import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { computePasswordFingerprint, hashPassword } from '../src/auth';
import { PROVIDER_CRM_LEGACY_ADMIN_EMAILS, PROVIDER_CRM_SOLE_ADMIN_EMAIL } from '../src/services/providerCrm';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';

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

  if (existingUsers.length > 1) {
    throw new Error(
      `Refusing to repair ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}: ${existingUsers.length} current/legacy admin email records exist.`
    );
  }

  const initialPassword = String(process.env[INITIAL_PASSWORD_ENV] || '').trim();
  const passwordData =
    initialPassword.length > 0
      ? {
          password: hashPassword(initialPassword),
          passwordFingerprint: computePasswordFingerprint(initialPassword),
        }
      : {};

  if (initialPassword.length > 0 && initialPassword.length < 12) {
    throw new Error(`${INITIAL_PASSWORD_ENV} must be at least 12 characters.`);
  }

  const adminData = {
    email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    name: 'CNH Provider CRM Administrator',
    role: 'admin',
    tier: 'Accelerated Tier',
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    emailVerified: true,
    failedSignInAttempts: 0,
    lockoutUntil: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    ...passwordData,
  } as any;

  const existing = existingUsers[0] || null;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: adminData,
    });
    console.log(`Provider CRM administrator repaired: ${PROVIDER_CRM_SOLE_ADMIN_EMAIL}`);
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
