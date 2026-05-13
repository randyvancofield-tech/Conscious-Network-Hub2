import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  computePasswordFingerprint,
  createSessionToken,
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from '../auth';
import { verifyIdentitySessionToken } from '../auth/identitySession';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedSessionId,
  getAuthenticatedUserId,
  logIdentityValidationFailure,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore, TwoFactorMethod } from '../services/persistenceStore';
import { mirrorUserToGoogleSheets } from '../services/googleSheetsMirror';
import { maskPhoneNumber, maskWalletDid } from '../services/sensitiveDataPolicy';
import { createUserSession, revokeUserSession, revokeUserSessionsByUserId } from '../services/userSessionStore';
import emailService from '../services/emailService';
import smsService from '../services/smsService';
import {
  normalizeDateOfBirth,
  normalizeOptionalString,
  normalizePrivacySettings,
  normalizeProfileMedia,
  type UserProfileMedia,
} from '../services/profileNormalization';
import {
  parseUserProfilePatch,
  USER_PROFILE_PATCH_FIELDS,
} from '../services/userProfilePatch';
import { normalizeTier } from '../tierPolicy';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  userCreateSchema,
  userEmailVerificationConfirmSchema,
  userPasswordResetConfirmSchema,
  userPasswordResetRequestSchema,
  userPhoneEnrollSchema,
  userPrivacyUpdateSchema,
  userProfilePatchSchema,
  userSignInSchema,
  userWalletEnrollSchema,
} from '../validation/requestSchemas';

const publicRouter = Router();
const protectedRouter = Router();

const MIN_PASSWORD_LENGTH = 12;
const MAX_FAILED_SIGN_IN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const PHONE_OTP_TTL_MS = 10 * 60 * 1000;
const PHONE_OTP_RESEND_GUARD_MS = 60 * 1000;
const MAX_PHONE_OTP_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const AUTOMATED_PROFILE_PATTERN = /\b(bot|agent|assistant|seed|system)\b/i;
const PROFILE_STORE_UNAVAILABLE_RESPONSE = {
  error: 'Profile service is currently unavailable. Please retry shortly.',
  code: 'PROFILE_STORE_UNAVAILABLE',
  retryable: true,
} as const;
const PROFILE_SESSION_ESTABLISH_FAILED_RESPONSE = {
  error:
    'Profile was created, but session setup could not be completed. Please sign in to continue.',
  code: 'PROFILE_SESSION_ESTABLISH_FAILED',
  retryable: true,
} as const;

const isLaunchFeatureEnabled = (name: string): boolean =>
  String(process.env[name] || '').trim().toLowerCase() === 'true';

const isInitialTwoFactorEnforced = (): boolean => isLaunchFeatureEnabled('ENABLE_INITIAL_2FA');
const isUserTwoFactorEnabled = (): boolean => isLaunchFeatureEnabled('ENABLE_USER_2FA');
const isEmailVerificationEnabled = (): boolean =>
  isLaunchFeatureEnabled('ENABLE_EMAIL_VERIFICATION');
const isPasswordResetEnabled = (): boolean =>
  String(process.env.ENABLE_PASSWORD_RESET || 'true').trim().toLowerCase() !== 'false';

const normalizeRole = (value: unknown): 'user' | 'applicant' | 'provider' | 'admin' => {
  const role = String(value || 'user').trim().toLowerCase();
  if (role === 'applicant' || role === 'provider' || role === 'admin') return role;
  return 'user';
};

const requiresTransientPhoneSignIn = (role: string): boolean => role === 'user';

const canUseNativePasswordReset = (user: { role?: string | null }): boolean =>
  ['user', 'applicant', 'provider', 'admin'].includes(normalizeRole(user.role));

const isInitialTwoFactorRequired = (user: {
  initialTwoFactorRequiredAt?: Date | null;
  initialTwoFactorCompletedAt?: Date | null;
}): boolean =>
  isInitialTwoFactorEnforced() &&
  Boolean(user.initialTwoFactorRequiredAt && !user.initialTwoFactorCompletedAt);

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty123',
  'letmein123',
  'welcome123',
  'admin123',
]);

const DIAGNOSTICS_ADMIN_HEADER = 'x-admin-diagnostics-key';

const isAutomatedDirectoryProfile = (profile: {
  name?: string | null;
  handle?: string | null;
  email?: string | null;
}): boolean => {
  const fields = [profile.name, profile.handle, profile.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return fields.some((field) => AUTOMATED_PROFILE_PATTERN.test(field));
};

const getRequestTraceId = (req: Request): string | null => {
  const raw = String(req.headers['x-cloud-trace-context'] || '').trim();
  if (!raw) return null;
  return raw.split('/')[0]?.trim() || null;
};

const safeLogHash = (value: string): string =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);

const setAuthResponseNoStore = (res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.vary('Authorization');
  res.vary('Cookie');
};

const hashPasswordResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const hashEmailVerificationToken = (token: string): string =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const resolveFrontendBaseUrl = (req: Request): string => {
  const configured = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return getPublicBaseUrl(req);
};

const buildPasswordResetUrl = (req: Request, token: string): string =>
  `${resolveFrontendBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;

const buildEmailVerificationUrl = (req: Request, token: string): string =>
  `${resolveFrontendBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;

const getPhoneOtpIssuedAtMs = (expiresAt: Date | null): number | null => {
  if (!expiresAt) return null;
  return expiresAt.getTime() - PHONE_OTP_TTL_MS;
};

const logAuthFlowError = (
  req: Request,
  action: 'create' | 'signin' | 'logout' | 'current',
  stage: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void => {
  const err = error as Error & { code?: string };
  const payload = {
    action,
    stage,
    method: req.method,
    path: req.path,
    requestId: String(req.headers['x-request-id'] || '').trim() || null,
    traceId: getRequestTraceId(req),
    errorCode: err?.code || null,
    errorName: err?.name || null,
    errorMessage: err?.message || String(error),
    ...(metadata || {}),
  };
  console.error('[AUTH][ERROR]', JSON.stringify(payload));
};

const timingSafeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const isLoopbackRequest = (req: Request): boolean => {
  const forwardedRaw = req.headers['x-forwarded-for'];
  const forwarded =
    typeof forwardedRaw === 'string'
      ? forwardedRaw.split(',')[0].trim()
      : Array.isArray(forwardedRaw)
      ? forwardedRaw[0]?.split(',')[0].trim()
      : '';
  const ip = forwarded || req.ip || req.socket.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('.localhost')
  );
};

const enforceDiagnosticsAdminAccess = (req: Request, res: Response): boolean => {
  const configuredKey = process.env.ADMIN_DIAGNOSTICS_KEY?.trim() || '';
  const providedHeader = String(req.headers[DIAGNOSTICS_ADMIN_HEADER] || '').trim();

  if (configuredKey) {
    if (!providedHeader || !timingSafeEquals(providedHeader, configuredKey)) {
      res.status(401).json({
        error: `Unauthorized diagnostics access. Provide ${DIAGNOSTICS_ADMIN_HEADER}.`,
      });
      return false;
    }
    return true;
  }

  if (process.env.NODE_ENV !== 'production' && isLoopbackRequest(req)) {
    return true;
  }

  res.status(503).json({
    error:
      'Diagnostics endpoint disabled. Set ADMIN_DIAGNOSTICS_KEY or access from localhost in non-production.',
  });
  return false;
};

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`;
}

function absolutizeUrl(req: Request, url?: string | null): string | null | undefined {
  if (!url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${getPublicBaseUrl(req)}${path}`;
}

