import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  computePasswordFingerprint,
  createSessionToken,
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from '../auth';
import { verifyProviderSessionToken } from '../auth/providerToken';
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
import { getProviderSessionById } from '../services/providerSessionStore';
import { maskPhoneNumber, maskWalletDid } from '../services/sensitiveDataPolicy';
import { createUserSession, revokeUserSession } from '../services/userSessionStore';
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
const MAX_PHONE_OTP_ATTEMPTS = 5;

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
  tier: normalizeTier(user.tier),
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
});

/**
 * POST /api/user/signin
 * Authenticate an existing user with canonical backend identity.
 */
publicRouter.post('/signin', validateJsonBody(userSignInSchema), async (req: Request, res: Response): Promise<any> => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
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

    if (user.twoFactorMethod === 'phone') {
      if (!user.phoneNumber) {
        auditSignIn('deny', 403, 'phone_2fa_missing_phone', user.id);
        return res.status(403).json({
          error: 'Phone 2FA is enabled but no phone number is configured for this profile',
        });
      }

      if (!twoFactorCode) {
        const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const hashedCode = computePasswordFingerprint(`otp:${code}`);
        const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);

        await localStore.updateUser(user.id, {
          pendingPhoneOtpHash: hashedCode,
          pendingPhoneOtpExpiresAt: expiresAt,
          pendingPhoneOtpAttempts: 0,
        });

        console.log(`[2FA][PHONE][DEV] Sign-in OTP issued for ${maskPhoneNumber(user.phoneNumber)}`);
        auditSignIn('deny', 202, 'two_factor_required_phone', user.id, {
          twoFactorMethod: 'phone',
        });

        return res.status(202).json({
          success: false,
          requiresTwoFactor: true,
          method: 'phone',
          message: 'Phone verification code required to complete sign-in',
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
          pendingPhoneOtpHash: null,
          pendingPhoneOtpExpiresAt: null,
          pendingPhoneOtpAttempts: 0,
        })) || user;
    }

    if (user.twoFactorMethod === 'wallet') {
      if (!providerToken) {
        auditSignIn('deny', 202, 'two_factor_required_wallet', user.id, {
          twoFactorMethod: 'wallet',
        });
        return res.status(202).json({
          success: false,
          requiresTwoFactor: true,
          method: 'wallet',
          message: 'Wallet provider session token required to complete sign-in',
        });
      }

      const providerPayload = verifyProviderSessionToken(providerToken);
      if (!providerPayload) {
        auditSignIn('deny', 401, 'wallet_provider_token_invalid', user.id);
        return res.status(401).json({ error: 'Invalid or expired wallet provider token' });
      }

      const providerSession = await getProviderSessionById(providerPayload.sessionId);
      if (!providerSession || providerSession.revokedAt) {
        auditSignIn('deny', 401, 'wallet_provider_session_invalid_or_revoked', user.id);
        return res.status(401).json({ error: 'Wallet provider session is invalid or revoked' });
      }

      if (providerSession.expiresAt.getTime() <= Date.now()) {
        auditSignIn('deny', 401, 'wallet_provider_session_expired', user.id);
        return res.status(401).json({ error: 'Wallet provider session expired' });
      }

      if (providerSession.did !== providerPayload.did) {
        auditSignIn('deny', 401, 'wallet_provider_identity_mismatch', user.id);
        return res.status(401).json({ error: 'Wallet provider identity mismatch' });
      }

      if (user.walletDid && providerSession.did !== user.walletDid) {
        auditSignIn('deny', 403, 'wallet_did_mismatch', user.id);
        return res.status(403).json({ error: 'Wallet DID does not match enrolled profile wallet' });
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
    });
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: toPublicUser(req, user),
    });
  } catch (error) {
    const errorCode = (error as Error & { code?: string })?.code;
    if (errorCode === 'STORE_UNAVAILABLE') {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'signin',
        outcome: 'error',
        statusCode: 503,
        metadata: { reason: 'store_unavailable' },
      });
      return res.status(503).json({
        error: 'Profile storage is temporarily unavailable. Retry shortly or contact support.',
      });
    }
    console.error('Error signing in user:', error);
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
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
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

    if (requestedTwoFactor === 'phone' && !requestedPhone) {
      auditCreate('deny', 400, 'phone_2fa_missing_phone');
      return res.status(400).json({ error: 'Phone number is required for phone-based 2FA' });
    }

    if (requestedTwoFactor === 'wallet' && !requestedWalletDid) {
      auditCreate('deny', 400, 'wallet_2fa_missing_wallet_did');
      return res.status(400).json({ error: 'walletDid is required for wallet-based 2FA' });
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
      tier: normalizeTier(req.body?.tier),
      location: requestedLocation,
      dateOfBirth: requestedDateOfBirth || null,
      avatarUrl: normalizeOptionalString(req.body?.avatarUrl),
      bannerUrl: normalizeOptionalString(req.body?.bannerUrl),
      profileMedia: requestedProfileMedia,
      phoneNumber: requestedPhone,
      twoFactorMethod: requestedTwoFactor,
      walletDid: requestedWalletDid,
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
      tier: persisted.tier,
      createdAt: persisted.createdAt.toISOString(),
    });

    const persistedSession = await createUserSession(persisted.id);
    const session = createSessionToken(persisted.id, {
      sessionId: persistedSession.id,
      expiresAt: persistedSession.expiresAt.getTime(),
    });
    auditCreate('success', 200, 'create_completed', persisted.id);

    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      persistenceVerified: true,
      user: toPublicUser(req, persisted),
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
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'create',
        outcome: 'error',
        statusCode: 503,
        metadata: { reason: 'store_unavailable' },
      });
      return res.status(503).json({
        error: 'Profile storage is temporarily unavailable. Retry shortly or contact support.',
      });
    }
    console.error('Error creating user profile:', error);
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
      user: toPublicUser(req, user),
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
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
      tier: normalizeTier(user.tier),
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

    return res.json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name || 'Node',
        tier: normalizeTier(u.tier),
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
    },
  });
});

/**
 * POST /api/user/2fa/phone/enroll
 * Enroll authenticated user in phone-based 2FA.
 */
protectedRouter.post('/2fa/phone/enroll', validateJsonBody(userPhoneEnrollSchema), async (req: Request, res: Response): Promise<any> => {
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

  const updated = await localStore.updateUser(authUserId, {
    phoneNumber,
    twoFactorMethod: 'phone',
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
    phoneNumberMasked: maskPhoneNumber(phoneNumber),
  });
});

/**
 * POST /api/user/2fa/wallet/enroll
 * Enroll authenticated user in wallet-based 2FA.
 */
protectedRouter.post('/2fa/wallet/enroll', validateJsonBody(userWalletEnrollSchema), async (req: Request, res: Response): Promise<any> => {
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

  const updated = await localStore.updateUser(authUserId, {
    walletDid,
    twoFactorMethod: 'wallet',
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
