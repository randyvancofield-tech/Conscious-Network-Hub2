import { Response } from 'express';
import { createSessionToken } from '../auth';
import { createUserSession } from './userSessionStore';

export interface IssuedCanonicalSession {
  token: string;
  expiresAt: number;
  sessionId: string;
}

export const applyAuthResponseHeaders = (res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.vary('Authorization');
  res.vary('Cookie');
};

export interface CanonicalSessionFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export const buildCanonicalSessionFailure = (
  error: unknown,
  fallbackMessage = 'Session setup could not be completed. Please sign in to continue.'
): CanonicalSessionFailure => {
  const code = error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : 'SESSION_ISSUE_FAILED';
  const message = error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallbackMessage;

  return {
    code,
    message,
    retryable: true,
  };
};

export const issueCanonicalSession = async (userId: string): Promise<IssuedCanonicalSession> => {
  const persistedSession = await createUserSession(userId);
  const session = createSessionToken(userId, {
    sessionId: persistedSession.id,
    expiresAt: persistedSession.expiresAt.getTime(),
  });

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    sessionId: persistedSession.id,
  };
};