const toIdentityName = (email: string): string =>
  email.split('@')[0]?.trim() || 'Node';

const normalizeTwoFactorMethod = (value: unknown): TwoFactorMethod => {
  const normalized = String(value || 'none').trim().toLowerCase();
  if (normalized === 'phone') return 'phone';
  if (normalized === 'wallet') return 'wallet';
  return 'none';
};

const normalizePhoneNumber = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const stripped = raw.replace(/[^\d+]/g, '');
  const normalized = stripped.startsWith('+')
    ? `+${stripped.slice(1).replace(/\+/g, '')}`
    : stripped.replace(/\+/g, '');
  if (!/^\+?\d{10,15}$/.test(normalized)) return null;
  return normalized;
};

const toPublicTier = (user: any): string | null => {
  const rawTier = String(user?.tier || '').trim();
  if (!rawTier) return null;

  return normalizeTier(rawTier);
};

const isActiveMembershipStatus = (status: unknown): boolean => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'active' || normalized === 'trialing' || normalized === 'free';
};

const reconcileUserMembershipProjection = async (user: any): Promise<{
  user: any;
  membership: Awaited<ReturnType<typeof localStore.getMembershipByUserId>> | null;
  hasActiveMembership: boolean;
  effectiveTier: string | null;
}> => {
  const membership = await localStore.getMembershipByUserId(user.id);
  const membershipTier = membership ? normalizeTier(membership.tier) : null;
  const membershipStatus = String(membership?.status || 'inactive').trim().toLowerCase();
  const membershipIsActive = Boolean(membershipTier && isActiveMembershipStatus(membershipStatus));
  const userTier = toPublicTier(user);

  if (!membershipIsActive) {
    const desiredTier = membership ? membershipTier : null;
    const desiredStatus = membership ? membershipStatus || 'inactive' : 'inactive';
    const desiredMembershipStatus = null;
    const desiredStartDate = membership?.startDate || null;
    const desiredEndDate = membership?.endDate || null;
    const needsProjectionUpdate =
      userTier !== desiredTier ||
      (user.membershipStatus || null) !== desiredMembershipStatus ||
      String(user.subscriptionStatus || '').trim().toLowerCase() !== desiredStatus ||
      (user.subscriptionStartDate || null)?.getTime?.() !== desiredStartDate?.getTime?.() ||
      (user.subscriptionEndDate || null)?.getTime?.() !== desiredEndDate?.getTime?.();

    const updated = needsProjectionUpdate
      ? await localStore.updateUser(user.id, {
          tier: desiredTier || '',
          membershipStatus: desiredMembershipStatus,
          subscriptionStatus: desiredStatus,
          subscriptionStartDate: desiredStartDate,
          subscriptionEndDate: desiredEndDate,
        })
      : null;

    return {
      user: updated || user,
      membership,
      hasActiveMembership: false,
      effectiveTier: desiredTier,
    };
  }

  const activeMembership = membership!;
  const activeMembershipTier = membershipTier!;
  const activeMembershipStatus = membershipStatus || 'active';
  const needsProjectionUpdate =
    userTier !== activeMembershipTier ||
    user.membershipStatus !== activeMembershipStatus ||
    !isActiveMembershipStatus(user.subscriptionStatus) ||
    !user.subscriptionStartDate ||
    (user.subscriptionStartDate || null)?.getTime?.() !==
      (activeMembership.startDate || null)?.getTime?.() ||
    (user.subscriptionEndDate || null)?.getTime?.() !==
      (activeMembership.endDate || null)?.getTime?.();

  if (!needsProjectionUpdate) {
    return {
      user,
      membership: activeMembership,
      hasActiveMembership: true,
      effectiveTier: activeMembershipTier,
    };
  }

  const updated = await localStore.updateUser(user.id, {
    tier: activeMembershipTier,
    membershipStatus: activeMembershipStatus,
    subscriptionStatus: 'active',
    subscriptionStartDate: activeMembership.startDate || user.subscriptionStartDate || new Date(),
    subscriptionEndDate: activeMembership.endDate || null,
  });

  return {
    user: updated || user,
    membership: activeMembership,
    hasActiveMembership: true,
    effectiveTier: activeMembershipTier,
  };
};

const absolutizeProfileMedia = (
  req: Request,
  profileMedia: unknown,
  avatarUrl: string | null | undefined,
  bannerUrl: string | null | undefined
): UserProfileMedia => {
  const normalized = normalizeProfileMedia(profileMedia, avatarUrl || null, bannerUrl || null);
  return {
    avatar: {
      ...normalized.avatar,
      url: absolutizeUrl(req, normalized.avatar.url) || null,
    },
    cover: {
      ...normalized.cover,
      url: absolutizeUrl(req, normalized.cover.url) || null,
    },
  };
};

const validatePasswordPolicy = (email: string, password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one symbol';
  }

  const loweredPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(loweredPassword)) {
    return 'Password is too common. Choose a more unique passphrase';
  }

  const emailFragments = email
    .toLowerCase()
    .split(/[@._-]+/)
    .filter((fragment) => fragment.length >= 3);
  for (const fragment of emailFragments) {
    if (loweredPassword.includes(fragment)) {
      return 'Password must not contain parts of your email address';
    }
  }

  return null;
};

