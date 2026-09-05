import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';

const users = new Map<string, any>();
const applicants = new Map<string, any>();
const notifications = new Map<string, any[]>();

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return users.get(id) || null;
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/userSessionStore', () => ({
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

jest.mock('../services/providerApplicantStore', () => ({
  createProviderApplicant: jest.fn(),
  getProviderApplicantByUserId: jest.fn(async (userId: string) => applicants.get(userId) || null),
  updateProviderApplicantReview: jest.fn(async (id: string, updates: any) => {
    for (const [userId, applicant] of applicants.entries()) {
      if (applicant.id === id) {
        const updated = { ...applicant, ...updates };
        applicants.set(userId, updated);
        return updated;
      }
    }
    return null;
  }),
}));

jest.mock('../services/notificationStore', () => ({
  createNotification: jest.fn(async () => null),
  listNotificationsForUser: jest.fn(async ({ userId, role }: { userId: string; role: string }) =>
    (notifications.get(userId) || []).filter((notification) => {
      const scope = String(notification.roleScope || '').trim();
      if (!scope) return true;
      return scope.split(',').map((entry) => entry.trim()).includes(role);
    })
  ),
}));

const mockReplies: any[] = [];
jest.mock('../services/adminMessageStore', () => ({
  listAdminMessages: jest.fn(async (filters: any) => mockReplies.filter((reply) =>
    reply.submitterUserId === filters.submitterUserId && reply.metadata.applicantId === filters.applicantId)),
  createAdminMessage: jest.fn(async (input: any) => {
    const reply = { ...input, id: `reply-${mockReplies.length}`, createdAt: new Date().toISOString() };
    mockReplies.push(reply);
    return reply;
  }),
}));

const { providerApplicantProtectedRoutes } = require('../routes/providerApplicants');

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

const createUser = (id: string, role: 'user' | 'applicant' | 'provider' | 'admin', overrides = {}) => ({
  id,
  email: `${id}@example.com`,
  role,
  tier: '',
  providerApproved: role === 'provider',
  providerApprovalStatus: role === 'provider' ? 'approved' : null,
  providerRevokedAt: null,
  ...overrides,
});

