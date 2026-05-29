import express from 'express';
import http from 'http';
import { ethers } from 'ethers';
import { createSessionToken } from '../auth';

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
  walletAddress: string | null;
  tier: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProviderChallenge {
  id: string;
  did: string;
  nonce: string;
  statement: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
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

interface MessageSigner {
  signMessage(message: string): Promise<string>;
}

const users = new Map<string, MockUser>();
const challenges = new Map<string, MockProviderChallenge>();
const sessions = new Map<string, MockProviderSession>();
let nextUserSessionId = 1;

const cloneDate = (value: Date | null): Date | null => (value ? new Date(value.getTime()) : null);

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  providerRevokedAt: cloneDate(user.providerRevokedAt),
  providerAccessUpdatedAt: cloneDate(user.providerAccessUpdatedAt),
  createdAt: new Date(user.createdAt.getTime()),
  updatedAt: new Date(user.updatedAt.getTime()),
});

const cloneChallenge = (challenge: MockProviderChallenge): MockProviderChallenge => ({
  ...challenge,
  expiresAt: new Date(challenge.expiresAt.getTime()),
  usedAt: cloneDate(challenge.usedAt),
  createdAt: new Date(challenge.createdAt.getTime()),
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
  walletAddress: string | null,
  overrides: Partial<MockUser> = {}
): MockUser => {
  const now = new Date();
  return {
    id,
    email: `${id}@example.com`,
    name: 'Provider Wallet Test',
    role,
    providerApprovalStatus: role === 'provider' ? 'approved' : null,
    providerApproved: role === 'provider',
    providerRevokedAt: null,
    providerAccessUpdatedAt: role === 'provider' ? now : null,
    walletAddress,
    tier: 'Accelerated Tier',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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

  async findUserByWalletAddress(walletAddress: string): Promise<MockUser | null> {
    const normalized = String(walletAddress || '').trim().toLowerCase();
    for (const user of users.values()) {
      if (String(user.walletAddress || '').trim().toLowerCase() === normalized) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async updateUser(id: string, updates: any): Promise<MockUser | null> {
    const existing = users.get(id);
    if (!existing) return null;
    const next = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    users.set(id, next);
    return cloneUser(next);
  },

  async createProviderChallenge(input: any): Promise<MockProviderChallenge> {
    const challenge: MockProviderChallenge = {
      id: input.id,
      did: input.did,
      nonce: input.nonce,
      statement: input.statement,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: input.createdAt || new Date(),
    };
    challenges.set(challenge.id, challenge);
    return cloneChallenge(challenge);
  },

  async getProviderChallengeById(id: string): Promise<MockProviderChallenge | null> {
    const challenge = challenges.get(id);
    return challenge ? cloneChallenge(challenge) : null;
  },

  async consumeProviderChallenge(id: string): Promise<boolean> {
    const challenge = challenges.get(id);
    if (!challenge || challenge.usedAt) return false;
    challenges.set(id, {
      ...challenge,
      usedAt: new Date(),
    });
    return true;
  },

  async markProviderChallengeUsed(id: string): Promise<void> {
    await this.consumeProviderChallenge(id);
  },

  async createProviderSession(input: any): Promise<MockProviderSession> {
    const session: MockProviderSession = {
      id: input.id,
      did: input.did,
      scopes: input.scopes,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: input.createdAt || new Date(),
    };
    sessions.set(session.id, session);
    return cloneSession(session);
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

const createUserSessionMock = jest.fn(async (userId: string) => {
  const now = new Date();
  return {
    id: `user-session-${nextUserSessionId++}`,
    userId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    revokedAt: null,
  };
});

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: createUserSessionMock,
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

const providerAuthRoutes = require('../routes/providerAuth').default;
const providerSessionRoutes = require('../routes/providerSession').default;
const {
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  isProviderCrmAdminPasswordFallbackEnabled,
} = require('../services/providerCrm') as {
  PROVIDER_CRM_SOLE_ADMIN_EMAIL: string;
  isProviderCrmAdminPasswordFallbackEnabled: () => boolean;
};

let server: http.Server | null = null;
let baseUrl = '';

const buildProviderSiweMessage = (challenge: any): string =>
  [
    `${challenge.domain} wants you to sign in with your Ethereum account:`,
    challenge.address,
    '',
    challenge.statement,
    '',
    `URI: ${challenge.uri}`,
    `Version: ${challenge.version}`,
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expirationTime}`,
  ].join('\n');

const userToken = (userId: string): string => createSessionToken(userId).token;

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

const issueChallenge = async (providerId: string, walletAddress: string) => {
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/wallet/nonce',
    token: userToken(providerId),
    body: { walletAddress },
  });
};

const issueBindChallenge = async (providerId: string, walletAddress: string) => {
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/wallet/bind/nonce',
    token: userToken(providerId),
    body: { walletAddress },
  });
};

const verifyChallenge = async (
  providerId: string,
  challenge: any,
  wallet: MessageSigner,
  walletAddress = challenge.address
) => {
  const message = buildProviderSiweMessage(challenge);
  const signature = await wallet.signMessage(message);
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/wallet/verify',
    token: userToken(providerId),
    body: {
      challengeId: challenge.challengeId,
      walletAddress,
      message,
      signature,
    },
  });
};

const verifyBindChallenge = async (
  providerId: string,
  challenge: any,
  wallet: MessageSigner,
  walletAddress = challenge.address
) => {
  const message = buildProviderSiweMessage(challenge);
  const signature = await wallet.signMessage(message);
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/wallet/bind/verify',
    token: userToken(providerId),
    body: {
      challengeId: challenge.challengeId,
      walletAddress,
      message,
      signature,
    },
  });
};

const issueAdminChallenge = async (walletAddress: string) => {
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/admin/wallet/nonce',
    body: { walletAddress },
  });
};

const verifyAdminChallenge = async (
  challenge: any,
  wallet: MessageSigner,
  walletAddress = challenge.address
) => {
  const message = buildProviderSiweMessage(challenge);
  const signature = await wallet.signMessage(message);
  return requestJson({
    method: 'POST',
    path: '/api/provider/auth/admin/wallet/verify',
    body: {
      challengeId: challenge.challengeId,
      walletAddress,
      message,
      signature,
    },
  });
};

describe('Provider wallet authentication', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'provider-wallet-auth-test-secret';
    process.env.SENSITIVE_DATA_KEY = 'provider-wallet-sensitive-key';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';
    process.env.PROVIDER_WALLET_CHAIN_ID = '31337';

    const app = express();
    app.use(express.json());
    app.use('/api/provider/auth', providerAuthRoutes);
    app.use('/api/provider/session', providerSessionRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve provider wallet test server address');
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
    challenges.clear();
    sessions.clear();
    nextUserSessionId = 1;
    delete process.env.PROVIDER_CRM_ADMIN_WALLET_ADDRESS;
    delete process.env.ADMIN_WALLET_ADDRESS;
    delete process.env.ENABLE_ADMIN_PASSWORD_FALLBACK;
    jest.clearAllMocks();
  });

  it('generates a SIWE-style nonce for the signed-in approved provider wallet', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));

    const response = await issueChallenge('provider-1', wallet.address);

    expect(response.status).toBe(200);
    expect(response.body?.challengeId).toBeTruthy();
    expect(response.body?.address).toBe(wallet.address);
    expect(response.body?.version).toBe('1');
    expect(response.body?.chainId).toBe(31337);
    expect(response.body?.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(String(response.body?.statement || '')).toContain('gasless signature');
    expect(challenges.size).toBe(1);
  });

  it('binds a wallet for an approved provider before verification', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', null));

    const challenge = await issueBindChallenge('provider-1', wallet.address);
    const binding = await verifyBindChallenge('provider-1', challenge.body, wallet);

    expect(challenge.status).toBe(200);
    expect(binding.status).toBe(200);
    expect(binding.body?.walletBound).toBe(true);
    expect(users.get('provider-1')?.walletAddress).toBe(wallet.address);
  });

  it('allows provider wallet verification after binding', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', null));

    const bindChallenge = await issueBindChallenge('provider-1', wallet.address);
    const binding = await verifyBindChallenge('provider-1', bindChallenge.body, wallet);
    const verifyChallengeResponse = await issueChallenge('provider-1', wallet.address);
    const verification = await verifyChallenge('provider-1', verifyChallengeResponse.body, wallet);

    expect(binding.status).toBe(200);
    expect(verifyChallengeResponse.status).toBe(200);
    expect(verification.status).toBe(200);
    expect(verification.body?.walletVerified).toBe(true);
    expect(sessions.size).toBe(1);
  });

  it('blocks provider wallet binding to a wallet owned by another user', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', null));
    users.set('provider-2', createMockUser('provider-2', 'provider', wallet.address));

    const challenge = await issueBindChallenge('provider-1', wallet.address);

    expect(challenge.status).toBe(403);
    expect(challenge.body?.code).toBe('PROVIDER_WALLET_BOUND_TO_OTHER_USER');
    expect(challenges.size).toBe(0);
  });

  it('accepts a valid signature and unlocks provider tools through the provider session', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));
    const challenge = await issueChallenge('provider-1', wallet.address);

    const verification = await verifyChallenge('provider-1', challenge.body, wallet);

    expect(verification.status).toBe(200);
    expect(verification.body?.success).toBe(true);
    expect(verification.body?.walletVerified).toBe(true);
    expect(String(verification.body?.token || '').length).toBeGreaterThan(20);
    expect(sessions.size).toBe(1);

    const providerSession = await requestJson({
      method: 'GET',
      path: '/api/provider/session/current',
      token: verification.body.token,
    });
    expect(providerSession.status).toBe(200);
    expect(providerSession.body?.success).toBe(true);
    expect(providerSession.body?.did).toBe('provider:provider-1');
  });

  it('rejects an invalid signature', async () => {
    const wallet = ethers.Wallet.createRandom();
    const otherWallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));
    const challenge = await issueChallenge('provider-1', wallet.address);

    const verification = await verifyChallenge('provider-1', challenge.body, otherWallet);

    expect(verification.status).toBe(401);
    expect(verification.body?.error).toBe('Wallet signature is invalid');
    expect(sessions.size).toBe(0);
  });

  it('rejects an expired nonce', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));
    const challenge = await issueChallenge('provider-1', wallet.address);
    const stored = challenges.get(challenge.body.challengeId);
    if (!stored) throw new Error('challenge missing from test store');
    challenges.set(stored.id, {
      ...stored,
      expiresAt: new Date(Date.now() - 1000),
    });

    const verification = await verifyChallenge('provider-1', challenge.body, wallet);

    expect(verification.status).toBe(401);
    expect(verification.body?.error).toBe('Wallet verification challenge expired');
    expect(sessions.size).toBe(0);
  });

  it('rejects a replayed nonce', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));
    const challenge = await issueChallenge('provider-1', wallet.address);

    const first = await verifyChallenge('provider-1', challenge.body, wallet);
    const second = await verifyChallenge('provider-1', challenge.body, wallet);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body?.error).toBe('Wallet verification challenge has already been used');
    expect(sessions.size).toBe(1);
  });

  it('rejects an unapproved wallet before issuing a nonce', async () => {
    const approvedWallet = ethers.Wallet.createRandom();
    const unapprovedWallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', approvedWallet.address));

    const response = await issueChallenge('provider-1', unapprovedWallet.address);

    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('PROVIDER_WALLET_NOT_APPROVED');
    expect(challenges.size).toBe(0);
  });

  it('rejects a submitted wallet mismatch', async () => {
    const wallet = ethers.Wallet.createRandom();
    const otherWallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));
    const challenge = await issueChallenge('provider-1', wallet.address);

    const verification = await verifyChallenge('provider-1', challenge.body, wallet, otherWallet.address);

    expect(verification.status).toBe(400);
    expect(verification.body?.error).toBe('Submitted wallet does not match signed message');
    expect(sessions.size).toBe(0);
  });

  it('requires wallet verification before approved providers can mint native provider sessions', async () => {
    const wallet = ethers.Wallet.createRandom();
    users.set('provider-1', createMockUser('provider-1', 'provider', wallet.address));

    const response = await requestJson({
      method: 'POST',
      path: '/api/provider/auth/session',
      token: userToken('provider-1'),
      body: {},
    });

    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('PROVIDER_WALLET_VERIFICATION_REQUIRED');
    expect(sessions.size).toBe(0);
  });

  it.each(['user', 'applicant'] as MockRole[])('does not enable wallet auth for %s accounts', async (role) => {
    const wallet = ethers.Wallet.createRandom();
    users.set(`${role}-1`, createMockUser(`${role}-1`, role, wallet.address));

    const response = await issueChallenge(`${role}-1`, wallet.address);

    expect(response.status).toBe(403);
    expect(sessions.size).toBe(0);
  });

  it('keeps admin provider session creation unchanged', async () => {
    users.set('admin-1', createMockUser('admin-1', 'admin', null));

    const response = await requestJson({
      method: 'POST',
      path: '/api/provider/auth/session',
      token: userToken('admin-1'),
      body: {},
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.session?.scopes).toEqual(['provider:*']);
  });

  it('blocks admin provider session minting when wallet verification is required', async () => {
    process.env.ENABLE_ADMIN_PASSWORD_FALLBACK = 'false';
    users.set('admin-1', createMockUser('admin-1', 'admin', null));

    const response = await requestJson({
      method: 'POST',
      path: '/api/provider/auth/session',
      token: userToken('admin-1'),
      body: {},
    });

    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('ADMIN_WALLET_VERIFICATION_REQUIRED');
    expect(sessions.size).toBe(0);
  });

  it('keeps admin password fallback disabled in production even if explicitly enabled', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFallback = process.env.ENABLE_ADMIN_PASSWORD_FALLBACK;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_ADMIN_PASSWORD_FALLBACK = 'true';

      expect(isProviderCrmAdminPasswordFallbackEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.ENABLE_ADMIN_PASSWORD_FALLBACK = previousFallback;
    }
  });

  it('reports Administrative Access wallet readiness without exposing the full wallet address', async () => {
    const wallet = ethers.Wallet.createRandom();
    process.env.PROVIDER_CRM_ADMIN_WALLET_ADDRESS = wallet.address;
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', null, {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );

    const response = await requestJson({
      method: 'GET',
      path: '/api/provider/auth/admin/wallet/status',
    });

    expect(response.status).toBe(200);
    expect(response.body?.walletConfigured).toBe(true);
    expect(response.body?.walletAddressMasked).toMatch(/^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/);
    expect(response.body?.walletAddressMasked).not.toBe(wallet.address);
    expect(response.body?.adminAccountReady).toBe(true);
    expect(response.body?.passwordFallbackEnabled).toBe(true);
  });

  it('verifies the configured admin wallet and creates canonical plus provider-control sessions', async () => {
    const wallet = ethers.Wallet.createRandom();
    process.env.PROVIDER_CRM_ADMIN_WALLET_ADDRESS = wallet.address;
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', null, {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );

    const challenge = await issueAdminChallenge(wallet.address);
    const verification = await verifyAdminChallenge(challenge.body, wallet);

    expect(challenge.status).toBe(200);
    expect(verification.status).toBe(200);
    expect(verification.body?.success).toBe(true);
    expect(verification.body?.walletVerified).toBe(true);
    expect(String(verification.body?.token || '').length).toBeGreaterThan(20);
    expect(verification.body?.user?.email).toBe(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
    expect(verification.body?.user?.role).toBe('admin');
    expect(verification.body?.providerControl?.session?.scopes).toEqual(['provider:*']);
    expect(createUserSessionMock).toHaveBeenCalledWith('sole-admin');
    expect(sessions.size).toBe(1);
  });

  it('rejects Administrative Access nonce requests from any wallet other than the configured founder wallet', async () => {
    const wallet = ethers.Wallet.createRandom();
    const otherWallet = ethers.Wallet.createRandom();
    process.env.PROVIDER_CRM_ADMIN_WALLET_ADDRESS = wallet.address;
    users.set(
      'sole-admin',
      createMockUser('sole-admin', 'admin', null, {
        email: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      })
    );

    const response = await issueAdminChallenge(otherWallet.address);

    expect(response.status).toBe(403);
    expect(response.body?.code).toBe('ADMIN_WALLET_MISMATCH');
    expect(challenges.size).toBe(0);
  });
});
