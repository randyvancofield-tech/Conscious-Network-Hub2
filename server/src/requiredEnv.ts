const hasNonEmptyEnv = (name: string): boolean => {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
};

const trimEnv = (name: string): string | null => {
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isPostgresUrl = (value: string): boolean => /^postgres(?:ql)?:\/\//i.test(value.trim());

// Required high-risk secrets/environment variables for backend startup.
// - AUTH_TOKEN_SECRET (or legacy SESSION_SECRET alias)
// - DATABASE_URL
// - SENSITIVE_DATA_KEY (required for production/shared_db)
export const REQUIRED_SECRETS = [
  'AUTH_TOKEN_SECRET (or SESSION_SECRET)',
  'DATABASE_URL',
  'SENSITIVE_DATA_KEY (production/shared_db)',
] as const;

const hasSensitiveDataKey = (): boolean => hasNonEmptyEnv('SENSITIVE_DATA_KEY');

export const resolveAuthTokenSecret = (): string => {
  const primary = trimEnv('AUTH_TOKEN_SECRET');
  if (primary) return primary;

  const legacy = trimEnv('SESSION_SECRET');
  if (legacy) return legacy;

  throw new Error(
    '[STARTUP][FATAL] Missing required auth signing secret. Set AUTH_TOKEN_SECRET (preferred) or SESSION_SECRET.'
  );
};

export const validateRequiredEnv = (): void => {
  const missing: string[] = [];
  const databaseUrl = trimEnv('DATABASE_URL');
  const persistenceBackend = (trimEnv('AUTH_PERSISTENCE_BACKEND') || '').toLowerCase();
  const nodeEnv = (trimEnv('NODE_ENV') || '').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const requireSharedDbPersistence = isProduction;
  const sharedPersistenceLikely =
    persistenceBackend === 'shared_db' || Boolean(databaseUrl && isPostgresUrl(databaseUrl));
  const requiresSensitiveFieldEncryption =
    nodeEnv === 'production' || sharedPersistenceLikely;

  if (!hasNonEmptyEnv('AUTH_TOKEN_SECRET') && !hasNonEmptyEnv('SESSION_SECRET')) {
    missing.push('AUTH_TOKEN_SECRET (or SESSION_SECRET)');
  }

  if (!databaseUrl) {
    missing.push('DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `[STARTUP][FATAL] Missing required secrets/environment variables: ${missing.join(', ')}`
    );
  }

  if (requiresSensitiveFieldEncryption && !hasSensitiveDataKey()) {
    throw new Error(
      '[STARTUP][FATAL] Missing required SENSITIVE_DATA_KEY for production/shared_db sensitive-field encryption.'
    );
  }

  if (requireSharedDbPersistence && persistenceBackend !== 'shared_db') {
    throw new Error(
      '[STARTUP][FATAL] AUTH_PERSISTENCE_BACKEND must be set to shared_db.'
    );
  }

  if (!requireSharedDbPersistence && persistenceBackend !== 'shared_db') {
    console.warn(
      '[STARTUP][WARN] AUTH_PERSISTENCE_BACKEND is not set to shared_db. This is allowed in non-production only.'
    );
  }

  if (requireSharedDbPersistence && databaseUrl && !isPostgresUrl(databaseUrl)) {
    throw new Error(
      '[STARTUP][FATAL] Shared DB persistence requires DATABASE_URL to use postgres:// or postgresql://.'
    );
  }

  if (persistenceBackend === 'shared_db' && databaseUrl && !isPostgresUrl(databaseUrl)) {
    if (isProduction) {
      throw new Error(
        '[STARTUP][FATAL] AUTH_PERSISTENCE_BACKEND=shared_db requires DATABASE_URL to use postgres:// or postgresql://'
      );
    }
    console.warn(
      '[STARTUP][WARN] AUTH_PERSISTENCE_BACKEND=shared_db with non-postgres DATABASE_URL is allowed in non-production only.'
    );
  }
};

export const hasOpenAiApiKey = (): boolean => hasNonEmptyEnv('OPENAI_API_KEY');
