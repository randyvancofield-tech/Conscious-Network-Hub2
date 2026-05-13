import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import {
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import {
  ProviderAuthenticatedRequest,
  requireProviderScope,
  requireProviderSession,
} from '../providerMiddleware';
import { resolveAuthTokenSecret } from '../requiredEnv';
import { getPrisma } from '../services/prismaClient';

type SessionMode = 'virtual' | 'solo' | 'immersive-5d';
type SessionStatus = 'scheduled' | 'live' | 'ended';

interface MeetingParticipant {
  id: string;
  kind: 'provider' | 'user' | 'guest';
  displayName: string;
  email: string | null;
  joinedAtMs: number;
}

interface MeetingInviteRecord {
  key: string;
  userId: string | null;
  username: string;
  displayName: string;
  invitedAtMs: number;
  source: 'direct' | 'group';
  groupId: string | null;
}

interface ExternalLinkRecord {
  id: string;
  createdAtMs: number;
  expiresAtMs: number;
  maxUses: number;
  uses: number;
  revoked: boolean;
}

interface MeetingSessionRecord {
  id: string;
  providerDid: string;
  providerUserId: string | null;
  providerDisplayName: string;
  title: string;
  description: string;
  focusArea: string;
  mode: SessionMode;
  status: SessionStatus;
  maxViewers: number;
  scheduledAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  publicStream: boolean;
  routeKey: string;
  vodPath: string | null;
  participants: Map<string, MeetingParticipant>;
  invitedMembers: Map<string, MeetingInviteRecord>;
  externalLinks: Map<string, ExternalLinkRecord>;
}

interface ExternalInviteTokenPayload {
  tokenType: 'meeting_external_invite';
  sessionId: string;
  linkId: string;
  providerDid: string;
  iat?: number;
  exp?: number;
}

interface GuestSessionTokenPayload {
  tokenType: 'meeting_guest_session';
  sessionId: string;
  participantId: string;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
}

const router = Router();
const providerRouter = Router();
const userRouter = Router();
const guestRouter = Router();

providerRouter.use(requireProviderSession);
userRouter.use(requireCanonicalIdentity);

const MAX_VIEWERS_HARD_CAP = 500;
const DEFAULT_MAX_VIEWERS = 120;
const DEFAULT_LINK_TTL_MINUTES = 120;
const MAX_LINK_TTL_MINUTES = 24 * 60;
const DEFAULT_LINK_MAX_USES = 500;
const MAX_LINK_MAX_USES = 1000;
const DIRECTORY_LOOKUP_LIMIT = 1000;
const MAX_BATCH_USERNAMES = 500;
const MAX_BATCH_GROUPS = 50;

const mapToArray = <T>(value: Map<string, T>): T[] => Array.from(value.values());

const sessionMetadata = (session: MeetingSessionRecord) => ({
  providerDid: session.providerDid,
  providerUserId: session.providerUserId,
  providerDisplayName: session.providerDisplayName,
  description: session.description,
  focusArea: session.focusArea,
  mode: session.mode,
  maxViewers: session.maxViewers,
  scheduledAtMs: session.scheduledAtMs,
  createdAtMs: session.createdAtMs,
  updatedAtMs: session.updatedAtMs,
  publicStream: session.publicStream,
  routeKey: session.routeKey,
  vodPath: session.vodPath,
  invitedMembers: mapToArray(session.invitedMembers),
  externalLinks: mapToArray(session.externalLinks),
});

const sessionFromRow = (row: any): MeetingSessionRecord => {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const participants = Array.isArray(row?.participants) ? row.participants : [];
  const invitedMembers = Array.isArray(metadata.invitedMembers) ? metadata.invitedMembers : [];
  const externalLinks = Array.isArray(metadata.externalLinks) ? metadata.externalLinks : [];
  const createdAtMs = Number(metadata.createdAtMs || new Date(row.createdAt).getTime());
  const updatedAtMs = Number(metadata.updatedAtMs || new Date(row.updatedAt).getTime());
  const scheduledAtMs = Number(
    metadata.scheduledAtMs ||
      (row.scheduledAt ? new Date(row.scheduledAt).getTime() : 0) ||
      createdAtMs
  );

  return {
    id: row.id,
    providerDid: String(metadata.providerDid || row.providerId),
    providerUserId: metadata.providerUserId ? String(metadata.providerUserId) : null,
    providerDisplayName: String(metadata.providerDisplayName || 'Verified Provider').trim() || 'Verified Provider',
    title: row.title,
    description: String(metadata.description || '').trim(),
    focusArea: String(metadata.focusArea || '').trim(),
    mode: normalizeSessionMode(metadata.mode),
    status: row.status === 'live' || row.status === 'ended' ? row.status : 'scheduled',
    maxViewers: normalizePositiveInteger(metadata.maxViewers, DEFAULT_MAX_VIEWERS, 2, MAX_VIEWERS_HARD_CAP),
    scheduledAtMs,
    createdAtMs,
    updatedAtMs,
    startedAtMs: row.startedAt ? new Date(row.startedAt).getTime() : null,
    endedAtMs: row.endedAt ? new Date(row.endedAt).getTime() : null,
    publicStream: metadata.publicStream === true,
    routeKey: String(metadata.routeKey || row.id).trim() || row.id,
    vodPath: metadata.vodPath ? String(metadata.vodPath) : null,
    participants: new Map(participants.map((entry: MeetingParticipant) => [entry.id, entry])),
    invitedMembers: new Map(invitedMembers.map((entry: MeetingInviteRecord) => [entry.key, entry])),
    externalLinks: new Map(externalLinks.map((entry: ExternalLinkRecord) => [entry.id, entry])),
  };
};

const saveMeetingSession = async (session: MeetingSessionRecord): Promise<void> => {
  const db = getPrisma() as any;
  await db.meetingSession.upsert({
    where: { id: session.id },
    update: {
      title: session.title,
      participants: mapToArray(session.participants),
      status: session.status,
      scheduledAt: new Date(session.scheduledAtMs),
      startedAt: session.startedAtMs ? new Date(session.startedAtMs) : null,
      endedAt: session.endedAtMs ? new Date(session.endedAtMs) : null,
      metadata: sessionMetadata(session),
    },
    create: {
      id: session.id,
      providerId: session.providerDid,
      title: session.title,
      participants: mapToArray(session.participants),
      status: session.status,
      scheduledAt: new Date(session.scheduledAtMs),
      startedAt: session.startedAtMs ? new Date(session.startedAtMs) : null,
      endedAt: session.endedAtMs ? new Date(session.endedAtMs) : null,
      metadata: sessionMetadata(session),
    },
  });
};

const getMeetingSession = async (sessionId: string): Promise<MeetingSessionRecord | null> => {
  const db = getPrisma() as any;
  const row = await db.meetingSession.findUnique({ where: { id: sessionId } });
  return row ? sessionFromRow(row) : null;
};

const getMeetingSessionByEndpoint = async (sessionEndpoint: string): Promise<MeetingSessionRecord | null> => {
  const normalized = String(sessionEndpoint || '').trim();
  if (!normalized) return null;
  const direct = await getMeetingSession(normalized);
  if (direct) return direct;

  const db = getPrisma() as any;
  const rows = await db.meetingSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map(sessionFromRow).find((session: MeetingSessionRecord) => session.routeKey === normalized) || null;
};

const listProviderMeetingSessions = async (providerDid: string): Promise<MeetingSessionRecord[]> => {
  const db = getPrisma() as any;
  const rows = await db.meetingSession.findMany({
    where: { providerId: providerDid },
    orderBy: { scheduledAt: 'desc' },
  });
  return rows.map(sessionFromRow);
};

const listActiveMeetingSessions = async (): Promise<MeetingSessionRecord[]> => {
  const db = getPrisma() as any;
  const rows = await db.meetingSession.findMany({
    where: { status: { not: 'ended' } },
    orderBy: { scheduledAt: 'asc' },
  });
  return rows.map(sessionFromRow);
};

const listArchivedMeetingSessions = async (): Promise<MeetingSessionRecord[]> => {
  const db = getPrisma() as any;
  const rows = await db.meetingSession.findMany({
    where: { status: 'ended' },
    orderBy: { endedAt: 'desc' },
  });
  return rows.map(sessionFromRow);
};

const normalizeUsername = (value: unknown): string =>
  String(value || '').trim().replace(/^@+/, '').toLowerCase();

const normalizeSessionMode = (value: unknown): SessionMode => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'solo') return 'solo';
  if (normalized === 'immersive-5d') return 'immersive-5d';
  return 'virtual';
};

