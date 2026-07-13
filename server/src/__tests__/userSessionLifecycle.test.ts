import express from 'express';
import http from 'http';
import { createSessionToken, hashPassword } from '../auth';
import { requireCanonicalIdentity } from '../middleware';
import { userProtectedRoutes, userPublicRoutes } from '../routes/user';
import { localStore } from '../services/persistenceStore';
import { createUserSession, getUserSessionById, revokeUserSession } from '../services/userSessionStore';

jest.mock('../services/persistenceStore', () => ({
  localStore: {
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    getMembershipByUserId: jest.fn(),
    findUserByPasswordFingerprint: jest.fn(),
    createUser: jest.fn(),
  },
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: jest.fn(),
  getUserSessionById: jest.fn(),
  revokeUserSession: jest.fn(),
  revokeUserSessionsByUserId: jest.fn(),
}));

jest.mock('../services/providerSessionStore', () => ({
  getProviderSessionById: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    send: jest.fn(async () => ({ ok: true, skipped: true })),
    configured: jest.fn(() => false),
  },
}));

describe('user session lifecycle', () => {
  const mockedLocalStore = localStore as jest.Mocked<typeof localStore>;
  const mockedCreateUserSession = createUserSession as jest.MockedFunction<typeof createUserSession>;
  const mockedGetUserSessionById = getUserSessionById as jest.MockedFunction<typeof getUserSessionById>;
  const mockedRevokeUserSession = revokeUserSession as jest.MockedFunction<typeof revokeUserSession>;

  let server: http.Server | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'session-lifecycle-test-secret';
    process.env.SENSITIVE_DATA_KEY = 'session-lifecycle-test-sensitive-key';
    process.env.PUBLIC_BASE_URL = '';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/user', userPublicRoutes);
    app.use('/api/user', userProtectedRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server address');
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
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocalStore.getUserByEmail.mockResolvedValue(null);
    mockedLocalStore.getUserById.mockResolvedValue(null);
    mockedLocalStore.updateUser.mockResolvedValue(null);
    mockedLocalStore.getMembershipByUserId.mockResolvedValue(null);
  });

  it('revokes the active user session on logout', async () => {
    const sessionId = 'session-logout';
    mockedGetUserSessionById.mockResolvedValue({
      id: sessionId,
      userId: 'user-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as never);
    mockedLocalStore.getUserById.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      tier: 'Free / Community Tier',
      lockoutUntil: null,
      walletAddress: null,
      privacySettings: {},
      profileMedia: null,
      providerApproved: false,
      providerApprovalStatus: null,
      providerRevokedAt: null,
      subscriptionStatus: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockedCreateUserSession.mockResolvedValue({
      id: sessionId,
      userId: 'user-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as never);
    mockedRevokeUserSession.mockResolvedValue(undefined as never);

    const token = createSessionToken('user-1', { sessionId }).token;

    const response = await fetch(`${baseUrl}/api/user/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(mockedRevokeUserSession).toHaveBeenCalledWith(sessionId);
    const body = (await response.json()) as { success?: boolean; sessionRevoked?: boolean };
    expect(body.success).toBe(true);
    expect(body.sessionRevoked).toBe(true);
  });
});
