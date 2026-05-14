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
      shellStatus: 'phase-1-shell',
      dataModelsEnabled: false,
      notesEnabled: tools.some((tool) => tool.id === 'notes' && tool.enabled),
      relationshipManagementEnabled: false,
      analyticsEnabled: tools.some((tool) => tool.id === 'analytics' && tool.enabled),
    },
  });
});

router.get('/admin/foundation', async (req: Request, res: Response): Promise<void> => {
  if (!(await requireSoleProviderCrmAdmin(req, res))) return;

  const guidanceUser = await localStore.getUserByEmail(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
  const providerReq = getProviderRequestContext(req);

  res.json({
    success: true,
    soleAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    guidanceUserExists: Boolean(guidanceUser),
    guidanceUserRole: guidanceUser?.role || null,
    guidanceUserIsAdmin: guidanceUser?.role === 'admin',
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
