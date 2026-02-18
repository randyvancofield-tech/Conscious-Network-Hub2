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
const isFileUrl = (value: string): boolean => /^file:/i.test(value.trim());

// Required high-risk secrets/environment variables for backend startup.
// - AUTH_TOKEN_SECRET (or legacy SESSION_SECRET alias)
// - DATABASE_URL
export const REQUIRED_SECRETS = [
  'AUTH_TOKEN_SECRET (or SESSION_SECRET)',
  'DATABASE_URL',
] as const;

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

  if (persistenceBackend === 'shared_db' && databaseUrl && !isPostgresUrl(databaseUrl)) {
    throw new Error(
      '[STARTUP][FATAL] AUTH_PERSISTENCE_BACKEND=shared_db requires DATABASE_URL to use postgres:// or postgresql://'
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    databaseUrl &&
    isFileUrl(databaseUrl) &&
    persistenceBackend !== 'local_file'
  ) {
    throw new Error(
      '[STARTUP][FATAL] Production DATABASE_URL uses file: storage. Configure shared Postgres persistence or set AUTH_PERSISTENCE_BACKEND=local_file for temporary recovery.'
    );
  }
};

export const hasOpenAiApiKey = (): boolean => hasNonEmptyEnv('OPENAI_API_KEY');
