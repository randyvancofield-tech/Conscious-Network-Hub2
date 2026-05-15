import { computePasswordFingerprint, hashPassword } from '../auth';
import { getPrisma } from './prismaClient';
import { PROVIDER_CRM_LEGACY_ADMIN_EMAILS, PROVIDER_CRM_SOLE_ADMIN_EMAIL } from './providerCrm';

const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;

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

  if (existingUsers.length > 1) {
    console.error(
      `[ProviderCRMAdminBootstrap] Refusing to repair admin account because ${existingUsers.length} current/legacy admin email matches exist.`
    );
    return;
  }

  const adminData = {
    name: 'CNH Provider CRM Administrator',
    role: 'admin',
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

  const existing = existingUsers[0] || null;
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        ...adminData,
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      },
    });
    console.log('[ProviderCRMAdminBootstrap] Provider CRM administrator repaired from env.');
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
