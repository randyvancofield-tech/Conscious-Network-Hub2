import type { Request, Response, NextFunction } from 'express';
import { requireCanonicalIdentity } from '../middleware';
import { verifySessionToken } from '../auth';
import { getUserSessionById, revokeUserSession } from '../services/userSessionStore';
import { localStore } from '../services/persistenceStore';
import { isProviderAccessActive } from '../services/providerAccess';

jest.mock('../auth', () => ({
  verifySessionToken: jest.fn(),
  verifyAdminElevationToken: jest.fn(),
}));

jest.mock('../services/userSessionStore', () => ({
  getUserSessionById: jest.fn(),
  revokeUserSession: jest.fn(),
}));

jest.mock('../services/persistenceStore', () => ({
  localStore: {
    getUserById: jest.fn(),
  },
}));

jest.mock('../services/providerAccess', () => ({
  isProviderAccessActive: jest.fn(() => true),
  getProviderAccessDenyReason: jest.fn(() => null),
}));

jest.mock('../tierPolicy', () => ({
  hasTierAccess: jest.fn(() => true),
}));

describe('requireCanonicalIdentity', () => {
  const mockedVerifySessionToken = verifySessionToken as jest.MockedFunction<typeof verifySessionToken>;
  const mockedGetUserSessionById = getUserSessionById as jest.MockedFunction<typeof getUserSessionById>;
  const mockedRevokeUserSession = revokeUserSession as jest.MockedFunction<typeof revokeUserSession>;
  const mockedLocalStoreGetUserById = localStore.getUserById as jest.MockedFunction<typeof localStore.getUserById>;
  const mockedIsProviderAccessActive = isProviderAccessActive as jest.MockedFunction<typeof isProviderAccessActive>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.ENFORCE_PERSISTED_USER_SESSIONS = 'true';
  });

  it('accepts bearer tokens when the scheme is lowercase', async () => {
    const req = {
      method: 'GET',
      path: '/api/me',
      headers: { authorization: 'bearer test-token' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    mockedVerifySessionToken.mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    mockedGetUserSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    } as never);
    mockedLocalStoreGetUserById.mockResolvedValue({
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
    mockedIsProviderAccessActive.mockReturnValue(true);

    await requireCanonicalIdentity(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(mockedRevokeUserSession).not.toHaveBeenCalled();
  });
});
