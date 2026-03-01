import path from 'path';
import { PrismaClient } from '@prisma/client';

type UploadStorageProvider = 'postgres_large_object';

interface PostgresUploadKeyPayload {
  v: 1;
  oid: number;
  mimeType: string;
  originalName: string;
}

export interface PersistedUploadObject {
  objectKey: string;
  storageProvider: UploadStorageProvider;
  publicPath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ResolvedUploadObject {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

let prisma: PrismaClient | null = null;

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
    };
  } catch {
    return null;
  }
};

const ensurePrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};

const persistPostgresLargeObjectUpload = async (input: {
  mimeType: string;
  originalName: string;
  buffer: Buffer;
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
    });

    return {
      objectKey,
      storageProvider: 'postgres_large_object',
      publicPath: `/uploads/object/${objectKey}`,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
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
}): Promise<PersistedUploadObject> => {
  return persistPostgresLargeObjectUpload(input);
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
