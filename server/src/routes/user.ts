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
  getAuthenticatedUserId,
  logIdentityValidationFailure,
  requireCanonicalIdentity,
} from '../middleware';
import { localStore, TwoFactorMethod } from '../services/persistenceStore';
import { mirrorUserToGoogleSheets } from '../services/googleSheetsMirror';
import { getProviderSessionById } from '../services/providerSessionStore';
import { normalizeTier } from '../tierPolicy';

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

const maskPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
};

const normalizeOptionalString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
};

type UserMediaAsset = {
  url: string | null;
  storageProvider: string | null;
  objectKey: string | null;
};

type UserProfileMedia = {
  avatar: UserMediaAsset;
  cover: UserMediaAsset;
};

const normalizeUserMediaAsset = (
  value: unknown,
  fallbackUrl: string | null
): UserMediaAsset => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawUrl = String(input.url ?? '').trim();
  const rawStorageProvider = String(input.storageProvider ?? '').trim();
  const rawObjectKey = String(input.objectKey ?? '').trim();
  return {
    url: rawUrl || fallbackUrl || null,
    storageProvider: rawStorageProvider || null,
    objectKey: rawObjectKey || null,
  };
};

const normalizeProfileMedia = (
  value: unknown,
  avatarFallback: string | null,
  coverFallback: string | null
): UserProfileMedia => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    avatar: normalizeUserMediaAsset(input.avatar, avatarFallback),
    cover: normalizeUserMediaAsset(input.cover, coverFallback),
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

const normalizeDateOfBirth = (value: unknown): Date | null | 'invalid' => {
  if (value === undefined) return null;
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'invalid';
  return parsed;
};

const normalizeInterests = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
};

const normalizePrivacySettings = (
  value: unknown
): { profileVisibility: 'public' | 'private'; showEmail: boolean; allowMessages: boolean; blockedUsers: string[] } => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const visibility =
    String(input.profileVisibility || '').trim().toLowerCase() === 'private'
      ? 'private'
      : 'public';
  const blockedUsers = Array.isArray(input.blockedUsers)
    ? input.blockedUsers
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 500)
    : [];
  return {
    profileVisibility: visibility,
    showEmail: Boolean(input.showEmail),
    allowMessages: input.allowMessages === undefined ? true : Boolean(input.allowMessages),
    blockedUsers: [...new Set(blockedUsers)],
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
});

/**
 * POST /api/user/signin
 * Authenticate an existing user with canonical backend identity.
 */
publicRouter.post('/signin', async (req: Request, res: Response): Promise<any> => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const twoFactorCode = String(req.body?.twoFactorCode || '').trim();
    const providerToken = String(req.body?.providerToken || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    let user = await localStore.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
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
        return res.status(423).json({
          error: 'Account temporarily locked due to repeated failed sign-in attempts',
          lockoutUntil,
        });
      }

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

        console.log(
          `[2FA][PHONE][DEV] OTP for ${maskPhoneNumber(user.phoneNumber)} (${user.email}): ${code}`
        );

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
          return res.status(429).json({
            error: 'Too many invalid 2FA attempts. Restart sign-in to request a new code',
          });
        }

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
        return res.status(202).json({
          success: false,
          requiresTwoFactor: true,
          method: 'wallet',
          message: 'Wallet provider session token required to complete sign-in',
        });
      }

      const providerPayload = verifyProviderSessionToken(providerToken);
      if (!providerPayload) {
        return res.status(401).json({ error: 'Invalid or expired wallet provider token' });
      }

      const providerSession = await getProviderSessionById(providerPayload.sessionId);
      if (!providerSession || providerSession.revokedAt) {
        return res.status(401).json({ error: 'Wallet provider session is invalid or revoked' });
      }

      if (providerSession.expiresAt.getTime() <= Date.now()) {
        return res.status(401).json({ error: 'Wallet provider session expired' });
      }

      if (providerSession.did !== providerPayload.did) {
        return res.status(401).json({ error: 'Wallet provider identity mismatch' });
      }

      if (user.walletDid && providerSession.did !== user.walletDid) {
        return res.status(403).json({ error: 'Wallet DID does not match enrolled profile wallet' });
      }
    }

    user =
      (await localStore.updateUser(user.id, {
        failedSignInAttempts: 0,
        lockoutUntil: null,
      })) || user;

    const session = createSessionToken(user.id);
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: toPublicUser(req, user),
    });
  } catch (error) {
    const errorCode = (error as Error & { code?: string })?.code;
    if (errorCode === 'STORE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Profile storage is temporarily unavailable. Retry shortly or contact support.',
      });
    }
    console.error('Error signing in user:', error);
    return res.status(500).json({ error: 'Failed to sign in user' });
  }
});

