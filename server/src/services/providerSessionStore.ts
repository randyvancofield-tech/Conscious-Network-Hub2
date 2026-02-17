import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export interface ProviderChallengeRecord {
  id: string;
  did: string;
  nonce: string;
  statement: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface ProviderSessionRecord {
  id: string;
  did: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes

let prismaInstance: PrismaClient | null = null;
let schemaReadyPromise: Promise<void> | null = null;

const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  return new Date(String(value));
};

const toChallengeRecord = (row: any): ProviderChallengeRecord => ({
  id: String(row.id),
  did: String(row.did),
  nonce: String(row.nonce),
  statement: String(row.statement),
  expiresAt: toDate(row.expiresAt),
  usedAt: row.usedAt ? toDate(row.usedAt) : null,
  createdAt: toDate(row.createdAt),
});

const toSessionRecord = (row: any): ProviderSessionRecord => ({
  id: String(row.id),
  did: String(row.did),
  scopes: JSON.parse(String(row.scopesJson)),
  issuedAt: toDate(row.issuedAt),
  expiresAt: toDate(row.expiresAt),
  revokedAt: row.revokedAt ? toDate(row.revokedAt) : null,
  createdAt: toDate(row.createdAt),
});

const ensureSchema = async (): Promise<void> => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const prisma = getPrismaClient();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProviderChallenge" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "did" TEXT NOT NULL,
          "nonce" TEXT NOT NULL,
          "statement" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "usedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderChallenge_did_idx"
        ON "ProviderChallenge" ("did")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderChallenge_expiresAt_idx"
        ON "ProviderChallenge" ("expiresAt")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProviderSession" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "did" TEXT NOT NULL,
          "scopesJson" TEXT NOT NULL,
          "issuedAt" DATETIME NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "revokedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderSession_did_idx"
        ON "ProviderSession" ("did")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderSession_expiresAt_idx"
        ON "ProviderSession" ("expiresAt")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderSession_revokedAt_idx"
        ON "ProviderSession" ("revokedAt")
      `);
    })();
  }

  await schemaReadyPromise;
};

export const createProviderChallenge = async (did: string): Promise<ProviderChallengeRecord> => {
  await ensureSchema();
  const prisma = getPrismaClient();

  const now = new Date();
  const ttlSecondsRaw = Number(process.env.PROVIDER_CHALLENGE_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0
      ? ttlSecondsRaw
      : DEFAULT_CHALLENGE_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const id = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString('hex');
  const statement = [
    'Higher Conscious Network Provider Authentication Challenge',
    `Challenge ID: ${id}`,
    `DID: ${did}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join('\n');

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ProviderChallenge" ("id", "did", "nonce", "statement", "expiresAt", "createdAt")
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    id,
    did,
    nonce,
    statement,
    expiresAt.toISOString(),
    now.toISOString()
  );

  return {
    id,
    did,
    nonce,
    statement,
    expiresAt,
    usedAt: null,
    createdAt: now,
  };
};

export const getProviderChallengeById = async (
  challengeId: string
): Promise<ProviderChallengeRecord | null> => {
  await ensureSchema();
  const prisma = getPrismaClient();
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT "id", "did", "nonce", "statement", "expiresAt", "usedAt", "createdAt"
      FROM "ProviderChallenge"
      WHERE "id" = ?
      LIMIT 1
    `,
    challengeId
  )) as any[];

  if (rows.length === 0) return null;
  return toChallengeRecord(rows[0]);
};

export const markProviderChallengeUsed = async (challengeId: string): Promise<void> => {
  await ensureSchema();
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "ProviderChallenge"
      SET "usedAt" = ?
      WHERE "id" = ? AND "usedAt" IS NULL
    `,
    new Date().toISOString(),
    challengeId
  );
};

export const createProviderSession = async (
  did: string,
  scopes: string[]
): Promise<ProviderSessionRecord> => {
  await ensureSchema();
  const prisma = getPrismaClient();

  const now = new Date();
  const ttlSecondsRaw = Number(process.env.PROVIDER_SESSION_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0 ? ttlSecondsRaw : 30 * 60;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const sessionId = crypto.randomUUID();
  const scopesJson = JSON.stringify(scopes);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "ProviderSession" ("id", "did", "scopesJson", "issuedAt", "expiresAt", "createdAt")
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    sessionId,
    did,
    scopesJson,
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString()
  );

  return {
    id: sessionId,
    did,
    scopes,
    issuedAt: now,
    expiresAt,
    revokedAt: null,
    createdAt: now,
  };
};

export const getProviderSessionById = async (
  sessionId: string
): Promise<ProviderSessionRecord | null> => {
  await ensureSchema();
  const prisma = getPrismaClient();
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT "id", "did", "scopesJson", "issuedAt", "expiresAt", "revokedAt", "createdAt"
      FROM "ProviderSession"
      WHERE "id" = ?
      LIMIT 1
    `,
    sessionId
  )) as any[];

  if (rows.length === 0) return null;
  return toSessionRecord(rows[0]);
};

export const revokeProviderSession = async (sessionId: string): Promise<void> => {
  await ensureSchema();
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `
      UPDATE "ProviderSession"
      SET "revokedAt" = ?
      WHERE "id" = ? AND "revokedAt" IS NULL
    `,
    new Date().toISOString(),
    sessionId
  );
};
