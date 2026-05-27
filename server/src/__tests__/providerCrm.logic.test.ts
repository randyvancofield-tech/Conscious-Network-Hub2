import express from 'express';
import http from 'http';
import { createProviderSessionToken } from '../auth/providerToken';

type MockRole = 'user' | 'applicant' | 'provider' | 'admin';

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  role: MockRole;
  providerApprovalStatus: string | null;
  providerApproved: boolean;
  providerRevokedAt: Date | null;
  providerAccessUpdatedAt: Date | null;
  tier: string;
  walletAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProviderSession {
  id: string;
  did: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const users = new Map<string, MockUser>();
const sessions = new Map<string, MockProviderSession>();

const cloneDate = (value: Date | null): Date | null => (value ? new Date(value.getTime()) : null);

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  providerRevokedAt: cloneDate(user.providerRevokedAt),
  providerAccessUpdatedAt: cloneDate(user.providerAccessUpdatedAt),
  createdAt: new Date(user.createdAt.getTime()),
  updatedAt: new Date(user.updatedAt.getTime()),
});

const cloneSession = (session: MockProviderSession): MockProviderSession => ({
  ...session,
  scopes: [...session.scopes],
  issuedAt: new Date(session.issuedAt.getTime()),
  expiresAt: new Date(session.expiresAt.getTime()),
  revokedAt: cloneDate(session.revokedAt),
  createdAt: new Date(session.createdAt.getTime()),
});