const toPublicUser = (req: Request, user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || toIdentityName(user.email),
  role: String(user.role || 'user').trim().toLowerCase(),
  handle: user.handle || null,
  bio: user.bio || null,
  location: user.location || null,
  dateOfBirth: user.dateOfBirth || null,
  avatarUrl: absolutizeUrl(req, user.avatarUrl),
  bannerUrl: absolutizeUrl(req, user.bannerUrl),
  profileMedia: absolutizeProfileMedia(req, user.profileMedia, user.avatarUrl, user.bannerUrl),
  interests: Array.isArray(user.interests) ? user.interests : [],
  twitterUrl: user.twitterUrl || null,
  githubUrl: user.githubUrl || null,
  websiteUrl: user.websiteUrl || null,
  privacySettings: normalizePrivacySettings(user.privacySettings),
  tier: toPublicTier(user),
  membershipStatus: user.membershipStatus || null,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionStartDate: user.subscriptionStartDate,
  subscriptionEndDate: user.subscriptionEndDate,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  profileBackgroundVideo: absolutizeUrl(req, user.profileBackgroundVideo),
  twoFactorEnabled: user.twoFactorMethod && user.twoFactorMethod !== 'none',
  twoFactorMethod: user.twoFactorMethod || 'none',
  phoneNumberMasked: maskPhoneNumber(user.phoneNumber),
  walletDid: maskWalletDid(user.walletDid),
  initialTwoFactorRequired: isInitialTwoFactorRequired(user),
  initialTwoFactorCompleted: Boolean(user.initialTwoFactorCompletedAt),
  canAccessFullPlatform: !isInitialTwoFactorRequired(user),
  emailVerified: user.emailVerified === true,
});

const buildPublicUser = async (req: Request, user: any) => {
  const reconciled = await reconcileUserMembershipProjection(user);
  const publicUser = toPublicUser(req, reconciled.user);
  const membership = reconciled.membership;

  return {
    ...publicUser,
    tier: reconciled.effectiveTier,
    subscriptionStatus:
      reconciled.hasActiveMembership && !isActiveMembershipStatus(publicUser.subscriptionStatus)
        ? 'active'
        : publicUser.subscriptionStatus,
    membershipStatus: reconciled.hasActiveMembership
      ? reconciled.user.membershipStatus || membership?.status || null
      : null,
    hasActiveMembership: reconciled.hasActiveMembership,
    membershipStartDate: membership?.startDate || null,
    membershipEndDate: membership?.endDate || null,
  };
};

const sendVerificationEmailForUser = async (
  req: Request,
  user: { id: string; email: string; emailVerified?: boolean | null }
): Promise<{ sent: boolean; devVerificationUrl?: string }> => {
  if (!isEmailVerificationEnabled()) return { sent: false };
  if (user.emailVerified) return { sent: false };
  const token = crypto.randomBytes(32).toString('base64url');
  const verificationUrl = buildEmailVerificationUrl(req, token);
  await localStore.updateUser(user.id, {
    emailVerificationTokenHash: hashEmailVerificationToken(token),
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });
  const result = await emailService.send({
    to: user.email,
    subject: 'Verify your Conscious Network Hub email',
    text: [
      'Welcome to Conscious Network Hub.',
      `Verify your email within 24 hours: ${verificationUrl}`,
      'If you did not create this account, you can ignore this email.',
    ].join('\n\n'),
    html: `
      <p>Welcome to Conscious Network Hub.</p>
      <p><a href="${verificationUrl}">Verify your email</a></p>
      <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
    `,
  });
  return {
    sent: true,
    ...(result?.skipped && process.env.NODE_ENV !== 'production'
      ? { devVerificationUrl: verificationUrl }
      : {}),
  };
};

/**
 * POST /api/user/signin
 * Authenticate an existing user with canonical backend identity.
 */
