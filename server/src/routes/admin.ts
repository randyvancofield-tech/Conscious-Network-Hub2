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
import emailService from '../services/emailService';
import { buildProviderApplicantStatusEmail } from '../services/emailTemplates';
import { createNotification } from '../services/notificationStore';
import { localStore, type LocalUserRecord } from '../services/persistenceStore';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  adminElevationSchema,
  adminRoleUpdateSchema,
  adminUserDeleteSchema,
  adminUserLockSchema,
} from '../validation/requestSchemas';
import {
  PROVIDER_APPLICANT_STATUSES,
  getProviderApplicantById,
  listProviderApplicants,
  updateProviderApplicantReview,
} from '../services/providerApplicantStore';
import {
  markProviderAccessApproved,
  revokeProviderAccessForUser,
} from '../services/providerAccess';
import { getPrisma } from '../services/prismaClient';
import { revokeProviderSessionsByDid } from '../services/providerSessionStore';
import { revokeUserSessionsByUserId } from '../services/userSessionStore';

const router = Router();
const PROVIDER_APPLICANT_CALENDLY_URL =
  'https://calendly.com/randycofield/buildingconnections';
const ADMIN_PROFILE_LOCK_MS = 10 * 365 * 24 * 60 * 60 * 1000;

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
  lockoutUntil: user.lockoutUntil || null,
  locked:
    user.lockoutUntil instanceof Date
      ? user.lockoutUntil.getTime() > Date.now()
      : Boolean(user.lockoutUntil && new Date(user.lockoutUntil).getTime() > Date.now()),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const providerDidForUser = (userId: string): string => `provider:${userId}`;
const userDidForUser = (userId: string): string => `user:${userId}`;

const accessDidsForUser = (userId: string): string[] => [
  userDidForUser(userId),
  providerDidForUser(userId),
];

const isAdminTarget = (user: LocalUserRecord): boolean => normalizeRole(user.role) === 'admin';

const revokeAllAccessForUser = async (
  userId: string
): Promise<{ userSessionsRevoked: number; providerSessionsRevoked: number }> => {
  const [userSessionsRevoked, providerSessionsRevoked] = await Promise.all([
    revokeUserSessionsByUserId(userId),
    revokeProviderSessionsByDid(providerDidForUser(userId)),
  ]);
  return { userSessionsRevoked, providerSessionsRevoked };
};

const deleteUserAndDetachedAccess = async (
  target: LocalUserRecord
): Promise<{
  providerSessionsDeleted: number;
  providerChallengesDeleted: number;
  providerInviteGroupsDeleted: number;
  meetingSessionsDeleted: number;
  aiInteractionsDeleted: number;
  legacyLaunchesDeleted: number;
}> => {
  const db = getPrisma();
  const dids = accessDidsForUser(target.id);
  return db.$transaction(async (tx) => {
    const providerSessionsDeleted = await tx.providerSession.deleteMany({
      where: { did: { in: dids } },
    });
    const providerChallengesDeleted = await tx.providerChallenge.deleteMany({
      where: { did: { in: dids } },
    });
    const providerInviteGroupsDeleted = await tx.providerInviteGroup.deleteMany({
      where: { did: { in: dids } },
    });
    const meetingSessionsDeleted = await tx.meetingSession.deleteMany({
      where: { providerId: target.id },
    });
    const aiInteractionsDeleted = await tx.aiInteraction.deleteMany({
      where: { userId: target.id },
    });
    const legacyLaunchesDeleted = await tx.providerBridgeLaunch.deleteMany({
      where: {
        OR: [
          { providerId: target.id },
          { email: target.email },
        ],
      },
    });
    await tx.user.delete({ where: { id: target.id } });

    return {
      providerSessionsDeleted: providerSessionsDeleted.count,
      providerChallengesDeleted: providerChallengesDeleted.count,
      providerInviteGroupsDeleted: providerInviteGroupsDeleted.count,
      meetingSessionsDeleted: meetingSessionsDeleted.count,
      aiInteractionsDeleted: aiInteractionsDeleted.count,
      legacyLaunchesDeleted: legacyLaunchesDeleted.count,
    };
  });
};

const denyProtectedUserMutation = (
  req: Request,
  res: Response,
  options: {
    action: string;
    actorUserId: string | null;
    targetUserId: string;
    target: LocalUserRecord;
  }
): boolean => {
  const { action, actorUserId, targetUserId, target } = options;
  if (actorUserId === targetUserId) {
    recordAuditEvent(req, {
      domain: 'admin',
      action,
      outcome: 'deny',
      actorUserId,
      targetUserId,
      statusCode: 400,
      metadata: { reason: 'self_mutation_denied' },
    });
    res.status(400).json({ error: 'Admins cannot lock, unlock, or delete their own profile' });
    return true;
  }

  if (isAdminTarget(target)) {
    recordAuditEvent(req, {
      domain: 'admin',
      action,
      outcome: 'deny',
      actorUserId,
      targetUserId,
      statusCode: 403,
      metadata: { reason: 'admin_target_protected' },
    });
    res.status(403).json({ error: 'Admin profiles are protected from lock/delete console actions' });
    return true;
  }

  return false;
};

