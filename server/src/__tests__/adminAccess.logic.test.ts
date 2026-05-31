import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';

const users = new Map<string, any>();

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return users.get(id) || null;
  },
  async listUsers(): Promise<any[]> {
    return Array.from(users.values());
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/providerApplicantStore', () => ({
  PROVIDER_APPLICANT_STATUSES: ['submitted', 'under_review', 'approved', 'rejected', 'needs_more_info'],
  listProviderApplicants: jest.fn(async () => []),
  getProviderApplicantById: jest.fn(async () => null),
  updateProviderApplicantReview: jest.fn(async () => null),
}));

const adminRoutes = require('../routes/admin').default;

let server: http.Server | null = null;
let baseUrl = '';

const requestJson = async (options: {
  method: string;
  path: string;
  token?: string;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

describe('admin route role boundaries', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'admin-access-test-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve admin access test server address');
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
  });

  it('denies approved providers access to admin routes', async () => {
    users.set('provider-1', {
      id: 'provider-1',
      email: 'provider@example.com',
      role: 'provider',
      tier: 'Accelerated Tier',
      providerApproved: true,
      providerApprovalStatus: 'approved',
      providerRevokedAt: null,
      walletAddress: '0x0000000000000000000000000000000000000001',
    });

    const response = await requestJson({
      method: 'GET',
      path: '/api/admin/users',
      token: createSessionToken('provider-1').token,
    });

    expect(response.status).toBe(403);
    expect(response.body?.error).toBe('Forbidden: insufficient role');
  });

  it('denies non-founder admin-role accounts access to admin routes', async () => {
    users.set('other-admin', {
      id: 'other-admin',
      email: 'other-admin@example.com',
      role: 'admin',
      tier: 'Accelerated Tier',
      providerApproved: false,
      providerApprovalStatus: null,
      providerRevokedAt: null,
    });

    const response = await requestJson({
      method: 'GET',
      path: '/api/admin/users',
      token: createSessionToken('other-admin').token,
    });

    expect(response.status).toBe(403);
    expect(response.body?.error).toBe('Solo founder admin access required');
    expect(response.body?.requiredAdminEmail).toBe('higherconscious.network1@gmail.com');
  });
});