publicRouter.post('/signin', validateJsonBody(userSignInSchema), async (req: Request, res: Response): Promise<any> => {
  setAuthResponseNoStore(res);
  let emailHash: string | null = null;
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    emailHash = email ? safeLogHash(email) : null;
    const password = String(req.body?.password || '');
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    const twoFactorCode = String(req.body?.twoFactorCode || '').trim();
    const providerToken = String(req.body?.providerToken || '').trim();
    const auditSignIn = (
      outcome: 'success' | 'deny' | 'error',
      statusCode: number,
      reason: string,
      actorUserId?: string | null,
      metadata?: Record<string, unknown>
    ): void => {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'signin',
        outcome,
        actorUserId: actorUserId || null,
        statusCode,
        metadata: {
          reason,
          ...metadata,
        },
      });
    };

    if (!email || !password) {
      auditSignIn('deny', 400, 'missing_required_fields');
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    let user = await localStore.getUserByEmail(email);
    if (!user) {
      auditSignIn('deny', 401, 'invalid_credentials_user_not_found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      auditSignIn('deny', 423, 'account_lockout_active', user.id, {
        lockoutUntil: user.lockoutUntil.toISOString(),
      });
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed sign-in attempts',
        lockoutUntil: user.lockoutUntil,
      });
    }

    const passwordMatches = verifyPassword(password, user.password);
    if (!passwordMatches) {
      const failedAttempts = (user.failedSignInAttempts || 0) + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_SIGN_IN_ATTEMPTS;
      const lockoutUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_WINDOW_MS)
        : null;

      user =
        (await localStore.updateUser(user.id, {
          failedSignInAttempts: shouldLock ? 0 : failedAttempts,
          lockoutUntil,
        })) || user;

      if (shouldLock) {
        auditSignIn('deny', 423, 'password_mismatch_lockout', user.id);
        return res.status(423).json({
          error: 'Account temporarily locked due to repeated failed sign-in attempts',
          lockoutUntil,
        });
      }

      auditSignIn('deny', 401, 'invalid_credentials_password_mismatch', user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (needsPasswordRehash(user.password)) {
      const upgradedHash = hashPassword(password);
      const upgradedFingerprint = computePasswordFingerprint(password);
      user =
        (await localStore.updateUser(user.id, {
          password: upgradedHash,
          passwordFingerprint: upgradedFingerprint,
        })) || user;
    }

    const role = normalizeRole(user.role);
    if (role === 'provider') {
      auditSignIn('deny', 403, 'direct_platform_signin_role_denied', user.id, {
        role,
      });
      return res.status(403).json({
        error: 'Provider accounts must authenticate through the provider portal',
      });
    }

    if (requiresTransientPhoneSignIn(role)) {
      if (!twoFactorCode) {
        if (!phoneNumber) {
          auditSignIn('deny', 400, 'transient_phone_2fa_missing_phone', user.id);
          return res.status(400).json({
            error: 'Enter a wireless phone number to receive your sign-in verification code.',
            requiresPhoneNumber: true,
          });
        }

        const issuedAtMs = getPhoneOtpIssuedAtMs(user.pendingPhoneOtpExpiresAt);
        if (
          user.pendingPhoneOtpHash &&
          user.pendingPhoneOtpExpiresAt &&
          user.pendingPhoneOtpExpiresAt.getTime() > Date.now() &&
          issuedAtMs &&
          Date.now() - issuedAtMs < PHONE_OTP_RESEND_GUARD_MS
        ) {
          auditSignIn('deny', 429, 'phone_otp_resend_too_soon', user.id);
          return res.status(429).json({
            error: 'A verification code was just sent. Please wait before requesting another code.',
          });
        }

        const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const hashedCode = computePasswordFingerprint(`otp:${code}`);
        const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);

        const delivery = await smsService.sendSecurityCode({
          to: phoneNumber,
          code,
          purpose: 'signin',
        });
        if (!delivery.ok) {
          auditSignIn('error', 503, 'phone_otp_delivery_failed', user.id, {
            provider: delivery.provider || null,
          });
          return res.status(503).json({
            error: 'Unable to send phone verification code. Please retry shortly.',
          });
        }

        await localStore.updateUser(user.id, {
          pendingPhoneOtpHash: hashedCode,
          pendingPhoneOtpExpiresAt: expiresAt,
          pendingPhoneOtpAttempts: 0,
        });

        auditSignIn('deny', 202, 'two_factor_required_phone', user.id, {
          twoFactorMethod: 'phone',
          smsProvider: delivery.provider || null,
          smsSkipped: Boolean(delivery.skipped),
          phoneHash: safeLogHash(phoneNumber),
        });

        return res.status(202).json({
          success: false,
          requiresTwoFactor: true,
          method: 'phone',
          message: 'A phone verification code was sent. Enter it to complete sign-in.',
          phoneNumberStored: false,
          ...(process.env.NODE_ENV !== 'production' && { devOtpCode: code }),
        });
      }

      const otpExpired =
        !user.pendingPhoneOtpExpiresAt || user.pendingPhoneOtpExpiresAt.getTime() <= Date.now();
      if (!user.pendingPhoneOtpHash || otpExpired) {
        auditSignIn('deny', 401, 'phone_otp_expired_or_missing', user.id);
        return res.status(401).json({
          error: 'Phone verification code expired. Retry sign-in to request a new code',
        });
      }

      const providedCodeHash = computePasswordFingerprint(`otp:${twoFactorCode}`);
      if (providedCodeHash !== user.pendingPhoneOtpHash) {
        const nextAttempts = (user.pendingPhoneOtpAttempts || 0) + 1;
        const exhausted = nextAttempts >= MAX_PHONE_OTP_ATTEMPTS;
        await localStore.updateUser(user.id, {
          pendingPhoneOtpAttempts: exhausted ? 0 : nextAttempts,
          pendingPhoneOtpHash: exhausted ? null : user.pendingPhoneOtpHash,
          pendingPhoneOtpExpiresAt: exhausted ? null : user.pendingPhoneOtpExpiresAt,
        });

        if (exhausted) {
          auditSignIn('deny', 429, 'phone_otp_attempts_exhausted', user.id);
          return res.status(429).json({
            error: 'Too many invalid 2FA attempts. Restart sign-in to request a new code',
          });
        }

        auditSignIn('deny', 401, 'phone_otp_invalid', user.id);
        return res.status(401).json({ error: 'Invalid verification code' });
      }

      user =
        (await localStore.updateUser(user.id, {
          phoneNumber: null,
          pendingPhoneOtpHash: null,
          pendingPhoneOtpExpiresAt: null,
          pendingPhoneOtpAttempts: 0,
        })) || user;
    }

    if (!requiresTransientPhoneSignIn(role) && isUserTwoFactorEnabled() && user.twoFactorMethod === 'wallet') {
      if (!user.walletDid) {
        auditSignIn('deny', 403, 'wallet_2fa_missing_wallet', user.id);
        return res.status(403).json({
          error: 'Wallet 2FA is enabled but no wallet DID is configured for this profile',
        });
      }

      if (!providerToken) {
        auditSignIn('deny', 202, 'two_factor_required_wallet', user.id, {
          twoFactorMethod: 'wallet',
        });
        return res.status(202).json({
          success: false,
          requiresTwoFactor: true,
          method: 'wallet',
          message: 'Address verification credential required to complete sign-in',
        });
      }

      const identitySession = verifyIdentitySessionToken(providerToken);
      const expectedDid = String(user.walletDid || '').trim().toLowerCase();
      const verifiedDid = String(identitySession?.did || '').trim().toLowerCase();
      if (!identitySession || identitySession.sub !== user.id || verifiedDid !== expectedDid) {
        auditSignIn('deny', 401, 'wallet_2fa_invalid_credential', user.id, {
          twoFactorMethod: 'wallet',
        });
        return res.status(401).json({ error: 'Invalid address verification credential' });
      }
    }

    user =
      (await localStore.updateUser(user.id, {
        failedSignInAttempts: 0,
        lockoutUntil: null,
      })) || user;

    const persistedSession = await createUserSession(user.id);
    const session = createSessionToken(user.id, {
      sessionId: persistedSession.id,
      expiresAt: persistedSession.expiresAt.getTime(),
    });
    auditSignIn('success', 200, 'signin_completed', user.id, {
      twoFactorMethod: user.twoFactorMethod || 'none',
      transientChallengeRequired: requiresTransientPhoneSignIn(role),
    });
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: await buildPublicUser(req, user),
    });
  } catch (error) {
    const errorCode = (error as Error & { code?: string })?.code;
    if (errorCode === 'STORE_UNAVAILABLE') {
      logAuthFlowError(req, 'signin', 'persisted_signin_failed', error, {
        statusCode: 503,
      });
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'signin',
        outcome: 'error',
        statusCode: 503,
        metadata: { reason: 'store_unavailable' },
      });
      return res.status(503).json(PROFILE_STORE_UNAVAILABLE_RESPONSE);
    }
    logAuthFlowError(req, 'signin', 'unexpected_exception', error, {
      statusCode: 500,
      emailHash,
    });
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'signin',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    return res.status(500).json({ error: 'Failed to sign in user' });
  }
});

/**
 * POST /api/user/create
 * Create a new canonical user profile in the database.
 */
