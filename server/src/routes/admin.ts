import { Router, Request, Response } from 'express';
import {
  createAdminElevationToken,
  verifyPassword,
} from '../auth';
import {
  getAuthenticatedRole,
  getAuthenticatedSessionId,
  getAuthenticatedUserId,
  requireAdminElevation,
  requireAdminRole,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  adminElevationSchema,
  adminRoleUpdateSchema,
} from '../validation/requestSchemas';
import {
  PROVIDER_APPLICANT_STATUSES,
  getProviderApplicantById,
  listProviderApplicants,
  updateProviderApplicantReview,
} from '../services/providerApplicantStore';

const router = Router();

type AdminVisibleRole = 'user' | 'applicant' | 'provider' | 'admin';

const normalizeRole = (value: unknown): AdminVisibleRole | null => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'user' || role === 'applicant' || role === 'provider' || role === 'admin') return role;
  return null;
};

const hasConfiguredElevationCode = (): boolean =>
  String(process.env.ADMIN_ELEVATION_CODE || '').trim().length > 0;

const isElevationCodeValid = (value: unknown): boolean => {
  const expected = String(process.env.ADMIN_ELEVATION_CODE || '').trim();
  const provided = String(value || '').trim();
  return Boolean(expected && provided && expected === provided);
};

const toAdminUserSummary = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  role: normalizeRole(user.role) || 'user',
  tier: user.tier || null,
  subscriptionStatus: user.subscriptionStatus || null,
  providerApprovalStatus: user.providerApprovalStatus || null,
  providerApproved: user.providerApproved === true,
  twoFactorMethod: user.twoFactorMethod || 'none',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

router.use(requireCanonicalIdentity);
router.use(requireAdminRole);

router.post(
  '/elevate',
  validateJsonBody(adminElevationSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    if (!actorUserId) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'elevation',
        outcome: 'deny',
        statusCode: 401,
        metadata: { reason: 'missing_authentication' },
      });
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await localStore.getUserById(actorUserId);
    if (!user || getAuthenticatedRole(req) !== 'admin') {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'elevation',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: { reason: 'admin_role_required' },
      });
      res.status(403).json({ error: 'Admin role required' });
      return;
    }

    const password = String(req.body?.password || '');
    const passwordValid = Boolean(password && verifyPassword(password, user.password));
    const codeValid = isElevationCodeValid(req.body?.elevationCode);
    if (!passwordValid && !codeValid) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'elevation',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: {
          reason: 'elevation_factor_invalid',
          configuredCodeAvailable: hasConfiguredElevationCode(),
        },
      });
      res.status(403).json({
        error: hasConfiguredElevationCode()
          ? 'Admin elevation requires account password or elevation code'
          : 'Admin elevation requires account password',
      });
      return;
    }

    const elevated = createAdminElevationToken(actorUserId, {
      sessionId: getAuthenticatedSessionId(req),
    });

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'elevation',
      outcome: 'success',
      actorUserId,
      targetUserId: actorUserId,
      statusCode: 200,
      metadata: {
        method: codeValid ? 'elevation_code' : 'password',
        expiresAt: new Date(elevated.expiresAt).toISOString(),
      },
    });

    res.json({
      success: true,
      elevationToken: elevated.token,
      expiresAt: elevated.expiresAt,
    });
  }
);

router.use(requireAdminElevation);

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const users = await localStore.listUsers(500);
  const roleCounts = users.reduce(
    (counts, user) => {
      const role = normalizeRole(user.role) || 'user';
      counts[role] += 1;
      return counts;
    },
    { user: 0, applicant: 0, provider: 0, admin: 0 }
  );

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'dashboard_view',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: {
      visibleUsers: users.length,
      roleCounts,
    },
  });

  res.json({
    success: true,
    roleModel: {
      guest: ['public:read'],
      member: ['self:read', 'self:update', 'courses:enroll', 'social:write', 'meetings:join'],
      applicant: ['provider-application:read'],
      admin: ['platform:read', 'users:read', 'roles:update', 'audit:read'],
    },
    summary: {
      usersTotal: users.length,
      roleCounts,
      activeMemberships: users.filter((user) => user.subscriptionStatus === 'active').length,
      providerApproved: users.filter((user) => user.providerApproved === true).length,
    },
    recentUsers: users.slice(0, 50).map(toAdminUserSummary),
  });
});

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const limit = Math.min(Math.max(Number(req.query.limit || 250), 1), 500);
  const users = await localStore.listUsers(limit);

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'users_list',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: { limit, returned: users.length },
  });

  res.json({
    success: true,
    users: users.map(toAdminUserSummary),
  });
});

