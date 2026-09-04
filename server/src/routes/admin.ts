import { Router, Request, Response, NextFunction } from 'express';
import {
  createAdminElevationToken,
  verifyPassword,
} from '../auth';
import { verifyProviderSessionToken } from '../auth/providerToken';
import {
  getAuthenticatedRole,
  getAuthenticatedSessionId,
  getAuthenticatedUserId,
  requireAdminElevation,
  requireAdminRole,
  requireCanonicalIdentity,
} from '../middleware';
import { listRecentAuditEvents, recordAuditEvent } from '../services/auditTelemetry';
import emailService from '../services/emailService';
import { buildProviderApplicantStatusEmail } from '../services/emailTemplates';
import { createNotification } from '../services/notificationStore';
import { localStore, type LocalUserRecord } from '../services/persistenceStore';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  ADMIN_INBOX_RECIPIENT_EMAIL,
  getAdminMessageSummary,
  listAdminMessages,
  normalizeAdminMessageStatus,
  normalizeAdminMessageType,
  updateAdminMessage,
} from '../services/adminMessageStore';
import {
  adminElevationSchema,
  adminMessageUpdateSchema,
  adminRoleUpdateSchema,
  adminUserDeleteSchema,
  adminUserLockSchema,
} from '../validation/requestSchemas';
import {
  PROVIDER_APPLICANT_STATUSES,
  deleteProviderApplicantById,
  getProviderApplicantById,
  listProviderApplicants,
  type ProviderApplicantFileRef,
  updateProviderApplicantReview,
} from '../services/providerApplicantStore';
import { listConsciousCareerGrantApplications } from '../services/consciousCareerGrantStore';
import {
  markProviderAccessApproved,
  revokeProviderAccessForUser,
} from '../services/providerAccess';
import { getPrisma } from '../services/prismaClient';
import { normalizeCourseSyllabusMetadata } from '../services/courseMetadata';
import { getProviderSessionById, revokeProviderSessionsByDid } from '../services/providerSessionStore';
import { type SocialPostRecord, socialStore } from '../services/socialStore';
import {
  deleteUploadObjectByKey,
  getUploadObjectAccessMetadata,
  resolveUploadObjectByKey,
} from '../services/uploadBlobStore';
import {
  absolutizeBackendUrl,
  buildBackendUploadObjectUrl,
  extractUploadObjectKeyFromUrl,
} from '../services/publicUrl';
import { buildZipArchive, type ZipArchiveEntry } from '../services/zipArchive';
import { revokeUserSessionsByUserId } from '../services/userSessionStore';
import { hasTierAccess, TIER_VALUES, type TierValue } from '../tierPolicy';
import {
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  isProviderCrmSoleAdmin,
} from '../services/providerCrm';

const router = Router();
const PROVIDER_APPLICANT_CALENDLY_URL =
  'https://calendly.com/randycofield/buildingconnections';
const ADMIN_PROFILE_LOCK_MS = 10 * 365 * 24 * 60 * 60 * 1000;

type AdminVisibleRole = 'user' | 'provider' | 'admin';

const normalizeRole = (value: unknown): AdminVisibleRole | null => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin' || role === 'provider') return role;
  if (role === 'user' || role === 'applicant') return 'user';
  return null;
};

const toAdminSubmissionUser = (user: any) =>
  user
    ? {
        id: String(user.id || ''),
        email: String(user.email || ''),
        name: user.name || null,
        role: normalizeRole(user.role) || 'user',
        tier: user.tier || null,
      }
    : null;

const toAdminApplicantFileSummary = (file: any) =>
  file && typeof file === 'object'
    ? {
        originalName: file.originalName || null,
        mimeType: file.mimeType || null,
        sizeBytes: file.sizeBytes ?? null,
        storageProvider: file.storageProvider || null,
      }
    : null;

const toAdminProviderApplicantRecord = (applicant: any) => ({
  ...applicant,
  resumeFile: toAdminApplicantFileSummary(applicant?.resumeFile),
  coverLetterFile: toAdminApplicantFileSummary(applicant?.coverLetterFile),
});

const toAdminProviderApplicationSubmission = (applicant: any) => ({
  id: String(applicant.id || ''),
  type: 'provider_application',
  status: String(applicant.status || 'submitted'),
  submittedAt: applicant.submittedAt || applicant.createdAt || null,
  updatedAt: applicant.updatedAt || null,
  title: `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || applicant.email || 'Provider application',
  applicantName: `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || null,
  applicantEmail: applicant.email || null,
  category: applicant.providerCategory || null,
  summary: {
    phone: applicant.phone || null,
    communicationPreference: applicant.communicationPreference || null,
    organizationName: applicant.organizationName || null,
    professionalTitle: applicant.professionalTitle || null,
    website: applicant.website || null,
    serviceArea: applicant.serviceArea || null,
    availabilityMode: applicant.availabilityMode || null,
    experienceLevel: applicant.experienceLevel || null,
    yearsExperience: applicant.yearsExperience ?? null,
    practiceStatus: applicant.practiceStatus || null,
    availabilityToServe: applicant.availabilityToServe || null,
    credentialsText: applicant.credentialsText || null,
    licenseNumber: applicant.licenseNumber || null,
    issuingOrganization: applicant.issuingOrganization || null,
    professionalReferences: applicant.professionalReferences || null,
    servicesOffered: applicant.servicesOffered || [],
    populationsServed: applicant.populationsServed || [],
    targetAudience: applicant.targetAudience || null,
    alignmentAnswers: applicant.alignmentAnswers || {},
    integrityConsents: applicant.integrityConsents || {},
    adminNotes: applicant.adminNotes || null,
  },
  files: {
    resumeFile: toAdminApplicantFileSummary(applicant.resumeFile),
    coverLetterFile: toAdminApplicantFileSummary(applicant.coverLetterFile),
  },
  user: toAdminSubmissionUser(applicant.user),
});

const toAdminGrantApplicationSubmission = (application: any) => ({
  id: String(application.id || ''),
  type: 'grant_application',
  status: String(application.status || 'submitted'),
  submittedAt: application.submittedAt || application.createdAt || null,
  updatedAt: application.updatedAt || null,
  title: application.legalName || application.user?.name || application.user?.email || 'Grant application',
  applicantName: application.legalName || application.user?.name || null,
  applicantEmail: application.user?.email || null,
  category: application.applicantType || null,
  summary: {
    country: application.country || null,
    region: application.region || null,
    locality: application.locality || null,
    postalCode: application.postalCode || null,
    applicantType: application.applicantType || null,
    ventureStage: application.ventureStage || null,
    requestedAmountUsd: application.requestedAmountUsd ?? null,
    useOfFunds: application.useOfFunds || {},
    answers: application.answers || {},
  },
  files: {},
  user: toAdminSubmissionUser(application.user),
});