publicRouter.post('/create', validateJsonBody(userCreateSchema), async (req: Request, res: Response): Promise<any> => {
  setAuthResponseNoStore(res);
  let emailHash: string | null = null;
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    emailHash = email ? safeLogHash(email) : null;
    const password = String(req.body?.password || '');
    const requestedName = String(req.body?.name || '').trim();
    const requestedLocation = normalizeOptionalString(req.body?.location);
    const requestedDateOfBirth = normalizeDateOfBirth(req.body?.dateOfBirth);
    const requestedTwoFactor = normalizeTwoFactorMethod(req.body?.twoFactorMethod);
    const requestedPhone = normalizePhoneNumber(req.body?.phoneNumber);
    const requestedWalletDid = String(req.body?.walletDid || '').trim() || null;
    const requestedProfileMedia = normalizeProfileMedia(
      req.body?.profileMedia,
      normalizeOptionalString(req.body?.avatarUrl),
      normalizeOptionalString(req.body?.bannerUrl)
    );
    const auditCreate = (
      outcome: 'success' | 'deny' | 'error',
      statusCode: number,
      reason: string,
      actorUserId?: string | null,
      metadata?: Record<string, unknown>
    ): void => {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'create',
        outcome,
        actorUserId: actorUserId || null,
        statusCode,
        metadata: {
          reason,
          requestedTwoFactor,
          ...metadata,
        },
      });
    };

    if (!email || !password) {
      auditCreate('deny', 400, 'missing_required_fields');
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    const passwordPolicyError = validatePasswordPolicy(email, password);
    if (passwordPolicyError) {
      auditCreate('deny', 400, 'password_policy_rejected');
      return res.status(400).json({ error: passwordPolicyError });
    }

    if (requestedDateOfBirth === 'invalid') {
      auditCreate('deny', 400, 'invalid_date_of_birth');
      return res.status(400).json({ error: 'dateOfBirth must be a valid date string' });
    }

    const passwordFingerprint = computePasswordFingerprint(password);
    const reusedPasswordUser = await localStore.findUserByPasswordFingerprint(passwordFingerprint);
    if (reusedPasswordUser) {
      auditCreate('deny', 400, 'password_fingerprint_reused');
      return res.status(400).json({
        error: 'Choose a unique password that is not already used by another profile',
      });
    }

    const name = requestedName || toIdentityName(email);
    const passwordHash = hashPassword(password);

    const user = await localStore.createUser({
      email,
      name,
      password: passwordHash,
      passwordFingerprint,
      // Tier remains unassigned until Stripe checkout confirmation.
      tier: '',
      location: requestedLocation,
      dateOfBirth: requestedDateOfBirth || null,
      avatarUrl: normalizeOptionalString(req.body?.avatarUrl),
      bannerUrl: normalizeOptionalString(req.body?.bannerUrl),
      profileMedia: requestedProfileMedia,
      phoneNumber: null,
      twoFactorMethod: 'none',
      walletDid: null,
      initialTwoFactorRequiredAt: isInitialTwoFactorEnforced() ? new Date() : null,
      initialTwoFactorCompletedAt: null,
    });

    // Persistence verification before granting hub access.
    const persisted = await localStore.getUserById(user.id);
    if (!persisted) {
      auditCreate('error', 500, 'persistence_verification_failed', user.id);
      return res
        .status(500)
        .json({ error: 'User persistence verification failed after database write' });
    }

    await mirrorUserToGoogleSheets({
      userId: persisted.id,
      email: persisted.email,
      name: persisted.name || toIdentityName(persisted.email),
      tier: persisted.tier || '',
      createdAt: persisted.createdAt.toISOString(),
    });

    let persistedSession;
    try {
      persistedSession = await createUserSession(persisted.id);
    } catch (sessionError) {
      logAuthFlowError(req, 'create', 'session_establish_failed', sessionError, {
        statusCode: 503,
        userId: persisted.id,
        emailHash,
      });
      auditCreate('error', 503, 'session_establish_failed', persisted.id);
      return res.status(503).json(PROFILE_SESSION_ESTABLISH_FAILED_RESPONSE);
    }

    const session = createSessionToken(persisted.id, {
      sessionId: persistedSession.id,
      expiresAt: persistedSession.expiresAt.getTime(),
    });
    const verification = await sendVerificationEmailForUser(req, persisted);
    auditCreate('success', 200, 'create_completed', persisted.id);

    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      persistenceVerified: true,
      user: await buildPublicUser(req, persisted),
      security: {
        passwordPolicy: {
          minLength: MIN_PASSWORD_LENGTH,
          requiresUpper: true,
          requiresLower: true,
          requiresNumber: true,
          requiresSymbol: true,
        },
        twoFactorMethod: persisted.twoFactorMethod,
      },
      emailVerification: {
        sent: verification.sent,
        ...(verification.devVerificationUrl ? { devVerificationUrl: verification.devVerificationUrl } : {}),
      },
    });
  } catch (error) {
    const duplicateCode = (error as Error & { code?: string })?.code;
    if (duplicateCode === 'DUPLICATE_USER') {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'create',
        outcome: 'deny',
        statusCode: 409,
        metadata: { reason: 'duplicate_user' },
      });
      return res.status(409).json({ error: 'A profile with this email already exists' });
    }
    if (duplicateCode === 'STORE_UNAVAILABLE') {
      logAuthFlowError(req, 'create', 'profile_persistence_failed', error, {
        statusCode: 503,
      });
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'create',
        outcome: 'error',
        statusCode: 503,
        metadata: { reason: 'store_unavailable' },
      });
      return res.status(503).json(PROFILE_STORE_UNAVAILABLE_RESPONSE);
    }
    logAuthFlowError(req, 'create', 'unexpected_exception', error, {
      statusCode: 500,
      emailHash,
    });
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'create',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    return res.status(500).json({ error: 'Failed to create user profile' });
  }
});

/**
 * POST /api/user/password-reset/request
 * Start native password recovery without revealing whether an email exists.
 */