router.get('/provider-applicants', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const status = String(req.query.status || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit || 250), 1), 500);
  const applicants = await listProviderApplicants({
    status: PROVIDER_APPLICANT_STATUSES.includes(status as any) ? status : undefined,
    limit,
  });

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_applicants_list',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: { status: status || null, returned: applicants.length },
  });

  res.json({
    success: true,
    statuses: PROVIDER_APPLICANT_STATUSES,
    applicants,
  });
});

router.get('/provider-applicants/:id', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const id = String(req.params.id || '').trim();
  const applicant = await getProviderApplicantById(id);
  if (!applicant) {
    res.status(404).json({ error: 'Provider applicant not found' });
    return;
  }

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_applicant_view',
    outcome: 'success',
    actorUserId,
    targetUserId: applicant.userId,
    statusCode: 200,
    metadata: { applicantId: applicant.id, status: applicant.status },
  });

  res.json({ success: true, applicant });
});

router.patch('/provider-applicants/:id', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const id = String(req.params.id || '').trim();
  const status = String(req.body?.status || '').trim().toLowerCase();
  const adminNotes =
    req.body?.adminNotes === undefined ? undefined : String(req.body?.adminNotes || '').trim();

  if (status && !PROVIDER_APPLICANT_STATUSES.includes(status as any)) {
    res.status(400).json({ error: 'Invalid provider applicant status' });
    return;
  }

  const existing = await getProviderApplicantById(id);
  if (!existing) {
    res.status(404).json({ error: 'Provider applicant not found' });
    return;
  }

  const updated = await updateProviderApplicantReview(id, {
    ...(status ? { status } : {}),
    ...(adminNotes !== undefined ? { adminNotes } : {}),
    reviewedAt: new Date(),
  });

  if (status === 'approved') {
    await localStore.updateUser(existing.userId, {
      role: 'provider',
      providerApproved: true,
      providerApprovalStatus: 'approved',
      providerAccessUpdatedAt: new Date(),
    });
  }

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'provider_applicant_update',
    outcome: 'success',
    actorUserId,
    targetUserId: existing.userId,
    statusCode: 200,
    metadata: {
      applicantId: id,
      previousStatus: existing.status,
      nextStatus: updated.status,
      adminNotesUpdated: adminNotes !== undefined,
      nativeProviderAccessGranted: status === 'approved',
    },
  });

  res.json({ success: true, applicant: updated });
});

router.patch(
  '/users/:id/role',
  validateJsonBody(adminRoleUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const targetUserId = String(req.params.id || '').trim();
    const nextRole = normalizeRole(req.body?.role);
    const reason = String(req.body?.reason || '').trim() || null;

    if (!actorUserId || !targetUserId || !nextRole) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 400,
        metadata: { reason: 'invalid_role_change_request' },
      });
      res.status(400).json({ error: 'Valid target user and role are required' });
      return;
    }

    if (actorUserId === targetUserId) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 400,
        metadata: { reason: 'self_role_change_denied' },
      });
      res.status(400).json({ error: 'Admins cannot change their own role' });
      return;
    }

    const target = await localStore.getUserById(targetUserId);
    if (!target) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 404,
        metadata: { reason: 'target_user_not_found' },
      });
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    const previousRole = normalizeRole(target.role) || 'user';
    const updated = await localStore.updateUser(targetUserId, {
      role: nextRole,
      ...(nextRole === 'provider'
        ? {
            providerApproved: target.providerApproved,
            providerApprovalStatus: target.providerApprovalStatus || 'pending',
            providerAccessUpdatedAt: new Date(),
          }
        : {}),
    });

    if (!updated) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'error',
        actorUserId,
        targetUserId,
        statusCode: 500,
        metadata: { reason: 'role_update_failed' },
      });
      res.status(500).json({ error: 'Failed to update user role' });
      return;
    }

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'role_change',
      outcome: 'success',
      actorUserId,
      targetUserId,
      statusCode: 200,
      metadata: {
        previousRole,
        nextRole,
        reason,
      },
    });

    res.json({
      success: true,
      user: toAdminUserSummary(updated),
    });
  }
);

export default router;