const normalizeSessionTitle = (value: unknown): string =>
  String(value || '').trim().slice(0, 120) || 'Provider Session';

const normalizeSessionText = (value: unknown, fallback: string, maxLength: number): string => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return normalized || fallback;
};

const normalizeScheduledAtMs = (value: unknown): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const asDate = Date.parse(String(value || ''));
  return Number.isFinite(asDate) && asDate > 0 ? asDate : Date.now();
};

const createInternalRouteKey = (): string => `cm_${crypto.randomBytes(18).toString('base64url')}`;

const normalizePositiveInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < minimum) return minimum;
  if (rounded > maximum) return maximum;
  return rounded;
};

const getPublicBaseUrl = (req: Request): string => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const protocol = forwardedProto || req.protocol || 'https';
  return `${protocol}://${req.get('host')}`;
};

const getMeetingAuthSecret = (): string => resolveAuthTokenSecret();

const createExternalInviteToken = (input: {
  sessionId: string;
  linkId: string;
  providerDid: string;
  ttlMinutes: number;
}): string => {
  const payload: ExternalInviteTokenPayload = {
    tokenType: 'meeting_external_invite',
    sessionId: input.sessionId,
    linkId: input.linkId,
    providerDid: input.providerDid,
  };
  return jwt.sign(payload, getMeetingAuthSecret(), {
    algorithm: 'HS256',
    issuer: 'hcn-meeting',
    audience: 'hcn-meeting-external-invite',
    expiresIn: Math.max(1, Math.floor(input.ttlMinutes * 60)),
  });
};

