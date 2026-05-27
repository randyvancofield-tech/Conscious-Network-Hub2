import { Prisma, PrismaClient } from '@prisma/client';
import { ProviderCrmToolId } from './providerCrm';
import { getPrisma } from './prismaClient';

interface ProviderCrmToolVisibilityRow {
  toolId: string;
  enabled: boolean;
  updatedByUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProviderCrmToolVisibilitySetting {
  toolId: ProviderCrmToolId;
  enabled: boolean;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

let tableReady: Promise<void> | null = null;

const toIsoString = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

export const ensureProviderCrmToolVisibilityTable = async (
  db: PrismaClient = getPrisma()
): Promise<void> => {
  if (!tableReady) {
    tableReady = (async () => {
      await db.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS "ProviderCrmToolVisibility" (
          "toolId" TEXT PRIMARY KEY,
          enabled BOOLEAN NOT NULL,
          "updatedByUserId" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "ProviderCrmToolVisibility_updated_idx"
        ON "ProviderCrmToolVisibility" ("updatedAt")
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }

  await tableReady;
};

const mapRow = (row: ProviderCrmToolVisibilityRow): ProviderCrmToolVisibilitySetting => ({
  toolId: row.toolId as ProviderCrmToolId,
  enabled: row.enabled === true,
  updatedByUserId: row.updatedByUserId,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

export const listProviderCrmToolVisibilitySettings = async (
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmToolVisibilitySetting[]> => {
  await ensureProviderCrmToolVisibilityTable(db);
  const rows = await db.$queryRaw<ProviderCrmToolVisibilityRow[]>(Prisma.sql`
    SELECT "toolId", enabled, "updatedByUserId", "createdAt", "updatedAt"
    FROM "ProviderCrmToolVisibility"
    ORDER BY "updatedAt" DESC
  `);
  return rows.map(mapRow);
};

export const listProviderCrmToolVisibilityOverrides = async (
  db: PrismaClient = getPrisma()
): Promise<Map<ProviderCrmToolId, boolean>> => {
  const settings = await listProviderCrmToolVisibilitySettings(db);
  return new Map(settings.map((setting) => [setting.toolId, setting.enabled]));
};

export const setProviderCrmToolVisibilitySetting = async (
  toolId: ProviderCrmToolId,
  enabled: boolean,
  updatedByUserId: string | null,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmToolVisibilitySetting> => {
  await ensureProviderCrmToolVisibilityTable(db);
  const now = new Date();
  const rows = await db.$queryRaw<ProviderCrmToolVisibilityRow[]>(Prisma.sql`
    INSERT INTO "ProviderCrmToolVisibility" ("toolId", enabled, "updatedByUserId", "createdAt", "updatedAt")
    VALUES (${toolId}, ${enabled}, ${updatedByUserId}, ${now}, ${now})
    ON CONFLICT ("toolId")
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      "updatedByUserId" = EXCLUDED."updatedByUserId",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "toolId", enabled, "updatedByUserId", "createdAt", "updatedAt"
  `);
  return mapRow(rows[0]);
};

export const resetProviderCrmToolVisibilityTableForTests = (): void => {
  tableReady = null;
};
