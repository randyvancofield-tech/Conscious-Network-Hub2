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
  it.each([
    ['applicant', null, '/api/social', '/', 'GET', false],
    ['user', 'submitted', '/api/ai', '/chat', 'POST', false],
    ['user', 'rejected', '/api/membership', '/checkout', 'POST', false],
    ['applicant', null, '/api/user', '/profile', 'PATCH', false],
    ['applicant', null, '/api/provider-applicants', '/current', 'GET', true],
    ['user', 'submitted', '/api/provider-applicants', '/current/calendly-shown', 'POST', true],
    ['applicant', null, '/api/user', '/current', 'GET', true],
    ['applicant', null, '/api/user', '/logout', 'POST', true],
    ['applicant', null, '/api/upload', '/object/document-key', 'GET', true],
    ['applicant', null, '/api/upload', '/avatar', 'POST', false],
    ['applicant', null, '/api/notifications', '/', 'GET', true],
    ['applicant', null, '/api/mail', '/messages', 'GET', true],
    ['applicant', null, '/api/mail', '/messages', 'POST', true],
    ['applicant', null, '/api/mail', '/recipients', 'GET', true],
    ['applicant', null, '/api/mail', '/messages/id/thread', 'GET', true],
    ['applicant', null, '/api/mail', '/messages/id/export', 'GET', true],
    ['applicant', null, '/api/mail', '/messages/id/attachments/file', 'GET', true],
    ['applicant', null, '/api/mail', '/messages/id/read', 'PATCH', true],
    ['applicant', null, '/api/mail', '/messages', 'DELETE', false],
    ['applicant', null, '/api/mail', '/admin', 'POST', false],
    ['applicant', null, '/api/mail', '/messages/id/attachments/file', 'POST', false],
    ['user', null, '/api/social', '/', 'GET', true],
    ['admin', 'submitted', '/api/admin', '/dashboard', 'GET', true],
    ['provider', 'approved', '/api/social', '/', 'GET', true],
  ])('applies applicant boundary for %s %s %s%s %s', async (role, status, baseUrl, path, method, allowed) => {
    mockedVerifySessionToken.mockReturnValue({ userId: 'account', sessionId: 'session', issuedAt: Date.now(), expiresAt: Date.now() + 60000 });
    mockedGetUserSessionById.mockResolvedValue({ id: 'session', userId: 'account', issuedAt: new Date(), expiresAt: new Date(Date.now() + 60000), revokedAt: null });
    mockedLocalStoreGetUserById.mockResolvedValue({ id: 'account', role, providerApprovalStatus: status, providerApproved: role === 'provider' } as never);
    mockedIsProviderAccessActive.mockReturnValue(true);
    const req = { baseUrl, path, method, headers: { authorization: 'Bearer token' } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
    const next = jest.fn();
    requireCanonicalIdentity(req, res, next);
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (allowed) expect(next).toHaveBeenCalledTimes(1);
    else {
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'APPLICANT_ACCESS_ONLY' }));
    }
    // A blocked feature must not destroy the applicant's status-portal session.
    expect(mockedRevokeUserSession).not.toHaveBeenCalled();
  });

});
