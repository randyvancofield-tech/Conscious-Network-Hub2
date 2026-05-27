import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';
import {
  CourseContentSection,
  buildCourseSyllabusMetadata,
  hasCourseSyllabusInput,
  normalizeCourseSyllabusMetadata,
} from './courseMetadata';

export type ProviderCrmWorkspaceRole = 'provider' | 'admin';
export type ProviderCrmRecordKind =
  | 'client'
  | 'organization'
  | 'institution'
  | 'follow_up'
  | 'note'
  | 'collaboration';
export type ProviderCrmRecordStatus = 'active' | 'watching' | 'contracting' | 'completed' | 'archived';
export type ProviderCrmPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ProviderCrmFollowUpStatus = 'open' | 'in_progress' | 'completed' | 'canceled';
export type ProviderCrmContentStatus = 'draft' | 'published' | 'archived';

export interface ProviderCrmWorkspaceScope {
  role: ProviderCrmWorkspaceRole;
  providerUserId: string;
  providerDid: string;
  providerDisplayName: string;
}

export interface ProviderCrmRecordInput {
  kind?: unknown;
  title?: unknown;
  clientUserId?: unknown;
  clientDisplayName?: unknown;
  organizationName?: unknown;
  treatmentFocus?: unknown;
  businessFocus?: unknown;
  status?: unknown;
  priority?: unknown;
  nextActionAt?: unknown;
  timezone?: unknown;
  details?: Record<string, unknown>;
}

export interface ProviderCrmRecord {
  id: string;
  providerId: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  organizationName: string | null;
  kind: ProviderCrmRecordKind;
  title: string;
  treatmentFocus: string | null;
  businessFocus: string | null;
  status: ProviderCrmRecordStatus;
  priority: ProviderCrmPriority;
  nextActionAt: string | null;
  timezone: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmNoteInput {
  title?: unknown;
  body?: unknown;
  category?: unknown;
  status?: unknown;
  relatedType?: unknown;
  relatedId?: unknown;
}

export interface ProviderCrmNote {
  id: string;
  providerId: string;
  authorUserId: string;
  title: string;
  body: string;
  category: string;
  status: 'active' | 'archived';
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmCollaborationInput {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  relatedType?: unknown;
  relatedId?: unknown;
}

export interface ProviderCrmCollaboration {
  id: string;
  providerId: string;
  authorUserId: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'archived';
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmFollowUpInput {
  title?: unknown;
  details?: unknown;
  dueAt?: unknown;
  status?: unknown;
  priority?: unknown;
  assignedToUserId?: unknown;
  relatedType?: unknown;
  relatedId?: unknown;
}

export interface ProviderCrmFollowUp {
  id: string;
  providerId: string;
  ownerUserId: string;
  assignedToUserId: string | null;
  title: string;
  details: string | null;
  dueAt: string | null;
  status: ProviderCrmFollowUpStatus;
  priority: ProviderCrmPriority;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmContentInput {
  title?: unknown;
  description?: unknown;
  fullDescription?: unknown;
  category?: unknown;
  estimatedDuration?: unknown;
  learningObjectives?: unknown;
  contentSections?: unknown;
  tier?: unknown;
  status?: unknown;
}

export interface ProviderCrmContentItem {
  id: string;
  ownerId: string | null;
  ownerType: string;
  provider: string;
  title: string;
  description: string;
  fullDescription: string | null;
  category: string | null;
  estimatedDuration: string | null;
  learningObjectives: string[];
  contentSections: CourseContentSection[];
  tier: string;
  status: ProviderCrmContentStatus;
  image: string | null;
  enrolledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmAnalytics {
  scope: {
    role: ProviderCrmWorkspaceRole;
    visibility: 'provider-owned' | 'administrator-aggregate';
  };
  generatedAt: string;
  relationships: {
    total: number;
    active: number;
    byKind: Record<string, number>;
    byStatus: Record<string, number>;
  };
  notes: {
    total: number;
    active: number;
    archived: number;
  };
  collaboration: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    archived: number;
  };
  followUps: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    canceled: number;
    due: number;
  };
  content: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  meetings: {
    total: number;
    upcoming: number;
  };
  admin?: {
    providerApplicants: {
      total: number;
      pending: number;
      approved: number;
      declined: number;
    };
    approvedProviders: number;
    membershipsByTier: Record<string, number>;
    aiInteractions: {
      total: number;
    };
  };
}

export interface ProviderRoundtableReservationInput {
  roomNumber?: unknown;
  startAt?: unknown;
  timezone?: unknown;
  title?: unknown;
  details?: Record<string, unknown>;
}

export interface ProviderRoundtableReservation {
  id: string;
  providerId: string;
  roomNumber: number;
  startAt: string;
  endAt: string;
  timezone: string;
  title: string;
  meetingSessionId: string;
  roomUrl: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  chatMode: 'native-room-signals';
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmWorkspace {
  scope: {
    role: ProviderCrmWorkspaceRole;
    providerUserId: string;
    providerDid: string;
    providerDisplayName: string;
    visibility: 'provider-owned' | 'administrator-holistic';
  };
  metrics: {
    treatment: {
      activeClientRecords: number;
      dueFollowUps: number;
      upcomingRoundtables: number;
    };
    businessGrowth: {
      organizationsTracked: number;
      institutionContractOpportunities: number;
      urgentOpportunities: number;
    };
  };
  guidanceAlerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'urgent';
    title: string;
    detail: string;
    action: string;
  }>;
  records: ProviderCrmRecord[];
  roundtable: {
    label: 'Conscious Roundtable';
    roomCount: 12;
    dayStartHour: 8;
    hourCount: 12;
    timezone: string;
    reservations: ProviderRoundtableReservation[];
  };
  resources: Array<{
    id: string;
    title: string;
    category: string;
    summary: string;
    checklist: string[];
  }>;
}

type ProviderCrmRecordRow = Omit<ProviderCrmRecord, 'nextActionAt' | 'createdAt' | 'updatedAt'> & {
  nextActionAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ProviderRoundtableReservationRow = Omit<
  ProviderRoundtableReservation,
  'startAt' | 'endAt' | 'createdAt' | 'updatedAt'
> & {
  startAt: Date | string;
  endAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const RECORD_KINDS: ProviderCrmRecordKind[] = [
  'client',
  'organization',
  'institution',
  'follow_up',
  'note',
  'collaboration',
];
const RECORD_STATUSES: ProviderCrmRecordStatus[] = ['active', 'watching', 'contracting', 'completed', 'archived'];
const PRIORITIES: ProviderCrmPriority[] = ['low', 'normal', 'high', 'urgent'];
const FOLLOW_UP_STATUSES: ProviderCrmFollowUpStatus[] = ['open', 'in_progress', 'completed', 'canceled'];
const CONTENT_STATUSES: ProviderCrmContentStatus[] = ['draft', 'published', 'archived'];
const ROUNDTABLE_ROOM_COUNT = 12;
const ROUNDTABLE_DAY_START_HOUR = 8;
const ROUNDTABLE_HOUR_COUNT = 12;

let tablesReady: Promise<void> | null = null;

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeText = (value: unknown, fallback: string, maxLength: number): string => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return (normalized || fallback).slice(0, maxLength);
};

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : null;
};

const requireText = (value: unknown, field: string, maxLength: number): string => {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) throw new Error(`VALIDATION:${field}`);
  return normalized;
};

const normalizeDetails = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const normalizeNoteStatus = (value: unknown, fallback: 'active' | 'archived' = 'active'): 'active' | 'archived' => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'archived' ? 'archived' : fallback;
};

const normalizeCollaborationStatus = (
  value: unknown,
  fallback: ProviderCrmCollaboration['status'] = 'open'
): ProviderCrmCollaboration['status'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'open' || normalized === 'in_progress' || normalized === 'completed' || normalized === 'archived') {
    return normalized;
  }
  return fallback;
};

