import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';

export type AdminMessageType =
  | 'contact'
  | 'report_issue'
  | 'support'
  | 'provider'
  | 'safety'
  | 'billing'
  | 'technical'
  | 'general';

export type AdminMessageStatus = 'new' | 'reviewing' | 'in_progress' | 'resolved' | 'archived';
export type AdminMessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AdminMessageInput {
  type: AdminMessageType;
  subject: string;
  message: string;
  priority?: AdminMessagePriority;
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterUserId?: string | null;
  route?: string | null;
  category?: string | null;
  source?: string | null;
  recipientEmail?: string | null;
  metadata?: Record<string, unknown> | null;
  aiAnalysis?: string | null;
}

export interface AdminMessageUpdateInput {
  status?: AdminMessageStatus;
  priority?: AdminMessagePriority;
  adminNotes?: string | null;
  resolutionSummary?: string | null;
}

interface AdminMessageRow {
  id: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  message: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterUserId: string | null;
  route: string | null;
  category: string | null;
  source: string;
  recipientEmail: string;
  metadata: Record<string, unknown> | null;
  aiAnalysis: string | null;
  adminNotes: string | null;
  resolutionSummary: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AdminMessage {
  id: string;
  type: AdminMessageType;
  status: AdminMessageStatus;
  priority: AdminMessagePriority;
  subject: string;
  message: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterUserId: string | null;
  route: string | null;
  category: string | null;
  source: string;
  recipientEmail: string;
  metadata: Record<string, unknown> | null;
  aiAnalysis: string | null;
  adminNotes: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMessageSummary {
  total: number;
  new: number;
  reviewing: number;
  inProgress: number;
  resolved: number;
  archived: number;
  high: number;
  urgent: number;
}

export interface AdminMessageListFilters {
  status?: AdminMessageStatus | 'all';
  type?: AdminMessageType | 'all';
  limit?: number;
}

export const ADMIN_INBOX_RECIPIENT_EMAIL =
  String(process.env.ADMIN_INBOX_RECIPIENT_EMAIL || 'higherconscious.network1@gmail.com')
    .trim()
    .toLowerCase() || 'higherconscious.network1@gmail.com';

const MESSAGE_TYPES: AdminMessageType[] = [
  'contact',
  'report_issue',
  'support',
  'provider',
  'safety',
  'billing',
  'technical',
  'general',
];
const MESSAGE_STATUSES: AdminMessageStatus[] = ['new', 'reviewing', 'in_progress', 'resolved', 'archived'];
const MESSAGE_PRIORITIES: AdminMessagePriority[] = ['low', 'normal', 'high', 'urgent'];

let tableReady: Promise<void> | null = null;

const normalizeText = (value: unknown, fallback: string, maxLength: number): string => {
  const normalized = String(value || '').trim().slice(0, maxLength);
  return normalized || fallback;
};

const normalizeNullableText = (value: unknown, maxLength: number): string | null => {
  const normalized = String(value || '').trim().slice(0, maxLength);
  return normalized || null;
};

const normalizeEmail = (value: unknown): string | null => {
  const normalized = normalizeNullableText(value, 320);
  return normalized ? normalized.toLowerCase() : null;
};

export const normalizeAdminMessageType = (value: unknown): AdminMessageType => {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  return MESSAGE_TYPES.includes(normalized as AdminMessageType)
    ? (normalized as AdminMessageType)
    : 'general';
};

export const normalizeAdminMessageStatus = (
  value: unknown,
  fallback: AdminMessageStatus = 'new'
): AdminMessageStatus => {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  return MESSAGE_STATUSES.includes(normalized as AdminMessageStatus)
    ? (normalized as AdminMessageStatus)
    : fallback;
};

export const normalizeAdminMessagePriority = (
  value: unknown,
  fallback: AdminMessagePriority = 'normal'
): AdminMessagePriority => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'medium') return 'normal';
  if (normalized === 'critical') return 'urgent';
  return MESSAGE_PRIORITIES.includes(normalized as AdminMessagePriority)
    ? (normalized as AdminMessagePriority)
    : fallback;
};

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const mapRow = (row: AdminMessageRow): AdminMessage => ({
  id: row.id,
  type: normalizeAdminMessageType(row.type),
  status: normalizeAdminMessageStatus(row.status),
  priority: normalizeAdminMessagePriority(row.priority),
  subject: row.subject,
  message: row.message,
  submitterName: row.submitterName,
  submitterEmail: row.submitterEmail,
  submitterUserId: row.submitterUserId,
  route: row.route,
  category: row.category,
  source: row.source,
  recipientEmail: row.recipientEmail,
  metadata: row.metadata || null,
  aiAnalysis: row.aiAnalysis,
  adminNotes: row.adminNotes,
  resolutionSummary: row.resolutionSummary,
  resolvedAt: toIsoString(row.resolvedAt),
  createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
  updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
});

