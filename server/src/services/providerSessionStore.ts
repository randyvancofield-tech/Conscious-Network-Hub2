import crypto from 'crypto';
import {
  localStore,
  LocalProviderChallengeRecord,
  LocalProviderSessionRecord,
} from './localStore';

export interface ProviderChallengeRecord extends LocalProviderChallengeRecord {}

export interface ProviderSessionRecord extends LocalProviderSessionRecord {}

const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes

export const createProviderChallenge = async (did: string): Promise<ProviderChallengeRecord> => {
  const now = new Date();
  const ttlSecondsRaw = Number(process.env.PROVIDER_CHALLENGE_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0
      ? ttlSecondsRaw
      : DEFAULT_CHALLENGE_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const id = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString('hex');
  const statement = [
    'Higher Conscious Network Provider Authentication Challenge',
    `Challenge ID: ${id}`,
    `DID: ${did}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
  ].join('\n');

  return localStore.createProviderChallenge({
    id,
    did,
    nonce,
    statement,
    expiresAt,
    createdAt: now,
  });
};

export const getProviderChallengeById = async (
  challengeId: string
): Promise<ProviderChallengeRecord | null> => {
  return localStore.getProviderChallengeById(challengeId);
};

export const markProviderChallengeUsed = async (challengeId: string): Promise<void> => {
  localStore.markProviderChallengeUsed(challengeId);
};

export const createProviderSession = async (
  did: string,
  scopes: string[]
): Promise<ProviderSessionRecord> => {
  const now = new Date();
  const ttlSecondsRaw = Number(process.env.PROVIDER_SESSION_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0 ? ttlSecondsRaw : 30 * 60;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const sessionId = crypto.randomUUID();

  return localStore.createProviderSession({
    id: sessionId,
    did,
    scopes,
    issuedAt: now,
    expiresAt,
    createdAt: now,
  });
};

export const getProviderSessionById = async (
  sessionId: string
): Promise<ProviderSessionRecord | null> => {
  return localStore.getProviderSessionById(sessionId);
};

export const revokeProviderSession = async (sessionId: string): Promise<void> => {
  localStore.revokeProviderSession(sessionId);
};