const normalizeFollowUpStatus = (
  value: unknown,
  fallback: ProviderCrmFollowUpStatus = 'open'
): ProviderCrmFollowUpStatus => {
  const normalized = String(value || '').trim().toLowerCase();
  return FOLLOW_UP_STATUSES.includes(normalized as ProviderCrmFollowUpStatus)
    ? (normalized as ProviderCrmFollowUpStatus)
    : fallback;
};

const followUpStatusToRecordStatus = (status: ProviderCrmFollowUpStatus): ProviderCrmRecordStatus => {
  if (status === 'completed') return 'completed';
  if (status === 'canceled') return 'archived';
  if (status === 'in_progress') return 'watching';
  return 'active';
};

const recordStatusToFollowUpStatus = (
  status: ProviderCrmRecordStatus,
  details: Record<string, unknown>
): ProviderCrmFollowUpStatus => {
  const fromDetails = normalizeFollowUpStatus(details.followUpStatus, 'open');
  if (details.followUpStatus) return fromDetails;
  if (status === 'completed') return 'completed';
  if (status === 'archived') return 'canceled';
  if (status === 'watching') return 'in_progress';
  return 'open';
};

const normalizeContentStatus = (
  value: unknown,
  fallback: ProviderCrmContentStatus = 'draft'
): ProviderCrmContentStatus => {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTENT_STATUSES.includes(normalized as ProviderCrmContentStatus)
    ? (normalized as ProviderCrmContentStatus)
    : fallback;
};

const normalizeTier = (value: unknown, fallback = 'Professional'): string => {
  const normalized = normalizeText(value, fallback, 80);
  return normalized || fallback;
};

const normalizeKind = (value: unknown): ProviderCrmRecordKind => {
  const normalized = String(value || '').trim().toLowerCase();
  return RECORD_KINDS.includes(normalized as ProviderCrmRecordKind)
    ? (normalized as ProviderCrmRecordKind)
    : 'client';
};

const normalizeStatus = (value: unknown): ProviderCrmRecordStatus => {
  const normalized = String(value || '').trim().toLowerCase();
  return RECORD_STATUSES.includes(normalized as ProviderCrmRecordStatus)
    ? (normalized as ProviderCrmRecordStatus)
    : 'active';
};

const normalizePriority = (value: unknown): ProviderCrmPriority => {
  const normalized = String(value || '').trim().toLowerCase();
  return PRIORITIES.includes(normalized as ProviderCrmPriority)
    ? (normalized as ProviderCrmPriority)
    : 'normal';
};

const normalizeTimezone = (value: unknown): string =>
  normalizeText(value, 'UTC', 80);

const normalizeNextActionAt = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
};

const normalizeRoundtableStartAt = (value: unknown): Date => {
  const date = new Date(String(value || ''));
  const now = new Date();
  const source = Number.isFinite(date.getTime()) ? date : now;
  source.setMinutes(0, 0, 0);
  return source;
};

const mapRecordRow = (row: ProviderCrmRecordRow): ProviderCrmRecord => ({
  ...row,
  nextActionAt: toIsoString(row.nextActionAt),
  createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
  updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  details: row.details || {},
});

const mapReservationRow = (row: ProviderRoundtableReservationRow): ProviderRoundtableReservation => ({
  ...row,
  startAt: toIsoString(row.startAt) || new Date().toISOString(),
  endAt: toIsoString(row.endAt) || new Date().toISOString(),
  createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
  updatedAt: toIsoString(row.updatedAt) || new Date().toISOString(),
  details: row.details || {},
});