const hasConfiguredElevationCode = (): boolean =>
  String(process.env.ADMIN_ELEVATION_CODE || '').trim().length > 0;

const isElevationCodeValid = (value: unknown): boolean => {
  const expected = String(process.env.ADMIN_ELEVATION_CODE || '').trim();
  const provided = String(value || '').trim();
  return Boolean(expected && provided && expected === provided);
};

const readHeaderValue = (req: Request, name: string): string => {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
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

const normalizeEmail = (value: unknown): string => String(value || '').trim().toLowerCase();

const isSoleAdminEmail = (email: unknown): boolean =>
  normalizeEmail(email) === PROVIDER_CRM_SOLE_ADMIN_EMAIL;

const isAdminTarget = (user: LocalUserRecord): boolean =>
  normalizeRole(user.role) === 'admin' || isSoleAdminEmail(user.email);

const requireSoleFounderAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const actor = actorUserId ? await localStore.getUserById(actorUserId) : null;
  if (!isProviderCrmSoleAdmin(actor)) {
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'sole_founder_admin_access',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: {
        reason: 'sole_founder_admin_required',
        requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      },
    });
    res.status(403).json({
      error: 'Solo founder admin access required',
      requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    });
    return;
  }

  next();
};

const validateProviderControlElevation = async (
  actorUserId: string,
  token: string
): Promise<{ valid: boolean; reason: string; providerSessionId?: string }> => {
  const payload = verifyProviderSessionToken(token);
  if (!payload) return { valid: false, reason: 'invalid_provider_control_token' };

  const session = await getProviderSessionById(payload.sessionId);
  if (!session) return { valid: false, reason: 'provider_control_session_not_found' };
  if (session.revokedAt) return { valid: false, reason: 'provider_control_session_revoked' };
  if (session.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: 'provider_control_session_expired' };
  }
  if (session.did !== payload.did || session.did !== providerDidForUser(actorUserId)) {
    return { valid: false, reason: 'provider_control_identity_mismatch' };
  }
  if (!session.scopes.includes('provider:*')) {
    return { valid: false, reason: 'provider_control_scope_missing' };
  }

  return { valid: true, reason: 'provider_control_session_valid', providerSessionId: session.id };
};

const extractUploadObjectKey = (value: unknown): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (!raw.includes('/') && !raw.includes(':')) return raw;

  const marker = '/api/upload/object/';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    return decodeURIComponent(raw.slice(markerIndex + marker.length).split(/[?#]/)[0] || '').trim() || null;
  }

  return null;
};

const cleanupSocialPostMedia = async (post: SocialPostRecord): Promise<number> => {
  const cleanupKeys = new Set<string>();
  for (const media of post.media || []) {
    const objectKey = extractUploadObjectKey(media.objectKey) || extractUploadObjectKey(media.url);
    if (objectKey) cleanupKeys.add(objectKey);
  }

  for (const key of cleanupKeys) {
    try {
      await deleteUploadObjectByKey(key);
    } catch (cleanupError) {
      console.error('[Admin] Failed to clean up upload object after moderated post delete', cleanupError);
    }
  }

  return cleanupKeys.size;
};

const canonicalUploadObjectUrl = (req: Request, objectKey: string | null): string | null => {
  if (!objectKey) return null;
  const metadata = getUploadObjectAccessMetadata(objectKey);
  if (!metadata) return null;
  if (metadata.access === 'public') {
    return buildBackendUploadObjectUrl(req, objectKey, 'public');
  }
  if (metadata.access === 'private') {
    return buildBackendUploadObjectUrl(req, objectKey, 'private');
  }
  return null;
};

const absolutizeUploadAwareUrl = (
  req: Request,
  value: unknown,
  objectKey?: unknown
): string | null => {
  const resolvedObjectKey =
    extractUploadObjectKeyFromUrl(typeof objectKey === 'string' ? objectKey : null) ||
    extractUploadObjectKeyFromUrl(typeof value === 'string' ? value : null);
  return (
    canonicalUploadObjectUrl(req, resolvedObjectKey) ||
    absolutizeBackendUrl(req, typeof value === 'string' ? value : null) ||
    null
  );
};

const authorAvatarMediaForAdmin = (req: Request, author?: LocalUserRecord | null) => {
  const avatar = author?.profileMedia?.avatar && typeof author.profileMedia.avatar === 'object'
    ? author.profileMedia.avatar
    : null;
  const avatarRecord = avatar as Record<string, unknown> | null;
  const objectKey = avatar?.objectKey || null;
  return {
    url: absolutizeUploadAwareUrl(req, avatar?.url || author?.avatarUrl, objectKey),
    storageProvider:
      typeof avatar?.storageProvider === 'string'
        ? avatar.storageProvider.trim() || null
        : null,
    objectKey:
      typeof objectKey === 'string'
        ? objectKey.trim() || null
        : null,
    mimeType:
      typeof avatar?.mimeType === 'string'
        ? avatar.mimeType.trim().toLowerCase() || null
        : null,
    mediaType:
      typeof avatarRecord?.mediaType === 'string'
        ? avatarRecord.mediaType.trim().toLowerCase() || null
        : null,
  };
};

const toAdminSocialPostSummary = (
  req: Request,
  post: SocialPostRecord,
  author?: LocalUserRecord | null
) => {
  const authorAvatarMedia = authorAvatarMediaForAdmin(req, author);
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: author?.name || author?.handle || author?.email || 'Unknown user',
    authorEmail: author?.email || null,
    authorRole: author?.role || null,
    authorTier: author?.tier || null,
    authorAvatarUrl: authorAvatarMedia.url,
    authorAvatarMedia,
    text: post.text,
    visibility: post.visibility,
    mediaCount: post.media.length,
    likeCount: post.likeCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const courseTierToMembershipTier = (courseTier: unknown): TierValue => {
  const normalized = String(courseTier || '').trim().toLowerCase();
  if (normalized === 'elite' || normalized === 'accelerated tier') return TIER_VALUES.ACCELERATED;
  if (normalized === 'professional' || normalized === 'guided tier') return TIER_VALUES.GUIDED;
  return TIER_VALUES.FREE;
};

const isActiveMembershipStatus = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'active' || normalized === 'trialing';
};

const toAdminCourseEnrollmentSummary = (entry: any) => ({
  userId: entry.userId,
  userName: entry.user?.name || null,
  userEmail: entry.user?.email || null,
  userRole: normalizeRole(entry.user?.role) || 'user',
  userTier: entry.user?.tier || null,
  userMembershipStatus: entry.user?.membershipStatus || null,
  status: entry.status,
  progressScore: Number(entry.progressScore || 0),
  enrolledAt: entry.enrolledAt,
  updatedAt: entry.updatedAt,
});

const toAdminCourseSummary = (course: any) => {
  const metadata = normalizeCourseSyllabusMetadata(course.syllabus);
  const enrollments = Array.isArray(course.enrollments) ? course.enrollments : [];
  return {
    id: course.id,
    title: course.title,
    provider: course.provider,
    description: course.description,
    tier: course.tier,
    requiredMembershipTier: courseTierToMembershipTier(course.tier),
    status: course.status,
    ownerId: course.ownerId || null,
    ownerType: course.ownerType || null,
    ownerName: course.owner?.name || null,
    ownerEmail: course.owner?.email || null,
    ownerRole: normalizeRole(course.owner?.role) || null,
    enrolledCount: Number(course.enrolledCount || 0),
    actualEnrollmentCount: enrollments.length,
    category: metadata.category,
    estimatedDuration: metadata.estimatedDuration,
    contentSectionCount: metadata.contentSections.length,
    enrollments: enrollments.map(toAdminCourseEnrollmentSummary),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
};

const toCourseAssignableUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  role: normalizeRole(user.role) || 'user',
  tier: user.tier || null,
  membershipStatus: user.membershipStatus || null,
  subscriptionStatus: user.subscriptionStatus || null,
  providerApproved: user.providerApproved === true,
});