const verifyExternalInviteToken = (token: string): ExternalInviteTokenPayload | null => {
  try {
    const payload = jwt.verify(token, getMeetingAuthSecret(), {
      issuer: 'hcn-meeting',
      audience: 'hcn-meeting-external-invite',
    }) as ExternalInviteTokenPayload;
    if (payload.tokenType !== 'meeting_external_invite') return null;
    if (!payload.sessionId || !payload.linkId || !payload.providerDid) return null;
    return payload;
  } catch {
    return null;
  }
};

const createGuestSessionToken = (input: {
  sessionId: string;
  participantId: string;
  name: string;
  email: string;
  ttlMinutes: number;
}): string => {
  const payload: GuestSessionTokenPayload = {
    tokenType: 'meeting_guest_session',
    sessionId: input.sessionId,
    participantId: input.participantId,
    name: input.name,
    email: input.email,
  };
  return jwt.sign(payload, getMeetingAuthSecret(), {
    algorithm: 'HS256',
    issuer: 'hcn-meeting',
    audience: 'hcn-meeting-guest-session',
    expiresIn: Math.max(1, Math.floor(input.ttlMinutes * 60)),
  });
};

const verifyGuestSessionToken = (token: string): GuestSessionTokenPayload | null => {
  try {
    const payload = jwt.verify(token, getMeetingAuthSecret(), {
      issuer: 'hcn-meeting',
      audience: 'hcn-meeting-guest-session',
    }) as GuestSessionTokenPayload;
    if (payload.tokenType !== 'meeting_guest_session') return null;
    if (!payload.sessionId || !payload.participantId || !payload.name || !payload.email) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const sessionToResponse = (session: MeetingSessionRecord, req?: Request) => {
  const roomPath = `/conscious-meetings/session/${encodeURIComponent(session.routeKey || session.id)}`;
  const baseUrl = req ? getPublicBaseUrl(req) : '';
  return {
    id: session.id,
    routeKey: session.routeKey,
    title: session.title,
    description: session.description,
    focusArea: session.focusArea,
    mode: session.mode,
    status: session.status,
    providerDid: session.providerDid,
    providerUserId: session.providerUserId,
    providerDisplayName: session.providerDisplayName,
    maxViewers: session.maxViewers,
    publicStream: session.publicStream,
    scheduledAtMs: session.scheduledAtMs,
    internalRoomPath: roomPath,
    internalRoomUrl: baseUrl ? `${baseUrl}${roomPath}` : null,
    standardRoomPath: `${roomPath}?view=standard`,
    immersiveRoomPath: `${roomPath}?view=immersive-5d`,
    vodPath: session.vodPath,
    participants: Array.from(session.participants.values()).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      displayName: entry.displayName,
      joinedAtMs: entry.joinedAtMs,
    })),
    invitedMembers: Array.from(session.invitedMembers.values()).map((entry) => ({
      key: entry.key,
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      source: entry.source,
      groupId: entry.groupId,
      invitedAtMs: entry.invitedAtMs,
    })),
    createdAtMs: session.createdAtMs,
    updatedAtMs: session.updatedAtMs,
    startedAtMs: session.startedAtMs,
    endedAtMs: session.endedAtMs,
  };
};

