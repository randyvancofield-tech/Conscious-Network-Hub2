import { createSessionToken } from '../auth';
import { createUserSession } from '../services/userSessionStore';
import { issueCanonicalSession } from '../services/sessionLifecycle';

jest.mock('../auth', () => ({
  createSessionToken: jest.fn(),
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: jest.fn(),
}));

describe('issueCanonicalSession', () => {
  const mockedCreateUserSession = createUserSession as jest.MockedFunction<typeof createUserSession>;
  const mockedCreateSessionToken = createSessionToken as jest.MockedFunction<typeof createSessionToken>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a persisted session and returns the canonical token payload', async () => {
    mockedCreateUserSession.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
      revokedAt: null,
    } as never);

    mockedCreateSessionToken.mockReturnValue({
      token: 'signed-token',
      expiresAt: 1767225600000,
    } as never);

    const result = await issueCanonicalSession('user-123');

    expect(mockedCreateUserSession).toHaveBeenCalledWith('user-123');
    expect(mockedCreateSessionToken).toHaveBeenCalledWith('user-123', {
      sessionId: 'session-123',
      expiresAt: new Date('2026-01-01T01:00:00.000Z').getTime(),
    });
    expect(result).toEqual({
      token: 'signed-token',
      expiresAt: 1767225600000,
      sessionId: 'session-123',
    });
  });
});
