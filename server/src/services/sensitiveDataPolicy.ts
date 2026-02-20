import crypto from 'crypto';

type SensitiveField = 'phoneNumber' | 'walletDid';

const ENCRYPTION_PREFIX = 'enc:v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

const trimEnv = (name: string): string => {
  return String(process.env[name] || '').trim();
};

const shouldEnforceEncryption = (): boolean => {
  const nodeEnv = trimEnv('NODE_ENV').toLowerCase();
  const backend = trimEnv('AUTH_PERSISTENCE_BACKEND').toLowerCase();
  return nodeEnv === 'production' || backend === 'shared_db';
};

const getRawKey = (): string => {
  return trimEnv('SENSITIVE_DATA_KEY');
};

const buildKey = (): Buffer | null => {
  const raw = getRawKey();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
};

const getEncryptionKey = (): Buffer => {
  const key = buildKey();
  if (key) return key;
  if (shouldEnforceEncryption()) {
    throw new Error(
      '[SECURITY][FATAL] Missing SENSITIVE_DATA_KEY. Set SENSITIVE_DATA_KEY for production/shared_db persistence.'
    );
  }
  throw new Error('[SECURITY][SKIP] SENSITIVE_DATA_KEY not configured');
};

const formatEnvelope = (iv: Buffer, tag: Buffer, ciphertext: Buffer): string => {
  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

const parseEnvelope = (value: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } | null => {
  const parts = value.split(':');
  if (parts.length !== 5) return null;
  if (`${parts[0]}:${parts[1]}` !== ENCRYPTION_PREFIX) return null;
  const [, , ivRaw, tagRaw, ciphertextRaw] = parts;
  if (!ivRaw || !tagRaw || !ciphertextRaw) return null;
  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    return null;
  }
  return { iv, tag, ciphertext };
};

export const isSensitiveDataEncrypted = (value: unknown): boolean => {
  const raw = String(value || '').trim();
  return raw.startsWith(`${ENCRYPTION_PREFIX}:`);
};

export const protectSensitiveField = (
  field: SensitiveField,
  value: string | null | undefined
): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (isSensitiveDataEncrypted(normalized)) {
    return normalized;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(field, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(normalized, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return formatEnvelope(iv, tag, ciphertext);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('[SECURITY][SKIP]')) {
      return normalized;
    }
    throw error;
  }
};

export const revealSensitiveField = (
  field: SensitiveField,
  value: string | null | undefined
): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!isSensitiveDataEncrypted(normalized)) {
    return normalized;
  }

  const envelope = parseEnvelope(normalized);
  if (!envelope) {
    throw new Error(`[SECURITY] Invalid encrypted payload format for ${field}`);
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, envelope.iv);
  decipher.setAAD(Buffer.from(field, 'utf8'));
  decipher.setAuthTag(envelope.tag);
  const plaintext = Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return plaintext || null;
};

export const maskWalletDid = (value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length <= 12) return '***';
  return `${normalized.slice(0, 6)}...${normalized.slice(-6)}`;
};

export const maskPhoneNumber = (value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, '');
  if (!digits) return '***';
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : '***';
};

export const sensitiveEncryptionPolicySnapshot = (): {
  encryptionConfigured: boolean;
  enforcementActive: boolean;
} => ({
  encryptionConfigured: Boolean(buildKey()),
  enforcementActive: shouldEnforceEncryption(),
});