publicRouter.post(
  '/password-reset/request',
  validateJsonBody(userPasswordResetRequestSchema),
  async (req: Request, res: Response): Promise<any> => {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const emailHash = normalizedEmail ? safeLogHash(normalizedEmail) : null;

    try {
      if (!isPasswordResetEnabled()) {
        recordAuditEvent(req, {
          domain: 'auth',
          action: 'password_reset_request',
          outcome: 'deny',
          statusCode: 503,
          metadata: { emailHash, reason: 'password_reset_deferred_for_launch' },
        });
        return res.status(503).json({
          error: 'Password reset email is currently disabled. Please contact support.',
          code: 'PASSWORD_RESET_DEFERRED',
        });
      }

      const user = normalizedEmail ? await localStore.getUserByEmail(normalizedEmail) : null;
      let devResetUrl: string | undefined;

      if (user && canUseNativePasswordReset(user)) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = hashPasswordResetToken(token);
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
        const resetUrl = buildPasswordResetUrl(req, token);

        await localStore.updateUser(user.id, {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        });

        const emailResult = await emailService.send({
          to: user.email,
          subject: 'Reset your Conscious Network Hub password',
          text: [
            'We received a request to reset your Conscious Network Hub password.',
            `Open this link within 60 minutes: ${resetUrl}`,
            'If you did not request this, you can ignore this email.',
          ].join('\n\n'),
          html: `
            <p>We received a request to reset your Conscious Network Hub password.</p>
            <p><a href="${resetUrl}">Reset your password</a></p>
            <p>This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>
          `,
        });

        if (emailResult?.skipped && process.env.NODE_ENV !== 'production') {
          devResetUrl = resetUrl;
          console.log('[AUTH][PASSWORD_RESET][DEV]', { emailHash, resetUrl });
        }

        recordAuditEvent(req, {
          domain: 'auth',
          action: 'password_reset_request',
          outcome: 'success',
          statusCode: 200,
          targetUserId: user.id,
          metadata: { emailHash, emailSkipped: Boolean(emailResult?.skipped) },
        });
      } else {
        recordAuditEvent(req, {
          domain: 'auth',
          action: 'password_reset_request',
          outcome: 'deny',
          statusCode: 200,
          metadata: { emailHash, reason: user ? 'unsupported_native_reset_role' : 'user_not_found' },
        });
      }

      return res.json({
        success: true,
        message: 'If an account exists for that email, a password reset link has been sent.',
        ...(devResetUrl ? { devResetUrl } : {}),
      });
    } catch (error) {
      console.error('[AUTH][PASSWORD_RESET] request failed', error);
      return res.status(500).json({ error: 'Unable to start password reset. Please retry.' });
    }
  }
);

/**
 * POST /api/user/password-reset/confirm
 * Complete native password recovery with a valid reset token.
 */
publicRouter.post(
  '/password-reset/confirm',
  validateJsonBody(userPasswordResetConfirmSchema),
  async (req: Request, res: Response): Promise<any> => {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    const tokenHash = hashPasswordResetToken(token);

    try {
      if (!isPasswordResetEnabled()) {
        return res.status(503).json({
          error: 'Password reset is currently disabled. Please contact support.',
          code: 'PASSWORD_RESET_DEFERRED',
        });
      }

      const user = await localStore.findUserByPasswordResetTokenHash(tokenHash);
      if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Reset link is invalid or expired' });
      }

      const passwordValidation = validatePasswordPolicy(user.email, password);
      if (passwordValidation) {
        return res.status(400).json({ error: passwordValidation });
      }

      await localStore.updateUser(user.id, {
        password: hashPassword(password),
        passwordFingerprint: computePasswordFingerprint(password),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        pendingPhoneOtpHash: null,
        pendingPhoneOtpExpiresAt: null,
        pendingPhoneOtpAttempts: 0,
        failedSignInAttempts: 0,
        lockoutUntil: null,
      });
      const sessionsRevoked = await revokeUserSessionsByUserId(user.id);

      recordAuditEvent(req, {
        domain: 'auth',
        action: 'password_reset_confirm',
        outcome: 'success',
        statusCode: 200,
        targetUserId: user.id,
        metadata: { sessionsRevoked },
      });

      return res.json({
        success: true,
        message: 'Password reset complete. You can sign in with your new password.',
      });
    } catch (error) {
      console.error('[AUTH][PASSWORD_RESET] confirm failed', error);
      return res.status(500).json({ error: 'Unable to reset password. Please retry.' });
    }
  }
);

/**
 * POST /api/user/email-verification/confirm
 * Verify a direct platform user's email address.
 */
publicRouter.post(
  '/email-verification/confirm',
  validateJsonBody(userEmailVerificationConfirmSchema),
  async (req: Request, res: Response): Promise<any> => {
    const token = String(req.body?.token || '').trim();
    const tokenHash = hashEmailVerificationToken(token);
    try {
      if (!isEmailVerificationEnabled()) {
        return res.status(503).json({
          error: 'Email verification is deferred for launch.',
          code: 'EMAIL_VERIFICATION_DEFERRED',
        });
      }

      const user = await localStore.findUserByEmailVerificationTokenHash(tokenHash);
      if (
        !user ||
        !user.emailVerificationExpiresAt ||
        user.emailVerificationExpiresAt.getTime() <= Date.now()
      ) {
        return res.status(400).json({ error: 'Verification link is invalid or expired' });
      }

      await localStore.updateUser(user.id, {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      });

      recordAuditEvent(req, {
        domain: 'auth',
        action: 'email_verification_confirm',
        outcome: 'success',
        statusCode: 200,
        targetUserId: user.id,
      });

      return res.json({ success: true, message: 'Email verified. You can continue into the hub.' });
    } catch (error) {
      console.error('[AUTH][EMAIL_VERIFICATION] confirm failed', error);
      return res.status(500).json({ error: 'Unable to verify email. Please retry.' });
    }
  }
);

/**
 * GET /api/user/create/diagnostics
 * Admin endpoint for runtime store health and recovery diagnostics.
 */
publicRouter.get('/create/diagnostics', async (req: Request, res: Response): Promise<any> => {
  if (!enforceDiagnosticsAdminAccess(req, res)) {
    return;
  }

  try {
    return res.json({
      success: true,
      diagnostics: await localStore.getDiagnostics(),
    });
  } catch (error) {
    console.error('Failed to build create diagnostics:', error);
    return res.status(500).json({ error: 'Failed to generate diagnostics' });
  }
});

/**
 * GET /api/user/current
 * Return canonical authenticated user identity.
 */
protectedRouter.use(requireCanonicalIdentity);