const findProviderSessionOrDeny = async (
  req: Request,
  res: Response
): Promise<{ providerDid: string; providerUserId: string; session: MeetingSessionRecord } | null> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  const providerUserId = String(providerReq.providerUserId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const session = await getMeetingSession(sessionId);
  if (!providerDid || !providerUserId || !session || session.providerDid !== providerDid) {
    res.status(404).json({ error: 'Meeting session not found' });
    return null;
  }
  return { providerDid, providerUserId, session };
};

const ensureSessionCapacity = (session: MeetingSessionRecord): boolean =>
  session.participants.size < session.maxViewers;

const maybeFinalizeSession = async (session: MeetingSessionRecord): Promise<void> => {
  if (session.participants.size > 0) return;
  session.status = 'ended';
  session.endedAtMs = Date.now();
  session.updatedAtMs = session.endedAtMs;
  session.vodPath = session.vodPath || `/vod/conscious-meetings/${session.id}.mp4`;
  await saveMeetingSession(session);
};

const resolveDirectoryUserByUsername = async (username: string): Promise<{
  userId: string | null;
  username: string;
  displayName: string;
}> => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return {
      userId: null,
      username: '',
      displayName: '',
    };
  }

  const users = await localStore.listUsers(DIRECTORY_LOOKUP_LIMIT);
  const match =
    users.find((entry) => normalizeUsername(entry.handle || '') === normalized) ||
    users.find((entry) => normalizeUsername(entry.name || '') === normalized);

  if (!match) {
    return {
      userId: null,
      username: normalized,
      displayName: normalized,
    };
  }

  return {
    userId: match.id,
    username: normalizeUsername(match.handle || match.name || normalized) || normalized,
    displayName: String(match.name || match.handle || normalized).trim() || normalized,
  };
};

const isUserInvited = (session: MeetingSessionRecord, user: any): boolean => {
  const userId = String(user?.id || '').trim();
  const candidates = new Set<string>();
  candidates.add(normalizeUsername(user?.handle || ''));
  candidates.add(normalizeUsername(user?.name || ''));
  const emailPrefix = String(user?.email || '').trim().split('@')[0] || '';
  candidates.add(normalizeUsername(emailPrefix));

  for (const invite of session.invitedMembers.values()) {
    if (invite.userId && userId && invite.userId === userId) return true;
    if (candidates.has(invite.username)) return true;
  }

  return false;
};

const canUserAccessSession = (session: MeetingSessionRecord, user: any): boolean =>
  session.publicStream || isUserInvited(session, user);

providerRouter.get('/sessions', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  const sessions = (await listProviderMeetingSessions(providerDid))
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map((session) => sessionToResponse(session, req));
  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_meeting_sessions_list',
    outcome: 'success',
    actorUserId: providerReq.providerUserId || providerDid,
    targetUserId: providerReq.providerUserId || providerDid,
    statusCode: 200,
    metadata: {
      providerSessionId: providerReq.providerSessionId || null,
      sessionCount: sessions.length,
    },
  });
  res.json({ success: true, sessions });
});