/**
 * POST /api/user/create
 * Create a new canonical user profile in the database.
 */
publicRouter.post('/create', async (req: Request, res: Response): Promise<any> => {
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    const passwordPolicyError = validatePasswordPolicy(email, password);
    if (passwordPolicyError) {
      return res.status(400).json({ error: passwordPolicyError });
    }

    if (requestedTwoFactor === 'phone' && !requestedPhone) {
      return res.status(400).json({ error: 'Phone number is required for phone-based 2FA' });
    }

    if (requestedTwoFactor === 'wallet' && !requestedWalletDid) {
      return res.status(400).json({ error: 'walletDid is required for wallet-based 2FA' });
    }

    if (requestedDateOfBirth === 'invalid') {
      return res.status(400).json({ error: 'dateOfBirth must be a valid date string' });
    }

    const passwordFingerprint = computePasswordFingerprint(password);
    const reusedPasswordUser = await localStore.findUserByPasswordFingerprint(passwordFingerprint);
    if (reusedPasswordUser) {
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

    const session = createSessionToken(persisted.id);

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
      return res.status(409).json({ error: 'A profile with this email already exists' });
    }
    if (duplicateCode === 'STORE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Profile storage is temporarily unavailable. Retry shortly or contact support.',
      });
    }
    console.error('Error creating user profile:', error);
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
protectedRouter.put('/privacy', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const nextPrivacySettings = normalizePrivacySettings(req.body?.privacySettings);
  const updated = await localStore.updateUser(authUserId, {
    privacySettings: nextPrivacySettings,
  });

  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

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
    return res.status(401).json({ error: 'Authentication required' });
  }

  const blockedUserId = String(req.params.blockedUserId || '').trim();
  if (!blockedUserId) {
    return res.status(400).json({ error: 'blockedUserId is required' });
  }
  if (blockedUserId === authUserId) {
    return res.status(400).json({ error: 'Users cannot block themselves' });
  }

  const [currentUser, targetUser] = await Promise.all([
    localStore.getUserById(authUserId),
    localStore.getUserById(blockedUserId),
  ]);
  if (!currentUser) {
    return res.status(404).json({ error: 'Authenticated user not found' });
  }
  if (!targetUser) {
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
    return res.status(404).json({ error: 'User not found' });
  }

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
    return res.status(401).json({ error: 'Authentication required' });
  }

  const blockedUserId = String(req.params.blockedUserId || '').trim();
  if (!blockedUserId) {
    return res.status(400).json({ error: 'blockedUserId is required' });
  }

  const currentUser = await localStore.getUserById(authUserId);
  if (!currentUser) {
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
    return res.status(404).json({ error: 'User not found' });
  }

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
      phoneNumberMasked: user.phoneNumber ? maskPhoneNumber(user.phoneNumber) : null,
      walletDid: user.walletDid,
      lockoutUntil: user.lockoutUntil,
    },
  });
});

/**
 * POST /api/user/2fa/phone/enroll
 * Enroll authenticated user in phone-based 2FA.
 */
protectedRouter.post('/2fa/phone/enroll', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Valid phoneNumber is required' });
  }

  const updated = await localStore.updateUser(authUserId, {
    phoneNumber,
    twoFactorMethod: 'phone',
  });
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

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
protectedRouter.post('/2fa/wallet/enroll', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const walletDid = String(req.body?.walletDid || '').trim();
  if (!walletDid) {
    return res.status(400).json({ error: 'walletDid is required' });
  }

  const updated = await localStore.updateUser(authUserId, {
    walletDid,
    twoFactorMethod: 'wallet',
  });
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    success: true,
    twoFactorMethod: updated.twoFactorMethod,
    walletDid: updated.walletDid,
  });
});

