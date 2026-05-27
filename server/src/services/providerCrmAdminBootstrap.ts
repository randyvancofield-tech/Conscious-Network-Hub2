import { computePasswordFingerprint, hashPassword } from '../auth';
import { getPrisma } from './prismaClient';
import {
  PROVIDER_CRM_LEGACY_ADMIN_EMAILS,
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  getConfiguredProviderCrmAdminWalletAddress,
} from './providerCrm';

const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;
const normalizeEmail = (value: unknown): string => String(value || '').trim().toLowerCase();
const DEFAULT_BOOTSTRAP_MAX_ATTEMPTS = 3;
const DEFAULT_BOOTSTRAP_RETRY_MS = 1500;

const legacyAdminCleanupData = {
  role: 'user',
  walletAddress: null,
  failedSignInAttempts: 0,
  lockoutUntil: null,
  passwordResetTokenHash: null,
  passwordResetExpiresAt: null,
  pendingPhoneOtpHash: null,
  pendingPhoneOtpExpiresAt: null,
  pendingPhoneOtpAttempts: 0,
};

const parsePositiveIntEnv = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDatabaseError = (error: unknown): boolean => {
  const maybeError = error as Error & { code?: string; errorCode?: string };
  const code = String(maybeError?.code || maybeError?.errorCode || '').trim().toUpperCase();
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    ['P1000', 'P1001', 'P1002', 'P1017'].includes(code) ||
    /can't reach database server|timed out|timeout|connection terminated|connection refused|econnreset|enotfound|network/i.test(
      message
    )
  );
};

const errorSummary = (error: unknown): Record<string, string | null> => {
  const maybeError = error as Error & { code?: string; errorCode?: string };
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: String(maybeError?.code || maybeError?.errorCode || '') || null,
    message: error instanceof Error ? error.message : String(error || ''),
  };
};

const ensureProviderCrmAdminFromEnvOnce = async (): Promise<void> => {
  const initialPassword = String(process.env[INITIAL_PASSWORD_ENV] || '').trim();
  if (initialPassword.length > 0 && initialPassword.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
    console.error(
      `[ProviderCRMAdminBootstrap] ${INITIAL_PASSWORD_ENV} must be at least ${MIN_BOOTSTRAP_PASSWORD_LENGTH} characters.`
    );
    return;
  }

  const db = getPrisma() as any;
  const passwordData =
    initialPassword.length > 0
      ? {
          password: hashPassword(initialPassword),
          passwordFingerprint: computePasswordFingerprint(initialPassword),
        }
      : {};
  const candidateEmails = Array.from(
    new Set([PROVIDER_CRM_SOLE_ADMIN_EMAIL, ...PROVIDER_CRM_LEGACY_ADMIN_EMAILS])
  );
  const configuredAdminWalletAddress = getConfiguredProviderCrmAdminWalletAddress();
  const existingUsers = await db.user.findMany({
    where: {
      OR: candidateEmails.map((email) => ({
        email: {
          equals: email,
          mode: 'insensitive',
        },
      })),
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  const adminData = {
    name: 'CNH Provider CRM Administrator',
    role: 'admin',
    ...(configuredAdminWalletAddress ? { walletAddress: configuredAdminWalletAddress } : {}),
    emailVerified: true,
    tier: 'Accelerated Tier',
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    failedSignInAttempts: 0,
    lockoutUntil: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    ...passwordData,
  };

  const currentEmailUser =
    existingUsers.find((user: { email: string }) => normalizeEmail(user.email) === PROVIDER_CRM_SOLE_ADMIN_EMAIL) ||
    null;
  const legacyUsers = existingUsers.filter(
    (user: { email: string }) => normalizeEmail(user.email) !== PROVIDER_CRM_SOLE_ADMIN_EMAIL
  );

  if (currentEmailUser) {
    const demoteLegacyAdminOperations = legacyUsers
      .filter((user: { role: string }) => String(user.role || '').toLowerCase() === 'admin')
      .map((user: { id: string }) =>
        db.user.update({
          where: { id: user.id },
          data: legacyAdminCleanupData,
        })
      );

    await db.$transaction([
      db.user.update({
        where: { id: currentEmailUser.id },
        data: {
          ...adminData,
          email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
        },
      }),
      ...demoteLegacyAdminOperations,
    ]);
    console.log('[ProviderCRMAdminBootstrap] Provider CRM administrator repaired from env.');
    return;
  }

  if (legacyUsers.length > 1) {
    console.error(
      `[ProviderCRMAdminBootstrap] Refusing to repair admin account because ${legacyUsers.length} legacy admin email matches exist.`
    );
    return;
  }

  const legacy = legacyUsers[0] || null;
  if (legacy) {
    await db.user.update({
      where: { id: legacy.id },
      data: {
        ...adminData,
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      },
    });
    console.log('[ProviderCRMAdminBootstrap] Legacy Provider CRM administrator migrated from env.');
    return;
  }

  if (!initialPassword) {
    console.log('[ProviderCRMAdminBootstrap] Provider CRM administrator not found; no initial password supplied.');
    return;
  }

  await db.user.create({
    data: {
      email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      ...adminData,
    },
  });
  console.log('[ProviderCRMAdminBootstrap] Provider CRM administrator created from env.');
};

export const ensureProviderCrmAdminFromEnv = async (): Promise<void> => {
  const maxAttempts = parsePositiveIntEnv(
    'PROVIDER_CRM_ADMIN_BOOTSTRAP_MAX_ATTEMPTS',
    DEFAULT_BOOTSTRAP_MAX_ATTEMPTS
  );
  const retryMs = parsePositiveIntEnv(
    'PROVIDER_CRM_ADMIN_BOOTSTRAP_RETRY_MS',
    DEFAULT_BOOTSTRAP_RETRY_MS
  );

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureProviderCrmAdminFromEnvOnce();
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableDatabaseError(error) || attempt >= maxAttempts) {
        break;
      }
      console.warn(
        '[ProviderCRMAdminBootstrap] Database unavailable during admin repair; retrying.',
        JSON.stringify({
          attempt,
          maxAttempts,
          retryMs,
          error: errorSummary(error),
        })
      );
      await wait(retryMs);
    }
  }

  console.error(
    '[ProviderCRMAdminBootstrap] Provider CRM administrator repair failed.',
    JSON.stringify({
      maxAttempts,
      error: errorSummary(lastError),
    })
  );
  throw lastError;
};
