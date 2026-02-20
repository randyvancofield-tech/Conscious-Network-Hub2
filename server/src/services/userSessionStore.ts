import crypto from 'crypto';
import { resolveSessionExpiry } from '../auth';
import { localStore } from './persistenceStore';

const USER_SESSION_DID_PREFIX = 'user:';
const USER_SESSION_SCOPES = ['user:session'];

export interface UserSessionRecord {
  id: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

type ProviderSessionRow = Awaited<ReturnType<typeof localStore.getProviderSessionById>>;

const toUserSessionRecord = (session: ProviderSessionRow): UserSessionRecord | null => {
  if (!session) return null;
  const did = String(session.did || '').trim();
  if (!did.startsWith(USER_SESSION_DID_PREFIX)) return null;
  const userId = did.slice(USER_SESSION_DID_PREFIX.length).trim();
  if (!userId) return null;
  return {
    id: session.id,
    userId,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
};

export const createUserSession = async (userId: string): Promise<UserSessionRecord> => {
  const now = new Date();
  const expiresAt = new Date(resolveSessionExpiry(now.getTime()));
  const created = await localStore.createProviderSession({
    id: crypto.randomUUID(),
    did: `${USER_SESSION_DID_PREFIX}${userId}`,
    scopes: USER_SESSION_SCOPES,
    issuedAt: now,
    expiresAt,
    createdAt: now,
  });
  const mapped = toUserSessionRecord(created);
  if (!mapped) {
    throw new Error('Failed to persist user session');
  }
  return mapped;
};

export const getUserSessionById = async (sessionId: string): Promise<UserSessionRecord | null> => {
  return toUserSessionRecord(await localStore.getProviderSessionById(sessionId));
};

export const revokeUserSession = async (sessionId: string): Promise<void> => {
  await localStore.revokeProviderSession(sessionId);
};
