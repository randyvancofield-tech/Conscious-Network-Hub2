import express from 'express';
import http from 'http';
import { hashPassword } from '../auth';

type MockUser = {
  id: string;
  email: string;
  name: string | null;
  password: string;
  passwordFingerprint: string | null;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  failedSignInAttempts: number;
  lockoutUntil: Date | null;
  twoFactorMethod: 'none' | 'phone' | 'wallet';
  phoneNumber: string | null;
  walletDid: string | null;
  pendingPhoneOtpHash: string | null;
  pendingPhoneOtpExpiresAt: Date | null;
  pendingPhoneOtpAttempts: number;
};

const users = new Map<string, MockUser>();
let nextSessionId = 1;

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  createdAt: new Date(user.createdAt.getTime()),
  updatedAt: new Date(user.updatedAt.getTime()),
  subscriptionStartDate: user.subscriptionStartDate
    ? new Date(user.subscriptionStartDate.getTime())
    : null,
  subscriptionEndDate: user.subscriptionEndDate
    ? new Date(user.subscriptionEndDate.getTime())
    : null,
  lockoutUntil: user.lockoutUntil ? new Date(user.lockoutUntil.getTime()) : null,
  pendingPhoneOtpExpiresAt: user.pendingPhoneOtpExpiresAt
    ? new Date(user.pendingPhoneOtpExpiresAt.getTime())
    : null,
});

const createMockUser = (email: string, passwordHash: string): MockUser => {
  const now = new Date();
  return {
    id: `user-${email}`,
    email,
    name: 'SignIn User',
    password: passwordHash,
    passwordFingerprint: null,
    tier: 'Free / Community Tier',
    subscriptionStatus: 'inactive',
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    createdAt: now,
    updatedAt: now,
    failedSignInAttempts: 0,
    lockoutUntil: null,
    twoFactorMethod: 'none',
    phoneNumber: null,
    walletDid: null,
    pendingPhoneOtpHash: null,
    pendingPhoneOtpExpiresAt: null,
    pendingPhoneOtpAttempts: 0,
  };
};

const createUserSessionMock = jest.fn(async (userId: string) => {
  const now = new Date();
  return {
    id: `session-${nextSessionId++}`,
    userId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60),
    revokedAt: null,
  };
});

const mockLocalStore = {
  async getUserByEmail(email: string): Promise<MockUser | null> {
    const target = email.trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email.toLowerCase() === target) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async updateUser(id: string, updates: Partial<MockUser>): Promise<MockUser | null> {
    const existing = users.get(id);
    if (!existing) return null;
    const next: MockUser = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    users.set(id, next);
    return cloneUser(next);
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: createUserSessionMock,
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

jest.mock('../services/providerSessionStore', () => ({
  getProviderSessionById: jest.fn(async () => null),
}));

const { userPublicRoutes } = require('../routes/user');

let server: http.Server | null = null;
let baseUrl = '';

const requestSignIn = async (body: Record<string, unknown>) => {
  const response = await fetch(`${baseUrl}/api/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

describe('Sign-in logic', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'signin-test-auth-secret';
    process.env.SENSITIVE_DATA_KEY = 'signin-test-sensitive-key';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';
    process.env.PUBLIC_BASE_URL = '';

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
    users.clear();
    nextSessionId = 1;
    jest.clearAllMocks();
  });

  it('logs in successfully with valid credentials and returns a token', async () => {
    const email = 'signin.success@example.com';
    const password = 'ValidPass#1234';
    const user = createMockUser(email, hashPassword(password));
    users.set(user.id, user);

    const response = await requestSignIn({ email, password });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(String(response.body?.token || '').length).toBeGreaterThan(20);
    expect(response.body?.user?.email).toBe(email);
    expect(createUserSessionMock).toHaveBeenCalledTimes(1);
  });

  it('returns invalid credentials for wrong password', async () => {
    const email = 'signin.wrong@example.com';
    const user = createMockUser(email, hashPassword('CorrectPass#9876'));
    users.set(user.id, user);

    const response = await requestSignIn({
      email,
      password: 'WrongPass#9876',
    });

    expect(response.status).toBe(401);
    expect(response.body?.error).toBe('Invalid credentials');
    expect(createUserSessionMock).not.toHaveBeenCalled();

    const updated = users.get(user.id);
    expect(updated?.failedSignInAttempts).toBe(1);
  });

  it('returns invalid credentials for non-existent user', async () => {
    const response = await requestSignIn({
      email: 'signin.missing@example.com',
      password: 'AnyPass#1234',
    });

    expect(response.status).toBe(401);
    expect(response.body?.error).toBe('Invalid credentials');
    expect(createUserSessionMock).not.toHaveBeenCalled();
  });
});