const syncAdminCourseEnrollmentCount = async (courseId: string): Promise<number> => {
  const db = getPrisma() as any;
  const enrolledCount = await db.userCourse.count({
    where: {
      courseId,
      status: { in: ['enrolled', 'completed'] },
    },
  });
  await db.course.update({
    where: { id: courseId },
    data: { enrolledCount },
  });
  return enrolledCount;
};

const verifyAdminAssignableCourseAccess = async (
  user: any,
  course: any
): Promise<{ allowed: true } | { allowed: false; error: string }> => {
  if (!user) return { allowed: false, error: 'Target user not found' };
  if (!course || course.status !== 'published') {
    return { allowed: false, error: 'Only published courses can be assigned to users' };
  }
  if (normalizeRole(user.role) === 'admin') return { allowed: true };

  const db = getPrisma() as any;
  const membership = await db.membership.findUnique({ where: { userId: user.id } });
  const hasActiveMembership =
    isActiveMembershipStatus(membership?.status) || isActiveMembershipStatus(user.membershipStatus);
  if (!hasActiveMembership) {
    return { allowed: false, error: 'Target user needs an active membership before course assignment' };
  }

  const requiredTier = courseTierToMembershipTier(course.tier);
  const effectiveTier = membership?.tier || user.tier || null;
  if (!hasTierAccess(effectiveTier, requiredTier)) {
    return { allowed: false, error: `Target user tier does not meet ${requiredTier}` };
  }

  return { allowed: true };
};

const buildAdminCourseGovernance = async () => {
  const db = getPrisma() as any;
  const [courses, users] = await Promise.all([
    db.course.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 250,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        enrollments: {
          orderBy: { updatedAt: 'desc' },
          take: 500,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                tier: true,
                membershipStatus: true,
              },
            },
          },
        },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        membershipStatus: true,
        subscriptionStatus: true,
        providerApproved: true,
      },
    }),
  ]);

  const providers = users
    .filter((user: any) => {
      const role = normalizeRole(user.role);
      return role === 'admin' || (role === 'provider' && user.providerApproved === true);
    })
    .map(toCourseAssignableUser);

  return {
    courses: courses.map(toAdminCourseSummary),
    providers,
    assignableUsers: users.map(toCourseAssignableUser),
  };
};

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

type ProviderApplicantDocumentType = 'resume' | 'cover-letter';
type ProviderApplicantDocumentDisposition = 'inline' | 'attachment';

const PROVIDER_APPLICATION_UPLOAD_CATEGORY = 'provider-application';
const PROVIDER_APPLICANT_DELETE_CONFIRMATION = 'DELETE PROVIDER SUBMISSION';
const PROVIDER_APPLICANT_DOCUMENT_TYPES: ProviderApplicantDocumentType[] = [
  'resume',
  'cover-letter',
];
const INLINE_PROVIDER_APPLICANT_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'text/plain']);
const PROVIDER_APPLICANT_DOCUMENT_LABELS: Record<ProviderApplicantDocumentType, string> = {
  resume: 'Resume',
  'cover-letter': 'Cover Letter',
};

const normalizeProviderApplicantDocumentType = (
  value: unknown
): ProviderApplicantDocumentType | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'resume' || normalized === 'cover-letter') return normalized;
  return null;
};

const normalizeProviderApplicantDocumentDisposition = (
  value: unknown
): ProviderApplicantDocumentDisposition | null => {
  const normalized = String(value || 'attachment').trim().toLowerCase();
  if (normalized === 'inline' || normalized === 'attachment') return normalized;
  return null;
};

const normalizeDocumentMimeType = (value: unknown): string => {
  const normalized = String(value || '').replace(/[\r\n\u0000-\u001F\u007F]/g, '').trim();
  return normalized || 'application/octet-stream';
};

const getDocumentMimeEssence = (mimeType: string): string =>
  mimeType.split(';')[0].trim().toLowerCase();

const canInlineProviderApplicantDocument = (mimeType: string): boolean =>
  INLINE_PROVIDER_APPLICANT_DOCUMENT_MIME_TYPES.has(getDocumentMimeEssence(mimeType));

