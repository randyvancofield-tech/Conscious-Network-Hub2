import path from 'path';
import { PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaClient';

type UploadStorageProvider = 'postgres_large_object';
export type UploadObjectAccess = 'public' | 'private';

interface PostgresUploadKeyPayload {
  v: 1;
  oid: number;
  mimeType: string;
  originalName: string;
  userId?: string;
  access?: UploadObjectAccess;
  category?: string;
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

const encodePostgresUploadKey = (payload: PostgresUploadKeyPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const decodePostgresUploadKey = (objectKey: string): PostgresUploadKeyPayload | null => {
  try {
    const decoded = Buffer.from(objectKey, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<PostgresUploadKeyPayload>;
    if (
      parsed?.v !== 1 ||
      !Number.isFinite(parsed.oid) ||
      Number(parsed.oid) <= 0 ||
      typeof parsed.mimeType !== 'string' ||
      parsed.mimeType.trim().length === 0 ||
      typeof parsed.originalName !== 'string' ||
      parsed.originalName.trim().length === 0
    ) {
      return null;
    }
    return {
      v: 1,
      oid: Math.floor(Number(parsed.oid)),
      mimeType: parsed.mimeType.trim(),
      originalName: sanitizeOriginalName(parsed.originalName),
      userId: sanitizeOptionalText(parsed.userId),
      access: normalizeUploadAccess(parsed.access) || undefined,
      category: sanitizeOptionalText(parsed.category),
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
  const access = parsedKey.access || 'legacy';
  return {
    objectKey,
    storageProvider: 'postgres_large_object',
    access,
    ownerUserId: parsedKey.userId || null,
    category: parsedKey.category || null,
    isLegacy: !parsedKey.access,
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
      v: 1,
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
