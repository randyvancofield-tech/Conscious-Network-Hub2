import { computePasswordFingerprint, hashPassword } from '../auth';
import { getPrisma } from './prismaClient';
import { PROVIDER_CRM_SOLE_ADMIN_EMAIL } from './providerCrm';

const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;

export const ensureProviderCrmAdminFromEnv = async (): Promise<void> => {
  const initialPassword = String(process.env[INITIAL_PASSWORD_ENV] || '').trim();
  if (!initialPassword) {
    return;
  }

  if (initialPassword.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
    console.error(
      `[ProviderCRMAdminBootstrap] ${INITIAL_PASSWORD_ENV} must be at least ${MIN_BOOTSTRAP_PASSWORD_LENGTH} characters.`
    );
    return;
  }

  const db = getPrisma() as any;
  const password = hashPassword(initialPassword);
  const passwordFingerprint = computePasswordFingerprint(initialPassword);
  const existing = await db.user.findUnique({
    where: { email: PROVIDER_CRM_SOLE_ADMIN_EMAIL },
    select: {
      id: true,
      role: true,
    },
  });

  const adminData = {
    name: 'CNH Provider CRM Administrator',
    role: 'admin',
    password,
    passwordFingerprint,
    emailVerified: true,
    tier: 'Accelerated Tier',
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    failedSignInAttempts: 0,
    lockoutUntil: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
  };

  if (existing) {
    await db.user.update({
      where: { email: PROVIDER_CRM_SOLE_ADMIN_EMAIL },
      data: adminData,
    });
    console.log('[ProviderCRMAdminBootstrap] Provider CRM administrator repaired from env.');
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
