import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';

type UploadStorageProvider = 'postgres_large_object';
export type UploadObjectAccess = 'public' | 'private';

interface PostgresUploadKeyPayload {
  v: 1 | 2 | 3;
  oid: number;
  mimeType: string;
  originalName?: string;
  userId?: string;
  access?: UploadObjectAccess;
  category?: string;
  sig?: string;
  signed?: boolean;
}

export interface PersistedUploadObject {
  objectKey: string;
  storageProvider: UploadStorageProvider;
  publicPath: string;
  mimeType: string;
  sizeBytes: number;
  access: UploadObjectAccess;
  category: string | null;
}

export interface ResolvedUploadObject {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadObjectAccessMetadata {
  objectKey: string;
  storageProvider: UploadStorageProvider;
  access: UploadObjectAccess | 'legacy';
  ownerUserId: string | null;
  category: string | null;
  isLegacy: boolean;
}

const toStoreError = (message: string, cause?: unknown): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string; cause?: unknown };
  error.code = 'STORE_UNAVAILABLE';
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

const sanitizeOriginalName = (input: string): string => {
  const normalized = path.basename(String(input || '').trim()).replace(/[^\w.\-]/g, '_');
  return normalized || 'upload.bin';
};

const sanitizeOptionalText = (input: unknown): string | undefined => {
  const normalized = String(input || '').trim();
  return normalized || undefined;
};

const normalizeUploadAccess = (input: unknown): UploadObjectAccess | null => {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'public' || normalized === 'private') return normalized;
  return null;
};

const isProductionLikeRuntime = (): boolean => {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const persistenceBackend = String(process.env.AUTH_PERSISTENCE_BACKEND || '').trim().toLowerCase();
  return nodeEnv === 'production' || persistenceBackend === 'shared_db';
};

const resolveUploadKeySecret = (): string => {
  const dedicatedSecret = String(process.env.UPLOAD_OBJECT_KEY_SECRET || '').trim();
  if (dedicatedSecret) return dedicatedSecret;

  if (isProductionLikeRuntime()) {
    throw toStoreError(
      '[UPLOAD][FATAL] UPLOAD_OBJECT_KEY_SECRET is required for production/shared upload object keys'
    );
  }

  const devFallback =
    String(process.env.SENSITIVE_DATA_KEY || '').trim() ||
    String(process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || '').trim();
  if (!devFallback) {
    throw toStoreError('[UPLOAD][FATAL] Upload object key secret is not configured');
  }
  return devFallback;
};

const deriveUploadEncryptionKey = (): Buffer =>
  crypto.createHash('sha256').update(`hcn-upload-object-key:${resolveUploadKeySecret()}`, 'utf8').digest();

const timingSafeEqualText = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildUploadKeySignaturePayload = (
  payload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'>
): string =>
  JSON.stringify({
    v: payload.v,
    oid: payload.oid,
    mimeType: payload.mimeType,
    originalName: payload.originalName,
    userId: payload.userId || null,
    access: payload.access || null,
    category: payload.category || null,
  });

const signUploadKeyPayloadWithSecret = (
  payload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'>,
  secret: string
): string =>
  crypto
    .createHmac('sha256', secret)
    .update(buildUploadKeySignaturePayload(payload), 'utf8')
    .digest('base64url');

const signUploadKeyPayload = (payload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'>): string =>
  signUploadKeyPayloadWithSecret(payload, resolveUploadKeySecret());

const resolveLegacyUploadKeySecrets = (): string[] =>
  String(process.env.UPLOAD_LEGACY_OBJECT_KEY_SECRET || '')
    .split(',')
    .map((secret) => secret.trim())
    .filter(Boolean);

const UPLOAD_KEY_V3_PREFIX = 'pglo3';

const encodeEncryptedUploadKey = (
  payload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed' | 'originalName'>
): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveUploadEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify({
        v: 3,
        oid: Math.floor(Number(payload.oid)),
        mimeType: String(payload.mimeType || '').trim(),
        userId: sanitizeOptionalText(payload.userId),
        access: normalizeUploadAccess(payload.access) || undefined,
        category: sanitizeOptionalText(payload.category),
      }),
      'utf8'
    ),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    UPLOAD_KEY_V3_PREFIX,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.');
};