providerRouter.post('/sessions', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  const providerUserId = String(providerReq.providerUserId || '').trim();
  if (!providerDid || !providerUserId) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  const title = normalizeSessionTitle(req.body?.title);
  const description = normalizeSessionText(
    req.body?.description,
    'Provider-hosted live session inside Conscious Network Hub.',
    1200
  );
  const focusArea = normalizeSessionText(req.body?.focusArea, 'Conscious Development', 120);
  const mode = normalizeSessionMode(req.body?.mode);
  const maxViewers = normalizePositiveInteger(
    req.body?.maxViewers,
    DEFAULT_MAX_VIEWERS,
    2,
    MAX_VIEWERS_HARD_CAP
  );
  const scheduledAtMs = normalizeScheduledAtMs(req.body?.scheduledAtMs || req.body?.scheduledAt);
  const publicStream = req.body?.publicStream !== false;
  const providerProfile = await localStore.getUserById(providerUserId);
  const providerDisplayName =
    String(providerProfile?.name || providerProfile?.handle || 'Verified Provider').trim() || 'Verified Provider';

  const sessionId = `meet_${crypto.randomUUID()}`;
  const nowMs = Date.now();
  const record: MeetingSessionRecord = {
    id: sessionId,
    providerDid,
    providerUserId,
    providerDisplayName,
    title,
    description,
    focusArea,
    mode,
    status: 'scheduled',
    maxViewers,
    scheduledAtMs,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    startedAtMs: null,
    endedAtMs: null,
    publicStream,
    routeKey: createInternalRouteKey(),
    vodPath: null,
    participants: new Map<string, MeetingParticipant>(),
    invitedMembers: new Map<string, MeetingInviteRecord>(),
    externalLinks: new Map<string, ExternalLinkRecord>(),
  };

  await saveMeetingSession(record);

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_create',
    outcome: 'success',
    actorUserId: providerUserId,
    targetUserId: providerUserId,
    statusCode: 201,
    metadata: {
      sessionId: record.id,
      routeKey: record.routeKey,
      mode: record.mode,
      maxViewers: record.maxViewers,
      scheduledAtMs: record.scheduledAtMs,
      publicStream: record.publicStream,
    },
  });

  res.status(201).json({ success: true, session: sessionToResponse(record, req) });
});

providerRouter.post('/sessions/:sessionId/start', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const resolved = await findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, providerUserId, session } = resolved;

  if (session.status === 'ended') {
    res.status(409).json({ error: 'Meeting session already ended' });
    return;
  }

  session.status = 'live';
  if (!session.startedAtMs) {
    session.startedAtMs = Date.now();
  }
  session.updatedAtMs = Date.now();

  const providerParticipantId = `provider:${providerDid}`;
  if (!session.participants.has(providerParticipantId)) {
    session.participants.set(providerParticipantId, {
      id: providerParticipantId,
      kind: 'provider',
      displayName: 'Provider Host',
      email: null,
      joinedAtMs: Date.now(),
    });
  }
  await saveMeetingSession(session);

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_start',
    outcome: 'success',
    actorUserId: providerUserId,
    targetUserId: providerUserId,
    statusCode: 200,
    metadata: { sessionId: session.id },
  });

  res.json({ success: true, session: sessionToResponse(session) });
});

providerRouter.post('/sessions/:sessionId/end', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const resolved = await findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerUserId, session } = resolved;

  session.status = 'ended';
  session.endedAtMs = Date.now();
  session.updatedAtMs = session.endedAtMs;
  session.vodPath = session.vodPath || `/vod/conscious-meetings/${session.id}.mp4`;
  session.participants.clear();
  session.invitedMembers.clear();
  session.externalLinks.clear();

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_end',
    outcome: 'success',
    actorUserId: providerUserId,
    targetUserId: providerUserId,
    statusCode: 200,
    metadata: { sessionId: session.id },
  });

  await saveMeetingSession(session);
  res.json({ success: true, sessionId: session.id, status: 'ended' });
});

