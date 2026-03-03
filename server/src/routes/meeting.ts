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
  requireProviderSession,
} from '../providerMiddleware';
import { resolveAuthTokenSecret } from '../requiredEnv';

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
  title: string;
  mode: SessionMode;
  status: SessionStatus;
  maxViewers: number;
  createdAtMs: number;
  updatedAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
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

const meetingSessions = new Map<string, MeetingSessionRecord>();

const MAX_VIEWERS_HARD_CAP = 500;
const DEFAULT_MAX_VIEWERS = 120;
const DEFAULT_LINK_TTL_MINUTES = 120;
const MAX_LINK_TTL_MINUTES = 24 * 60;
const DEFAULT_LINK_MAX_USES = 500;
const MAX_LINK_MAX_USES = 1000;
const DIRECTORY_LOOKUP_LIMIT = 1000;
const MAX_BATCH_USERNAMES = 500;
const MAX_BATCH_GROUPS = 50;

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

const sessionToResponse = (session: MeetingSessionRecord) => ({
  id: session.id,
  title: session.title,
  mode: session.mode,
  status: session.status,
  providerDid: session.providerDid,
  maxViewers: session.maxViewers,
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
});

const findProviderSessionOrDeny = (
  req: Request,
  res: Response
): { providerDid: string; session: MeetingSessionRecord } | null => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const session = meetingSessions.get(sessionId);
  if (!providerDid || !session || session.providerDid !== providerDid) {
    res.status(404).json({ error: 'Meeting session not found' });
    return null;
  }
  return { providerDid, session };
};

const ensureSessionCapacity = (session: MeetingSessionRecord): boolean =>
  session.participants.size < session.maxViewers;

const maybeFinalizeSession = (session: MeetingSessionRecord): void => {
  if (session.participants.size > 0) return;
  session.status = 'ended';
  session.endedAtMs = Date.now();
  session.updatedAtMs = session.endedAtMs;
  meetingSessions.delete(session.id);
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

providerRouter.get('/sessions', (req: Request, res: Response): void => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  const sessions = Array.from(meetingSessions.values())
    .filter((session) => session.providerDid === providerDid)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map(sessionToResponse);
  res.json({ success: true, sessions });
});

providerRouter.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerDid) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  const title = normalizeSessionTitle(req.body?.title);
  const mode = normalizeSessionMode(req.body?.mode);
  const maxViewers = normalizePositiveInteger(
    req.body?.maxViewers,
    DEFAULT_MAX_VIEWERS,
    2,
    MAX_VIEWERS_HARD_CAP
  );

  const sessionId = `meet_${crypto.randomUUID()}`;
  const nowMs = Date.now();
  const record: MeetingSessionRecord = {
    id: sessionId,
    providerDid,
    title,
    mode,
    status: 'scheduled',
    maxViewers,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    startedAtMs: null,
    endedAtMs: null,
    participants: new Map<string, MeetingParticipant>(),
    invitedMembers: new Map<string, MeetingInviteRecord>(),
    externalLinks: new Map<string, ExternalLinkRecord>(),
  };

  meetingSessions.set(record.id, record);

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_create',
    outcome: 'success',
    actorUserId: providerDid,
    targetUserId: providerDid,
    statusCode: 201,
    metadata: { sessionId: record.id, mode: record.mode, maxViewers: record.maxViewers },
  });

  res.status(201).json({ success: true, session: sessionToResponse(record) });
});

providerRouter.post('/sessions/:sessionId/start', (req: Request, res: Response): void => {
  const resolved = findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, session } = resolved;

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

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_start',
    outcome: 'success',
    actorUserId: providerDid,
    targetUserId: providerDid,
    statusCode: 200,
    metadata: { sessionId: session.id },
  });

  res.json({ success: true, session: sessionToResponse(session) });
});

providerRouter.post('/sessions/:sessionId/end', (req: Request, res: Response): void => {
  const resolved = findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, session } = resolved;

  session.status = 'ended';
  session.endedAtMs = Date.now();
  session.updatedAtMs = session.endedAtMs;
  session.participants.clear();
  session.invitedMembers.clear();
  session.externalLinks.clear();

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_end',
    outcome: 'success',
    actorUserId: providerDid,
    targetUserId: providerDid,
    statusCode: 200,
    metadata: { sessionId: session.id },
  });

  meetingSessions.delete(session.id);
  res.json({ success: true, sessionId: session.id, status: 'ended' });
});

providerRouter.post('/sessions/:sessionId/invite-users', async (req: Request, res: Response): Promise<void> => {
  const resolved = findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, session } = resolved;

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

  recordAuditEvent(req, {
    domain: 'social',
    action: 'provider_session_invite_users',
    outcome: 'success',
    actorUserId: providerDid,
    targetUserId: providerDid,
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

providerRouter.post('/sessions/:sessionId/external-links', (req: Request, res: Response): void => {
  const resolved = findProviderSessionOrDeny(req, res);
  if (!resolved) return;
  const { providerDid, session } = resolved;

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
    actorUserId: providerDid,
    targetUserId: providerDid,
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

providerRouter.get('/sessions/:sessionId', (req: Request, res: Response): void => {
  const resolved = findProviderSessionOrDeny(req, res);
  if (!resolved) return;
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

  const sessions = Array.from(meetingSessions.values())
    .filter((session) => session.status !== 'ended')
    .filter((session) => isUserInvited(session, viewer))
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map(sessionToResponse);

  res.json({ success: true, sessions });
});

userRouter.post('/sessions/:sessionId/join', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const sessionId = String(req.params.sessionId || '').trim();
  const session = meetingSessions.get(sessionId);
  if (!session || session.status === 'ended') {
    res.status(404).json({ error: 'Meeting session not found' });
    return;
  }

  const viewer = await localStore.getUserById(authUserId);
  if (!viewer) {
    res.status(401).json({ error: 'Viewer session is invalid' });
    return;
  }

  if (!isUserInvited(session, viewer)) {
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

  res.json({ success: true, session: sessionToResponse(session), participantId });
});

userRouter.post('/sessions/:sessionId/leave', (req: Request, res: Response): void => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const sessionId = String(req.params.sessionId || '').trim();
  const session = meetingSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Meeting session not found' });
    return;
  }

  session.participants.delete(`user:${authUserId}`);
  session.updatedAtMs = Date.now();
  maybeFinalizeSession(session);

  res.json({ success: true, sessionId, leftParticipantId: `user:${authUserId}` });
});

guestRouter.post('/preview', (req: Request, res: Response): void => {
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

  const session = meetingSessions.get(payload.sessionId);
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

guestRouter.post('/join', (req: Request, res: Response): void => {
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

  const session = meetingSessions.get(payload.sessionId);
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

guestRouter.post('/leave', (req: Request, res: Response): void => {
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

  const session = meetingSessions.get(payload.sessionId);
  if (!session) {
    res.json({ success: true, sessionId: payload.sessionId, participantId: payload.participantId });
    return;
  }

  session.participants.delete(payload.participantId);
  session.updatedAtMs = Date.now();
  maybeFinalizeSession(session);

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
