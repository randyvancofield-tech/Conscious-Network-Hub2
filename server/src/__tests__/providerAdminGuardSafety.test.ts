import express from 'express';
import http from 'http';
import providerAuthRoutes from '../routes/providerAuth';
import { localStore } from '../services/persistenceStore';

jest.mock('../services/persistenceStore', () => ({
  localStore: {
    getUserById: jest.fn(),
    createProviderChallenge: jest.fn(),
    getProviderChallengeById: jest.fn(),
    markProviderChallengeUsed: jest.fn(),
  },
}));

jest.mock('../services/providerCrm', () => ({
  PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS: ['ADMIN_WALLET_ADDRESS'],
  PROVIDER_CRM_SOLE_ADMIN_EMAIL: 'higherconscious.network1@gmail.com',
  canUseProviderCrmAdminPasswordFallback: jest.fn(() => false),
  getConfiguredProviderCrmAdminWalletAddress: jest.fn(() => '0x1234567890abcdef1234567890abcdef12345678'),
  isProviderCrmAdminPasswordFallbackEnabled: jest.fn(() => false),
  isProviderCrmMobileAdminPasswordFallbackAllowed: jest.fn(() => false),
  isProviderCrmSoleAdmin: jest.fn(() => true),
  maskProviderCrmAdminWalletAddress: jest.fn((value: string | null | undefined) => value ? `${value.slice(0, 6)}...` : null),
}));

describe('provider/admin guard safety', () => {
  const mockedLocalStore = localStore as jest.Mocked<typeof localStore>;
  let server: http.Server | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'provider-admin-test-secret';
    process.env.SENSITIVE_DATA_KEY = 'provider-admin-test-sensitive-key';
    process.env.PUBLIC_BASE_URL = '';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/provider/auth', providerAuthRoutes);

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
    mockedLocalStore.getUserById.mockResolvedValue(null);
    mockedLocalStore.getProviderChallengeById.mockResolvedValue(null);
  });

  it('rejects an invalid admin wallet nonce request before verification proceeds', async () => {
    const response = await fetch(`${baseUrl}/api/provider/auth/admin/wallet/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(String(body.error)).toMatch(/Valid walletAddress is required|invalid/i);
  });
});
