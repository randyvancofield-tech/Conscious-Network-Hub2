import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

type EnvSource = 'process' | string;

const TRACKED_KEYS = [
  'DATABASE_URL',
  'DATABASE_POOL_MODE',
  'AUTH_PERSISTENCE_BACKEND',
  'NODE_ENV',
  'PORT',
] as const;

const sourceByKey = new Map<string, EnvSource>();
let loaded = false;

const serverRoot = (): string => path.resolve(__dirname, '..');

const toDisplayPath = (filePath: string): string =>
  path.relative(process.cwd(), filePath).replace(/\\/g, '/') || filePath;

const recordOriginalProcessSources = (originalKeys: Set<string>): void => {
  for (const key of TRACKED_KEYS) {
    if (originalKeys.has(key)) {
      sourceByKey.set(key, 'process');
    }
  }
};

const processEnvShouldWin = (key: string, originalKeys: Set<string>): boolean => {
  if (!originalKeys.has(key)) return false;
  const originalNodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (originalNodeEnv === 'production' || originalNodeEnv === 'test') return true;
  return ['true', '1', 'yes', 'on'].includes(
    String(process.env.CNH_ENV_PROCESS_PRECEDENCE || '').trim().toLowerCase()
  );
};

const loadEnvFile = (filePath: string, originalKeys: Set<string>): void => {
  if (!fs.existsSync(filePath)) return;

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  const displayPath = toDisplayPath(filePath);
  for (const [key, value] of Object.entries(parsed)) {
    if (processEnvShouldWin(key, originalKeys)) {
      continue;
    }
    process.env[key] = value;
    sourceByKey.set(key, displayPath);
  }
};

export const loadServerEnv = (): void => {
  if (loaded) return;
  loaded = true;

  const originalKeys = new Set(Object.keys(process.env));
  recordOriginalProcessSources(originalKeys);

  const root = serverRoot();
  loadEnvFile(path.resolve(root, '.env'), originalKeys);
  loadEnvFile(path.resolve(root, '.env.local'), originalKeys);
};

const parseDatabaseUrl = (
  value: string
):
  | {
      protocol: string;
      host: string;
      database: string;
      usesPooler: boolean;
      hasSslMode: boolean;
      parseable: true;
    }
  | { parseable: false } => {
  try {
    const parsed = new URL(value);
    return {
      protocol: parsed.protocol.replace(/:$/, ''),
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, ''),
      usesPooler: parsed.hostname.toLowerCase().includes('pooler'),
      hasSslMode: parsed.searchParams.has('sslmode'),
      parseable: true,
    };
  } catch {
    return { parseable: false };
  }
};

export const getServerEnvDiagnostics = (): Record<string, unknown> => {
  loadServerEnv();

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const parsedDatabase = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;
  return {
    databaseUrlSource: sourceByKey.get('DATABASE_URL') || 'missing',
    database:
      parsedDatabase && parsedDatabase.parseable
        ? {
            protocol: parsedDatabase.protocol,
            host: parsedDatabase.host,
            database: parsedDatabase.database,
            usesPooler: parsedDatabase.usesPooler,
            hasSslMode: parsedDatabase.hasSslMode,
          }
        : { configured: Boolean(databaseUrl), parseable: false },
    authPersistenceBackend: process.env.AUTH_PERSISTENCE_BACKEND || null,
    databasePoolMode: process.env.DATABASE_POOL_MODE || null,
    nodeEnv: process.env.NODE_ENV || null,
    port: process.env.PORT || null,
  };
};

export const logServerEnvDiagnostics = (label = 'STARTUP'): void => {
  console.log(`[${label}] Database environment resolved:`, JSON.stringify(getServerEnvDiagnostics()));
};
