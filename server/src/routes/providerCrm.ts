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
  buildProviderCrmAnalytics,
  createProviderCrmCollaboration,
  createProviderCrmContentItem,
  createProviderCrmFollowUp,
  createProviderCrmNote,
  createProviderCrmRecord,
  createRoundtableReservation,
  deleteProviderCrmCollaboration,
  deleteProviderCrmFollowUp,
  deleteProviderCrmNote,
  listProviderCrmCollaborations,
  listProviderCrmContentItems,
  listProviderCrmFollowUps,
  listProviderCrmNotes,
  updateProviderCrmCollaboration,
  updateProviderCrmContentItem,
  updateProviderCrmFollowUp,
  updateProviderCrmNote,
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

const getRequiredWorkspaceScope = async (req: Request, res: Response): Promise<ProviderCrmWorkspaceScope | null> => {
  const scope = await getWorkspaceScope(req);
  if (!scope) {
    res.status(400).json({ error: 'Missing provider workspace identity context' });
    return null;
  }
  return scope;
};

const handleProviderCrmError = (res: Response, error: unknown): boolean => {
  if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
    const field = error.message.slice('VALIDATION:'.length) || 'field';
    res.status(400).json({ error: `${field} is required` });
    return true;
  }
  return false;
};

const sendNotFound = (res: Response, noun: string): void => {
  res.status(404).json({ error: `${noun} not found` });
};

const auditCrmMutation = (
  req: Request,
  scope: ProviderCrmWorkspaceScope,
  action: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
): void => {
  recordAuditEvent(req, {
    domain: 'admin',
    action,
    outcome: 'success',
    actorUserId: scope.providerUserId,
    targetUserId: scope.providerUserId,
    statusCode: 200,
    metadata: {
      role: scope.role,
      targetId,
      ...metadata,
    },
  });
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
      shellStatus: 'crm-launch-workspace',
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

router.get('/notes', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const notes = await listProviderCrmNotes(scope);
  res.json({ success: true, notes });
});

router.post('/notes', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const note = await createProviderCrmNote(scope, req.body || {});
    auditCrmMutation(req, scope, 'provider_crm_note_create', note.id, { status: note.status });
    res.status(201).json({ success: true, note });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.patch('/notes/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const note = await updateProviderCrmNote(scope, req.params.id, req.body || {});
    if (!note) {
      sendNotFound(res, 'CRM note');
      return;
    }
    auditCrmMutation(req, scope, 'provider_crm_note_update', note.id, { status: note.status });
    res.json({ success: true, note });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.delete('/notes/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const deleted = await deleteProviderCrmNote(scope, req.params.id);
  if (!deleted) {
    sendNotFound(res, 'CRM note');
    return;
  }
  auditCrmMutation(req, scope, 'provider_crm_note_delete', req.params.id);
  res.json({ success: true });
});

router.get('/content', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const items = await listProviderCrmContentItems(scope);
  res.json({ success: true, items });
});

router.post('/content', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const item = await createProviderCrmContentItem(scope, req.body || {});
    auditCrmMutation(req, scope, 'provider_crm_content_create', item.id, { status: item.status });
    res.status(201).json({ success: true, item });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.patch('/content/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const item = await updateProviderCrmContentItem(scope, req.params.id, req.body || {});
    if (!item) {
      sendNotFound(res, 'CRM content item');
      return;
    }
    auditCrmMutation(req, scope, 'provider_crm_content_update', item.id, { status: item.status });
    res.json({ success: true, item });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.get('/collaboration', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const items = await listProviderCrmCollaborations(scope);
  res.json({ success: true, items });
});

router.post('/collaboration', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const item = await createProviderCrmCollaboration(scope, req.body || {});
    auditCrmMutation(req, scope, 'provider_crm_collaboration_create', item.id, { status: item.status });
    res.status(201).json({ success: true, item });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.patch('/collaboration/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const item = await updateProviderCrmCollaboration(scope, req.params.id, req.body || {});
    if (!item) {
      sendNotFound(res, 'CRM collaboration item');
      return;
    }
    auditCrmMutation(req, scope, 'provider_crm_collaboration_update', item.id, { status: item.status });
    res.json({ success: true, item });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.delete('/collaboration/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const deleted = await deleteProviderCrmCollaboration(scope, req.params.id);
  if (!deleted) {
    sendNotFound(res, 'CRM collaboration item');
    return;
  }
  auditCrmMutation(req, scope, 'provider_crm_collaboration_delete', req.params.id);
  res.json({ success: true });
});

router.get('/follow-ups', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const followUps = await listProviderCrmFollowUps(scope);
  res.json({ success: true, followUps });
});

router.post('/follow-ups', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const followUp = await createProviderCrmFollowUp(scope, req.body || {});
    auditCrmMutation(req, scope, 'provider_crm_follow_up_create', followUp.id, { status: followUp.status });
    res.status(201).json({ success: true, followUp });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.patch('/follow-ups/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  try {
    const followUp = await updateProviderCrmFollowUp(scope, req.params.id, req.body || {});
    if (!followUp) {
      sendNotFound(res, 'CRM follow-up');
      return;
    }
    auditCrmMutation(req, scope, 'provider_crm_follow_up_update', followUp.id, { status: followUp.status });
    res.json({ success: true, followUp });
  } catch (error) {
    if (handleProviderCrmError(res, error)) return;
    throw error;
  }
});

router.delete('/follow-ups/:id', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const deleted = await deleteProviderCrmFollowUp(scope, req.params.id);
  if (!deleted) {
    sendNotFound(res, 'CRM follow-up');
    return;
  }
  auditCrmMutation(req, scope, 'provider_crm_follow_up_delete', req.params.id);
  res.json({ success: true });
});

router.get('/analytics', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const scope = await getRequiredWorkspaceScope(req, res);
  if (!scope) return;
  const analytics = await buildProviderCrmAnalytics(scope);
  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_crm_analytics_read',
    outcome: 'success',
    actorUserId: scope.providerUserId,
    targetUserId: scope.providerUserId,
    statusCode: 200,
    metadata: {
      role: scope.role,
      visibility: analytics.scope.visibility,
    },
  });
  res.json({ success: true, analytics });
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
      status: 'launch-ready',
      providerAssistanceEnabled: true,
      queues: [
        { id: 'tool-visibility', label: 'Tool Visibility', status: 'available' },
        { id: 'provider-support', label: 'Provider Support', status: 'available' },
        { id: 'escalations', label: 'Admin Support/Escalation', status: 'available' },
      ],
    },
  });
});

export default router;
