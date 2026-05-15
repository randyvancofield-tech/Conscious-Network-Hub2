import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { computePasswordFingerprint, hashPassword } from '../src/auth';
import {
  PROVIDER_CRM_LEGACY_ADMIN_EMAILS,
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  getConfiguredProviderCrmAdminWalletAddress,
} from '../src/services/providerCrm';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';
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
} as any;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const candidateEmails = Array.from(
    new Set([PROVIDER_CRM_SOLE_ADMIN_EMAIL, ...PROVIDER_CRM_LEGACY_ADMIN_EMAILS])
  );
  const existingUsers = await prisma.user.findMany({
    where: {
      OR: candidateEmails.map((email) => ({
        email: {
          equals: email,
          mode: 'insensitive',
        },
      })),
    },
  });

  const initialPassword = String(process.env[INITIAL_PASSWORD_ENV] || '').trim();
  const passwordData =
    initialPassword.length > 0
      ? {
          password: hashPassword(initialPassword),
          passwordFingerprint: computePasswordFingerprint(initialPassword),
        }
      : {};
  const configuredAdminWalletAddress = getConfiguredProviderCrmAdminWalletAddress();

  if (initialPassword.length > 0 && initialPassword.length < 12) {
    throw new Error(`${INITIAL_PASSWORD_ENV} must be at least 12 characters.`);
  }

  const adminData = {
    email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    name: 'CNH Provider CRM Administrator',
    role: 'admin',
    tier: 'Accelerated Tier',
    ...(configuredAdminWalletAddress ? { walletAddress: configuredAdminWalletAddress } : {}),
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    emailVerified: true,
    failedSignInAttempts: 0,
    lockoutUntil: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    ...passwordData,
  } as any;

  const currentEmailUser =
    existingUsers.find((user) => normalizeEmail(user.email) === PROVIDER_CRM_SOLE_ADMIN_EMAIL) || null;
  const legacyUsers = existingUsers.filter(
    (user) => normalizeEmail(user.email) !== PROVIDER_CRM_SOLE_ADMIN_EMAIL
  );

  if (currentEmailUser) {
    const demoteLegacyAdminOperations = legacyUsers
      .filter((user) => String(user.role || '').toLowerCase() === 'admin')
      .map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: legacyAdminCleanupData,
        })
      );

    await prisma.$transaction([
      prisma.user.update({
        where: { id: currentEmailUser.id },
        data: adminData,
      }),
      ...demoteLegacyAdminOperations,
    ]);
    console.log(`Provider CRM administrator repaired: ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}`);
    return;
  }

  if (legacyUsers.length > 1) {
    throw new Error(
      `Refusing to repair ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}: ${legacyUsers.length} legacy admin email records exist.`
    );
  }

  const legacy = legacyUsers[0] || null;
  if (legacy) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: adminData,
    });
    console.log(`Provider CRM legacy administrator migrated: ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}`);
    return;
  }

  if (!initialPassword) {
    throw new Error(
      `${PROVIDER_CRM_SOLE_ADMIN_EMAIL} does not exist. Set ${INITIAL_PASSWORD_ENV} to a one-time password with at least 12 characters, run this script, then rotate the password immediately.`
    );
  }

  await prisma.user.create({
    data: adminData,
  });

  console.log(`Provider CRM administrator created: ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}`);
  console.log('Rotate the one-time password immediately after first sign-in.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