const sanitizeProviderApplicantDocumentFilename = (
  value: unknown,
  fallback: string
): string => {
  const raw = String(value || fallback || '').trim();
  const basename = raw.split(/[\\/]/).filter(Boolean).pop() || fallback || 'document';
  return basename.replace(/[\r\n"\u0000-\u001F\u007F]/g, '_').trim() || fallback || 'document';
};

const buildProviderApplicantDocumentDisposition = (
  type: ProviderApplicantDocumentDisposition,
  filename: string
): string => {
  const safeFilename = sanitizeProviderApplicantDocumentFilename(filename, 'document');
  const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_');
  return `${type}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
};

const getProviderApplicantDocumentRef = (
  applicant: any,
  documentType: ProviderApplicantDocumentType
): ProviderApplicantFileRef | null => {
  const ref = documentType === 'resume' ? applicant?.resumeFile : applicant?.coverLetterFile;
  if (!ref || typeof ref !== 'object') return null;
  const objectKey = String((ref as Partial<ProviderApplicantFileRef>).objectKey || '').trim();
  if (!objectKey) return null;
  return ref as ProviderApplicantFileRef;
};

interface ValidatedProviderApplicantDocument {
  documentType: ProviderApplicantDocumentType;
  label: string;
  fileRef: ProviderApplicantFileRef;
  objectKey: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number | null;
}

const validateProviderApplicantDocument = (
  applicant: any,
  documentType: ProviderApplicantDocumentType
):
  | { ok: true; document: ValidatedProviderApplicantDocument }
  | { ok: false; statusCode: number; error: string; reason: string } => {
  const fileRef = getProviderApplicantDocumentRef(applicant, documentType);
  if (!fileRef) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Provider applicant document not found',
      reason: 'document_reference_missing',
    };
  }

  const objectKey = String(fileRef.objectKey || '').trim();
  const metadata = getUploadObjectAccessMetadata(objectKey);
  if (
    !metadata ||
    metadata.storageProvider !== 'postgres_large_object' ||
    metadata.access !== 'private' ||
    metadata.ownerUserId !== String(applicant.userId || '').trim() ||
    metadata.category !== PROVIDER_APPLICATION_UPLOAD_CATEGORY
  ) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Provider applicant document not found',
      reason: 'upload_object_metadata_mismatch',
    };
  }

  return {
    ok: true,
    document: {
      documentType,
      label: PROVIDER_APPLICANT_DOCUMENT_LABELS[documentType],
      fileRef,
      objectKey,
      mimeType: normalizeDocumentMimeType(fileRef.mimeType),
      originalName: sanitizeProviderApplicantDocumentFilename(
        fileRef.originalName,
        documentType === 'resume' ? 'resume' : 'cover-letter'
      ),
      sizeBytes: Number.isFinite(Number(fileRef.sizeBytes)) ? Number(fileRef.sizeBytes) : null,
    },
  };
};

const validateExistingProviderApplicantDocuments = (
  applicant: any
):
  | { ok: true; documents: ValidatedProviderApplicantDocument[] }
  | { ok: false; documentType: ProviderApplicantDocumentType; statusCode: number; error: string; reason: string } => {
  const documents: ValidatedProviderApplicantDocument[] = [];
  for (const documentType of PROVIDER_APPLICANT_DOCUMENT_TYPES) {
    if (!getProviderApplicantDocumentRef(applicant, documentType)) continue;
    const validation = validateProviderApplicantDocument(applicant, documentType);
    if (validation.ok === false) {
      return { ...validation, documentType };
    }
    documents.push(validation.document);
  }
  return { ok: true, documents };
};

const validateRequiredProviderApplicantDocuments = (
  applicant: any
):
  | { ok: true; documents: ValidatedProviderApplicantDocument[] }
  | { ok: false; documentType: ProviderApplicantDocumentType; statusCode: number; error: string; reason: string } => {
  const documents: ValidatedProviderApplicantDocument[] = [];
  for (const documentType of PROVIDER_APPLICANT_DOCUMENT_TYPES) {
    const validation = validateProviderApplicantDocument(applicant, documentType);
    if (validation.ok === false) {
      return { ...validation, documentType };
    }
    documents.push(validation.document);
  }
  return { ok: true, documents };
};

const extensionFromMimeType = (mimeType: string): string => {
  const essence = getDocumentMimeEssence(mimeType);
  if (essence === 'application/pdf') return '.pdf';
  if (essence === 'text/plain') return '.txt';
  if (essence === 'application/rtf') return '.rtf';
  if (essence === 'application/msword') return '.doc';
  if (essence === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '.docx';
  }
  return '';
};

const ensureFilenameHasExtension = (filename: string, mimeType: string): string => {
  const extension = extensionFromMimeType(mimeType);
  if (!extension || filename.toLowerCase().endsWith(extension)) return filename;
  if (/\.[a-z0-9]{1,8}$/i.test(filename)) return filename;
  return `${filename}${extension}`;
};

const sanitizeZipSegment = (value: unknown, fallback: string): string => {
  const sanitized = sanitizeProviderApplicantDocumentFilename(value, fallback)
    .replace(/[^a-z0-9._ -]+/gi, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || fallback;
};

const buildProviderApplicantExportFilename = (applicant: any): string => {
  const name = `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() ||
    applicant.email ||
    applicant.id ||
    'provider-submission';
  const slug = sanitizeZipSegment(name, 'provider-submission')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'provider-submission';
  return `${slug}-provider-submission.zip`;
};

const buildProviderApplicantExportJson = (
  applicant: any,
  documents: ValidatedProviderApplicantDocument[]
): string =>
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      submission: {
        id: applicant.id,
        userId: applicant.userId,
        email: applicant.email,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        phone: applicant.phone || null,
        communicationPreference: applicant.communicationPreference || null,
        providerCategory: applicant.providerCategory,
        organizationName: applicant.organizationName || null,
        professionalTitle: applicant.professionalTitle || null,
        website: applicant.website || null,
        socialLinks: applicant.socialLinks || [],
        serviceArea: applicant.serviceArea || null,
        availabilityMode: applicant.availabilityMode || null,
        servicesOffered: applicant.servicesOffered || [],
        targetAudience: applicant.targetAudience || null,
        populationsServed: applicant.populationsServed || [],
        experienceLevel: applicant.experienceLevel || null,
        yearsExperience: applicant.yearsExperience ?? null,
        practiceStatus: applicant.practiceStatus || null,
        availabilityToServe: applicant.availabilityToServe || null,
        credentialsText: applicant.credentialsText || null,
        licenseNumber: applicant.licenseNumber || null,
        issuingOrganization: applicant.issuingOrganization || null,
        credentialExpiration: applicant.credentialExpiration || null,
        professionalReferences: applicant.professionalReferences || null,
        alignmentAnswers: applicant.alignmentAnswers || {},
        integrityConsents: applicant.integrityConsents || {},
        consentAudit: applicant.consentAudit || null,
        status: applicant.status,
        adminNotes: applicant.adminNotes || null,
        submittedAt: applicant.submittedAt || null,
        reviewedAt: applicant.reviewedAt || null,
        calendlyShownAt: applicant.calendlyShownAt || null,
        createdAt: applicant.createdAt || null,
        updatedAt: applicant.updatedAt || null,
      },
      documents: documents.map((document) => ({
        type: document.documentType,
        label: document.label,
        originalName: document.originalName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        archivePath: `documents/${document.documentType}/${ensureFilenameHasExtension(document.originalName, document.mimeType)}`,
      })),
    },
    null,
    2
  );