const createMockUser = (
  id: string,
  role: MockRole,
  overrides: Partial<MockUser> = {}
): MockUser => {
  const now = new Date();
  return {
    id,
    email: `${id}@example.com`,
    name: 'Provider CRM Test',
    role,
    providerApprovalStatus: role === 'provider' ? 'approved' : null,
    providerApproved: role === 'provider',
    providerRevokedAt: null,
    providerAccessUpdatedAt: role === 'provider' ? now : null,
    tier: 'Accelerated Tier',
    walletAddress: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const createMockProviderSession = (
  userId: string,
  scopes: string[] = ['provider:read', 'provider:host']
): { session: MockProviderSession; token: string } => {
  const now = new Date();
  const session: MockProviderSession = {
    id: `session-${userId}`,
    did: `provider:${userId}`,
    scopes,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    revokedAt: null,
    createdAt: now,
  };
  sessions.set(session.id, session);
  const token = createProviderSessionToken(session.id, session.did, session.scopes).token;
  return { session, token };
};

const mockLocalStore = {
  async getUserById(id: string): Promise<MockUser | null> {
    const user = users.get(id);
    return user ? cloneUser(user) : null;
  },

  async getUserByEmail(email: string): Promise<MockUser | null> {
    const normalized = String(email || '').trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async getProviderSessionById(id: string): Promise<MockProviderSession | null> {
    const session = sessions.get(id);
    return session ? cloneSession(session) : null;
  },

  async revokeProviderSession(id: string): Promise<void> {
    const session = sessions.get(id);
    if (!session) return;
    sessions.set(id, {
      ...session,
      revokedAt: new Date(),
    });
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

const mockCrmState = {
  notes: [] as any[],
  content: [] as any[],
  collaborations: [] as any[],
  followUps: [] as any[],
};
let mockCrmCounter = 0;

const mockNextCrmId = (prefix: string): string => `${prefix}-${++mockCrmCounter}`;
const mockIsVisibleToScope = (scope: any, item: any): boolean =>
  scope?.role === 'admin' || item.providerId === scope?.providerUserId || item.ownerId === scope?.providerUserId;
const mockResetCrmState = (): void => {
  mockCrmState.notes = [];
  mockCrmState.content = [];
  mockCrmState.collaborations = [];
  mockCrmState.followUps = [];
  mockCrmCounter = 0;
};

jest.mock('../services/providerCrmWorkspaceStore', () => ({
  buildProviderCrmWorkspace: jest.fn(async (scope: any, timezone = 'UTC') => ({
    scope: {
      ...scope,
      visibility: scope.role === 'admin' ? 'administrator-holistic' : 'provider-owned',
    },
    metrics: {
      treatment: {
        activeClientRecords: 0,
        dueFollowUps: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'open').length,
        upcomingRoundtables: 0,
      },
      businessGrowth: {
        organizationsTracked: 0,
        institutionContractOpportunities: 0,
        urgentOpportunities: 0,
      },
    },
    guidanceAlerts: [],
    records: [],
    roundtable: {
      label: 'Conscious Roundtable',
      roomCount: 12,
      dayStartHour: 8,
      hourCount: 12,
      timezone,
      reservations: [],
    },
    resources: [],
  })),
  createProviderCrmRecord: jest.fn(async (scope: any, input: any) => ({
    id: mockNextCrmId('record'),
    providerId: scope.providerUserId,
    clientUserId: null,
    clientDisplayName: input.clientDisplayName || null,
    organizationName: input.organizationName || null,
    kind: input.kind || 'client',
    title: input.title || 'Record',
    treatmentFocus: input.treatmentFocus || null,
    businessFocus: input.businessFocus || null,
    status: input.status || 'active',
    priority: input.priority || 'normal',
    nextActionAt: null,
    timezone: input.timezone || null,
    details: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  createRoundtableReservation: jest.fn(async (scope: any, input: any) => ({
    id: mockNextCrmId('roundtable'),
    providerId: scope.providerUserId,
    roomNumber: Number(input.roomNumber || 1),
    startAt: input.startAt || new Date().toISOString(),
    endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    timezone: input.timezone || 'UTC',
    title: input.title || 'Conscious Roundtable',
    meetingSessionId: mockNextCrmId('meeting'),
    roomUrl: '/conscious-meetings/session/test',
    status: 'scheduled',
    chatMode: 'native-room-signals',
    details: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  listProviderCrmNotes: jest.fn(async (scope: any) => mockCrmState.notes.filter((item) => mockIsVisibleToScope(scope, item))),
  createProviderCrmNote: jest.fn(async (scope: any, input: any) => {
    if (!input.title || !input.body) throw new Error(`VALIDATION:${!input.title ? 'title' : 'body'}`);
    const now = new Date().toISOString();
    const note = {
      id: mockNextCrmId('note'),
      providerId: scope.providerUserId,
      authorUserId: scope.providerUserId,
      title: input.title,
      body: input.body,
      category: input.category || 'general',
      status: input.status || 'active',
      relatedType: null,
      relatedId: null,
      createdAt: now,
      updatedAt: now,
    };
    mockCrmState.notes.push(note);
    return note;
  }),
  updateProviderCrmNote: jest.fn(async (scope: any, id: string, input: any) => {
    const note = mockCrmState.notes.find((item) => item.id === id && mockIsVisibleToScope(scope, item));
    if (!note) return null;
    Object.assign(note, input, { updatedAt: new Date().toISOString() });
    return note;
  }),
  deleteProviderCrmNote: jest.fn(async (scope: any, id: string) => {
    const index = mockCrmState.notes.findIndex((item) => item.id === id && mockIsVisibleToScope(scope, item));
    if (index < 0) return false;
    mockCrmState.notes.splice(index, 1);
    return true;
  }),
  listProviderCrmContentItems: jest.fn(async (scope: any) => mockCrmState.content.filter((item) => mockIsVisibleToScope(scope, item))),
  createProviderCrmContentItem: jest.fn(async (scope: any, input: any) => {
    if (!input.title || !input.description) throw new Error(`VALIDATION:${!input.title ? 'title' : 'description'}`);
    const now = new Date().toISOString();
    const item = {
      id: mockNextCrmId('content'),
      ownerId: scope.providerUserId,
      ownerType: scope.role,
      provider: scope.providerDisplayName,
      title: input.title,
      description: input.description,
      tier: input.tier || 'Professional',
      status: input.status || 'draft',
      image: null,
      enrolledCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockCrmState.content.push(item);
    return item;
  }),
  updateProviderCrmContentItem: jest.fn(async (scope: any, id: string, input: any) => {
    const item = mockCrmState.content.find((entry) => entry.id === id && mockIsVisibleToScope(scope, entry));
    if (!item) return null;
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    return item;
  }),
  listProviderCrmCollaborations: jest.fn(async (scope: any) => mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item))),
  createProviderCrmCollaboration: jest.fn(async (scope: any, input: any) => {
    if (!input.title || !input.description) throw new Error(`VALIDATION:${!input.title ? 'title' : 'description'}`);
    const now = new Date().toISOString();
    const item = {
      id: mockNextCrmId('collaboration'),
      providerId: scope.providerUserId,
      authorUserId: scope.providerUserId,
      title: input.title,
      description: input.description,
      status: input.status || 'open',
      relatedType: null,
      relatedId: null,
      createdAt: now,
      updatedAt: now,
    };
    mockCrmState.collaborations.push(item);
    return item;
  }),
  updateProviderCrmCollaboration: jest.fn(async (scope: any, id: string, input: any) => {
    const item = mockCrmState.collaborations.find((entry) => entry.id === id && mockIsVisibleToScope(scope, entry));
    if (!item) return null;
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    return item;
  }),
  deleteProviderCrmCollaboration: jest.fn(async (scope: any, id: string) => {
    const index = mockCrmState.collaborations.findIndex((item) => item.id === id && mockIsVisibleToScope(scope, item));
    if (index < 0) return false;
    mockCrmState.collaborations.splice(index, 1);
    return true;
  }),
  listProviderCrmFollowUps: jest.fn(async (scope: any) => mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item))),
  createProviderCrmFollowUp: jest.fn(async (scope: any, input: any) => {
    if (!input.title) throw new Error('VALIDATION:title');
    const now = new Date().toISOString();
    const item = {
      id: mockNextCrmId('follow-up'),
      providerId: scope.providerUserId,
      ownerUserId: scope.providerUserId,
      assignedToUserId: input.assignedToUserId || null,
      title: input.title,
      details: input.details || null,
      dueAt: input.dueAt || null,
      status: input.status || 'open',
      priority: input.priority || 'normal',
      relatedType: null,
      relatedId: null,
      createdAt: now,
      updatedAt: now,
    };
    mockCrmState.followUps.push(item);
    return item;
  }),
  updateProviderCrmFollowUp: jest.fn(async (scope: any, id: string, input: any) => {
    const item = mockCrmState.followUps.find((entry) => entry.id === id && mockIsVisibleToScope(scope, entry));
    if (!item) return null;
    Object.assign(item, input, { updatedAt: new Date().toISOString() });
    return item;
  }),
  deleteProviderCrmFollowUp: jest.fn(async (scope: any, id: string) => {
    const index = mockCrmState.followUps.findIndex((item) => item.id === id && mockIsVisibleToScope(scope, item));
    if (index < 0) return false;
    mockCrmState.followUps.splice(index, 1);
    return true;
  }),
  buildProviderCrmAnalytics: jest.fn(async (scope: any) => ({
    scope: { role: scope.role, visibility: scope.role === 'admin' ? 'administrator-aggregate' : 'provider-owned' },
    generatedAt: new Date().toISOString(),
    relationships: { total: 0, active: 0, byKind: {}, byStatus: {} },
    notes: {
      total: mockCrmState.notes.filter((item) => mockIsVisibleToScope(scope, item)).length,
      active: mockCrmState.notes.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'active').length,
      archived: mockCrmState.notes.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'archived').length,
    },
    collaboration: {
      total: mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item)).length,
      open: mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'open').length,
      inProgress: mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'in_progress').length,
      completed: mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'completed').length,
      archived: mockCrmState.collaborations.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'archived').length,
    },
    followUps: {
      total: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item)).length,
      open: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'open').length,
      inProgress: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'in_progress').length,
      completed: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'completed').length,
      canceled: mockCrmState.followUps.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'canceled').length,
      due: 0,
    },
    content: {
      total: mockCrmState.content.filter((item) => mockIsVisibleToScope(scope, item)).length,
      draft: mockCrmState.content.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'draft').length,
      published: mockCrmState.content.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'published').length,
      archived: mockCrmState.content.filter((item) => mockIsVisibleToScope(scope, item) && item.status === 'archived').length,
    },
    meetings: { total: 0, upcoming: 0 },
    admin:
      scope.role === 'admin'
        ? {
            providerApplicants: { total: 0, pending: 0, approved: 0, declined: 0 },
            approvedProviders: 0,
            membershipsByTier: {},
            aiInteractions: { total: 0 },
          }
        : undefined,
  })),
}));