providerRouter.post('/sessions/:sessionId/invite-users', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const resolved = await findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, providerUserId, session } = resolved;

  const directUsernames: string[] = Array.isArray(req.body?.usernames)
    ? req.body.usernames.slice(0, MAX_BATCH_USERNAMES).map((entry: unknown) => normalizeUsername(entry))
    : [];
  const groupIds: string[] = Array.isArray(req.body?.groupIds)
    ? req.body.groupIds.slice(0, MAX_BATCH_GROUPS).map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
    : [];

  const groupUsernamePairs: Array<{ username: string; groupId: string }> = [];
  if (groupIds.length > 0) {
    const providerGroups = await localStore.listProviderInviteGroupsByDid(providerDid, 200);
    const selectedGroups = providerGroups.filter((group) => groupIds.includes(group.id));
    for (const group of selectedGroups) {
      for (const member of group.members) {
        const normalized = normalizeUsername(member.username);
        if (!normalized) continue;
        groupUsernamePairs.push({ username: normalized, groupId: group.id });
      }
    }
  }

  const directSet = new Set(directUsernames.filter(Boolean));
  const allUsernames = new Set<string>([...directSet, ...groupUsernamePairs.map((entry) => entry.username)]);
  if (allUsernames.size === 0) {
    res.status(400).json({ error: 'At least one username or groupId is required' });
    return;
  }

  const added: MeetingInviteRecord[] = [];
  for (const username of allUsernames) {
    const resolvedMember = await resolveDirectoryUserByUsername(username);
    if (!resolvedMember.username) continue;
    const key = resolvedMember.userId || `username:${resolvedMember.username}`;
    if (session.invitedMembers.has(key)) continue;

    const sourceGroup = groupUsernamePairs.find((entry) => entry.username === resolvedMember.username);
    const invite: MeetingInviteRecord = {
      key,
      userId: resolvedMember.userId,
      username: resolvedMember.username,
      displayName: resolvedMember.displayName,
      invitedAtMs: Date.now(),
      source: sourceGroup ? 'group' : 'direct',
      groupId: sourceGroup?.groupId || null,
    };
    session.invitedMembers.set(invite.key, invite);
    added.push(invite);
  }

  session.updatedAtMs = Date.now();
  await saveMeetingSession(session);

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_invite_users',
    outcome: 'success',
    actorUserId: providerUserId,
    targetUserId: providerUserId,
    statusCode: 200,
    metadata: {
      sessionId: session.id,
      invitedCount: added.length,
      directUsernames: directSet.size,
      groupIdsCount: groupIds.length,
    },
  });

  res.json({
    success: true,
    invitedCount: added.length,
    invitedMembers: added,
    session: sessionToResponse(session),
  });
});

providerRouter.post('/sessions/:sessionId/external-links', requireProviderScope('provider:host'), async (req: Request, res: Response): Promise<void> => {
  const resolved = await findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerUserId, session } = resolved;

  const ttlMinutes = normalizePositiveInteger(
    req.body?.expiresInMinutes,
    DEFAULT_LINK_TTL_MINUTES,
    5,
    MAX_LINK_TTL_MINUTES
  );
  const maxUses = normalizePositiveInteger(
    req.body?.maxUses,
    DEFAULT_LINK_MAX_USES,
    1,
    MAX_LINK_MAX_USES
  );

  const linkId = `mlink_${crypto.randomUUID()}`;
  const nowMs = Date.now();
  const expiresAtMs = nowMs + ttlMinutes * 60 * 1000;
  const record: ExternalLinkRecord = {
    id: linkId,
    createdAtMs: nowMs,
    expiresAtMs,
    maxUses,
    uses: 0,
    revoked: false,
  };
  session.externalLinks.set(linkId, record);
  session.updatedAtMs = nowMs;
  await saveMeetingSession(session);

  const inviteToken = createExternalInviteToken({
    sessionId: session.id,
    linkId,
    providerDid: session.providerDid,
    ttlMinutes,
  });
  const joinUrl = `${getPublicBaseUrl(req)}/?externalMeetingInvite=${encodeURIComponent(inviteToken)}`;

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_external_link_create',
    outcome: 'success',
    actorUserId: providerUserId,
    targetUserId: providerUserId,
    statusCode: 201,
    metadata: {
      sessionId: session.id,
      linkId,
      expiresAtMs,
      maxUses,
    },
  });

  res.status(201).json({
    success: true,
    link: {
      id: linkId,
      inviteToken,
      joinUrl,
      expiresAtMs,
      maxUses,
      uses: 0,
    },
  });
});

