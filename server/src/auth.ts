import crypto from 'crypto';
import { resolveAuthTokenSecret } from './requiredEnv';

export interface SessionTokenPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LEN = 64;

const getTokenSecret = (): string => resolveAuthTokenSecret();

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

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LEN).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${hash}`;
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

  if (storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    return verifyScryptPassword(password, storedPassword);
  }

  const legacyHash = legacySha256(password);
  return storedPassword === legacyHash || storedPassword === password;
};

export const needsPasswordRehash = (storedPassword: string): boolean => {
  return !storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`);
};

export const computePasswordFingerprint = (password: string): string => {
  const fingerprintKey = `password-fingerprint:${getTokenSecret()}`;
  return crypto.createHmac('sha256', fingerprintKey).update(password).digest('hex');
};

export const createSessionToken = (userId: string): { token: string; expiresAt: number } => {
  const now = Date.now();
  const ttlSecondsRaw = Number(process.env.SESSION_TTL_SECONDS);
  const ttlSeconds =
    Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0
      ? ttlSecondsRaw
      : DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = now + ttlSeconds * 1000;

  const payload: SessionTokenPayload = {
    userId,
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
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
};
