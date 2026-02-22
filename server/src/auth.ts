import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { resolveAuthTokenSecret } from './requiredEnv';

export interface SessionTokenPayload {
  userId: string;
  sessionId?: string;
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_BCRYPT_ROUNDS = 12;
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LEN = 64;

const getTokenSecret = (): string => resolveAuthTokenSecret();

export const resolveSessionTtlSeconds = (): number => {
  const ttlSecondsRaw = Number(process.env.SESSION_TTL_SECONDS);
  return Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0
    ? ttlSecondsRaw
    : DEFAULT_SESSION_TTL_SECONDS;
};

export const resolveSessionExpiry = (issuedAtMs = Date.now()): number =>
  issuedAtMs + resolveSessionTtlSeconds() * 1000;

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
    .createHmac('sha256', getTokenSecret())
    .update(segment)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const legacySha256 = (password: string): string =>
  crypto.createHash('sha256').update(password).digest('hex');

const resolveBcryptRounds = (): number => {
  const parsed = Number(process.env.BCRYPT_SALT_ROUNDS);
  if (Number.isFinite(parsed) && parsed >= 8 && parsed <= 15) {
    return Math.floor(parsed);
  }
  return DEFAULT_BCRYPT_ROUNDS;
};

const isBcryptHash = (stored: string): boolean => /^\$2[aby]\$\d{2}\$/.test(stored);

export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, resolveBcryptRounds());
};

const verifyScryptPassword = (password: string, stored: string): boolean => {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const [, salt, expectedHashHex] = parts;
  if (!salt || !expectedHashHex) return false;

  const actualHashHex = crypto.scryptSync(password, salt, PASSWORD_KEY_LEN).toString('hex');
  const actualBuffer = Buffer.from(actualHashHex, 'hex');
  const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

export const verifyPassword = (password: string, storedPassword: string): boolean => {
  if (!storedPassword || typeof storedPassword !== 'string') return false;

  if (isBcryptHash(storedPassword)) {
    try {
      return bcrypt.compareSync(password, storedPassword);
    } catch {
      return false;
    }
  }

  if (storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    return verifyScryptPassword(password, storedPassword);
  }

  const legacyHash = legacySha256(password);
  return storedPassword === legacyHash || storedPassword === password;
};

export const needsPasswordRehash = (storedPassword: string): boolean => {
  return !isBcryptHash(storedPassword);
};

export const computePasswordFingerprint = (password: string): string => {
  const fingerprintKey = `password-fingerprint:${getTokenSecret()}`;
  return crypto.createHmac('sha256', fingerprintKey).update(password).digest('hex');
};

export const createSessionToken = (
  userId: string,
  options?: {
    sessionId?: string | null;
    expiresAt?: number | null;
  }
): { token: string; expiresAt: number } => {
  const now = Date.now();
  const providedExpiresAt = Number(options?.expiresAt);
  const expiresAt =
    Number.isFinite(providedExpiresAt) && providedExpiresAt > now
      ? providedExpiresAt
      : resolveSessionExpiry(now);
  const sessionId = String(options?.sessionId || '').trim() || undefined;

  const payload: SessionTokenPayload = {
    userId,
    ...(sessionId ? { sessionId } : {}),
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

export const verifySessionToken = (token: string): SessionTokenPayload | null => {
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
    const parsed = JSON.parse(fromBase64Url(payloadSegment)) as SessionTokenPayload;
    if (!parsed?.userId || !parsed?.expiresAt) return null;
    if (parsed.sessionId !== undefined && String(parsed.sessionId || '').trim().length === 0) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
};