const resolveFrontendBaseUrl = (req: Request): string => {
  const configured = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'https';
  return `${proto}://${req.get('host')}`.replace(/\/+$/, '');
};

const buildFrontendUrl = (req: Request, path: string): string => {
  const base = resolveFrontendBaseUrl(req);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const formatApplicantStatus = (status: unknown): string => {
  const normalized = String(status || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under review',
    discovery_scheduled: 'Discovery scheduled',
    approved: 'Approved',
    rejected: 'Not approved',
    needs_more_info: 'More information requested',
  };
  return labels[normalized] || 'Updated';
};

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
      provider: ['provider-session:request-after-approval', 'provider-crm:use-after-wallet'],
      admin: ['platform:read', 'users:read', 'roles:update', 'audit:read'],
    },
    summary: {
      usersTotal: users.length,
      roleCounts,
      activeMemberships: users.filter((user) => user.subscriptionStatus === 'active').length,
      providerApproved: users.filter((user) => user.providerApproved === true).length,
    },
    recentUsers: users.slice(0, 500).map(toAdminUserSummary),
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

router.post(
  '/users/:id/lock',
  validateJsonBody(adminUserLockSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const targetUserId = String(req.params.id || '').trim();
    const reason = String(req.body?.reason || '').trim() || 'Admin console lock';

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user is required' });
      return;
    }

    const target = await localStore.getUserById(targetUserId);
    if (!target) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'user_lock',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 404,
        metadata: { reason: 'target_user_not_found' },
      });
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    if (denyProtectedUserMutation(req, res, {
      action: 'user_lock',
      actorUserId,
      targetUserId,
      target,
    })) {
      return;
    }

    const lockoutUntil = new Date(Date.now() + ADMIN_PROFILE_LOCK_MS);
    const updated = await localStore.updateUser(targetUserId, {
      lockoutUntil,
      failedSignInAttempts: 0,
    });
    if (!updated) {
      res.status(500).json({ error: 'Failed to lock target user' });
      return;
    }

    const revoked = await revokeAllAccessForUser(targetUserId);
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'user_lock',
      outcome: 'success',
      actorUserId,
      targetUserId,
      statusCode: 200,
      metadata: {
        reason,
        lockoutUntil: lockoutUntil.toISOString(),
        ...revoked,
      },
    });

    res.json({
      success: true,
      user: toAdminUserSummary(updated),
      accessRevoked: revoked,
    });
  }
);

router.post(
  '/users/:id/unlock',
  validateJsonBody(adminUserLockSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const targetUserId = String(req.params.id || '').trim();
    const reason = String(req.body?.reason || '').trim() || 'Admin console unlock';

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user is required' });
      return;
    }

    const target = await localStore.getUserById(targetUserId);
    if (!target) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'user_unlock',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 404,
        metadata: { reason: 'target_user_not_found' },
      });
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    if (denyProtectedUserMutation(req, res, {
      action: 'user_unlock',
      actorUserId,
      targetUserId,
      target,
    })) {
      return;
    }

    const updated = await localStore.updateUser(targetUserId, {
      lockoutUntil: null,
      failedSignInAttempts: 0,
    });
    if (!updated) {
      res.status(500).json({ error: 'Failed to unlock target user' });
      return;
    }

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'user_unlock',
      outcome: 'success',
      actorUserId,
      targetUserId,
      statusCode: 200,
      metadata: { reason },
    });

    res.json({
      success: true,
      user: toAdminUserSummary(updated),
    });
  }
);