providerRouter.get('/sessions/:sessionId', requireProviderScope('provider:read'), async (req: Request, res: Response): Promise<void> => {
  const resolved = await findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const providerReq = req as ProviderAuthenticatedRequest;
  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_meeting_session_read',
    outcome: 'success',
    actorUserId: providerReq.providerUserId || resolved.providerDid,
    targetUserId: providerReq.providerUserId || resolved.providerDid,
    statusCode: 200,
    metadata: {
      providerSessionId: providerReq.providerSessionId || null,
      sessionId: resolved.session.id,
      status: resolved.session.status,
    },
  });
  res.json({ success: true, session: sessionToResponse(resolved.session) });
});

userRouter.get('/sessions/joinable', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  const sessions = (await listActiveMeetingSessions())
    .filter((session) => session.status !== 'ended')
    .filter((session) => canUserAccessSession(session, viewer))
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map((session) => sessionToResponse(session, req));

  res.json({ success: true, sessions });
});

userRouter.get('/sessions/upcoming', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  const sessions = (await listActiveMeetingSessions())
    .filter((session) => session.status !== 'ended')
    .filter((session) => canUserAccessSession(session, viewer))
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs)
    .map((session) => sessionToResponse(session, req));

  res.json({ success: true, sessions });
});

userRouter.get('/sessions/archive', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  const sessions = (await listArchivedMeetingSessions())
    .filter((session) => canUserAccessSession(session, viewer))
    .sort((a, b) => (b.endedAtMs || b.updatedAtMs) - (a.endedAtMs || a.updatedAtMs))
    .map((session) => sessionToResponse(session, req));

  res.json({ success: true, sessions });
});

userRouter.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  const sessionId = String(req.params.sessionId || '').trim();
  const session = await getMeetingSessionByEndpoint(sessionId);
  if (!session || !canUserAccessSession(session, viewer)) {
    res.status(404).json({ error: 'Meeting session not found' });
    return;
  }

  res.json({ success: true, session: sessionToResponse(session, req) });
});

userRouter.post('/sessions/:sessionId/join', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const sessionId = String(req.params.sessionId || '').trim();
  const session = await getMeetingSessionByEndpoint(sessionId);
  if (!session || session.status === 'ended') {
    res.status(404).json({ error: 'Meeting session not found' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  if (!canUserAccessSession(session, viewer)) {
    res.status(403).json({ error: 'You are not invited to this meeting session' });
    return;
  }

  if (!ensureSessionCapacity(session)) {
    res.status(409).json({ error: 'Meeting viewer capacity reached' });
    return;
  }

  const participantId = `user:${authUserId}`;
  if (!session.participants.has(participantId)) {
    session.participants.set(participantId, {
      id: participantId,
      kind: 'user',
      displayName: String(req.body?.displayName || viewer.name || viewer.handle || 'Participant').trim().slice(0, 80) || 'Participant',
      email: null,
      joinedAtMs: Date.now(),
    });
  }
  session.updatedAtMs = Date.now();
  await saveMeetingSession(session);

  res.json({ success: true, session: sessionToResponse(session, req), participantId });
});

userRouter.post('/sessions/:sessionId/leave', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const sessionId = String(req.params.sessionId || '').trim();
  const session = await getMeetingSessionByEndpoint(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found' });
    return;
  }

  session.participants.delete(`user:${authUserId}`);
  session.updatedAtMs = Date.now();
  if (session.participants.size === 0) {
    await maybeFinalizeSession(session);
  } else {
    await saveMeetingSession(session);
  }

  res.json({ success: true, sessionId, leftParticipantId: `user:${authUserId}` });
});

guestRouter.post('/preview', async (req: Request, res: Response): Promise<void> => {
  const inviteToken = String(req.body?.inviteToken || '').trim();
  if (!inviteToken) {
    res.status(400).json({ error: 'inviteToken is required' });
    return;
  }

  const payload = verifyExternalInviteToken(inviteToken);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired invite link' });
    return;
  }

  const session = await getMeetingSession(payload.sessionId);
  if (!session || session.status === 'ended') {
    res.status(404).json({ error: 'Meeting session unavailable' });
    return;
  }

  const link = session.externalLinks.get(payload.linkId);
  if (!link || link.revoked || link.expiresAtMs <= Date.now()) {
    res.status(410).json({ error: 'Invite link expired or revoked' });
    return;
  }

  res.json({
    success: true,
    session: {
      id: session.id,
      title: session.title,
      mode: session.mode,
      status: session.status,
      maxViewers: session.maxViewers,
      participantCount: session.participants.size,
      remainingCapacity: Math.max(session.maxViewers - session.participants.size, 0),
    },
    link: {
      id: link.id,
      expiresAtMs: link.expiresAtMs,
      uses: link.uses,
      maxUses: link.maxUses,
    },
  });
});