protectedRouter.get('/current', async (req: Request, res: Response): Promise<any> => {
  setAuthResponseNoStore(res);
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      logIdentityValidationFailure(req, 'missing_auth_user_after_identity_middleware');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await localStore.getUserById(authUserId);
    if (!user) {
      logIdentityValidationFailure(req, 'authenticated_user_not_found', { authUserId });
      return res.status(401).json({ error: 'Invalid session user' });
    }

    return res.json({
      success: true,
      user: await buildPublicUser(req, user),
    });
  } catch (error) {
    logAuthFlowError(req, 'current', 'unexpected_exception', error, {
      statusCode: 500,
    });
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

/**
 * POST /api/user/logout
 * Revoke the active authenticated user session.
 */
protectedRouter.post('/logout', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'logout',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const authSessionId = getAuthenticatedSessionId(req);
  try {
    if (authSessionId) {
      await revokeUserSession(authSessionId);
    }

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'logout',
      outcome: 'success',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 200,
      metadata: {
        sessionRevoked: Boolean(authSessionId),
      },
    });

    return res.json({
      success: true,
      sessionRevoked: Boolean(authSessionId),
    });
  } catch (error) {
    logAuthFlowError(req, 'logout', 'session_revoke_failed', error, {
      statusCode: 500,
      authSessionId: authSessionId || null,
    });
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'logout',
      outcome: 'error',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    return res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/**
 * GET /api/user/reconcile/:id
 * Reconciliation endpoint for canonical identity/tier/created timestamp.
 */
protectedRouter.get('/reconcile/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const requestedId = req.params.id;
    if (!enforceAuthenticatedUserMatch(req, res, requestedId, 'params.id')) {
      return;
    }

    const user = await localStore.getUserById(requestedId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      canonicalUserId: user.id,
      tier: toPublicTier(user),
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error reconciling user:', error);
    return res.status(500).json({ error: 'Failed to reconcile user' });
  }
});

/**
 * GET /api/user/directory
 * Basic directory for authenticated hub users.
 */
protectedRouter.get('/directory', async (req: Request, res: Response): Promise<any> => {
  try {
    const users = await localStore.listUsers(250);
    const visibleUsers = users.filter((user) => !isAutomatedDirectoryProfile(user));

    return res.json({
      success: true,
      users: visibleUsers.map((u) => ({
        id: u.id,
        name: u.name || 'Node',
        handle: u.handle || null,
        avatarUrl: absolutizeUrl(req, u.avatarUrl),
        profileMedia: absolutizeProfileMedia(req, u.profileMedia, u.avatarUrl, u.bannerUrl),
        location: u.location || null,
        bio: u.bio || null,
        tier: toPublicTier(u),
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error loading user directory:', error);
    return res.status(500).json({ error: 'Failed to load user directory' });
  }
});

/**
 * GET /api/user/privacy
 * Get authenticated user's privacy settings.
 */
protectedRouter.get('/privacy', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await localStore.getUserById(authUserId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    success: true,
    privacySettings: normalizePrivacySettings(user.privacySettings),
  });
});

/**
 * PUT /api/user/privacy
 * Update authenticated user's privacy settings.
 */
protectedRouter.put('/privacy', validateJsonBody(userPrivacyUpdateSchema), async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_update',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const nextPrivacySettings = normalizePrivacySettings(req.body?.privacySettings);
  const updated = await localStore.updateUser(authUserId, {
    privacySettings: nextPrivacySettings,
  });

  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_update',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: 'privacy_update',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: {
      profileVisibility: nextPrivacySettings.profileVisibility,
      blockedUsersCount: nextPrivacySettings.blockedUsers.length,
    },
  });

  return res.json({
    success: true,
    privacySettings: normalizePrivacySettings(updated.privacySettings),
  });
});

/**
 * POST /api/user/privacy/block/:blockedUserId
 * Add a user to the authenticated user's blocked list.
 */
protectedRouter.post('/privacy/block/:blockedUserId', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const blockedUserId = String(req.params.blockedUserId || '').trim();
  if (!blockedUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_blocked_user_id' },
    });
    return res.status(400).json({ error: 'blockedUserId is required' });
  }
  if (blockedUserId === authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 400,
      metadata: { reason: 'cannot_block_self' },
    });
    return res.status(400).json({ error: 'Users cannot block themselves' });
  }

  const [currentUser, targetUser] = await Promise.all([
    localStore.getUserById(authUserId),
    localStore.getUserById(blockedUserId),
  ]);
  if (!currentUser) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 404,
      metadata: { reason: 'authenticated_user_not_found' },
    });
    return res.status(404).json({ error: 'Authenticated user not found' });
  }
  if (!targetUser) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 404,
      metadata: { reason: 'target_user_not_found' },
    });
    return res.status(404).json({ error: 'Target user not found' });
  }

  const settings = normalizePrivacySettings(currentUser.privacySettings);
  const blockedUsers = [...new Set([...settings.blockedUsers, blockedUserId])];
  const updated = await localStore.updateUser(authUserId, {
    privacySettings: {
      ...settings,
      blockedUsers,
    },
  });

  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_add',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found_after_update' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: 'privacy_block_add',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: blockedUserId,
    statusCode: 200,
    metadata: { blockedUsersCount: blockedUsers.length },
  });

  return res.json({
    success: true,
    privacySettings: normalizePrivacySettings(updated.privacySettings),
  });
});

/**
 * DELETE /api/user/privacy/block/:blockedUserId
 * Remove a user from the authenticated user's blocked list.
 */
protectedRouter.delete('/privacy/block/:blockedUserId', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_remove',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const blockedUserId = String(req.params.blockedUserId || '').trim();
  if (!blockedUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_remove',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_blocked_user_id' },
    });
    return res.status(400).json({ error: 'blockedUserId is required' });
  }

  const currentUser = await localStore.getUserById(authUserId);
  if (!currentUser) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_remove',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 404,
      metadata: { reason: 'authenticated_user_not_found' },
    });
    return res.status(404).json({ error: 'Authenticated user not found' });
  }

  const settings = normalizePrivacySettings(currentUser.privacySettings);
  const blockedUsers = settings.blockedUsers.filter((entry) => entry !== blockedUserId);
  const updated = await localStore.updateUser(authUserId, {
    privacySettings: {
      ...settings,
      blockedUsers,
    },
  });

  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'privacy_block_remove',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: blockedUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found_after_update' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: 'privacy_block_remove',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: blockedUserId,
    statusCode: 200,
    metadata: { blockedUsersCount: blockedUsers.length },
  });

  return res.json({
    success: true,
    privacySettings: normalizePrivacySettings(updated.privacySettings),
  });
});

/**
 * GET /api/user/security
 * Inspect current account security setup.
 */
protectedRouter.get('/security', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await localStore.getUserById(authUserId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    success: true,
    security: {
      twoFactorMethod: user.twoFactorMethod,
      phoneNumberMasked: maskPhoneNumber(user.phoneNumber),
      walletDid: maskWalletDid(user.walletDid),
      lockoutUntil: user.lockoutUntil,
      initialTwoFactorRequired: isInitialTwoFactorRequired(user),
      initialTwoFactorCompleted: Boolean(user.initialTwoFactorCompletedAt),
      canAccessFullPlatform: !isInitialTwoFactorRequired(user),
    },
  });
});

