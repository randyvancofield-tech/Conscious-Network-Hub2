import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { createSessionToken } from '../auth';
import { createProviderSessionToken } from '../auth/providerToken';

type MeetingRow = {
  id: string;
  providerId: string;
  title: string;
  participants: any[];
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

const users = new Map<string, any>();
const providerSessions = new Map<string, any>();
const meetingRows = new Map<string, MeetingRow>();

const cloneRow = (row: MeetingRow): MeetingRow => ({
  ...row,
  participants: row.participants.map((participant) => ({ ...participant })),
  metadata: JSON.parse(JSON.stringify(row.metadata || {})),
  scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
  startedAt: row.startedAt ? new Date(row.startedAt) : null,
  endedAt: row.endedAt ? new Date(row.endedAt) : null,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return users.get(id) || null;
  },
  async listUsers(): Promise<any[]> {
    return Array.from(users.values());
  },
  async listProviderInviteGroupsByDid(): Promise<any[]> {
    return [];
  },
};

const mockMeetingSessionModel = {
  async findUnique({ where }: { where: { id: string } }): Promise<MeetingRow | null> {
    const row = meetingRows.get(where.id);
    return row ? cloneRow(row) : null;
  },
  async findMany(args: any = {}): Promise<MeetingRow[]> {
    let rows = Array.from(meetingRows.values()).map(cloneRow);
    if (args.where?.providerId) {
      rows = rows.filter((row) => row.providerId === args.where.providerId);
    }
    if (args.where?.status === 'ended') {
      rows = rows.filter((row) => row.status === 'ended');
    }
    if (args.where?.status?.not) {
      rows = rows.filter((row) => row.status !== args.where.status.not);
    }
    return rows;
  },
  async upsert(args: any): Promise<MeetingRow> {
    const existing = meetingRows.get(args.where.id);
    const source = existing ? { ...existing, ...args.update } : args.create;
    const row: MeetingRow = {
      id: source.id || args.where.id,
      providerId: source.providerId,
      title: source.title,
      participants: Array.isArray(source.participants) ? source.participants : [],
      status: source.status,
      scheduledAt: source.scheduledAt ? new Date(source.scheduledAt) : null,
      startedAt: source.startedAt ? new Date(source.startedAt) : null,
      endedAt: source.endedAt ? new Date(source.endedAt) : null,
      metadata: JSON.parse(JSON.stringify(source.metadata || {})),
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    meetingRows.set(row.id, row);
    return cloneRow(row);
  },
};

const mockPrismaDb = {
  meetingSession: mockMeetingSessionModel,
};

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => mockPrismaDb,
}));

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/providerSessionStore', () => ({
  getProviderSessionById: jest.fn(async (sessionId: string) => providerSessions.get(sessionId) || null),
  revokeProviderSession: jest.fn(async () => undefined),
}));