/**
 * POST /api/user/2fa/disable
 * Disable 2FA for authenticated user.
 */
protectedRouter.post('/2fa/disable', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const updated = await localStore.updateUser(authUserId, {
    twoFactorMethod: 'none',
    pendingPhoneOtpHash: null,
    pendingPhoneOtpExpiresAt: null,
    pendingPhoneOtpAttempts: 0,
  });
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

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
protectedRouter.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, id, 'params.id')) {
      return;
    }

    const updateData = req.body || {};
    const nextName =
      updateData.name !== undefined ? normalizeOptionalString(updateData.name) : undefined;
    const nextHandle =
      updateData.handle !== undefined ? normalizeOptionalString(updateData.handle) : undefined;
    const nextBio =
      updateData.bio !== undefined ? normalizeOptionalString(updateData.bio) : undefined;
    const nextLocation =
      updateData.location !== undefined ? normalizeOptionalString(updateData.location) : undefined;
    const nextDateOfBirthRaw =
      updateData.dateOfBirth !== undefined ? normalizeDateOfBirth(updateData.dateOfBirth) : undefined;
    if (nextDateOfBirthRaw === 'invalid') {
      return res.status(400).json({ error: 'dateOfBirth must be a valid date string' });
    }
    const nextDateOfBirth =
      nextDateOfBirthRaw === undefined ? undefined : nextDateOfBirthRaw;
    const nextAvatarUrl =
      updateData.avatarUrl !== undefined ? normalizeOptionalString(updateData.avatarUrl) : undefined;
    const nextBannerUrl =
      updateData.bannerUrl !== undefined ? normalizeOptionalString(updateData.bannerUrl) : undefined;
    const nextProfileMedia =
      updateData.profileMedia !== undefined
        ? normalizeProfileMedia(updateData.profileMedia, nextAvatarUrl || null, nextBannerUrl || null)
        : undefined;
    const nextInterests =
      updateData.interests !== undefined ? normalizeInterests(updateData.interests) : undefined;
    const nextTwitterUrl =
      updateData.twitterUrl !== undefined
        ? normalizeOptionalString(updateData.twitterUrl)
        : undefined;
    const nextGithubUrl =
      updateData.githubUrl !== undefined ? normalizeOptionalString(updateData.githubUrl) : undefined;
    const nextWebsiteUrl =
      updateData.websiteUrl !== undefined
        ? normalizeOptionalString(updateData.websiteUrl)
        : undefined;
    const nextPrivacySettings =
      updateData.privacySettings !== undefined
        ? normalizePrivacySettings(updateData.privacySettings)
        : undefined;
    const nextBackgroundVideo =
      updateData.profileBackgroundVideo !== undefined
        ? normalizeOptionalString(updateData.profileBackgroundVideo)
        : undefined;

    const persisted = await localStore.updateUser(id, {
      name: nextName,
      handle: nextHandle,
      bio: nextBio,
      location: nextLocation,
      dateOfBirth: nextDateOfBirth,
      avatarUrl: nextAvatarUrl,
      bannerUrl: nextBannerUrl,
      profileMedia: nextProfileMedia,
      interests: nextInterests,
      twitterUrl: nextTwitterUrl,
      githubUrl: nextGithubUrl,
      websiteUrl: nextWebsiteUrl,
      privacySettings: nextPrivacySettings,
      profileBackgroundVideo: nextBackgroundVideo,
    });

    if (!persisted) {
      return res.status(404).json({ error: 'User not found after update' });
    }

    return res.json({
      success: true,
      user: toPublicUser(req, persisted),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

const router = Router();
router.use(publicRouter);
router.use(protectedRouter);

export { publicRouter as userPublicRoutes, protectedRouter as userProtectedRoutes };
export default router;
