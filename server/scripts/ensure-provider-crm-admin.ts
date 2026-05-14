import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROVIDER_CRM_ADMIN_EMAIL = 'guidance@higherconscious.network';
const INITIAL_PASSWORD_ENV = 'PROVIDER_CRM_ADMIN_INITIAL_PASSWORD';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: PROVIDER_CRM_ADMIN_EMAIL },
  });

  if (existing) {
    if (existing.role !== 'admin') {
      await prisma.user.update({
        where: { email: PROVIDER_CRM_ADMIN_EMAIL },
        data: { role: 'admin' },
      });
      console.log(`Provider CRM administrator promoted: ${PROVIDER_CRM_ADMIN_EMAIL}`);
      return;
    }

    console.log(`Provider CRM administrator already active: ${PROVIDER_CRM_ADMIN_EMAIL}`);
    return;
  }

  const initialPassword = String(process.env[INITIAL_PASSWORD_ENV] || '');
  if (initialPassword.length < 12) {
    throw new Error(
      `${PROVIDER_CRM_ADMIN_EMAIL} does not exist. Set ${INITIAL_PASSWORD_ENV} to a one-time password with at least 12 characters, run this script, then rotate the password immediately.`
    );
  }

  await prisma.user.create({
    data: {
      email: PROVIDER_CRM_ADMIN_EMAIL,
      name: 'CNH Provider CRM Administrator',
      role: 'admin',
      password: hashPassword(initialPassword),
      tier: 'Accelerated Tier',
      membershipStatus: 'active',
      subscriptionStatus: 'active',
      emailVerified: true,
    } as any,
  });

  console.log(`Provider CRM administrator created: ${PROVIDER_CRM_ADMIN_EMAIL}`);
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
