import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';

export type AuditDomain = 'auth' | 'profile' | 'social';
export type AuditOutcome = 'success' | 'deny' | 'error';

interface AuditEventInput {
  domain: AuditDomain;
  action: string;
  outcome: AuditOutcome;
  actorUserId?: string | null;
  targetUserId?: string | null;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

interface AuditEventRecord {
  at: string;
  domain: AuditDomain;
  action: string;
  outcome: AuditOutcome;
  actorUserId: string | null;
  targetUserId: string | null;
  statusCode: number | null;
  request: {
    method: string;
    path: string;
    ipHash: string | null;
    origin: string | null;
    userAgentHash: string | null;
    requestId: string | null;
  };
  metadata?: Record<string, unknown>;
}

const DEFAULT_AUDIT_LOG_FILE = path.resolve(__dirname, '../../data/audit-events.log');
const MAX_METADATA_DEPTH = 4;
const MAX_ARRAY_LENGTH = 30;
const MAX_STRING_LENGTH = 1024;
const SENSITIVE_KEY_PATTERN =
  /(password|token|otp|secret|phone|wallet|email|signature|publickey|authorization)/i;

const trimEnv = (name: string): string => String(process.env[name] || '').trim();

const getHashKey = (): string => {
  const fromEnv = trimEnv('AUDIT_HASH_KEY');
  if (fromEnv) return fromEnv;
  const authKey = trimEnv('AUTH_TOKEN_SECRET') || trimEnv('SESSION_SECRET');
  if (authKey) return authKey;
  return 'audit-dev-fallback';
};

const hashValue = (value: string): string => {
  return crypto
    .createHmac('sha256', getHashKey())
    .update(value)
    .digest('hex')
    .slice(0, 24);
};

const redactUnknown = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_METADATA_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}[TRUNCATED]`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((entry) => redactUnknown(entry, depth + 1));
  }
  if (typeof value !== 'object') return '[UNSUPPORTED]';

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = redactUnknown(entry, depth + 1);
  }
  return output;
};

const getRequestIp = (req: Request): string | null => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwarded =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : Array.isArray(forwardedFor)
      ? forwardedFor[0]?.split(',')[0]?.trim()
      : '';
  const ip = forwarded || req.ip || req.socket.remoteAddress || '';
  return ip.trim() || null;
};

const toAuditRecord = (req: Request, input: AuditEventInput): AuditEventRecord => {
  const ip = getRequestIp(req);
  const userAgent = String(req.headers['user-agent'] || '').trim();
  const requestId = String(req.headers['x-request-id'] || '').trim() || null;

  return {
    at: new Date().toISOString(),
    domain: input.domain,
    action: input.action,
    outcome: input.outcome,
    actorUserId: input.actorUserId || null,
    targetUserId: input.targetUserId || null,
    statusCode:
      typeof input.statusCode === 'number' && Number.isFinite(input.statusCode)
        ? input.statusCode
        : null,
    request: {
      method: req.method,
      path: req.path,
      ipHash: ip ? hashValue(ip) : null,
      origin: String(req.headers.origin || '').trim() || null,
      userAgentHash: userAgent ? hashValue(userAgent) : null,
      requestId,
    },
    ...(input.metadata ? { metadata: redactUnknown(input.metadata) as Record<string, unknown> } : {}),
  };
};

const shouldWriteAuditFile = (): boolean =>
  trimEnv('AUDIT_LOG_STDOUT_ONLY').toLowerCase() !== 'true';

const resolveAuditLogFile = (): string => trimEnv('AUDIT_LOG_FILE') || DEFAULT_AUDIT_LOG_FILE;

const appendAuditLine = (line: string): void => {
  if (!shouldWriteAuditFile()) return;
  const filePath = resolveAuditLogFile();
  try {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[AUDIT][WARN] Failed to persist audit event', error);
  }
};

export const recordAuditEvent = (req: Request, input: AuditEventInput): void => {
  try {
    const event = toAuditRecord(req, input);
    const line = JSON.stringify(event);
    console.info('[AUDIT]', line);
    appendAuditLine(line);
  } catch (error) {
    console.error('[AUDIT][WARN] Failed to emit audit event', error);
  }
};