describe('provider applicant lifecycle status access', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'provider-applicant-lifecycle-test-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/provider-applicants', providerApplicantProtectedRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve provider applicant lifecycle test server address');
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
    applicants.clear();
    notifications.clear();
    mockReplies.length = 0;
  });

  it('lets a formerly approved provider view their rejected applicant status without CRM access', async () => {
    users.set(
      'provider-1',
      createUser('provider-1', 'provider', {
        providerApproved: false,
        providerApprovalStatus: 'rejected',
        providerRevokedAt: new Date(),
      })
    );
    applicants.set('provider-1', {
      id: 'applicant-1',
      userId: 'provider-1',
      email: 'provider-1@example.com',
      firstName: 'Provider',
      lastName: 'One',
      providerCategory: 'Healing Arts',
      status: 'rejected',
    });
    notifications.set('provider-1', [
      {
        id: 'notification-1',
        type: 'provider_application_status',
        title: 'Provider application status updated',
        body: 'This application was not approved for the current provider cohort.',
        roleScope: 'provider',
        metadata: { nextStatus: 'rejected' },
      },
    ]);

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider-applicants/current',
      token: tokenFor('provider-1'),
    });

    expect(response.status).toBe(200);
    expect(response.body?.applicant?.status).toBe('rejected');
    expect(response.body?.notifications?.[0]?.metadata?.nextStatus).toBe('rejected');
  });

  it('lets a member with a provider application view their application status', async () => {
    users.set(
      'member-applicant',
      createUser('member-applicant', 'user', {
        providerApproved: false,
        providerApprovalStatus: 'submitted',
      })
    );
    applicants.set('member-applicant', {
      id: 'applicant-member',
      userId: 'member-applicant',
      email: 'member-applicant@example.com',
      firstName: 'Member',
      lastName: 'Applicant',
      providerCategory: 'Mental Wellness',
      status: 'submitted',
    });
    notifications.set('member-applicant', [
      {
        id: 'notification-2',
        type: 'provider_application_submitted',
        title: 'Provider application submitted',
        body: 'Your provider application was received.',
        roleScope: 'user',
        metadata: { status: 'submitted' },
      },
    ]);

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider-applicants/current',
      token: tokenFor('member-applicant'),
    });

    expect(response.status).toBe(200);
    expect(response.body?.applicant?.status).toBe('submitted');
    expect(response.body?.notifications?.[0]?.metadata?.status).toBe('submitted');
  });

  it('blocks ordinary member accounts from provider application status data', async () => {
    users.set('member-1', createUser('member-1', 'user'));

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider-applicants/current',
      token: tokenFor('member-1'),
    });

    expect(response.status).toBe(403);
    expect(response.body?.error).toBe('Provider application status access only.');
  });
  it('keeps private review and account fields out of the applicant portal', async () => {
    users.set('applicant-1', createUser('applicant-1', 'applicant'));
    applicants.set('applicant-1', { id: 'application-1', status: 'needs_more_info', adminNotes: 'private review', user: { password: 'private hash' }, consentAudit: { ip: 'private' } });
    const result = await requestJson({ method: 'GET', path: '/api/provider-applicants/current', token: tokenFor('applicant-1') });
    expect(result.status).toBe(200);
    expect(result.body.applicant).toEqual({ id: 'application-1', status: 'needs_more_info' });
  });

  it('persists own follow-ups without changing status and excludes other applicants replies', async () => {
    users.set('applicant-1', createUser('applicant-1', 'applicant'));
    applicants.set('applicant-1', { id: 'application-1', status: 'needs_more_info', firstName: 'A', lastName: 'One', email: 'one@example.com' });
    mockReplies.push({ id: 'other-reply', message: 'private response', createdAt: new Date().toISOString(), submitterUserId: 'other-user', metadata: { applicantId: 'other-app' } });
    const sent = await requestJson({ method: 'POST', path: '/api/provider-applicants/current/follow-up', token: tokenFor('applicant-1'), body: { message: 'Here is my clarification.' } });
    expect(sent.status).toBe(201);
    expect(applicants.get('applicant-1').status).toBe('needs_more_info');
    const current = await requestJson({ method: 'GET', path: '/api/provider-applicants/current', token: tokenFor('applicant-1') });
    expect(current.body.replies).toHaveLength(1);
    expect(current.body.replies[0].message).toBe('Here is my clarification.');
  });

  it.each([{ message: '' }, { message: 'x'.repeat(4001) }, { message: 'hello', userId: 'someone-else' }, { message: 'hello', status: 'approved' }])('rejects invalid or authority-bearing follow-up payloads', async (body) => {
    users.set('applicant-1', createUser('applicant-1', 'applicant'));
    const result = await requestJson({ method: 'POST', path: '/api/provider-applicants/current/follow-up', token: tokenFor('applicant-1'), body });
    expect(result.status).toBe(400);
    expect(mockReplies).toHaveLength(0);
  });

  it('does not let an administrator submit an applicant response', async () => {
    users.set('admin-1', createUser('admin-1', 'admin'));
    const result = await requestJson({ method: 'POST', path: '/api/provider-applicants/current/follow-up', token: tokenFor('admin-1'), body: { message: 'hello' } });
    expect(result.status).toBe(403);
    expect(mockReplies).toHaveLength(0);
  });

  it('does not accept follow-ups for a closed application', async () => {
    users.set('applicant-1', createUser('applicant-1', 'applicant'));
    applicants.set('applicant-1', { id: 'application-1', status: 'approved' });
    const result = await requestJson({ method: 'POST', path: '/api/provider-applicants/current/follow-up', token: tokenFor('applicant-1'), body: { message: 'hello' } });
    expect(result.status).toBe(409);
  });

});
