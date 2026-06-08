import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';

type MockRole = 'user' | 'applicant' | 'provider' | 'admin';

const users = new Map<string, any>();

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return users.get(id) || null;
  },
};

const mockPrismaDb = {
  user: {
    findMany: jest.fn(async () => [
      {
        id: 'provider-1',
        name: 'Provider One',
        role: 'provider',
        providerApproved: true,
        providerApprovalStatus: 'approved',
        providerRevokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    findUnique: jest.fn(async () => null),
  },
  anchorLinkRequest: {
    create: jest.fn(async () => ({})),
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/prismaClient', () => ({
  getPrisma: () => mockPrismaDb,
}));

const { providersRouter } = require('../routes/providers');

let server: http.Server | null = null;
let baseUrl = '';

const tokenFor = (userId: string): string => createSessionToken(userId).token;

const requestJson = async (options: {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

const createUser = (id: string, tier: string, role: MockRole = 'user') => ({
  id,
  email: `${id}@example.com`,
  role,
  tier,
  providerApproved: role === 'provider',
  providerApprovalStatus: role === 'provider' ? 'approved' : null,
  providerRevokedAt: null,
  walletAddress: null,
});

describe('provider marketplace public discovery and tier enforcement', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'provider-marketplace-tier-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/providers', providersRouter);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve provider marketplace test server address');
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
    jest.clearAllMocks();
  });

  it('allows public-safe provider discovery to guests', async () => {
    const response = await requestJson({
      method: 'GET',
      path: '/api/providers',
    });

    expect(response.status).toBe(200);
    expect(response.body?.providers).toHaveLength(1);
    expect(response.body?.providers?.[0]?.id).toBe('provider-1');
  });

  it('allows public-safe provider discovery to non-accelerated members', async () => {
    users.set('free-user', createUser('free-user', 'Free / Community Tier'));

    const response = await requestJson({
      method: 'GET',
      path: '/api/providers',
      token: tokenFor('free-user'),
    });

    expect(response.status).toBe(200);
    expect(response.body?.providers).toHaveLength(1);
  });

  it('allows provider marketplace to accelerated members', async () => {
    users.set('accelerated-user', createUser('accelerated-user', 'Accelerated Tier'));

    const response = await requestJson({
      method: 'GET',
      path: '/api/providers',
      token: tokenFor('accelerated-user'),
    });

    expect(response.status).toBe(200);
    expect(response.body?.providers).toHaveLength(1);
  });

  it('keeps provider request actions tier-gated for non-accelerated members', async () => {
    users.set('free-user', createUser('free-user', 'Free / Community Tier'));

    const response = await requestJson({
      method: 'POST',
      path: '/api/providers/provider-1/request',
      token: tokenFor('free-user'),
      body: { note: 'I would like to connect with this provider.' },
    });

    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('TIER_ACCESS_REQUIRED');
  });
});
