import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';

type UploadStorageProvider = 'postgres_large_object';
export type UploadObjectAccess = 'public' | 'private';

interface PostgresUploadKeyPayload {
  v: 1 | 2;
  oid: number;
  mimeType: string;
  originalName: string;
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

const resolveUploadKeySecret = (): string => {
  const secret =
    String(process.env.UPLOAD_OBJECT_KEY_SECRET || '').trim() ||
    String(process.env.SENSITIVE_DATA_KEY || '').trim() ||
    String(process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || '').trim();
  if (!secret) {
    throw toStoreError('[UPLOAD][FATAL] Upload object key signing secret is not configured');
  }
  return secret;
};

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

const signUploadKeyPayload = (payload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'>): string =>
  crypto
    .createHmac('sha256', resolveUploadKeySecret())
    .update(buildUploadKeySignaturePayload(payload), 'utf8')
    .digest('base64url');

const encodePostgresUploadKey = (payload: PostgresUploadKeyPayload): string => {
  const normalizedPayload: Omit<PostgresUploadKeyPayload, 'sig' | 'signed'> = {
    v: 2,
    oid: Math.floor(Number(payload.oid)),
    mimeType: String(payload.mimeType || '').trim(),
    originalName: sanitizeOriginalName(payload.originalName),
    userId: sanitizeOptionalText(payload.userId),
    access: normalizeUploadAccess(payload.access) || undefined,
    category: sanitizeOptionalText(payload.category),
  };
  return Buffer.from(
    JSON.stringify({
      ...normalizedPayload,
      sig: signUploadKeyPayload(normalizedPayload),
    }),
    'utf8'
  ).toString('base64url');
};

const decodePostgresUploadKey = (objectKey: string): PostgresUploadKeyPayload | null => {
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
      const expected = signUploadKeyPayload(normalized);
      if (!timingSafeEqualText(signature, expected)) return null;
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