export const ensureProviderCrmWorkspaceTables = async (db: PrismaClient = getPrisma()): Promise<void> => {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS "ProviderCrmRecord" (
          id TEXT PRIMARY KEY,
          "providerId" TEXT NOT NULL,
          "clientUserId" TEXT,
          "clientDisplayName" TEXT,
          "organizationName" TEXT,
          kind TEXT NOT NULL DEFAULT 'client',
          title TEXT NOT NULL,
          "treatmentFocus" TEXT,
          "businessFocus" TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          priority TEXT NOT NULL DEFAULT 'normal',
          "nextActionAt" TIMESTAMPTZ,
          timezone TEXT,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "ProviderCrmRecord_provider_kind_idx"
        ON "ProviderCrmRecord" ("providerId", kind)
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "ProviderCrmRecord_provider_status_idx"
        ON "ProviderCrmRecord" ("providerId", status)
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "ProviderCrmRecord_next_action_idx"
        ON "ProviderCrmRecord" ("nextActionAt")
      `);

      await db.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS "ProviderRoundtableReservation" (
          id TEXT PRIMARY KEY,
          "providerId" TEXT NOT NULL,
          "roomNumber" INTEGER NOT NULL,
          "startAt" TIMESTAMPTZ NOT NULL,
          "endAt" TIMESTAMPTZ NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'UTC',
          title TEXT NOT NULL,
          "meetingSessionId" TEXT NOT NULL,
          "roomUrl" TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'scheduled',
          "chatMode" TEXT NOT NULL DEFAULT 'native-room-signals',
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS "ProviderRoundtableReservation_provider_start_idx"
        ON "ProviderRoundtableReservation" ("providerId", "startAt")
      `);
      await db.$executeRaw(Prisma.sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "ProviderRoundtableReservation_room_start_active_idx"
        ON "ProviderRoundtableReservation" ("roomNumber", "startAt")
        WHERE status <> 'cancelled'
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }

  await tablesReady;
};

export const listProviderCrmRecords = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmRecord[]> => {
  await ensureProviderCrmWorkspaceTables(db);
  const rows =
    scope.role === 'admin'
      ? await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          ORDER BY "updatedAt" DESC
          LIMIT 250
        `)
      : await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          WHERE "providerId" = ${scope.providerUserId}
          ORDER BY "updatedAt" DESC
          LIMIT 250
        `);
  return rows.map(mapRecordRow);
};