const providerCrmRoutes = require('../routes/providerCrm').default;
const {
  clearProviderCrmRuntimeVisibilityForTests,
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
} = require('../services/providerCrm') as {
  clearProviderCrmRuntimeVisibilityForTests: () => void;
  PROVIDER_CRM_SOLE_ADMIN_EMAIL: string;
};

let server: http.Server | null = null;
let baseUrl = '';

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

describe('Provider CRM shell and admin foundation', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'provider-crm-test-secret';
    process.env.SENSITIVE_DATA_KEY = 'provider-crm-sensitive-key';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/provider/crm', providerCrmRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve provider CRM test server address');
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
    sessions.clear();
    delete process.env.PROVIDER_CRM_ENABLED_TOOLS;
    delete process.env.PROVIDER_CRM_DISABLED_TOOLS;
    clearProviderCrmRuntimeVisibilityForTests();
    mockResetCrmState();
  });

  it('recognizes the configured email as the sole Provider CRM admin', async () => {
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );
    const { token } = createMockProviderSession('sole-admin', ['provider:*']);

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/admin/foundation',
      token,
    });

    expect(response.status).toBe(200);
    expect(response.body?.soleAdminEmail).toBe(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
    expect(response.body?.soleAdminUserExists).toBe(true);
    expect(response.body?.soleAdminUserIsAdmin).toBe(true);
    expect(response.body?.seedPath?.storesCredentialsInCode).toBe(false);
    expect(response.body?.seedPath?.createsAdditionalAdmins).toBe(false);
  });

  it('denies Provider CRM admin controls to other admin users', async () => {
    users.set(
      'other-admin',
      createMockUser('other-admin', 'admin', {
        email: 'randyvancofield@gmail.com',
      })
    );
    const { token } = createMockProviderSession('other-admin', ['provider:*']);

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/admin/tools',
      token,
    });

    expect(response.status).toBe(403);
    expect(response.body?.requiredAdminEmail).toBe(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
  });

  it('allows the sole admin to access CRM admin tool visibility controls', async () => {
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );
    const { token } = createMockProviderSession('sole-admin', ['provider:*']);

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/admin/tools',
      token,
    });

    expect(response.status).toBe(200);
    expect(response.body?.visibilityControl?.source).toBe('server-registry-runtime-overrides');
    expect(response.body?.tools?.some((tool: any) => tool.id === 'admin-support')).toBe(true);
  });

  it('requires a native provider session before provider CRM access', async () => {
    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/tools',
    });

    expect(response.status).toBe(401);
    expect(response.body?.error).toBe('Provider authentication required');
  });

  it('allows approved providers to see only enabled provider CRM tools', async () => {
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    const { token } = createMockProviderSession('provider-1');

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/tools',
      token,
    });

    expect(response.status).toBe(200);
    const toolIds = response.body?.tools?.map((tool: any) => tool.id) || [];
    expect(toolIds).toEqual(
      expect.arrayContaining(['home', 'members', 'sessions', 'follow-ups', 'notes', 'content-courses', 'collaboration', 'analytics'])
    );
    expect(toolIds).not.toContain('admin-support');
  });

  it('applies sole admin visibility control to provider tool access', async () => {
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    const admin = createMockProviderSession('sole-admin', ['provider:*']);
    const provider = createMockProviderSession('provider-1');

    const update = await requestJson({
      method: 'PATCH',
      path: '/api/provider/crm/admin/tools/analytics',
      token: admin.token,
      body: { enabled: false },
    });
    const providerTools = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/tools',
      token: provider.token,
    });

    expect(update.status).toBe(200);
    expect(update.body?.tool?.enabled).toBe(false);
    const toolIds = providerTools.body?.tools?.map((tool: any) => tool.id) || [];
    expect(toolIds).not.toContain('analytics');
  });

  it('allows providers to create, list, update, and delete their private CRM notes', async () => {
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    const { token } = createMockProviderSession('provider-1');

    const created = await requestJson({
      method: 'POST',
      path: '/api/provider/crm/notes',
      token,
      body: { title: 'Intake note', body: 'Follow up on continuity plan.', category: 'care' },
    });
    const listed = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/notes',
      token,
    });
    const updated = await requestJson({
      method: 'PATCH',
      path: `/api/provider/crm/notes/${created.body?.note?.id}`,
      token,
      body: { status: 'archived' },
    });
    const deleted = await requestJson({
      method: 'DELETE',
      path: `/api/provider/crm/notes/${created.body?.note?.id}`,
      token,
    });

    expect(created.status).toBe(201);
    expect(created.body?.note?.providerId).toBe('provider-1');
    expect(listed.status).toBe(200);
    expect(listed.body?.notes).toHaveLength(1);
    expect(updated.status).toBe(200);
    expect(updated.body?.note?.status).toBe('archived');
    expect(deleted.status).toBe(200);
  });

  it('prevents providers from mutating another provider CRM note', async () => {
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    users.set('provider-2', createMockUser('provider-2', 'provider'));
    const first = createMockProviderSession('provider-1');
    const second = createMockProviderSession('provider-2');

    const created = await requestJson({
      method: 'POST',
      path: '/api/provider/crm/notes',
      token: first.token,
      body: { title: 'Scoped note', body: 'Only provider one can edit this.' },
    });
    const blocked = await requestJson({
      method: 'PATCH',
      path: `/api/provider/crm/notes/${created.body?.note?.id}`,
      token: second.token,
      body: { title: 'Cross tenant edit' },
    });

    expect(created.status).toBe(201);
    expect(blocked.status).toBe(404);
  });

  it('allows providers to manage scoped content drafts and publish state', async () => {
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    const { token } = createMockProviderSession('provider-1');

    const created = await requestJson({
      method: 'POST',
      path: '/api/provider/crm/content',
      token,
      body: { title: 'Provider practice module', description: 'Launch-safe provider content.', status: 'draft' },
    });
    const updated = await requestJson({
      method: 'PATCH',
      path: `/api/provider/crm/content/${created.body?.item?.id}`,
      token,
      body: { status: 'published', title: 'Provider practice module updated' },
    });
    const listed = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/content',
      token,
    });

    expect(created.status).toBe(201);
    expect(created.body?.item?.ownerId).toBe('provider-1');
    expect(created.body?.item?.status).toBe('draft');
    expect(updated.status).toBe(200);
    expect(updated.body?.item?.status).toBe('published');
    expect(listed.body?.items).toHaveLength(1);
  });

  it('allows providers to manage collaboration records and follow-ups', async () => {
    users.set('provider-1', createMockUser('provider-1', 'provider'));
    const { token } = createMockProviderSession('provider-1');

    const collaboration = await requestJson({
      method: 'POST',
      path: '/api/provider/crm/collaboration',
      token,
      body: { title: 'Care handoff', description: 'Coordinate next step with admin.', status: 'open' },
    });
    const followUp = await requestJson({
      method: 'POST',
      path: '/api/provider/crm/follow-ups',
      token,
      body: { title: 'Check in', details: 'Confirm next appointment.', status: 'open', priority: 'high' },
    });
    const followUpUpdate = await requestJson({
      method: 'PATCH',
      path: `/api/provider/crm/follow-ups/${followUp.body?.followUp?.id}`,
      token,
      body: { status: 'completed' },
    });

    expect(collaboration.status).toBe(201);
    expect(collaboration.body?.item?.providerId).toBe('provider-1');
    expect(followUp.status).toBe(201);
    expect(followUp.body?.followUp?.priority).toBe('high');
    expect(followUpUpdate.status).toBe(200);
    expect(followUpUpdate.body?.followUp?.status).toBe('completed');
  });

  it('returns aggregate analytics without leaking note or follow-up bodies', async () => {
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );
    const { token } = createMockProviderSession('sole-admin', ['provider:*']);
    await requestJson({
      method: 'POST',
      path: '/api/provider/crm/notes',
      token,
      body: { title: 'Sensitive note', body: 'Private clinical context should not appear in analytics.' },
    });

    const analytics = await requestJson({
      method: 'GET',
      path: '/api/provider/crm/analytics',
      token,
    });

    expect(analytics.status).toBe(200);
    expect(analytics.body?.analytics?.notes?.total).toBe(1);
    expect(JSON.stringify(analytics.body?.analytics)).not.toContain('Private clinical context');
    expect(analytics.body?.analytics?.admin?.providerApplicants).toBeDefined();
  });

  it.each(['user', 'applicant'] as MockRole[])(
    'blocks %s accounts from provider CRM even with a provider-shaped token',
    async (role) => {
      users.set(`${role}-1`, createMockUser(`${role}-1`, role));
      const { token } = createMockProviderSession(`${role}-1`);

      const response = await requestJson({
        method: 'GET',
        path: '/api/provider/crm/tools',
        token,
      });

      expect(response.status).toBe(401);
      expect(response.body?.error).toBe('Provider role required');
    }
  );
});
