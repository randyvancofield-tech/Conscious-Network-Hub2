import crypto from 'crypto';
import { resolveAuthTokenSecret } from '../requiredEnv';

export interface ProviderTokenPayload {
  tokenType: 'provider';
  sessionId: string;
  did: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_PROVIDER_SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

const toBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
};

const signSegment = (segment: string): string =>
  crypto
    .createHmac('sha256', resolveAuthTokenSecret())
    .update(segment)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const createProviderSessionToken = (
  sessionId: string,
  did: string,
  scopes: string[]
): { token: string; expiresAt: number } => {
  const now = Date.now();
  const ttlSecondsRaw = Number(process.env.PROVIDER_SESSION_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0
      ? ttlSecondsRaw
      : DEFAULT_PROVIDER_SESSION_TTL_SECONDS;
  const expiresAt = now + ttlSeconds * 1000;

  const payload: ProviderTokenPayload = {
    tokenType: 'provider',
    sessionId,
    did,
    scopes,
    issuedAt: now,
    expiresAt,
  };

  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signatureSegment = signSegment(payloadSegment);

  return {
    token: `${payloadSegment}.${signatureSegment}`,
    expiresAt,
  };
};

export const verifyProviderSessionToken = (token: string): ProviderTokenPayload | null => {
  if (!token || typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length !== 2) return null;

  const [payloadSegment, signatureSegment] = segments;
  const expectedSignature = signSegment(payloadSegment);

  const providedBuffer = Buffer.from(signatureSegment, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadSegment)) as ProviderTokenPayload;
    if (payload.tokenType !== 'provider') return null;
    if (!payload.sessionId || !payload.did || !Array.isArray(payload.scopes)) return null;
    if (!payload.expiresAt || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