const decodeEncryptedUploadKey = (objectKey: string): PostgresUploadKeyPayload | null => {
  const parts = String(objectKey || '').split('.');
  if (parts.length !== 4 || parts[0] !== UPLOAD_KEY_V3_PREFIX) return null;

  try {
    const [, ivRaw, encryptedRaw, authTagRaw] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveUploadEncryptionKey(),
      Buffer.from(ivRaw, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<PostgresUploadKeyPayload>;
    if (
      parsed?.v !== 3 ||
      !Number.isFinite(parsed.oid) ||
      Number(parsed.oid) <= 0 ||
      typeof parsed.mimeType !== 'string' ||
      parsed.mimeType.trim().length === 0
    ) {
      return null;
    }
    return {
      v: 3,
      oid: Math.floor(Number(parsed.oid)),
      mimeType: parsed.mimeType.trim(),
      originalName: 'upload.bin',
      userId: sanitizeOptionalText(parsed.userId),
      access: normalizeUploadAccess(parsed.access) || undefined,
      category: sanitizeOptionalText(parsed.category),
      signed: true,
    };
  } catch {
    return null;
  }
};

const encodePostgresUploadKey = (payload: PostgresUploadKeyPayload): string => {
  const normalizedPayload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'> = {
    v: 3,
    oid: Math.floor(Number(payload.oid)),
    mimeType: String(payload.mimeType || '').trim(),
    originalName: sanitizeOriginalName(payload.originalName || ''),
    userId: sanitizeOptionalText(payload.userId),
    access: normalizeUploadAccess(payload.access) || undefined,
    category: sanitizeOptionalText(payload.category),
  };
  return encodeEncryptedUploadKey({
    v: 3,
    oid: normalizedPayload.oid,
    mimeType: normalizedPayload.mimeType,
    userId: normalizedPayload.userId,
    access: normalizedPayload.access,
    category: normalizedPayload.category,
  });
};

const decodePostgresUploadKey = (objectKey: string): PostgresUploadKeyPayload | null => {
  if (String(objectKey || '').startsWith(`${UPLOAD_KEY_V3_PREFIX}.`)) {
    return decodeEncryptedUploadKey(objectKey);
  }

  try {
    const decoded = Buffer.from(objectKey, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<PostgresUploadKeyPayload>;
    if (
      (parsed?.v !== 1 && parsed?.v !== 2) ||
      !Number.isFinite(parsed.oid) ||
      Number(parsed.oid) <= 0 ||
      typeof parsed.mimeType !== 'string' ||
      parsed.mimeType.trim().length === 0 ||
      typeof parsed.originalName !== 'string' ||
      parsed.originalName.trim().length === 0
    ) {
      return null;
    }
    const normalized: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'> = {
      v: parsed.v,
      oid: Math.floor(Number(parsed.oid)),
      mimeType: parsed.mimeType.trim(),
      originalName: sanitizeOriginalName(parsed.originalName),
      userId: sanitizeOptionalText(parsed.userId),
      access: normalizeUploadAccess(parsed.access) || undefined,
      category: sanitizeOptionalText(parsed.category),
    };

    if (normalized.v === 2) {
      const signature = String(parsed.sig || '').trim();
      if (!signature) return null;
      const currentExpected = signUploadKeyPayload(normalized);
      const legacyMatch = resolveLegacyUploadKeySecrets().some((secret) =>
        timingSafeEqualText(signature, signUploadKeyPayloadWithSecret(normalized, secret))
      );
      if (!timingSafeEqualText(signature, currentExpected) && !legacyMatch) return null;
      return {
        ...normalized,
        sig: signature,
        signed: true,
      };
    }

    return {
      ...normalized,
      signed: false,
    };
  } catch {
    return null;
  }
};

const isLegacyPublicObjectAccessAllowed = (): boolean =>
  String(process.env.UPLOAD_ALLOW_LEGACY_PUBLIC_OBJECTS || '').trim().toLowerCase() === 'true';

const getUploadObjectPath = (access: UploadObjectAccess, objectKey: string): string =>
  `${access === 'public' ? '/uploads/object' : '/api/upload/object'}/${objectKey}`;