jest.mock('../services/userSessionStore', () => ({
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

const meetingRoutes = require('../routes/meeting').default;

let server: http.Server | null = null;
let baseUrl = '';

const tokenFor = (userId: string): string => createSessionToken(userId).token;

const providerTokenFor = (providerUserId: string): string => {
  const sessionId = `provider-session-${providerUserId}`;
  const did = `provider:${providerUserId}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  providerSessions.set(sessionId, {
    id: sessionId,
    did,
    scopes: ['provider:*'],
    issuedAt: new Date(),
    expiresAt,
    createdAt: new Date(),
    revokedAt: null,
  });
  return createProviderSessionToken(sessionId, did, ['provider:*']).token;
};

const requestJson = async (options: {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

const createUser = (id: string, overrides: Record<string, any> = {}): any => ({
  id,
  email: `${id}@example.com`,
  name: id,
  handle: id,
  role: 'user',
  tier: 'Free / Community Tier',
  lockoutUntil: null,
  ...overrides,
});

const createMeetingRow = (input: {
  id: string;
  status: 'scheduled' | 'live' | 'ended' | 'archived';
  providerUserId?: string;
  publicStream?: boolean;
  participants?: any[];
  signals?: any[];
  invitedMembers?: any[];
  externalLinks?: any[];
  vodPath?: string | null;
  extraMetadata?: Record<string, any>;
}): MeetingRow => {
  const now = new Date();
  const providerUserId = input.providerUserId || 'provider-1';
  const row: MeetingRow = {
    id: input.id,
    providerId: `provider:${providerUserId}`,
    title: `Meeting ${input.id}`,
    participants: input.participants || [],
    status: input.status,
    scheduledAt: now,
    startedAt: input.status === 'live' || input.status === 'ended' ? now : null,
    endedAt: input.status === 'ended' ? now : null,
    metadata: {
      providerDid: `provider:${providerUserId}`,
      providerUserId,
      providerDisplayName: 'Verified Provider',
      description: 'Lifecycle test session',
      focusArea: 'Testing',
      mode: 'virtual',
      maxViewers: 20,
      scheduledAtMs: now.getTime(),
      createdAtMs: now.getTime(),
      updatedAtMs: now.getTime(),
      publicStream: input.publicStream ?? true,
      nativeRoomEnabled: true,
      immersiveEnabled: false,
      localRecordingAllowed: false,
      routeKey: `${input.id}-route`,
      vodPath: input.vodPath ?? '/archive/replay.webm',
      invitedMembers: input.invitedMembers || [],
      externalLinks: input.externalLinks || [],
      signals: input.signals || [],
      ...(input.extraMetadata || {}),
    },
    createdAt: now,
    updatedAt: now,
  };
  meetingRows.set(row.id, row);
  return row;
};

const createExternalInviteToken = (input: {
  sessionId: string;
  linkId: string;
  providerDid?: string;
}): string =>
  jwt.sign(
    {
      tokenType: 'meeting_external_invite',
      sessionId: input.sessionId,
      linkId: input.linkId,
      providerDid: input.providerDid || 'provider:provider-1',
    },
    process.env.AUTH_TOKEN_SECRET || 'meeting-lifecycle-test-secret',
    {
      algorithm: 'HS256',
      issuer: 'hcn-meeting',
      audience: 'hcn-meeting-external-invite',
      expiresIn: 60 * 60,
    }
  );

describe('meeting lifecycle hardening', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'meeting-lifecycle-test-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve meeting lifecycle test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  beforeEach(() => {
    users.clear();
    providerSessions.clear();
    meetingRows.clear();
    users.set('member-1', createUser('member-1'));
    users.set(
      'provider-1',
      createUser('provider-1', {
        role: 'provider',
        providerApproved: true,
        providerApprovalStatus: 'approved',
        providerRevokedAt: null,
      })
    );
  });

  it('rejects authenticated user joins for scheduled, archived, and ended sessions without mutating participants', async () => {
    createMeetingRow({ id: 'scheduled-session', status: 'scheduled' });
    createMeetingRow({
      id: 'archived-session',
      status: 'archived',
      participants: [{ id: 'provider:provider-1', kind: 'provider', displayName: 'Provider', email: null, joinedAtMs: 1 }],
    });
    createMeetingRow({
      id: 'ended-session',
      status: 'ended',
      participants: [{ id: 'provider:provider-1', kind: 'provider', displayName: 'Provider', email: null, joinedAtMs: 1 }],
    });

    const scheduledResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/user/sessions/scheduled-session/join',
      token: tokenFor('member-1'),
      body: { displayName: 'Member One' },
    });
    const archivedResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/user/sessions/archived-session/join',
      token: tokenFor('member-1'),
      body: { displayName: 'Member One' },
    });
    const endedResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/user/sessions/ended-session/join',
      token: tokenFor('member-1'),
      body: { displayName: 'Member One' },
    });

    expect(scheduledResponse.status).toBe(409);
    expect(scheduledResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(archivedResponse.status).toBe(409);
    expect(archivedResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(endedResponse.status).toBe(409);
    expect(endedResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(meetingRows.get('scheduled-session')?.participants).toHaveLength(0);
    expect(meetingRows.get('archived-session')?.participants).toHaveLength(1);
    expect(meetingRows.get('ended-session')?.participants).toHaveLength(1);
  });

  it('allows authenticated users to join authorized live sessions', async () => {
    createMeetingRow({ id: 'live-session', status: 'live' });

    const response = await requestJson({
      method: 'POST',
      path: '/api/meeting/user/sessions/live-session/join',
      token: tokenFor('member-1'),
      body: { displayName: 'Member One' },
    });

    expect(response.status).toBe(200);
    expect(response.body?.participantId).toBe('user:member-1');
    expect(meetingRows.get('live-session')?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'user:member-1', kind: 'user', displayName: 'Member One' }),
      ])
    );
  });

  it('rejects signed guest joins for scheduled, archived, and ended sessions without mutating participants', async () => {
    const link = {
      id: 'mlink-test',
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      maxUses: 5,
      uses: 0,
      revoked: false,
    };
    createMeetingRow({ id: 'guest-scheduled', status: 'scheduled', externalLinks: [link] });
    createMeetingRow({
      id: 'guest-archived',
      status: 'archived',
      participants: [{ id: 'provider:provider-1', kind: 'provider', displayName: 'Provider', email: null, joinedAtMs: 1 }],
      externalLinks: [link],
    });
    createMeetingRow({
      id: 'guest-ended',
      status: 'ended',
      participants: [{ id: 'provider:provider-1', kind: 'provider', displayName: 'Provider', email: null, joinedAtMs: 1 }],
      externalLinks: [link],
    });

    const scheduledResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/guest/join',
      body: {
        inviteToken: createExternalInviteToken({ sessionId: 'guest-scheduled', linkId: 'mlink-test' }),
        name: 'Guest One',
        email: 'guest@example.com',
      },
    });
    const archivedResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/guest/join',
      body: {
        inviteToken: createExternalInviteToken({ sessionId: 'guest-archived', linkId: 'mlink-test' }),
        name: 'Guest One',
        email: 'guest@example.com',
      },
    });
    const endedResponse = await requestJson({
      method: 'POST',
      path: '/api/meeting/guest/join',
      body: {
        inviteToken: createExternalInviteToken({ sessionId: 'guest-ended', linkId: 'mlink-test' }),
        name: 'Guest One',
        email: 'guest@example.com',
      },
    });

    expect(scheduledResponse.status).toBe(409);
    expect(scheduledResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(archivedResponse.status).toBe(409);
    expect(archivedResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(endedResponse.status).toBe(409);
    expect(endedResponse.body?.code).toBe('MEETING_SESSION_NOT_LIVE');
    expect(meetingRows.get('guest-scheduled')?.participants).toHaveLength(0);
    expect(meetingRows.get('guest-scheduled')?.metadata.externalLinks[0].uses).toBe(0);
    expect(meetingRows.get('guest-archived')?.participants).toHaveLength(1);
    expect(meetingRows.get('guest-archived')?.metadata.externalLinks[0].uses).toBe(0);
    expect(meetingRows.get('guest-ended')?.participants).toHaveLength(1);
    expect(meetingRows.get('guest-ended')?.metadata.externalLinks[0].uses).toBe(0);
  });

  it('allows signed guests to join valid live sessions', async () => {
    const link = {
      id: 'mlink-live',
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      maxUses: 5,
      uses: 0,
      revoked: false,
    };
    createMeetingRow({ id: 'guest-live', status: 'live', externalLinks: [link] });

    const response = await requestJson({
      method: 'POST',
      path: '/api/meeting/guest/join',
      body: {
        inviteToken: createExternalInviteToken({ sessionId: 'guest-live', linkId: 'mlink-live' }),
        name: 'Guest One',
        email: 'guest@example.com',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body?.guest?.participantId).toEqual(expect.stringMatching(/^guest:/));
    expect(meetingRows.get('guest-live')?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'guest', displayName: 'Guest One', email: 'guest@example.com' }),
      ])
    );
    expect(meetingRows.get('guest-live')?.metadata.externalLinks[0].uses).toBe(1);
  });

  it('clears active signal metadata on provider end while preserving non-signal metadata', async () => {
    createMeetingRow({
      id: 'end-live',
      status: 'live',
      participants: [{ id: 'user:member-1', kind: 'user', displayName: 'Member One', email: null, joinedAtMs: 10 }],
      invitedMembers: [{ key: 'member-1', userId: 'member-1', username: 'member-1', displayName: 'Member One', invitedAtMs: 2, source: 'direct', groupId: null }],
      externalLinks: [{ id: 'mlink-preserve', createdAtMs: 3, expiresAtMs: Date.now() + 1000, maxUses: 5, uses: 1, revoked: false }],
      signals: [{ id: 'sig-1', fromParticipantId: 'user:member-1', toParticipantId: null, type: 'presence', payload: { ready: true }, createdAtMs: 4 }],
      vodPath: '/archive/preserved.webm',
      extraMetadata: { complianceBoundary: { consentRequired: true } },
    });

    const response = await requestJson({
      method: 'POST',
      path: '/api/meeting/provider/sessions/end-live/end',
      token: providerTokenFor('provider-1'),
    });
    const row = meetingRows.get('end-live');

    expect(response.status).toBe(200);
    expect(row?.status).toBe('ended');
    expect(row?.metadata.signals).toEqual([]);
    expect(row?.participants).toHaveLength(1);
    expect(row?.metadata.invitedMembers).toHaveLength(1);
    expect(row?.metadata.externalLinks).toHaveLength(1);
    expect(row?.metadata.vodPath).toBe('/archive/preserved.webm');
    expect(row?.metadata.complianceBoundary).toEqual({ consentRequired: true });
  });

  it('blocks ended-session signal reads and never returns historical signals', async () => {
    createMeetingRow({
      id: 'ended-signals',
      status: 'ended',
      signals: [{ id: 'sig-old', fromParticipantId: 'provider:provider-1', toParticipantId: null, type: 'presence', payload: { ready: true }, createdAtMs: 4 }],
    });

    const response = await requestJson({
      method: 'GET',
      path: '/api/meeting/user/sessions/ended-signals/signals',
      token: tokenFor('member-1'),
    });

    expect(response.status).toBe(410);
    expect(response.body?.code).toBe('MEETING_SESSION_ENDED');
    expect(response.body?.signals).toBeUndefined();
  });
});

export {};