guestRouter.post('/join', async (req: Request, res: Response): Promise<void> => {
  const inviteToken = String(req.body?.inviteToken || '').trim();
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 180);
  if (!inviteToken || !name || !email) {
    res.status(400).json({ error: 'inviteToken, name, and email are required' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  const payload = verifyExternalInviteToken(inviteToken);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired invite link' });
    return;
  }

  const session = await getMeetingSession(payload.sessionId);
  if (!session || session.status === 'ended') {
    res.status(404).json({ error: 'Meeting session unavailable' });
    return;
  }

  const link = session.externalLinks.get(payload.linkId);
  if (!link || link.revoked || link.expiresAtMs <= Date.now()) {
    res.status(410).json({ error: 'Invite link expired or revoked' });
    return;
  }

  if (link.uses >= link.maxUses) {
    res.status(409).json({ error: 'Invite link usage limit reached' });
    return;
  }

  if (!ensureSessionCapacity(session)) {
    res.status(409).json({ error: 'Meeting viewer capacity reached' });
    return;
  }

  const participantId = `guest:${crypto.randomUUID()}`;
  session.participants.set(participantId, {
    id: participantId,
    kind: 'guest',
    displayName: name,
    email,
    joinedAtMs: Date.now(),
  });
  session.updatedAtMs = Date.now();
  link.uses += 1;
  await saveMeetingSession(session);

  const guestSessionToken = createGuestSessionToken({
    sessionId: session.id,
    participantId,
    name,
    email,
    ttlMinutes: 12 * 60,
  });

  res.json({
    success: true,
    guest: {
      participantId,
      name,
      email,
    },
    guestSessionToken,
    session: sessionToResponse(session),
  });
});

guestRouter.post('/leave', async (req: Request, res: Response): Promise<void> => {
  const guestSessionToken = String(req.body?.guestSessionToken || '').trim();
  if (!guestSessionToken) {
    res.status(400).json({ error: 'guestSessionToken is required' });
    return;
  }

  const payload = verifyGuestSessionToken(guestSessionToken);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired guest session' });
    return;
  }

  const session = await getMeetingSession(payload.sessionId);
  if (!session) {
    res.json({ success: true, sessionId: payload.sessionId, participantId: payload.participantId });
    return;
  }

  session.participants.delete(payload.participantId);
  session.updatedAtMs = Date.now();
  if (session.participants.size === 0) {
    await maybeFinalizeSession(session);
  } else {
    await saveMeetingSession(session);
  }

  res.json({
    success: true,
    sessionId: payload.sessionId,
    participantId: payload.participantId,
  });
});

router.use('/provider', providerRouter);
router.use('/user', userRouter);
router.use('/guest', guestRouter);

export default router;