export const createProviderCrmRecord = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderCrmRecordInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmRecord> => {
  await ensureProviderCrmWorkspaceTables(db);
  const id = `crm_${crypto.randomUUID()}`;
  const now = new Date();
  const nextActionAt = normalizeNextActionAt(input.nextActionAt);
  const normalizedDetails = normalizeDetails(input.details);
  const detailsJson = JSON.stringify(normalizedDetails);
  const record: ProviderCrmRecord = {
    id,
    providerId: scope.providerUserId,
    clientUserId: normalizeOptionalText(input.clientUserId, 80),
    clientDisplayName: normalizeOptionalText(input.clientDisplayName, 140),
    organizationName: normalizeOptionalText(input.organizationName, 180),
    kind: normalizeKind(input.kind),
    title: normalizeText(input.title, 'Provider CRM record', 180),
    treatmentFocus: normalizeOptionalText(input.treatmentFocus, 500),
    businessFocus: normalizeOptionalText(input.businessFocus, 500),
    status: normalizeStatus(input.status),
    priority: normalizePriority(input.priority),
    nextActionAt: nextActionAt ? nextActionAt.toISOString() : null,
    timezone: input.timezone ? normalizeTimezone(input.timezone) : null,
    details: normalizedDetails,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await db.$executeRaw(Prisma.sql`
    INSERT INTO "ProviderCrmRecord" (
      id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
      kind, title, "treatmentFocus", "businessFocus", status, priority,
      "nextActionAt", timezone, details, "createdAt", "updatedAt"
    )
    VALUES (
      ${record.id}, ${record.providerId}, ${record.clientUserId}, ${record.clientDisplayName},
      ${record.organizationName}, ${record.kind}, ${record.title}, ${record.treatmentFocus},
      ${record.businessFocus}, ${record.status}, ${record.priority}, ${nextActionAt},
      ${record.timezone}, ${detailsJson}::jsonb, ${now}, ${now}
    )
  `);

  return record;
};

const listProviderCrmRecordsByKind = async (
  scope: ProviderCrmWorkspaceScope,
  kind: ProviderCrmRecordKind,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmRecord[]> => {
  await ensureProviderCrmWorkspaceTables(db);
  const rows =
    scope.role === 'admin'
      ? await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          WHERE kind = ${kind}
          ORDER BY "updatedAt" DESC
          LIMIT 250
        `)
      : await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          WHERE "providerId" = ${scope.providerUserId}
            AND kind = ${kind}
          ORDER BY "updatedAt" DESC
          LIMIT 250
        `);
  return rows.map(mapRecordRow);
};

const getProviderCrmRecordById = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  kind: ProviderCrmRecordKind,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmRecord | null> => {
  await ensureProviderCrmWorkspaceTables(db);
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const rows =
    scope.role === 'admin'
      ? await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          WHERE id = ${normalizedId}
            AND kind = ${kind}
          LIMIT 1
        `)
      : await db.$queryRaw<ProviderCrmRecordRow[]>(Prisma.sql`
          SELECT id, "providerId", "clientUserId", "clientDisplayName", "organizationName",
            kind, title, "treatmentFocus", "businessFocus", status, priority,
            "nextActionAt", timezone, details, "createdAt", "updatedAt"
          FROM "ProviderCrmRecord"
          WHERE id = ${normalizedId}
            AND "providerId" = ${scope.providerUserId}
            AND kind = ${kind}
          LIMIT 1
        `);
  return rows[0] ? mapRecordRow(rows[0]) : null;
};

const updateProviderCrmRecord = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  kind: ProviderCrmRecordKind,
  input: ProviderCrmRecordInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmRecord | null> => {
  const current = await getProviderCrmRecordById(scope, id, kind, db);
  if (!current) return null;

  const nextActionAt =
    input.nextActionAt === undefined
      ? current.nextActionAt
      : normalizeNextActionAt(input.nextActionAt)?.toISOString() || null;
  const nextDetails =
    input.details === undefined
      ? current.details
      : {
          ...current.details,
          ...normalizeDetails(input.details),
        };
  const updatedAt = new Date();
  const next: ProviderCrmRecord = {
    ...current,
    clientUserId:
      input.clientUserId === undefined
        ? current.clientUserId
        : normalizeOptionalText(input.clientUserId, 80),
    clientDisplayName:
      input.clientDisplayName === undefined
        ? current.clientDisplayName
        : normalizeOptionalText(input.clientDisplayName, 140),
    organizationName:
      input.organizationName === undefined
        ? current.organizationName
        : normalizeOptionalText(input.organizationName, 180),
    title: input.title === undefined ? current.title : normalizeText(input.title, current.title, 180),
    treatmentFocus:
      input.treatmentFocus === undefined
        ? current.treatmentFocus
        : normalizeOptionalText(input.treatmentFocus, 1000),
    businessFocus:
      input.businessFocus === undefined
        ? current.businessFocus
        : normalizeOptionalText(input.businessFocus, 1000),
    status: input.status === undefined ? current.status : normalizeStatus(input.status),
    priority: input.priority === undefined ? current.priority : normalizePriority(input.priority),
    nextActionAt,
    timezone: input.timezone === undefined ? current.timezone : normalizeTimezone(input.timezone),
    details: nextDetails,
    updatedAt: updatedAt.toISOString(),
  };

  await db.$executeRaw(Prisma.sql`
    UPDATE "ProviderCrmRecord"
    SET "clientUserId" = ${next.clientUserId},
      "clientDisplayName" = ${next.clientDisplayName},
      "organizationName" = ${next.organizationName},
      title = ${next.title},
      "treatmentFocus" = ${next.treatmentFocus},
      "businessFocus" = ${next.businessFocus},
      status = ${next.status},
      priority = ${next.priority},
      "nextActionAt" = ${nextActionAt ? new Date(nextActionAt) : null},
      timezone = ${next.timezone},
      details = ${JSON.stringify(next.details)}::jsonb,
      "updatedAt" = ${updatedAt}
    WHERE id = ${current.id}
      AND kind = ${kind}
      ${scope.role === 'admin' ? Prisma.empty : Prisma.sql`AND "providerId" = ${scope.providerUserId}`}
  `);

  return next;
};

const deleteProviderCrmRecord = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  kind: ProviderCrmRecordKind,
  db: PrismaClient = getPrisma()
): Promise<boolean> => {
  const current = await getProviderCrmRecordById(scope, id, kind, db);
  if (!current) return false;
  const deleted =
    scope.role === 'admin'
      ? await db.$executeRaw(Prisma.sql`
          DELETE FROM "ProviderCrmRecord"
          WHERE id = ${current.id}
            AND kind = ${kind}
        `)
      : await db.$executeRaw(Prisma.sql`
          DELETE FROM "ProviderCrmRecord"
          WHERE id = ${current.id}
            AND kind = ${kind}
            AND "providerId" = ${scope.providerUserId}
        `);
  return Number(deleted || 0) > 0;
};

const toNote = (record: ProviderCrmRecord): ProviderCrmNote => ({
  id: record.id,
  providerId: record.providerId,
  authorUserId: String(record.details.authorUserId || record.providerId),
  title: record.title,
  body: String(record.details.body || record.treatmentFocus || ''),
  category: String(record.details.category || 'general'),
  status: record.status === 'archived' ? 'archived' : 'active',
  relatedType: normalizeOptionalText(record.details.relatedType, 60),
  relatedId: normalizeOptionalText(record.details.relatedId, 120),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const toCollaboration = (record: ProviderCrmRecord): ProviderCrmCollaboration => ({
  id: record.id,
  providerId: record.providerId,
  authorUserId: String(record.details.authorUserId || record.providerId),
  title: record.title,
  description: String(record.details.description || record.businessFocus || ''),
  status: normalizeCollaborationStatus(record.details.collaborationStatus, record.status === 'archived' ? 'archived' : 'open'),
  relatedType: normalizeOptionalText(record.details.relatedType, 60),
  relatedId: normalizeOptionalText(record.details.relatedId, 120),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const toFollowUp = (record: ProviderCrmRecord): ProviderCrmFollowUp => ({
  id: record.id,
  providerId: record.providerId,
  ownerUserId: String(record.details.ownerUserId || record.providerId),
  assignedToUserId: normalizeOptionalText(record.details.assignedToUserId, 120),
  title: record.title,
  details: normalizeOptionalText(record.details.followUpDetails || record.treatmentFocus, 1200),
  dueAt: record.nextActionAt,
  status: recordStatusToFollowUpStatus(record.status, record.details),
  priority: record.priority,
  relatedType: normalizeOptionalText(record.details.relatedType, 60),
  relatedId: normalizeOptionalText(record.details.relatedId, 120),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const listProviderCrmNotes = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmNote[]> =>
  (await listProviderCrmRecordsByKind(scope, 'note', db)).map(toNote);

export const createProviderCrmNote = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderCrmNoteInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmNote> => {
  const title = requireText(input.title, 'title', 180);
  const body = requireText(input.body, 'body', 4000);
  const status = normalizeNoteStatus(input.status);
  const record = await createProviderCrmRecord(
    scope,
    {
      kind: 'note',
      title,
      treatmentFocus: body,
      status: status === 'archived' ? 'archived' : 'active',
      details: {
        body,
        category: normalizeText(input.category, 'general', 80),
        relatedType: normalizeOptionalText(input.relatedType, 60),
        relatedId: normalizeOptionalText(input.relatedId, 120),
        authorUserId: scope.providerUserId,
      },
    },
    db
  );
  return toNote(record);
};

export const updateProviderCrmNote = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  input: ProviderCrmNoteInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmNote | null> => {
  const current = await getProviderCrmRecordById(scope, id, 'note', db);
  if (!current) return null;
  const currentNote = toNote(current);
  const nextBody = input.body === undefined ? currentNote.body : requireText(input.body, 'body', 4000);
  const nextStatus = input.status === undefined ? currentNote.status : normalizeNoteStatus(input.status, currentNote.status);
  const record = await updateProviderCrmRecord(
    scope,
    id,
    'note',
    {
      title: input.title === undefined ? currentNote.title : requireText(input.title, 'title', 180),
      treatmentFocus: nextBody,
      status: nextStatus === 'archived' ? 'archived' : 'active',
      details: {
        body: nextBody,
        category: input.category === undefined ? currentNote.category : normalizeText(input.category, 'general', 80),
        relatedType: input.relatedType === undefined ? currentNote.relatedType : normalizeOptionalText(input.relatedType, 60),
        relatedId: input.relatedId === undefined ? currentNote.relatedId : normalizeOptionalText(input.relatedId, 120),
      },
    },
    db
  );
  return record ? toNote(record) : null;
};

export const deleteProviderCrmNote = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  db: PrismaClient = getPrisma()
): Promise<boolean> => deleteProviderCrmRecord(scope, id, 'note', db);

export const listProviderCrmCollaborations = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmCollaboration[]> =>
  (await listProviderCrmRecordsByKind(scope, 'collaboration', db)).map(toCollaboration);

export const createProviderCrmCollaboration = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderCrmCollaborationInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmCollaboration> => {
  const title = requireText(input.title, 'title', 180);
  const description = requireText(input.description, 'description', 4000);
  const status = normalizeCollaborationStatus(input.status);
  const record = await createProviderCrmRecord(
    scope,
    {
      kind: 'collaboration',
      title,
      businessFocus: description,
      status: status === 'completed' ? 'completed' : status === 'archived' ? 'archived' : 'active',
      details: {
        description,
        collaborationStatus: status,
        relatedType: normalizeOptionalText(input.relatedType, 60),
        relatedId: normalizeOptionalText(input.relatedId, 120),
        authorUserId: scope.providerUserId,
      },
    },
    db
  );
  return toCollaboration(record);
};

export const updateProviderCrmCollaboration = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  input: ProviderCrmCollaborationInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmCollaboration | null> => {
  const current = await getProviderCrmRecordById(scope, id, 'collaboration', db);
  if (!current) return null;
  const currentItem = toCollaboration(current);
  const nextDescription =
    input.description === undefined ? currentItem.description : requireText(input.description, 'description', 4000);
  const nextStatus =
    input.status === undefined ? currentItem.status : normalizeCollaborationStatus(input.status, currentItem.status);
  const record = await updateProviderCrmRecord(
    scope,
    id,
    'collaboration',
    {
      title: input.title === undefined ? currentItem.title : requireText(input.title, 'title', 180),
      businessFocus: nextDescription,
      status: nextStatus === 'completed' ? 'completed' : nextStatus === 'archived' ? 'archived' : 'active',
      details: {
        description: nextDescription,
        collaborationStatus: nextStatus,
        relatedType:
          input.relatedType === undefined ? currentItem.relatedType : normalizeOptionalText(input.relatedType, 60),
        relatedId: input.relatedId === undefined ? currentItem.relatedId : normalizeOptionalText(input.relatedId, 120),
      },
    },
    db
  );
  return record ? toCollaboration(record) : null;
};

export const deleteProviderCrmCollaboration = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  db: PrismaClient = getPrisma()
): Promise<boolean> => deleteProviderCrmRecord(scope, id, 'collaboration', db);

export const listProviderCrmFollowUps = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmFollowUp[]> =>
  (await listProviderCrmRecordsByKind(scope, 'follow_up', db)).map(toFollowUp);

export const createProviderCrmFollowUp = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderCrmFollowUpInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmFollowUp> => {
  const title = requireText(input.title, 'title', 180);
  const status = normalizeFollowUpStatus(input.status);
  const details = normalizeOptionalText(input.details, 1200);
  const record = await createProviderCrmRecord(
    scope,
    {
      kind: 'follow_up',
      title,
      treatmentFocus: details || undefined,
      status: followUpStatusToRecordStatus(status),
      priority: input.priority,
      nextActionAt: input.dueAt,
      details: {
        followUpStatus: status,
        followUpDetails: details,
        ownerUserId: scope.providerUserId,
        assignedToUserId: normalizeOptionalText(input.assignedToUserId, 120),
        relatedType: normalizeOptionalText(input.relatedType, 60),
        relatedId: normalizeOptionalText(input.relatedId, 120),
      },
    },
    db
  );
  return toFollowUp(record);
};

export const updateProviderCrmFollowUp = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  input: ProviderCrmFollowUpInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmFollowUp | null> => {
  const current = await getProviderCrmRecordById(scope, id, 'follow_up', db);
  if (!current) return null;
  const currentItem = toFollowUp(current);
  const nextStatus = input.status === undefined ? currentItem.status : normalizeFollowUpStatus(input.status, currentItem.status);
  const nextDetails = input.details === undefined ? currentItem.details : normalizeOptionalText(input.details, 1200);
  const record = await updateProviderCrmRecord(
    scope,
    id,
    'follow_up',
    {
      title: input.title === undefined ? currentItem.title : requireText(input.title, 'title', 180),
      treatmentFocus: nextDetails || undefined,
      status: followUpStatusToRecordStatus(nextStatus),
      priority: input.priority === undefined ? currentItem.priority : input.priority,
      nextActionAt: input.dueAt === undefined ? currentItem.dueAt : input.dueAt,
      details: {
        followUpStatus: nextStatus,
        followUpDetails: nextDetails,
        assignedToUserId:
          input.assignedToUserId === undefined
            ? currentItem.assignedToUserId
            : normalizeOptionalText(input.assignedToUserId, 120),
        relatedType: input.relatedType === undefined ? currentItem.relatedType : normalizeOptionalText(input.relatedType, 60),
        relatedId: input.relatedId === undefined ? currentItem.relatedId : normalizeOptionalText(input.relatedId, 120),
      },
    },
    db
  );
  return record ? toFollowUp(record) : null;
};

export const deleteProviderCrmFollowUp = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  db: PrismaClient = getPrisma()
): Promise<boolean> => deleteProviderCrmRecord(scope, id, 'follow_up', db);

const toContentItem = (course: any): ProviderCrmContentItem => {
  const metadata = normalizeCourseSyllabusMetadata(course.syllabus);
  return {
    id: String(course.id),
    ownerId: course.ownerId || null,
    ownerType: String(course.ownerType || ''),
    provider: String(course.provider || ''),
    title: String(course.title || ''),
    description: String(course.description || ''),
    fullDescription: metadata.fullDescription,
    category: metadata.category,
    estimatedDuration: metadata.estimatedDuration,
    learningObjectives: metadata.learningObjectives,
    contentSections: metadata.contentSections,
    tier: String(course.tier || 'Professional'),
    status: normalizeContentStatus(course.status, 'draft'),
    image: course.image || null,
    enrolledCount: Number(course.enrolledCount || 0),
    createdAt: toIsoString(course.createdAt) || new Date().toISOString(),
    updatedAt: toIsoString(course.updatedAt) || new Date().toISOString(),
  };
};

export const listProviderCrmContentItems = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmContentItem[]> => {
  const dbAny = db as any;
  const courses = await dbAny.course.findMany({
    where: scope.role === 'admin' ? {} : { ownerId: scope.providerUserId },
    orderBy: { updatedAt: 'desc' },
    take: 250,
  });
  return courses.map(toContentItem);
};

export const createProviderCrmContentItem = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderCrmContentInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmContentItem> => {
  const dbAny = db as any;
  const title = requireText(input.title, 'title', 180);
  const description = requireText(input.description, 'description', 2000);
  const status = normalizeContentStatus(input.status, 'draft');
  const syllabus = buildCourseSyllabusMetadata(null, input);
  const course = await dbAny.course.create({
    data: {
      id: `provider_course_${crypto.randomUUID()}`,
      ownerId: scope.providerUserId,
      ownerType: scope.role,
      provider: scope.providerDisplayName,
      title,
      description,
      tier: normalizeTier(input.tier),
      status,
      enrolledCount: 0,
      image: null,
      syllabus,
    },
  });
  return toContentItem(course);
};

export const updateProviderCrmContentItem = async (
  scope: ProviderCrmWorkspaceScope,
  id: string,
  input: ProviderCrmContentInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmContentItem | null> => {
  const dbAny = db as any;
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const existing = await dbAny.course.findFirst({
    where: scope.role === 'admin' ? { id: normalizedId } : { id: normalizedId, ownerId: scope.providerUserId },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = requireText(input.title, 'title', 180);
  if (input.description !== undefined) data.description = requireText(input.description, 'description', 2000);
  if (input.tier !== undefined) data.tier = normalizeTier(input.tier, existing.tier);
  if (input.status !== undefined) data.status = normalizeContentStatus(input.status, normalizeContentStatus(existing.status));
  if (hasCourseSyllabusInput(input)) data.syllabus = buildCourseSyllabusMetadata(existing.syllabus, input);

  const course = await dbAny.course.update({
    where: { id: existing.id },
    data,
  });
  return toContentItem(course);
};

type CountRow = { key: string | null; count: number | string | bigint };

const countMapFromRows = (rows: CountRow[]): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.key || 'unknown');
    acc[key] = Number(row.count || 0);
    return acc;
  }, {});

const countBy = <T extends string>(items: T[]): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

export const buildProviderCrmAnalytics = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmAnalytics> => {
  await ensureProviderCrmWorkspaceTables(db);
  const dbAny = db as any;
  const now = new Date();
  const [records, notes, collaborations, followUps, contentItems, meetingTotal, upcomingMeetings] =
    await Promise.all([
      listProviderCrmRecords(scope, db),
      listProviderCrmNotes(scope, db),
      listProviderCrmCollaborations(scope, db),
      listProviderCrmFollowUps(scope, db),
      listProviderCrmContentItems(scope, db),
      dbAny.meetingSession.count({
        where: scope.role === 'admin' ? {} : { providerId: scope.providerDid },
      }),
      dbAny.meetingSession.count({
        where:
          scope.role === 'admin'
            ? { status: { in: ['scheduled', 'live'] } }
            : { providerId: scope.providerDid, status: { in: ['scheduled', 'live'] } },
      }),
    ]);

  const relationshipRecords = records.filter(
    (record) => record.kind !== 'note' && record.kind !== 'collaboration' && record.kind !== 'follow_up'
  );
  const followUpStatuses = countBy(followUps.map((followUp) => followUp.status));
  const collaborationStatuses = countBy(collaborations.map((item) => item.status));
  const contentStatuses = countBy(contentItems.map((item) => item.status));
  const analytics: ProviderCrmAnalytics = {
    scope: {
      role: scope.role,
      visibility: scope.role === 'admin' ? 'administrator-aggregate' : 'provider-owned',
    },
    generatedAt: now.toISOString(),
    relationships: {
      total: relationshipRecords.length,
      active: relationshipRecords.filter((record) => record.status !== 'archived').length,
      byKind: countBy(relationshipRecords.map((record) => record.kind)),
      byStatus: countBy(relationshipRecords.map((record) => record.status)),
    },
    notes: {
      total: notes.length,
      active: notes.filter((note) => note.status === 'active').length,
      archived: notes.filter((note) => note.status === 'archived').length,
    },
    collaboration: {
      total: collaborations.length,
      open: collaborationStatuses.open || 0,
      inProgress: collaborationStatuses.in_progress || 0,
      completed: collaborationStatuses.completed || 0,
      archived: collaborationStatuses.archived || 0,
    },
    followUps: {
      total: followUps.length,
      open: followUpStatuses.open || 0,
      inProgress: followUpStatuses.in_progress || 0,
      completed: followUpStatuses.completed || 0,
      canceled: followUpStatuses.canceled || 0,
      due: followUps.filter((followUp) => {
        if (!followUp.dueAt || followUp.status === 'completed' || followUp.status === 'canceled') return false;
        return new Date(followUp.dueAt).getTime() <= now.getTime();
      }).length,
    },
    content: {
      total: contentItems.length,
      draft: contentStatuses.draft || 0,
      published: contentStatuses.published || 0,
      archived: contentStatuses.archived || 0,
    },
    meetings: {
      total: Number(meetingTotal || 0),
      upcoming: Number(upcomingMeetings || 0),
    },
  };

  if (scope.role === 'admin') {
    const [applicantStatusRows, approvedProviders, membershipRows, aiInteractions] = await Promise.all([
      dbAny.providerApplicant.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      dbAny.user.count({
        where: {
          role: 'provider',
          providerRevokedAt: null,
          OR: [
            { providerApprovalStatus: { in: ['approved', 'active'] } },
            { providerApproved: true },
          ],
        },
      }),
      dbAny.membership.groupBy({
        by: ['tier'],
        _count: { _all: true },
      }),
      dbAny.aiInteraction.count(),
    ]);
    const applicantCounts = countMapFromRows(
      applicantStatusRows.map((row: any) => ({ key: row.status, count: row._count?._all || 0 }))
    );
    const membershipCounts = countMapFromRows(
      membershipRows.map((row: any) => ({ key: row.tier, count: row._count?._all || 0 }))
    );
    analytics.admin = {
      providerApplicants: {
        total: Object.values(applicantCounts).reduce((sum, value) => sum + value, 0),
        pending:
          (applicantCounts.submitted || 0) +
          (applicantCounts.under_review || 0) +
          (applicantCounts.needs_more_info || 0) +
          (applicantCounts.discovery_scheduled || 0),
        approved: (applicantCounts.approved || 0) + (applicantCounts.accepted || 0),
        declined:
          (applicantCounts.rejected || 0) +
          (applicantCounts.declined || 0) +
          (applicantCounts.denied || 0),
      },
      approvedProviders: Number(approvedProviders || 0),
      membershipsByTier: membershipCounts,
      aiInteractions: {
        total: Number(aiInteractions || 0),
      },
    };
  }

  return analytics;
};

export const listRoundtableReservations = async (
  scope: ProviderCrmWorkspaceScope,
  db: PrismaClient = getPrisma()
): Promise<ProviderRoundtableReservation[]> => {
  await ensureProviderCrmWorkspaceTables(db);
  const horizonStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows =
    scope.role === 'admin'
      ? await db.$queryRaw<ProviderRoundtableReservationRow[]>(Prisma.sql`
          SELECT id, "providerId", "roomNumber", "startAt", "endAt", timezone, title,
            "meetingSessionId", "roomUrl", status, "chatMode", details, "createdAt", "updatedAt"
          FROM "ProviderRoundtableReservation"
          WHERE "startAt" >= ${horizonStart}
          ORDER BY "startAt" ASC, "roomNumber" ASC
          LIMIT 500
        `)
      : await db.$queryRaw<ProviderRoundtableReservationRow[]>(Prisma.sql`
          SELECT id, "providerId", "roomNumber", "startAt", "endAt", timezone, title,
            "meetingSessionId", "roomUrl", status, "chatMode", details, "createdAt", "updatedAt"
          FROM "ProviderRoundtableReservation"
          WHERE "providerId" = ${scope.providerUserId}
            AND "startAt" >= ${horizonStart}
          ORDER BY "startAt" ASC, "roomNumber" ASC
          LIMIT 500
        `);
  return rows.map(mapReservationRow);
};

export const createRoundtableReservation = async (
  scope: ProviderCrmWorkspaceScope,
  input: ProviderRoundtableReservationInput,
  db: PrismaClient = getPrisma()
): Promise<ProviderRoundtableReservation> => {
  await ensureProviderCrmWorkspaceTables(db);
  const roomNumber = Math.max(
    1,
    Math.min(ROUNDTABLE_ROOM_COUNT, Number.parseInt(String(input.roomNumber || '1'), 10) || 1)
  );
  const startAt = normalizeRoundtableStartAt(input.startAt);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  const timezone = normalizeTimezone(input.timezone);
  const title = normalizeText(input.title, 'Conscious Roundtable', 180);
  const reservationId = `roundtable_${crypto.randomUUID()}`;
  const meetingSessionId = `meet_${crypto.randomUUID()}`;
  const routeKey = `conscious-roundtable-${crypto.randomUUID()}`;
  const roomUrl = `/conscious-meetings/session/${encodeURIComponent(routeKey)}`;
  const detailsJson = JSON.stringify(input.details || {});
  const now = new Date();

  const existing = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM "ProviderRoundtableReservation"
    WHERE "roomNumber" = ${roomNumber}
      AND "startAt" = ${startAt}
      AND status <> 'cancelled'
    LIMIT 1
  `);
  if (existing.length > 0) {
    throw new Error('ROUNDTABLE_SLOT_UNAVAILABLE');
  }

  const metadata: Prisma.JsonObject = {
    providerDid: scope.providerDid,
    providerUserId: scope.providerUserId,
    providerDisplayName: scope.providerDisplayName,
    description: 'Private Conscious Roundtable room reserved from the Provider CRM.',
    focusArea: 'Conscious Roundtable',
    mode: 'virtual',
    maxViewers: 24,
    publicStream: false,
    nativeRoomEnabled: true,
    immersiveEnabled: false,
    localRecordingAllowed: false,
    routeKey,
    vodPath: null,
    participants: [],
    invitedMembers: [],
    externalLinks: [],
    signals: [],
    roundtable: {
      reservationId,
      roomNumber,
      timezone,
    },
  };

  await db.$transaction(async (tx) => {
    await tx.meetingSession.create({
      data: {
        id: meetingSessionId,
        providerId: scope.providerDid,
        title,
        participants: [],
        status: 'scheduled',
        scheduledAt: startAt,
        metadata,
      },
    });

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProviderRoundtableReservation" (
        id, "providerId", "roomNumber", "startAt", "endAt", timezone, title,
        "meetingSessionId", "roomUrl", status, "chatMode", details, "createdAt", "updatedAt"
      )
      VALUES (
        ${reservationId}, ${scope.providerUserId}, ${roomNumber}, ${startAt}, ${endAt},
        ${timezone}, ${title}, ${meetingSessionId}, ${roomUrl}, 'scheduled',
        'native-room-signals', ${detailsJson}::jsonb, ${now}, ${now}
      )
    `);
  });

  return {
    id: reservationId,
    providerId: scope.providerUserId,
    roomNumber,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone,
    title,
    meetingSessionId,
    roomUrl,
    status: 'scheduled',
    chatMode: 'native-room-signals',
    details: input.details || {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

const buildGuidanceAlerts = (
  records: ProviderCrmRecord[],
  reservations: ProviderRoundtableReservation[]
): ProviderCrmWorkspace['guidanceAlerts'] => {
  const nowMs = Date.now();
  const dueRecords = records.filter((record) => {
    if (!record.nextActionAt || record.status === 'completed' || record.status === 'archived') return false;
    return new Date(record.nextActionAt).getTime() <= nowMs;
  });
  const upcomingReservations = reservations.filter((reservation) => {
    if (reservation.status === 'cancelled') return false;
    return new Date(reservation.startAt).getTime() >= nowMs;
  });

  const alerts: ProviderCrmWorkspace['guidanceAlerts'] = [];
  if (records.length === 0) {
    alerts.push({
      id: 'first-record',
      severity: 'info',
      title: 'Create the first relationship record',
      detail: 'Begin by documenting one member, organization, or institution interaction.',
      action: 'Add record',
    });
  }
  if (dueRecords.length > 0) {
    alerts.push({
      id: 'due-follow-ups',
      severity: dueRecords.some((record) => record.priority === 'urgent') ? 'urgent' : 'warning',
      title: `${dueRecords.length} follow-up${dueRecords.length === 1 ? '' : 's'} due`,
      detail: 'Review treatment continuity and business-growth next actions.',
      action: 'Open follow-ups',
    });
  }
  if (upcomingReservations.length === 0) {
    alerts.push({
      id: 'roundtable-empty',
      severity: 'info',
      title: 'No upcoming Conscious Roundtable reservation',
      detail: 'Reserve a branded CNH room before sending users or partner institutions a meeting link.',
      action: 'Reserve Roundtable',
    });
  }
  return alerts;
};

const buildMetrics = (
  records: ProviderCrmRecord[],
  reservations: ProviderRoundtableReservation[]
): ProviderCrmWorkspace['metrics'] => {
  const nowMs = Date.now();
  const activeRecords = records.filter((record) => record.status !== 'archived');
  const dueFollowUps = activeRecords.filter(
    (record) => record.nextActionAt && new Date(record.nextActionAt).getTime() <= nowMs
  );
  const upcomingRoundtables = reservations.filter(
    (reservation) => reservation.status !== 'cancelled' && new Date(reservation.startAt).getTime() >= nowMs
  );
  const organizationRecords = activeRecords.filter(
    (record) => record.kind === 'organization' || record.kind === 'institution'
  );

  return {
    treatment: {
      activeClientRecords: activeRecords.filter((record) => record.kind === 'client').length,
      dueFollowUps: dueFollowUps.length,
      upcomingRoundtables: upcomingRoundtables.length,
    },
    businessGrowth: {
      organizationsTracked: organizationRecords.length,
      institutionContractOpportunities: organizationRecords.filter(
        (record) => record.status === 'contracting' || Boolean(record.businessFocus)
      ).length,
      urgentOpportunities: activeRecords.filter((record) => record.priority === 'urgent').length,
    },
  };
};

const KNOWLEDGE_RESOURCES: ProviderCrmWorkspace['resources'] = [
  {
    id: 'treatment-continuity',
    title: 'Treatment Continuity Checklist',
    category: 'Service Delivery',
    summary: 'Standardize intake, session goals, consent boundaries, and next-step documentation.',
    checklist: [
      'Confirm member objective before the session starts.',
      'Document the treatment focus and next action before closing.',
      'Schedule or record the next follow-up date inside the CRM.',
    ],
  },
  {
    id: 'institution-contracting',
    title: 'Institution Relationship Notes',
    category: 'Business Growth',
    summary: 'Capture organizations and institutions CNH should evaluate for contracts or partnerships.',
    checklist: [
      'Record organization name, stakeholder, region, and service need.',
      'Classify urgency and contract-readiness without using sales-lead language.',
      'Escalate strategic institutions to admin visibility.',
    ],
  },
  {
    id: 'roundtable-readiness',
    title: 'Conscious Roundtable Room Readiness',
    category: 'Virtual Care',
    summary: 'Use CNH-native room links, local timezone scheduling, and signed access whenever possible.',
    checklist: [
      'Reserve one of the 12 hourly rooms before sending the link.',
      'Use platform invites for CNH users and external guest links only when needed.',
      'Avoid storing sensitive meeting recordings unless a user explicitly chooses local-only recording.',
    ],
  },
];

export const buildProviderCrmWorkspace = async (
  scope: ProviderCrmWorkspaceScope,
  timezone: string,
  db: PrismaClient = getPrisma()
): Promise<ProviderCrmWorkspace> => {
  const [records, reservations] = await Promise.all([
    listProviderCrmRecords(scope, db),
    listRoundtableReservations(scope, db),
  ]);

  return {
    scope: {
      ...scope,
      visibility: scope.role === 'admin' ? 'administrator-holistic' : 'provider-owned',
    },
    metrics: buildMetrics(records, reservations),
    guidanceAlerts: buildGuidanceAlerts(records, reservations),
    records,
    roundtable: {
      label: 'Conscious Roundtable',
      roomCount: ROUNDTABLE_ROOM_COUNT,
      dayStartHour: ROUNDTABLE_DAY_START_HOUR,
      hourCount: ROUNDTABLE_HOUR_COUNT,
      timezone: normalizeTimezone(timezone),
      reservations,
    },
    resources: KNOWLEDGE_RESOURCES,
  };
};
