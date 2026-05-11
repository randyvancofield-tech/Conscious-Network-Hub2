import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
  if (!prisma) {
    // Neon pool mode is selected by DATABASE_URL. Keep one process-wide client so
    // the app does not multiply connection pools across services.
    prisma = new PrismaClient();
  }
  return prisma;
};
