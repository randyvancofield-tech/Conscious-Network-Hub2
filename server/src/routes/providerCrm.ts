import { Request, Response, Router } from 'express';
import {
  ProviderAuthenticatedRequest,
  requireProviderScope,
  requireProviderSession,
} from '../providerMiddleware';
import {
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  getProviderCrmTool,
  isProviderCrmSoleAdmin,
  listProviderCrmToolsForRole,
  setProviderCrmToolVisibility,
} from '../services/providerCrm';
import {
  ProviderCrmWorkspaceScope,
  buildProviderCrmWorkspace,
  createProviderCrmRecord,
  createRoundtableReservation,
} from '../services/providerCrmWorkspaceStore';
import { localStore } from '../services/persistenceStore';
import { recordAuditEvent } from '../services/auditTelemetry';

const router = Router();

router.use(requireProviderSession);

const getProviderRequestContext = (req: Request): ProviderAuthenticatedRequest =>
  req as ProviderAuthenticatedRequest;

const getCurrentProviderUser = async (req: Request) => {
  const providerReq = getProviderRequestContext(req);
  const userId = String(providerReq.providerUserId || '').trim();
  return userId ? localStore.getUserById(userId) : null;
};

const getWorkspaceScope = async (req: Request): Promise<ProviderCrmWorkspaceScope | null> => {
  const providerReq = getProviderRequestContext(req);
  const providerUserId = String(providerReq.providerUserId || '').trim();
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerUserId || !providerDid) return null;

  const user = await getCurrentProviderUser(req);
  return {
    role: providerReq.providerRole === 'admin' ? 'admin' : 'provider',
    providerUserId,
    providerDid,
    providerDisplayName:
      String(user?.name || user?.handle || user?.email || 'Verified Provider').trim() || 'Verified Provider',
  };
};

const requireSoleProviderCrmAdmin = async (
  req: Request,
  res: Response
): Promise<boolean> => {
  const providerReq = getProviderRequestContext(req);
  if (providerReq.providerRole !== 'admin') {
    res.status(403).json({ error: 'Provider CRM admin controls require admin role' });
    return false;
  }

  const user = await getCurrentProviderUser(req);
  if (!isProviderCrmSoleAdmin(user)) {
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'admin_access',
      outcome: 'deny',
      actorUserId: providerReq.providerUserId || null,
      statusCode: 403,
      metadata: {
        reason: 'provider_crm_sole_admin_required',
        requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      },
    });
    res.status(403).json({
      error: 'Provider CRM admin controls are limited to the configured sole administrator',
      requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    });
    return false;
  }

  return true;
};

router.get('/tools', requireProviderScope('provider:read'), (req: Request, res: Response): void => {
  const providerReq = getProviderRequestContext(req);
  const role = providerReq.providerRole === 'admin' ? 'admin' : 'provider';
  const tools = listProviderCrmToolsForRole(role);

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'tool_visibility_list',
    outcome: 'success',
    actorUserId: providerReq.providerUserId || null,
    targetUserId: providerReq.providerUserId || null,
    statusCode: 200,
    metadata: {
      role,
      visibleTools: tools.length,
      providerSessionId: providerReq.providerSessionId || null,
    },
  });

  res.json({
    success: true,
    role,
    tools,
  });
});

router.get('/summary', requireProviderScope('provider:read'), (req: Request, res: Response): void => {
  const providerReq = getProviderRequestContext(req);
  const role = providerReq.providerRole === 'admin' ? 'admin' : 'provider';
  const tools = listProviderCrmToolsForRole(role);

  res.json({
    success: true,
    role,
    did: providerReq.providerDid,
    sessionId: providerReq.providerSessionId,
    summary: {
      activeToolCount: tools.filter((tool) => tool.enabled).length,
      shellStatus: 'crm-workspace-foundation',
      dataModelsEnabled: true,
      notesEnabled: tools.some((tool) => tool.id === 'notes' && tool.enabled),
      relationshipManagementEnabled: true,
      analyticsEnabled: tools.some((tool) => tool.id === 'analytics' && tool.enabled),
    },
  });
});

router.get('/workspace', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getWorkspaceScope(req);
  if (!scope) {
    res.status(400).json({ error: 'Missing provider workspace identity context' });
    return;
  }

  const timezone = String(req.query.timezone || 'UTC').trim() || 'UTC';
  const workspace = await buildProviderCrmWorkspace(scope, timezone);
  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_crm_workspace_read',
    outcome: 'success',
    actorUserId: scope.providerUserId,
    targetUserId: scope.providerUserId,
    statusCode: 200,
    metadata: {
      role: scope.role,
      visibility: workspace.scope.visibility,
      recordCount: workspace.records.length,
      roundtableReservationCount: workspace.roundtable.reservations.length,
    },
  });

  res.json({
    success: true,
    workspace,
  });
});

