import express from 'express';
import http from 'http';
import { hashPassword } from '../auth';
import { userPublicRoutes } from '../routes/user';
import { localStore } from '../services/persistenceStore';
import { createUserSession } from '../services/userSessionStore';

jest.mock('../services/persistenceStore', () => ({
  localStore: {
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    getMembershipByUserId: jest.fn(),
    createUser: jest.fn(),
    findUserByPasswordFingerprint: jest.fn(),
  },
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: jest.fn(),
  getUserSessionById: jest.fn(),
  revokeUserSession: jest.fn(),
  revokeUserSessionsByUserId: jest.fn(),
}));

jest.mock('../services/googleSheetsMirror', () => ({
  mirrorUserToGoogleSheets: jest.fn(async () => undefined),
}));

jest.mock('../services/recoveryCodeService', () => ({
  createRecoveryCodesForUser: jest.fn(async () => ['code-1', 'code-2']),
  getRecoveryCodeStatusForUser: jest.fn(async () => ({ hasUnusedCodes: true })),
  verifyAndConsumeRecoveryCode: jest.fn(async () => false),
}));

jest.mock('../services/notificationStore', () => ({
  createNotification: jest.fn(async () => undefined),
}));

jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    send: jest.fn(async () => ({ ok: true, skipped: true })),
    configured: jest.fn(() => false),
  },
}));

describe('account create and sign-in entry safety', () => {
  const mockedLocalStore = localStore as jest.Mocked<typeof localStore>;
  const mockedCreateUserSession = createUserSession as jest.MockedFunction<typeof createUserSession>;

  let server: http.Server | null = null;
  let baseUrl = '';
  let createdUser: Record<string, unknown>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'entry-safety-secret';
    process.env.SENSITIVE_DATA_KEY = 'entry-safety-sensitive-key';
    process.env.PUBLIC_BASE_URL = '';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/user', userPublicRoutes);

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
    createdUser = {
      id: 'user-created',
      email: 'entry@example.com',
      name: 'Entry User',
      role: 'user',
      password: hashPassword('StrongPass#1234'),
      passwordFingerprint: 'fingerprint',
      tier: 'Free / Community Tier',
      membershipStatus: null,
      subscriptionStatus: 'inactive',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      profileBackgroundVideo: null,
      phoneNumber: null,
      twoFactorMethod: 'none',
      walletAddress: null,
      walletDid: null,
      pendingPhoneOtpHash: null,
      pendingPhoneOtpExpiresAt: null,
      pendingPhoneOtpAttempts: 0,
      initialTwoFactorRequiredAt: null,
      initialTwoFactorCompletedAt: null,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedSignInAttempts: 0,
      lockoutUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      providerApproved: false,
      providerApprovalStatus: null,
      providerRevokedAt: null,
      providerAccessUpdatedAt: null,
      handle: null,
      bio: null,
      location: null,
      dateOfBirth: null,
      avatarUrl: null,
      bannerUrl: null,
      profileMedia: null,
      interests: [],
      twitterUrl: null,
      githubUrl: null,
      websiteUrl: null,
      privacySettings: {
        profileVisibility: 'public',
        showEmail: false,
        allowMessages: true,
        blockedUsers: [],
      },
    };
    mockedLocalStore.getUserByEmail.mockResolvedValue(null);
    mockedLocalStore.getUserById.mockImplementation(async (id: string) => {
      return id === String(createdUser.id) ? (createdUser as never) : null;
    });
    mockedLocalStore.updateUser.mockResolvedValue(null);
    mockedLocalStore.getMembershipByUserId.mockResolvedValue(null);
    mockedLocalStore.findUserByPasswordFingerprint.mockResolvedValue(null);
    mockedLocalStore.createUser.mockResolvedValue(createdUser as never);
    mockedCreateUserSession.mockResolvedValue({
      id: 'session-created',
      userId: 'user-created',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as never);
  });

  it('creates an account and returns a signed session token', async () => {
    const response = await fetch(`${baseUrl}/api/user/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'entry@example.com',
        password: 'StrongPass#1234',
      }),
    });

    expect(response.status).toBe(200);
    expect(mockedCreateUserSession).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { success?: boolean; token?: string };
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token?.length).toBeGreaterThan(20);
  });

  it('rejects missing credentials on sign-in', async () => {
    const response = await fetch(`${baseUrl}/api/user/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'entry@example.com' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(String(body.error)).toMatch(/Invalid request body|Missing required fields/i);
  });
});
