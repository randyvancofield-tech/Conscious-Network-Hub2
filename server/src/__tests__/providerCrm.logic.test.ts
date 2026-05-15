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
    expect(toolIds).toEqual(expect.arrayContaining(['home', 'members', 'sessions', 'follow-ups']));
    expect(toolIds).not.toContain('notes');
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