export const getUploadObjectAccessMetadata = (
  objectKey: string
): UploadObjectAccessMetadata | null => {
  const parsedKey = decodePostgresUploadKey(objectKey);
  if (!parsedKey) return null;
  const access = parsedKey.signed ? parsedKey.access || 'private' : 'legacy';
  return {
    objectKey,
    storageProvider: 'postgres_large_object',
    access,
    ownerUserId: parsedKey.userId || null,
    category: parsedKey.category || null,
    isLegacy: !parsedKey.signed,
  };
};

export const isUploadObjectPubliclyReadable = (objectKey: string): boolean => {
  const metadata = getUploadObjectAccessMetadata(objectKey);
  if (!metadata) return false;
  if (metadata.access === 'public') return true;
  return metadata.access === 'legacy' && isLegacyPublicObjectAccessAllowed();
};

const ensurePrisma = (): PrismaClient => {
  return getPrisma();
};

const persistPostgresLargeObjectUpload = async (input: {
  userId: string;
  mimeType: string;
  originalName: string;
  buffer: Buffer;
  access: UploadObjectAccess;
  category?: string | null;
}): Promise<PersistedUploadObject> => {
  try {
    const rows = await ensurePrisma().$queryRaw<Array<{ oid: bigint | number }>>`
      SELECT lo_from_bytea(0, ${input.buffer}) AS oid
    `;
    const rawOid = rows[0]?.oid;
    const oid = typeof rawOid === 'bigint' ? Number(rawOid) : Number(rawOid);
    if (!Number.isFinite(oid) || oid <= 0) {
      throw new Error('invalid_large_object_id');
    }

    const objectKey = encodePostgresUploadKey({
      v: 2,
      oid: Math.floor(oid),
      mimeType: input.mimeType,
      originalName: sanitizeOriginalName(input.originalName),
      userId: input.access === 'private' ? sanitizeOptionalText(input.userId) : undefined,
      access: input.access,
      category: sanitizeOptionalText(input.category),
    });

    return {
      objectKey,
      storageProvider: 'postgres_large_object',
      publicPath: getUploadObjectPath(input.access, objectKey),
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      access: input.access,
      category: sanitizeOptionalText(input.category) || null,
    };
  } catch (error) {
    throw toStoreError('[UPLOAD][FATAL] Failed to persist upload blob', error);
  }
};

export const persistUploadObject = async (input: {
  userId: string;
  mimeType: string;
  originalName: string;
  buffer: Buffer;
  access?: UploadObjectAccess;
  category?: string | null;
}): Promise<PersistedUploadObject> => {
  return persistPostgresLargeObjectUpload({
    ...input,
    access: normalizeUploadAccess(input.access) || 'private',
  });
};

export const resolveUploadObjectByKey = async (
  objectKey: string
): Promise<ResolvedUploadObject | null> => {
  const parsedKey = decodePostgresUploadKey(objectKey);
  if (!parsedKey) {
    return null;
  }

  try {
    const rows = await ensurePrisma().$queryRaw<Array<{ data: Buffer | Uint8Array | null }>>`
      SELECT lo_get(${parsedKey.oid}) AS data
    `;
    const rawData = rows[0]?.data;
    if (!rawData) return null;
    const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
    return {
      buffer,
      mimeType: parsedKey.mimeType || 'application/octet-stream',
      sizeBytes: buffer.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      message.includes('does not exist') ||
      message.includes('large object') ||
      message.includes('invalid input syntax')
    ) {
      return null;
    }
    throw toStoreError('[UPLOAD][FATAL] Failed to read upload blob', error);
  }
};

export const deleteUploadObjectByKey = async (objectKey: string): Promise<boolean> => {
  const parsedKey = decodePostgresUploadKey(objectKey);
  if (!parsedKey) {
    return false;
  }

  try {
    const rows = await ensurePrisma().$queryRaw<Array<{ unlinked: number | boolean | null }>>`
      SELECT lo_unlink(${parsedKey.oid}) AS unlinked
    `;
    const raw = rows[0]?.unlinked;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw > 0;
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      message.includes('does not exist') ||
      message.includes('large object') ||
      message.includes('invalid input syntax')
    ) {
      return false;
    }
    throw toStoreError('[UPLOAD][FATAL] Failed to delete upload blob', error);
  }
};