/**
 * POST /api/user/2fa/phone/enroll
 * Enroll authenticated user in phone-based 2FA.
 */
protectedRouter.post('/2fa/phone/enroll', validateJsonBody(userPhoneEnrollSchema), async (req: Request, res: Response): Promise<any> => {
  if (!isUserTwoFactorEnabled()) {
    return res.status(503).json({
      error: 'User phone 2FA enrollment is deferred for launch.',
      code: 'USER_2FA_DEFERRED',
    });
  }

  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_phone',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
  if (!phoneNumber) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_phone',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'invalid_phone_number' },
    });
    return res.status(400).json({ error: 'Valid phoneNumber is required' });
  }

  const existing = await localStore.getUserById(authUserId);
  const shouldCompleteInitialTwoFactor =
    Boolean(existing?.initialTwoFactorRequiredAt) && !existing?.initialTwoFactorCompletedAt;
  const updated = await localStore.updateUser(authUserId, {
    phoneNumber: null,
    twoFactorMethod: 'phone',
    ...(shouldCompleteInitialTwoFactor ? { initialTwoFactorCompletedAt: new Date() } : {}),
  });
  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_phone',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: '2fa_enroll_phone',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: { twoFactorMethod: updated.twoFactorMethod },
  });

  return res.json({
    success: true,
    twoFactorMethod: updated.twoFactorMethod,
    phoneNumberMasked: null,
    phoneNumberStored: false,
    security: {
      twoFactorMethod: updated.twoFactorMethod,
      phoneNumberMasked: null,
      walletDid: maskWalletDid(updated.walletDid),
      initialTwoFactorRequired: isInitialTwoFactorRequired(updated),
      initialTwoFactorCompleted: Boolean(updated.initialTwoFactorCompletedAt),
      canAccessFullPlatform: !isInitialTwoFactorRequired(updated),
    },
    user: toPublicUser(req, updated),
  });
});

/**
 * POST /api/user/2fa/wallet/enroll
 * Enroll authenticated user in wallet-based 2FA.
 */
protectedRouter.post('/2fa/wallet/enroll', validateJsonBody(userWalletEnrollSchema), async (req: Request, res: Response): Promise<any> => {
  if (!isUserTwoFactorEnabled()) {
    return res.status(503).json({
      error: 'User wallet 2FA enrollment is deferred for launch.',
      code: 'USER_2FA_DEFERRED',
    });
  }

  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_wallet',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const walletDid = String(req.body?.walletDid || '').trim();
  if (!walletDid) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_wallet',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_wallet_did' },
    });
    return res.status(400).json({ error: 'walletDid is required' });
  }

  const existing = await localStore.getUserById(authUserId);
  const shouldCompleteInitialTwoFactor =
    Boolean(existing?.initialTwoFactorRequiredAt) && !existing?.initialTwoFactorCompletedAt;
  const updated = await localStore.updateUser(authUserId, {
    walletDid,
    twoFactorMethod: 'wallet',
    ...(shouldCompleteInitialTwoFactor ? { initialTwoFactorCompletedAt: new Date() } : {}),
  });
  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_enroll_wallet',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: '2fa_enroll_wallet',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: { twoFactorMethod: updated.twoFactorMethod },
  });

  return res.json({
    success: true,
    twoFactorMethod: updated.twoFactorMethod,
    walletDid: maskWalletDid(updated.walletDid),
    security: {
      twoFactorMethod: updated.twoFactorMethod,
      phoneNumberMasked: maskPhoneNumber(updated.phoneNumber),
      walletDid: maskWalletDid(updated.walletDid),
      initialTwoFactorRequired: isInitialTwoFactorRequired(updated),
      initialTwoFactorCompleted: Boolean(updated.initialTwoFactorCompletedAt),
      canAccessFullPlatform: !isInitialTwoFactorRequired(updated),
    },
    user: toPublicUser(req, updated),
  });
});

/**
 * POST /api/user/2fa/disable
 * Disable 2FA for authenticated user.
 */
protectedRouter.post('/2fa/disable', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_disable',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const updated = await localStore.updateUser(authUserId, {
    twoFactorMethod: 'none',
    pendingPhoneOtpHash: null,
    pendingPhoneOtpExpiresAt: null,
    pendingPhoneOtpAttempts: 0,
  });
  if (!updated) {
    recordAuditEvent(req, {
      domain: 'profile',
      action: '2fa_disable',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'profile',
    action: '2fa_disable',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: { twoFactorMethod: updated.twoFactorMethod },
  });

  return res.json({
    success: true,
    twoFactorMethod: updated.twoFactorMethod,
  });
});

/**
 * PUT /api/user/:id
 * Edit user profile (including background video).
 * Requires canonical identity match with user ID.
 */
protectedRouter.put('/:id', validateJsonBody(userProfilePatchSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, id, 'params.id')) {
      recordAuditEvent(req, {
        domain: 'profile',
        action: 'profile_update',
        outcome: 'deny',
        targetUserId: id,
        statusCode: 403,
        metadata: { reason: 'canonical_user_mismatch' },
      });
      return;
    }

    const parsedPatch = parseUserProfilePatch(req.body, {
      allowedFields: USER_PROFILE_PATCH_FIELDS,
    });
    if (parsedPatch.error) {
      recordAuditEvent(req, {
        domain: 'profile',
        action: 'profile_update',
        outcome: 'deny',
        actorUserId: id,
        targetUserId: id,
        statusCode: 400,
        metadata: { reason: 'invalid_patch_payload' },
      });
      return res.status(400).json({ error: parsedPatch.error });
    }

    const persisted = await localStore.updateUser(id, parsedPatch.updates);

    if (!persisted) {
      recordAuditEvent(req, {
        domain: 'profile',
        action: 'profile_update',
        outcome: 'deny',
        actorUserId: id,
        targetUserId: id,
        statusCode: 404,
        metadata: { reason: 'user_not_found_after_update' },
      });
      return res.status(404).json({ error: 'User not found after update' });
    }

    recordAuditEvent(req, {
      domain: 'profile',
      action: 'profile_update',
      outcome: 'success',
      actorUserId: id,
      targetUserId: id,
      statusCode: 200,
      metadata: {
        fieldsUpdated: Object.keys(parsedPatch.updates),
      },
    });

    return res.json({
      success: true,
      user: toPublicUser(req, persisted),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    recordAuditEvent(req, {
      domain: 'profile',
      action: 'profile_update',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

const router = Router();
router.use(publicRouter);
router.use(protectedRouter);

export { publicRouter as userPublicRoutes, protectedRouter as userProtectedRoutes };
export default router;