router.post('/records', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getWorkspaceScope(req);
  if (!scope) {
    res.status(400).json({ error: 'Missing provider workspace identity context' });
    return;
  }

  const record = await createProviderCrmRecord(scope, req.body || {});
  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_crm_record_create',
    outcome: 'success',
    actorUserId: scope.providerUserId,
    targetUserId: scope.providerUserId,
    statusCode: 201,
    metadata: {
      role: scope.role,
      recordId: record.id,
      kind: record.kind,
      status: record.status,
      priority: record.priority,
    },
  });

  res.status(201).json({
    success: true,
    record,
  });
});

router.post(
  '/roundtable/reservations',
  requireProviderScope('provider:host'),
  async (req: Request, res: Response): Promise<void> => {
    const scope = await getWorkspaceScope(req);
    if (!scope) {
      res.status(400).json({ error: 'Missing provider workspace identity context' });
      return;
    }

    try {
      const reservation = await createRoundtableReservation(scope, req.body || {});
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'provider_crm_roundtable_reserve',
        outcome: 'success',
        actorUserId: scope.providerUserId,
        targetUserId: scope.providerUserId,
        statusCode: 201,
        metadata: {
          role: scope.role,
          reservationId: reservation.id,
          roomNumber: reservation.roomNumber,
          meetingSessionId: reservation.meetingSessionId,
        },
      });

      res.status(201).json({
        success: true,
        reservation,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'ROUNDTABLE_SLOT_UNAVAILABLE') {
        res.status(409).json({ error: 'Conscious Roundtable room is already reserved for that hour' });
        return;
      }
      throw error;
    }
  }
);

router.get('/admin/foundation', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireSoleProviderCrmAdmin(req, res))) return;

  const soleAdminUser = await localStore.getUserByEmail(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
  const providerReq = getProviderRequestContext(req);

  res.json({
    success: true,
    soleAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    soleAdminUserExists: Boolean(soleAdminUser),
    soleAdminUserRole: soleAdminUser?.role || null,
    soleAdminUserIsAdmin: soleAdminUser?.role === 'admin',
    currentAdminUserId: providerReq.providerUserId || null,
    seedPath: {
      script: 'npm --prefix server run admin:ensure-provider-crm',
      requiresEnv: ['PROVIDER_CRM_ADMIN_INITIAL_PASSWORD'],
      storesCredentialsInCode: false,
      createsAdditionalAdmins: false,
    },
  });
});

router.get('/admin/tools', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireSoleProviderCrmAdmin(req, res))) return;

  const tools = listProviderCrmToolsForRole('admin');
  res.json({
    success: true,
    soleAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    visibilityControl: {
      source: 'server-registry-runtime-overrides',
      persistentStorage: false,
      envOverrides: ['PROVIDER_CRM_ENABLED_TOOLS', 'PROVIDER_CRM_DISABLED_TOOLS'],
    },
    tools,
  });
});

router.patch('/admin/tools/:toolId', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireSoleProviderCrmAdmin(req, res))) return;

  const tool = getProviderCrmTool(req.params.toolId);
  if (!tool) {
    res.status(404).json({ error: 'Provider CRM tool not found' });
    return;
  }

  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled boolean is required' });
    return;
  }

  const updated = setProviderCrmToolVisibility(tool.id, enabled);
  const providerReq = getProviderRequestContext(req);
  recordAuditEvent(req, {
    domain: 'admin',
    action: 'tool_visibility_update',
    outcome: 'success',
    actorUserId: providerReq.providerUserId || null,
    targetUserId: providerReq.providerUserId || null,
    statusCode: 200,
    metadata: {
      toolId: tool.id,
      enabled,
      persistence: 'runtime_only',
    },
  });

  res.json({
    success: true,
    tool: updated,
    visibilityControl: {
      source: 'runtime_override',
      persistentStorage: false,
    },
  });
});

router.get('/admin/oversight', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireSoleProviderCrmAdmin(req, res))) return;

  res.json({
    success: true,
    oversight: {
      status: 'phase-1-shell',
      providerAssistanceEnabled: true,
      queues: [
        { id: 'tool-visibility', label: 'Tool Visibility', status: 'available' },
        { id: 'provider-support', label: 'Provider Support', status: 'shell' },
        { id: 'escalations', label: 'Admin Support/Escalation', status: 'shell' },
      ],
    },
  });
});

export default router;