router.delete(
  '/users/:id',
  validateJsonBody(adminUserDeleteSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const targetUserId = String(req.params.id || '').trim();
    const reason = String(req.body?.reason || '').trim() || 'Admin console delete';

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user is required' });
      return;
    }

    const target = await localStore.getUserById(targetUserId);
    if (!target) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'user_delete',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 404,
        metadata: { reason: 'target_user_not_found' },
      });
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    if (denyProtectedUserMutation(req, res, {
      action: 'user_delete',
      actorUserId,
      targetUserId,
      target,
    })) {
      return;
    }

    try {
      const deleted = await deleteUserAndDetachedAccess(target);
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'user_delete',
        outcome: 'success',
        actorUserId,
        targetUserId,
        statusCode: 200,
        metadata: {
          reason,
          targetEmail: target.email,
          ...deleted,
        },
      });

      res.json({
        success: true,
        deletedUserId: targetUserId,
        deleted,
      });
    } catch (error) {
      console.error('[Admin] user delete failed', error);
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'user_delete',
        outcome: 'error',
        actorUserId,
        targetUserId,
        statusCode: 500,
        metadata: { reason: 'delete_failed' },
      });
      res.status(500).json({ error: 'Failed to delete target user' });
    }
  }
);

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
  const applicantMessage =
    req.body?.applicantMessage === undefined
      ? undefined
      : String(req.body?.applicantMessage || '').trim().slice(0, 2000);
  const sendEmail = req.body?.sendEmail === undefined ? true : req.body?.sendEmail === true;

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

  let providerAccessChange:
    | { granted: true; revokedSessions?: never }
    | { granted: false; revokedSessions: number }
    | null = null;

  if (status === 'approved') {
    await localStore.updateUser(existing.userId, {
      role: 'provider',
      providerApproved: true,
      providerApprovalStatus: 'approved',
      providerRevokedAt: null,
      providerAccessUpdatedAt: new Date(),
    });
    await markProviderAccessApproved(existing.userId);
    providerAccessChange = { granted: true };
  } else if (status) {
    const targetUser = await localStore.getUserById(existing.userId);
    if (targetUser?.providerApproved || targetUser?.providerApprovalStatus === 'approved') {
      const revoked = await revokeProviderAccessForUser(targetUser, {
        approvalStatus: status,
      });
      providerAccessChange = {
        granted: false,
        revokedSessions: revoked.providerSessionsRevoked + revoked.userSessionsRevoked,
      };
    } else if (targetUser) {
      await localStore.updateUser(existing.userId, {
        providerApproved: false,
        providerApprovalStatus: status,
        providerRevokedAt: null,
        providerAccessUpdatedAt: new Date(),
      });
    }
  }

  const nextStatus = status || updated.status;
  const targetUser = await localStore.getUserById(existing.userId);
  const shouldNotifyApplicant = Boolean(status) || Boolean(applicantMessage);
  const shouldSendStatusEmail = sendEmail && shouldNotifyApplicant;
  let applicantEmailResult: Awaited<ReturnType<typeof emailService.send>> | null = null;
  if (shouldSendStatusEmail) {
    const applicantEmail = buildProviderApplicantStatusEmail({
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      providerCategory: updated.providerCategory,
      status: nextStatus,
      frontendBaseUrl: resolveFrontendBaseUrl(req),
      applicantPortalUrl: buildFrontendUrl(req, '/provider/applicant-sign-in'),
      providerAccessUrl: buildFrontendUrl(req, '/provider-access'),
      calendlyUrl: PROVIDER_APPLICANT_CALENDLY_URL,
      applicantMessage,
    });
    applicantEmailResult = await emailService.send({
      to: updated.email,
      ...applicantEmail,
    });
  }

  if (shouldNotifyApplicant) {
    await createNotification({
      userId: existing.userId,
      type: nextStatus === 'approved' ? 'provider_application_approved' : 'provider_application_status',
      title:
        nextStatus === 'approved'
          ? 'Provider application approved'
          : 'Provider application status updated',
      body:
        nextStatus === 'approved'
          ? 'Your provider account has been approved. Sign in through Provider Access and complete wallet verification to open provider tools.'
          : applicantMessage ||
            `Your provider application status is now ${formatApplicantStatus(nextStatus)}.`,
      roleScope:
        nextStatus === 'approved'
          ? 'provider'
          : targetUser?.role === 'provider'
          ? 'provider'
          : 'applicant',
      metadata: {
        applicantId: id,
        previousStatus: existing.status,
        nextStatus,
        emailSkipped: Boolean(applicantEmailResult?.skipped),
        emailSent: applicantEmailResult?.ok === true && !applicantEmailResult?.skipped,
      },
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
      applicantMessageSent: Boolean(applicantMessage),
      statusEmailRequested: shouldSendStatusEmail,
      statusEmailSkipped: Boolean(applicantEmailResult?.skipped),
      nativeProviderAccessGranted: providerAccessChange?.granted === true,
      nativeProviderAccessRevoked: providerAccessChange?.granted === false,
      revokedSessions:
        providerAccessChange?.granted === false ? providerAccessChange.revokedSessions : 0,
    },
  });

  res.json({
    success: true,
    applicant: updated,
    communication: {
      emailConfigured: emailService.configured(),
      emailAttempted: shouldSendStatusEmail,
      emailSkipped: Boolean(applicantEmailResult?.skipped),
      emailSent: applicantEmailResult?.ok === true && !applicantEmailResult?.skipped,
    },
  });
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