const buildProviderApplicantExportText = (
  applicant: any,
  documents: ValidatedProviderApplicantDocument[]
): string => {
  const lines = [
    'Provider Submission Export',
    '',
    `Applicant: ${`${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || 'Unknown'}`,
    `Email: ${applicant.email || 'Not provided'}`,
    `Category: ${applicant.providerCategory || 'Not provided'}`,
    `Status: ${formatApplicantStatus(applicant.status)}`,
    `Submitted: ${applicant.submittedAt || 'Unknown'}`,
    '',
    'Professional Summary',
    `Title: ${applicant.professionalTitle || 'Not provided'}`,
    `Organization: ${applicant.organizationName || 'Not provided'}`,
    `Service Area: ${applicant.serviceArea || 'Not provided'}`,
    `Website: ${applicant.website || 'Not provided'}`,
    '',
    'Credentials',
    applicant.credentialsText || 'Not provided',
    '',
    'Documents',
    ...documents.map(
      (document) =>
        `${document.label}: documents/${document.documentType}/${ensureFilenameHasExtension(document.originalName, document.mimeType)}`
    ),
    '',
    'Admin Notes',
    applicant.adminNotes || 'None',
  ];
  return `${lines.join('\n')}\n`;
};

router.use(requireCanonicalIdentity);
router.use(requireAdminRole);
router.use(requireSoleFounderAdmin);

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
    const providerControlToken =
      readHeaderValue(req, 'x-provider-control-token') ||
      String(req.body?.providerControlToken || '').trim();
    const providerControl = providerControlToken
      ? await validateProviderControlElevation(actorUserId, providerControlToken)
      : { valid: false, reason: 'provider_control_token_missing' };

    if (!passwordValid && !codeValid && !providerControl.valid) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'elevation',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: {
          reason: 'elevation_factor_invalid',
          configuredCodeAvailable: hasConfiguredElevationCode(),
          providerControlReason: providerControl.reason,
        },
      });
      res.status(403).json({
        error: hasConfiguredElevationCode()
          ? 'Admin elevation requires account password, elevation code, or verified wallet control session'
          : 'Admin elevation requires account password or verified wallet control session',
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
        method: providerControl.valid ? 'provider_control_session' : codeValid ? 'elevation_code' : 'password',
        providerSessionId: providerControl.providerSessionId || null,
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
  const userById = new Map(users.map((user) => [user.id, user]));
  const [
    recentSocialPosts,
    courseGovernance,
    adminMessageSummary,
    recentAdminMessages,
    providerApplicants,
    grantApplications,
  ] = await Promise.all([
    socialStore.listPosts({ limit: 50 }),
    buildAdminCourseGovernance(),
    getAdminMessageSummary(),
    listAdminMessages({ limit: 50 }),
    listProviderApplicants({ limit: 500 }),
    listConsciousCareerGrantApplications({ limit: 500 }),
  ]);
  const recentAuditEvents = listRecentAuditEvents({ limit: 50 });
  const pendingProviderApplications = providerApplicants.filter((applicant) =>
    ['submitted', 'under_review', 'needs_more_info', 'discovery_scheduled'].includes(
      String(applicant.status || '').trim().toLowerCase()
    )
  ).length;
  const roleCounts = users.reduce(
    (counts, user) => {
      const role = normalizeRole(user.role) || 'user';
      counts[role] += 1;
      return counts;
    },
    { user: 0, provider: 0, admin: 0 }
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
      providerApplicationsPending: pendingProviderApplications,
      recentSocialPosts: recentSocialPosts.length,
      adminMessagesOpen:
        adminMessageSummary.new + adminMessageSummary.reviewing + adminMessageSummary.inProgress,
      auditEventsReturned: recentAuditEvents.length,
    },
  });

  res.json({
    success: true,
    roleModel: {
      guest: ['public:read'],
      member: ['self:read', 'self:update', 'courses:enroll', 'social:write', 'meetings:join'],
      provider: ['provider-session:request-after-approval', 'provider-crm:use-after-wallet'],
      admin: [
        'solo-founder',
        PROVIDER_CRM_SOLE_ADMIN_EMAIL,
        'platform:read',
        'users:read',
        'roles:update',
        'audit:read',
      ],
    },
    soleAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    summary: {
      usersTotal: users.length,
      roleCounts,
      activeMemberships: users.filter((user) => user.subscriptionStatus === 'active').length,
      providerApproved: users.filter((user) => user.providerApproved === true).length,
      coursesTotal: courseGovernance.courses.length,
      courseEnrollmentsTotal: courseGovernance.courses.reduce(
        (total: number, course: any) => total + Number(course.actualEnrollmentCount || 0),
        0
      ),
      adminMessagesTotal: adminMessageSummary.total,
      adminMessagesOpen:
        adminMessageSummary.new + adminMessageSummary.reviewing + adminMessageSummary.inProgress,
      adminMessagesUrgent: adminMessageSummary.urgent,
      providerApplicationsTotal: providerApplicants.length,
      providerApplicationsPending: pendingProviderApplications,
      grantApplicationsTotal: grantApplications.length,
      grantApplicationsPending: grantApplications.filter((application) =>
        ['submitted', 'under_review', 'reviewing', 'needs_more_info'].includes(
          String(application.status || '').trim().toLowerCase()
        )
      ).length,
      submissionsTotal: providerApplicants.length + grantApplications.length + adminMessageSummary.total,
      auditEventsRecent: recentAuditEvents.length,
      auditDeniedRecent: recentAuditEvents.filter((event) => event.outcome === 'deny').length,
      auditErrorsRecent: recentAuditEvents.filter((event) => event.outcome === 'error').length,
    },
    recentUsers: users.slice(0, 500).map(toAdminUserSummary),
    recentSocialPosts: recentSocialPosts.map((post) =>
      toAdminSocialPostSummary(req, post, userById.get(post.authorId))
    ),
    courseGovernance,
    adminInbox: {
      recipientEmail: ADMIN_INBOX_RECIPIENT_EMAIL,
      summary: adminMessageSummary,
      recent: recentAdminMessages,
    },
    submissions: {
      providerApplications: providerApplicants.map(toAdminProviderApplicationSubmission),
      grantApplications: grantApplications.map(toAdminGrantApplicationSubmission),
      adminMessages: recentAdminMessages,
    },
    recentAuditEvents,
  });
});

router.get('/audit-events', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const limit = Number(req.query.limit || 100);
  const domain = String(req.query.domain || 'all').trim().toLowerCase();
  const outcome = String(req.query.outcome || 'all').trim().toLowerCase();
  const events = listRecentAuditEvents({
    limit: Number.isFinite(limit) ? limit : 100,
    domain,
    outcome,
  });

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'audit_events_view',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: {
      returned: events.length,
      domain,
      outcome,
    },
  });

  res.json({ success: true, events });
});

router.get('/messages', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const statusQuery = String(req.query.status || 'all').trim();
  const typeQuery = String(req.query.type || 'all').trim();
  const status = statusQuery === 'all' ? 'all' : normalizeAdminMessageStatus(statusQuery);
  const limit = Number(req.query.limit || 100);
  const [summary, messages] = await Promise.all([
    getAdminMessageSummary(),
    listAdminMessages({
      status,
      type: typeQuery === 'all' ? 'all' : normalizeAdminMessageType(typeQuery),
      limit: Number.isFinite(limit) ? limit : 100,
    }),
  ]);

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'admin_messages_view',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: {
      status,
      returned: messages.length,
    },
  });

  res.json({
    success: true,
    recipientEmail: ADMIN_INBOX_RECIPIENT_EMAIL,
    summary,
    messages,
  });
});

router.patch(
  '/messages/:id',
  validateJsonBody(adminMessageUpdateSchema),
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const messageId = String(req.params.id || '').trim();
    if (!messageId) {
      res.status(400).json({ error: 'Message id is required' });
      return;
    }

    const updated = await updateAdminMessage(
      messageId,
      {
        status: req.body?.status || undefined,
        priority: req.body?.priority || undefined,
        adminNotes: req.body?.adminNotes,
        resolutionSummary: req.body?.resolutionSummary,
      },
      actorUserId
    );

    if (!updated) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'admin_message_update',
        outcome: 'deny',
        actorUserId,
        statusCode: 404,
        metadata: { messageId, reason: 'not_found' },
      });
      res.status(404).json({ error: 'Admin message not found' });
      return;
    }

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'admin_message_update',
      outcome: 'success',
      actorUserId,
      statusCode: 200,
      metadata: {
        messageId,
        status: updated.status,
        priority: updated.priority,
      },
    });

    res.json({ success: true, message: updated });
  }
);

router.get('/courses', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const courseGovernance = await buildAdminCourseGovernance();

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'course_governance_view',
    outcome: 'success',
    actorUserId,
    statusCode: 200,
    metadata: {
      courses: courseGovernance.courses.length,
      providers: courseGovernance.providers.length,
      assignableUsers: courseGovernance.assignableUsers.length,
    },
  });

  res.json({ success: true, courseGovernance });
});

router.patch('/courses/:id/owner', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const courseId = String(req.params.id || '').trim();
  const ownerIdRaw = req.body?.ownerId === null ? null : String(req.body?.ownerId || '').trim();
  const providerLabelRaw = String(req.body?.provider || '').trim();
  if (!courseId) {
    res.status(400).json({ error: 'Course id is required' });
    return;
  }

  const db = getPrisma() as any;
  const existing = await db.course.findUnique({ where: { id: courseId } });
  if (!existing) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  let owner: any = null;
  if (ownerIdRaw) {
    owner = await db.user.findUnique({
      where: { id: ownerIdRaw },
      select: { id: true, email: true, name: true, role: true, providerApproved: true },
    });
    const ownerRole = normalizeRole(owner?.role);
    if (!owner || (ownerRole !== 'provider' && ownerRole !== 'admin')) {
      res.status(400).json({ error: 'Course owner must be an admin or provider user' });
      return;
    }
    if (ownerRole === 'provider' && owner.providerApproved !== true) {
      res.status(400).json({ error: 'Course owner provider must be approved' });
      return;
    }
  }

  const provider = providerLabelRaw || owner?.name || owner?.email || 'Conscious Network Curriculum';
  const updated = await db.course.update({
    where: { id: courseId },
    data: {
      ownerId: owner?.id || null,
      ownerType: owner ? normalizeRole(owner.role) || 'provider' : 'admin',
      provider,
    },
    include: {
      owner: { select: { id: true, email: true, name: true, role: true } },
      enrollments: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              tier: true,
              membershipStatus: true,
            },
          },
        },
      },
    },
  });

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'course_owner_update',
    outcome: 'success',
    actorUserId,
    targetUserId: owner?.id || null,
    statusCode: 200,
    metadata: {
      courseId,
      previousOwnerId: existing.ownerId || null,
      nextOwnerId: owner?.id || null,
      provider,
    },
  });

  res.json({ success: true, course: toAdminCourseSummary(updated) });
});

router.post('/courses/:id/enrollments', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const courseId = String(req.params.id || '').trim();
  const targetUserId = String(req.body?.userId || '').trim();
  const rawScore = Number(req.body?.progressScore ?? 0);
  if (!courseId || !targetUserId) {
    res.status(400).json({ error: 'Course id and user id are required' });
    return;
  }

  const db = getPrisma() as any;
  const [course, targetUser] = await Promise.all([
    db.course.findUnique({ where: { id: courseId } }),
    db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        membershipStatus: true,
      },
    }),
  ]);
  const access = await verifyAdminAssignableCourseAccess(targetUser, course);
  if (!access.allowed) {
    res.status(400).json({ error: access.error });
    return;
  }

  const progressScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const enrollment = await db.userCourse.upsert({
    where: { userId_courseId: { userId: targetUserId, courseId } },
    update: {
      status: progressScore >= 100 ? 'completed' : 'enrolled',
      progressScore,
    },
    create: {
      userId: targetUserId,
      courseId,
      progressScore,
      status: progressScore >= 100 ? 'completed' : 'enrolled',
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tier: true,
          membershipStatus: true,
        },
      },
    },
  });
  await syncAdminCourseEnrollmentCount(courseId);

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'course_enrollment_assign',
    outcome: 'success',
    actorUserId,
    targetUserId,
    statusCode: 200,
    metadata: {
      courseId,
      progressScore,
      status: enrollment.status,
    },
  });

  res.json({ success: true, enrollment: toAdminCourseEnrollmentSummary(enrollment) });
});

router.patch('/courses/:id/enrollments/:userId', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const courseId = String(req.params.id || '').trim();
  const targetUserId = String(req.params.userId || '').trim();
  const rawScore = Number(req.body?.progressScore ?? req.body?.progress);
  const status = String(req.body?.status || '').trim().toLowerCase();
  if (!courseId || !targetUserId) {
    res.status(400).json({ error: 'Course id and user id are required' });
    return;
  }
  if (!Number.isFinite(rawScore) && !status) {
    res.status(400).json({ error: 'progressScore or status is required' });
    return;
  }
  if (status && !['enrolled', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Enrollment status must be enrolled or completed' });
    return;
  }

  const data: Record<string, unknown> = {};
  if (Number.isFinite(rawScore)) {
    const progressScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    data.progressScore = progressScore;
    data.status = progressScore >= 100 ? 'completed' : status || 'enrolled';
  } else if (status) {
    data.status = status;
  }

  try {
    const enrollment = await (getPrisma() as any).userCourse.update({
      where: { userId_courseId: { userId: targetUserId, courseId } },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tier: true,
            membershipStatus: true,
          },
        },
      },
    });
    await syncAdminCourseEnrollmentCount(courseId);

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'course_enrollment_update',
      outcome: 'success',
      actorUserId,
      targetUserId,
      statusCode: 200,
      metadata: { courseId, data },
    });

    res.json({ success: true, enrollment: toAdminCourseEnrollmentSummary(enrollment) });
  } catch {
    res.status(404).json({ error: 'Course enrollment not found' });
  }
});

router.delete('/courses/:id/enrollments/:userId', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const courseId = String(req.params.id || '').trim();
  const targetUserId = String(req.params.userId || '').trim();
  if (!courseId || !targetUserId) {
    res.status(400).json({ error: 'Course id and user id are required' });
    return;
  }

  try {
    await (getPrisma() as any).userCourse.delete({
      where: { userId_courseId: { userId: targetUserId, courseId } },
    });
    const enrolledCount = await syncAdminCourseEnrollmentCount(courseId);
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'course_enrollment_remove',
      outcome: 'success',
      actorUserId,
      targetUserId,
      statusCode: 200,
      metadata: { courseId, enrolledCount },
    });
    res.json({ success: true, courseId, userId: targetUserId, enrolledCount });
  } catch {
    res.status(404).json({ error: 'Course enrollment not found' });
  }
});

router.post('/social/posts/:postId/hide', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const postId = String(req.params.postId || '').trim();
  const reason = String(req.body?.reason || '').trim() || 'Admin content moderation';
  if (!postId) {
    res.status(400).json({ error: 'postId is required' });
    return;
  }

  const existing = await socialStore.getPostById(postId);
  if (!existing) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const updated = await socialStore.updatePost({ postId, visibility: 'private' });
  if (!updated) {
    res.status(404).json({ error: 'Post not found after moderation update' });
    return;
  }
  const author = await localStore.getUserById(updated.authorId);

  recordAuditEvent(req, {
    domain: 'admin',
    action: 'social_post_hide',
    outcome: 'success',
    actorUserId,
    targetUserId: updated.authorId,
    statusCode: 200,
    metadata: {
      postId,
      reason,
      previousVisibility: existing.visibility,
      nextVisibility: updated.visibility,
    },
  });

  res.json({
    success: true,
    post: toAdminSocialPostSummary(req, updated, author),
  });
});

router.delete('/social/posts/:postId', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const postId = String(req.params.postId || '').trim();
  const confirm = String(req.body?.confirm || '').trim();
  const reason = String(req.body?.reason || '').trim() || 'Admin content moderation';
  if (!postId) {
    res.status(400).json({ error: 'postId is required' });
    return;
  }
  if (confirm !== 'DELETE POST') {
    res.status(400).json({ error: 'Post deletion requires DELETE POST confirmation' });
    return;
  }

  const deleted = await socialStore.deletePost(postId);
  if (!deleted) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const mediaDeleted = await cleanupSocialPostMedia(deleted);
  recordAuditEvent(req, {
    domain: 'admin',
    action: 'social_post_delete',
    outcome: 'success',
    actorUserId,
    targetUserId: deleted.authorId,
    statusCode: 200,
    metadata: {
      postId,
      reason,
      mediaDeleted,
    },
  });

  res.json({ success: true, postId, mediaDeleted });
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
    applicants: applicants.map(toAdminProviderApplicantRecord),
  });
});

router.get(
  '/provider-applicants/:id/documents/:documentType',
  async (req: Request, res: Response): Promise<void> => {
    const actorUserId = getAuthenticatedUserId(req);
    const id = String(req.params.id || '').trim();
    const documentType = normalizeProviderApplicantDocumentType(req.params.documentType);
    if (!documentType) {
      res.status(400).json({ error: 'Invalid provider applicant document type' });
      return;
    }

    const requestedDisposition = normalizeProviderApplicantDocumentDisposition(
      req.query.disposition
    );
    if (!requestedDisposition) {
      res.status(400).json({ error: 'Invalid provider applicant document disposition' });
      return;
    }

    const applicant = await getProviderApplicantById(id);
    if (!applicant) {
      res.status(404).json({ error: 'Provider applicant not found' });
      return;
    }

    const validation = validateProviderApplicantDocument(applicant, documentType);
    if (validation.ok === false) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'provider_applicant_document_view',
        outcome: 'deny',
        actorUserId,
        targetUserId: applicant.userId,
        statusCode: 404,
        metadata: {
          applicantId: applicant.id,
          documentType,
          reason: validation.reason,
        },
      });
      res.status(validation.statusCode).json({ error: validation.error });
      return;
    }
    const { document } = validation;

    try {
      const resolved = await resolveUploadObjectByKey(document.objectKey);
      if (!resolved) {
        res.status(404).json({ error: 'Provider applicant document not found' });
        return;
      }

      const mimeType = normalizeDocumentMimeType(document.mimeType || resolved.mimeType);
      const finalDisposition =
        requestedDisposition === 'inline' && canInlineProviderApplicantDocument(mimeType)
          ? 'inline'
          : 'attachment';
      const originalName = document.originalName;

      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        buildProviderApplicantDocumentDisposition(finalDisposition, originalName)
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Length', String(resolved.buffer.length));

      recordAuditEvent(req, {
        domain: 'admin',
        action: 'provider_applicant_document_view',
        outcome: 'success',
        actorUserId,
        targetUserId: applicant.userId,
        statusCode: 200,
        metadata: {
          applicantId: applicant.id,
          documentType,
          requestedDisposition,
          disposition: finalDisposition,
          mimeType,
        },
      });

      res.send(resolved.buffer);
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      if (code === 'STORE_UNAVAILABLE') {
        res.status(503).json({
          error: 'Upload storage is temporarily unavailable. Retry shortly.',
        });
        return;
      }
      console.error('[Admin] provider applicant document read failed', error);
      res.status(500).json({ error: 'Failed to load provider applicant document' });
    }
  }
);

router.get('/provider-applicants/:id/export', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const id = String(req.params.id || '').trim();
  const applicant = await getProviderApplicantById(id);
  if (!applicant) {
    res.status(404).json({ error: 'Provider applicant not found' });
    return;
  }

  const validation = validateRequiredProviderApplicantDocuments(applicant);
  if (validation.ok === false) {
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'provider_applicant_export',
      outcome: 'deny',
      actorUserId,
      targetUserId: applicant.userId,
      statusCode: 409,
      metadata: {
        applicantId: applicant.id,
        documentType: validation.documentType,
        reason: validation.reason,
      },
    });
    res.status(409).json({
      error: 'Provider applicant export cannot be created until document references are valid',
    });
    return;
  }

  try {
    const resolvedDocuments = [];
    for (const document of validation.documents) {
      const resolved = await resolveUploadObjectByKey(document.objectKey);
      if (!resolved) {
        res.status(404).json({
          error: `${document.label} file could not be found for this provider applicant`,
        });
        return;
      }
      resolvedDocuments.push({ document, resolved });
    }

    const entries: ZipArchiveEntry[] = [
      {
        path: 'submission.json',
        data: buildProviderApplicantExportJson(applicant, validation.documents),
        modifiedAt: applicant.updatedAt || applicant.submittedAt,
      },
      {
        path: 'submission.txt',
        data: buildProviderApplicantExportText(applicant, validation.documents),
        modifiedAt: applicant.updatedAt || applicant.submittedAt,
      },
      ...resolvedDocuments.map(({ document, resolved }) => ({
        path: `documents/${document.documentType}/${sanitizeZipSegment(
          ensureFilenameHasExtension(document.originalName, document.mimeType),
          `${document.documentType}${extensionFromMimeType(document.mimeType)}`
        )}`,
        data: resolved.buffer,
        modifiedAt: applicant.updatedAt || applicant.submittedAt,
      })),
    ];
    const archive = buildZipArchive(entries);
    const exportFilename = buildProviderApplicantExportFilename(applicant);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      buildProviderApplicantDocumentDisposition('attachment', exportFilename)
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', String(archive.length));

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'provider_applicant_export',
      outcome: 'success',
      actorUserId,
      targetUserId: applicant.userId,
      statusCode: 200,
      metadata: {
        applicantId: applicant.id,
        documents: validation.documents.map((document) => document.documentType),
      },
    });

    res.send(archive);
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'STORE_UNAVAILABLE') {
      res.status(503).json({
        error: 'Upload storage is temporarily unavailable. Retry shortly.',
      });
      return;
    }
    console.error('[Admin] provider applicant export failed', error);
    res.status(500).json({ error: 'Failed to create provider applicant export' });
  }
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

  res.json({ success: true, applicant: toAdminProviderApplicantRecord(applicant) });
});

router.delete('/provider-applicants/:id', async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const id = String(req.params.id || '').trim();
  const confirm = String(req.body?.confirm || '').trim();
  if (confirm !== PROVIDER_APPLICANT_DELETE_CONFIRMATION) {
    res.status(400).json({
      error: `Deletion requires confirm="${PROVIDER_APPLICANT_DELETE_CONFIRMATION}"`,
    });
    return;
  }

  const applicant = await getProviderApplicantById(id);
  if (!applicant) {
    res.status(404).json({ error: 'Provider applicant not found' });
    return;
  }

  const validation = validateRequiredProviderApplicantDocuments(applicant);
  if (validation.ok === false) {
    recordAuditEvent(req, {
      domain: 'admin',
      action: 'provider_applicant_delete',
      outcome: 'deny',
      actorUserId,
      targetUserId: applicant.userId,
      statusCode: 409,
      metadata: {
        applicantId: applicant.id,
        documentType: validation.documentType,
        reason: validation.reason,
      },
    });
    res.status(409).json({
      error: 'Provider applicant cannot be deleted until document references are valid',
    });
    return;
  }

  try {
    const documentResults = [];
    for (const document of validation.documents) {
      const deleted = await deleteUploadObjectByKey(document.objectKey);
      documentResults.push({
        documentType: document.documentType,
        originalName: document.originalName,
        deleted,
      });
    }

    const deletedApplicant = await deleteProviderApplicantById(id);
    if (!deletedApplicant) {
      res.status(404).json({ error: 'Provider applicant not found' });
      return;
    }

    recordAuditEvent(req, {
      domain: 'admin',
      action: 'provider_applicant_delete',
      outcome: 'success',
      actorUserId,
      targetUserId: applicant.userId,
      statusCode: 200,
      metadata: {
        applicantId: applicant.id,
        documents: documentResults,
      },
    });

    res.json({
      success: true,
      deletedApplicantId: deletedApplicant.id,
      deletedDocuments: documentResults,
    });
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'STORE_UNAVAILABLE') {
      res.status(503).json({
        error: 'Upload storage is temporarily unavailable. Retry shortly.',
      });
      return;
    }
    console.error('[Admin] provider applicant delete failed', error);
    res.status(500).json({ error: 'Failed to delete provider applicant' });
  }
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
          : 'user',
      metadata: {
        applicantId: id,
        previousStatus: existing.status,
        nextStatus,
        applicantMessage: applicantMessage || null,
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
    applicant: toAdminProviderApplicantRecord(updated),
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
    if (nextRole === 'admin' && !isSoleAdminEmail(target.email)) {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 403,
        metadata: {
          reason: 'sole_admin_email_required',
          requestedRole: nextRole,
          requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
        },
      });
      res.status(403).json({
        error: `The only admin account is ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}`,
      });
      return;
    }

    if (isSoleAdminEmail(target.email) && nextRole !== 'admin') {
      recordAuditEvent(req, {
        domain: 'admin',
        action: 'role_change',
        outcome: 'deny',
        actorUserId,
        targetUserId,
        statusCode: 403,
        metadata: {
          reason: 'sole_admin_demotion_denied',
          requestedRole: nextRole,
        },
      });
      res.status(403).json({ error: 'The solo founder admin account cannot be demoted' });
      return;
    }

    let revokedProviderAccess:
      | { providerSessionsRevoked: number; userSessionsRevoked: number }
      | null = null;
    if (previousRole === 'provider' && nextRole !== 'provider') {
      const revoked = await revokeProviderAccessForUser(target, {
        approvalStatus: 'manual_role_change',
      });
      revokedProviderAccess = {
        providerSessionsRevoked: revoked.providerSessionsRevoked,
        userSessionsRevoked: revoked.userSessionsRevoked,
      };
    }

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
        revokedProviderAccess,
      },
    });

    res.json({
      success: true,
      user: toAdminUserSummary(updated),
    });
  }
);

export default router;
