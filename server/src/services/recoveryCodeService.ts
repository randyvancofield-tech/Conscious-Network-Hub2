import crypto from 'crypto';
import { resolveAuthTokenSecret } from '../requiredEnv';
import { getPrisma } from './prismaClient';

export interface AccountRecoveryCodeRecord {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryCodeStatus {
  hasUnusedCodes: boolean;
  unusedCount: number;
}

const DEFAULT_RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normalizeRecoveryCode = (value: unknown): string =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const formatRecoveryCode = (normalizedCode: string): string => {
  const clean = normalizeRecoveryCode(normalizedCode).replace(/^CNH/, '');
  return ['CNH', clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12)]
    .filter(Boolean)
    .join('-');
};

export const generateRecoveryCode = (): string => {
  let body = '';
  for (let index = 0; index < 12; index += 1) {
    body += RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return formatRecoveryCode(body);
};

export const hashRecoveryCode = (code: unknown): string => {
  const normalized = normalizeRecoveryCode(code);
  return crypto
    .createHmac('sha256', `cnh-recovery-code:${resolveAuthTokenSecret()}`)
    .update(normalized, 'utf8')
    .digest('hex');
};

const toPositiveCount = (count?: number): number => {
  const parsed = Number(count || DEFAULT_RECOVERY_CODE_COUNT);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 20) : DEFAULT_RECOVERY_CODE_COUNT;
};

const toRecord = (row: any): AccountRecoveryCodeRecord => ({
  id: row.id,
  userId: row.userId,
  codeHash: row.codeHash,
  usedAt: row.usedAt || null,
  revokedAt: row.revokedAt || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createRecoveryCodesForUser = async (
  userIdInput: string,
  countInput = DEFAULT_RECOVERY_CODE_COUNT
): Promise<string[]> => {
  const userId = String(userIdInput || '').trim();
  if (!userId) return [];

  try {
    const count = toPositiveCount(countInput);
    const codes = new Set<string>();
    while (codes.size < count) {
      codes.add(generateRecoveryCode());
    }

    const db = getPrisma() as any;
    await db.$executeRaw`
      UPDATE "AccountRecoveryCode"
      SET "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "usedAt" IS NULL AND "revokedAt" IS NULL
    `;

    for (const code of codes) {
      await db.$executeRaw`
        INSERT INTO "AccountRecoveryCode" ("id", "userId", "codeHash", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${userId}, ${hashRecoveryCode(code)}, CURRENT_TIMESTAMP)
      `;
    }

    return Array.from(codes);
  } catch (error) {
    console.error('[RECOVERY_CODES] Failed to create recovery codes', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

export const getRecoveryCodeStatusForUser = async (
  userIdInput: string
): Promise<RecoveryCodeStatus> => {
  const userId = String(userIdInput || '').trim();
  if (!userId) return { hasUnusedCodes: false, unusedCount: 0 };

  try {
    const rows = (await (getPrisma() as any).$queryRaw`
      SELECT COUNT(*)::int AS "unusedCount"
      FROM "AccountRecoveryCode"
      WHERE "userId" = ${userId} AND "usedAt" IS NULL AND "revokedAt" IS NULL
    `) as Array<{ unusedCount?: number }>;
    const unusedCount = Number(rows[0]?.unusedCount || 0);
    return {
      hasUnusedCodes: unusedCount > 0,
      unusedCount,
    };
  } catch (error) {
    console.error('[RECOVERY_CODES] Failed to inspect recovery codes', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { hasUnusedCodes: false, unusedCount: 0 };
  }
};

export const verifyAndConsumeRecoveryCode = async (
  userIdInput: string,
  codeInput: unknown
): Promise<AccountRecoveryCodeRecord | null> => {
  const userId = String(userIdInput || '').trim();
  const normalizedCode = normalizeRecoveryCode(codeInput);
  if (!userId || normalizedCode.length < 8) return null;

  try {
    const codeHash = hashRecoveryCode(normalizedCode);
    const matches = (await (getPrisma() as any).$queryRaw`
      SELECT "id", "userId", "codeHash", "usedAt", "revokedAt", "createdAt", "updatedAt"
      FROM "AccountRecoveryCode"
      WHERE "userId" = ${userId}
        AND "codeHash" = ${codeHash}
        AND "usedAt" IS NULL
        AND "revokedAt" IS NULL
      LIMIT 1
    `) as any[];
    const match = matches[0];
    if (!match) return null;

    const consumed = (await (getPrisma() as any).$queryRaw`
      UPDATE "AccountRecoveryCode"
      SET "usedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${match.id} AND "usedAt" IS NULL AND "revokedAt" IS NULL
      RETURNING "id", "userId", "codeHash", "usedAt", "revokedAt", "createdAt", "updatedAt"
    `) as any[];

    return consumed[0] ? toRecord(consumed[0]) : null;
  } catch (error) {
    console.error('[RECOVERY_CODES] Failed to consume recovery code', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const revokeRecoveryCodesForUser = async (userIdInput: string): Promise<number> => {
  const userId = String(userIdInput || '').trim();
  if (!userId) return 0;

  try {
    const updated = await (getPrisma() as any).$executeRaw`
      UPDATE "AccountRecoveryCode"
      SET "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "usedAt" IS NULL AND "revokedAt" IS NULL
    `;
    return Number(updated || 0);
  } catch (error) {
    console.error('[RECOVERY_CODES] Failed to revoke recovery codes', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};