export const ensureAdminMessageTable = async (db: PrismaClient = getPrisma()): Promise<void> => {
  if (!tableReady) {
    tableReady = (async () => {
      await db.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS "AdminMessage" (
          "id" TEXT PRIMARY KEY,
          "type" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'new',
          "priority" TEXT NOT NULL DEFAULT 'normal',
          "subject" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "submitterName" TEXT,
          "submitterEmail" TEXT,
          "submitterUserId" TEXT,
          "route" TEXT,
          "category" TEXT,
          "source" TEXT NOT NULL DEFAULT 'platform',
          "recipientEmail" TEXT NOT NULL DEFAULT 'higherconscious.network1@gmail.com',
          "metadata" JSONB,
          "aiAnalysis" TEXT,
          "adminNotes" TEXT,
          "resolutionSummary" TEXT,
          "resolvedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "AdminMessage_recipient_status_idx"
        ON "AdminMessage" ("recipientEmail", "status")
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "AdminMessage_type_created_idx"
        ON "AdminMessage" ("type", "createdAt")
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "AdminMessage_priority_status_idx"
        ON "AdminMessage" ("priority", "status")
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "AdminMessage_submitter_idx"
        ON "AdminMessage" ("submitterUserId")
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }

  await tableReady;
};

export const createAdminMessage = async (
  input: AdminMessageInput,
  db: PrismaClient = getPrisma()
): Promise<AdminMessage> => {
  await ensureAdminMessageTable(db);
  const now = new Date();
  const id = `adminmsg_${crypto.randomUUID()}`;
  const type = normalizeAdminMessageType(input.type);
  const priority = normalizeAdminMessagePriority(input.priority);
  const subject = normalizeText(input.subject, 'Platform message', 240);
  const message = normalizeText(input.message, 'No message supplied.', 8000);
  const source = normalizeText(input.source, 'platform', 120);
  const recipientEmail = normalizeEmail(input.recipientEmail) || ADMIN_INBOX_RECIPIENT_EMAIL;
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : null;

  const rows = await db.$queryRaw<AdminMessageRow[]>(Prisma.sql`
    INSERT INTO "AdminMessage" (
      "id",
      "type",
      "status",
      "priority",
      "subject",
      "message",
      "submitterName",
      "submitterEmail",
      "submitterUserId",
      "route",
      "category",
      "source",
      "recipientEmail",
      "metadata",
      "aiAnalysis",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${type},
      'new',
      ${priority},
      ${subject},
      ${message},
      ${normalizeNullableText(input.submitterName, 200)},
      ${normalizeEmail(input.submitterEmail)},
      ${normalizeNullableText(input.submitterUserId, 128)},
      ${normalizeNullableText(input.route, 512)},
      ${normalizeNullableText(input.category, 120)},
      ${source},
      ${recipientEmail},
      ${metadata as Prisma.InputJsonValue | null},
      ${normalizeNullableText(input.aiAnalysis, 8000)},
      ${now},
      ${now}
    )
    RETURNING *
  `);

  return mapRow(rows[0]);
};

export const listAdminMessages = async (
  filters: AdminMessageListFilters = {},
  db: PrismaClient = getPrisma()
): Promise<AdminMessage[]> => {
  await ensureAdminMessageTable(db);
  const limit = Math.max(1, Math.min(250, Number(filters.limit || 50)));
  const clauses: Prisma.Sql[] = [];
  const status = filters.status && filters.status !== 'all'
    ? normalizeAdminMessageStatus(filters.status)
    : null;
  const type = filters.type && filters.type !== 'all'
    ? normalizeAdminMessageType(filters.type)
    : null;

  if (status) clauses.push(Prisma.sql`"status" = ${status}`);
  if (type) clauses.push(Prisma.sql`"type" = ${type}`);

  const where = clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty;
  const rows = await db.$queryRaw<AdminMessageRow[]>(Prisma.sql`
    SELECT *
    FROM "AdminMessage"
    ${where}
    ORDER BY
      CASE "status"
        WHEN 'new' THEN 0
        WHEN 'reviewing' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'resolved' THEN 3
        ELSE 4
      END,
      CASE "priority"
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        ELSE 3
      END,
      "createdAt" DESC
    LIMIT ${limit}
  `);

  return rows.map(mapRow);
};

export const getAdminMessageSummary = async (
  db: PrismaClient = getPrisma()
): Promise<AdminMessageSummary> => {
  await ensureAdminMessageTable(db);
  const rows = await db.$queryRaw<Array<{ status: string; priority: string; count: number | bigint }>>(Prisma.sql`
    SELECT "status", "priority", COUNT(*) AS count
    FROM "AdminMessage"
    GROUP BY "status", "priority"
  `);

  const summary: AdminMessageSummary = {
    total: 0,
    new: 0,
    reviewing: 0,
    inProgress: 0,
    resolved: 0,
    archived: 0,
    high: 0,
    urgent: 0,
  };

  for (const row of rows) {
    const count = Number(row.count || 0);
    const status = normalizeAdminMessageStatus(row.status, 'archived');
    const priority = normalizeAdminMessagePriority(row.priority);
    summary.total += count;
    if (status === 'new') summary.new += count;
    if (status === 'reviewing') summary.reviewing += count;
    if (status === 'in_progress') summary.inProgress += count;
    if (status === 'resolved') summary.resolved += count;
    if (status === 'archived') summary.archived += count;
    if (priority === 'high') summary.high += count;
    if (priority === 'urgent') summary.urgent += count;
  }

  return summary;
};

export const updateAdminMessage = async (
  id: string,
  input: AdminMessageUpdateInput,
  actorUserId: string | null,
  db: PrismaClient = getPrisma()
): Promise<AdminMessage | null> => {
  await ensureAdminMessageTable(db);
  const rows = await db.$queryRaw<AdminMessageRow[]>(Prisma.sql`
    SELECT *
    FROM "AdminMessage"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  const current = rows[0] ? mapRow(rows[0]) : null;
  if (!current) return null;

  const nextStatus = input.status ? normalizeAdminMessageStatus(input.status, current.status) : current.status;
  const nextPriority = input.priority
    ? normalizeAdminMessagePriority(input.priority, current.priority)
    : current.priority;
  const now = new Date();
  const resolvedAt = nextStatus === 'resolved'
    ? current.resolvedAt ? new Date(current.resolvedAt) : now
    : null;
  const metadata = {
    ...(current.metadata || {}),
    lastUpdatedByUserId: actorUserId || null,
  };

  const updated = await db.$queryRaw<AdminMessageRow[]>(Prisma.sql`
    UPDATE "AdminMessage"
    SET
      "status" = ${nextStatus},
      "priority" = ${nextPriority},
      "adminNotes" = ${input.adminNotes === undefined ? current.adminNotes : normalizeNullableText(input.adminNotes, 8000)},
      "resolutionSummary" = ${
        input.resolutionSummary === undefined
          ? current.resolutionSummary
          : normalizeNullableText(input.resolutionSummary, 8000)
      },
      "resolvedAt" = ${resolvedAt},
      "metadata" = ${metadata as Prisma.InputJsonValue},
      "updatedAt" = ${now}
    WHERE "id" = ${id}
    RETURNING *
  `);

  return mapRow(updated[0]);
};

export const resetAdminMessageTableForTests = (): void => {
  tableReady = null;
};
