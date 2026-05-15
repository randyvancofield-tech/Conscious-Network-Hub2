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

export const ensureProviderCrmAdminFromEnv = async (): Promise<void> => {
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
