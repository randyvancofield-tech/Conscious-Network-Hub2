const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const TRACKED_KEYS = [
  'DATABASE_URL',
  'DATABASE_POOL_MODE',
  'AUTH_PERSISTENCE_BACKEND',
  'NODE_ENV',
  'PORT',
];

let loaded = false;
const sourceByKey = new Map();

const toDisplayPath = (filePath) =>
  path.relative(process.cwd(), filePath).replace(/\\/g, '/') || filePath;

const processEnvShouldWin = (key, originalKeys) => {
  if (!originalKeys.has(key)) return false;
  const originalNodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (originalNodeEnv === 'production' || originalNodeEnv === 'test') return true;
  return ['true', '1', 'yes', 'on'].includes(
    String(process.env.CNH_ENV_PROCESS_PRECEDENCE || '').trim().toLowerCase()
  );
};

const loadEnvFile = (filePath, originalKeys) => {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  const displayPath = toDisplayPath(filePath);
  for (const [key, value] of Object.entries(parsed)) {
    if (processEnvShouldWin(key, originalKeys)) continue;
    process.env[key] = value;
    sourceByKey.set(key, displayPath);
  }
};

const loadServerEnv = () => {
  if (loaded) return;
  loaded = true;

  const originalKeys = new Set(Object.keys(process.env));
  for (const key of TRACKED_KEYS) {
    if (originalKeys.has(key)) sourceByKey.set(key, 'process');
  }

  const serverRoot = path.resolve(__dirname, '..');
  loadEnvFile(path.resolve(serverRoot, '.env'), originalKeys);
  loadEnvFile(path.resolve(serverRoot, '.env.local'), originalKeys);
};

const parseDatabaseUrl = (value) => {
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

const getServerEnvDiagnostics = () => {
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

const logServerEnvDiagnostics = (label = 'SCRIPT') => {
  console.log(`[${label}] Database environment resolved:`, JSON.stringify(getServerEnvDiagnostics()));
};

module.exports = {
  getServerEnvDiagnostics,
  loadServerEnv,
  logServerEnvDiagnostics,
};
