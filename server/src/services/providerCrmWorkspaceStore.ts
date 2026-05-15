import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';

export type ProviderCrmWorkspaceRole = 'provider' | 'admin';
export type ProviderCrmRecordKind = 'client' | 'organization' | 'institution' | 'follow_up';
export type ProviderCrmRecordStatus = 'active' | 'watching' | 'contracting' | 'completed' | 'archived';
export type ProviderCrmPriority = 'low' | 'normal' | 'high' | 'urgent';

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

const RECORD_KINDS: ProviderCrmRecordKind[] = ['client', 'organization', 'institution', 'follow_up'];
const RECORD_STATUSES: ProviderCrmRecordStatus[] = ['active', 'watching', 'contracting', 'completed', 'archived'];
const PRIORITIES: ProviderCrmPriority[] = ['low', 'normal', 'high', 'urgent'];
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
  const detailsJson = JSON.stringify(input.details || {});
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
    details: input.details || {},
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
