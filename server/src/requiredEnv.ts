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

const parseDatabaseUrl = (value: string): URL | null => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

const isNeonDatabaseUrl = (value: string): boolean => {
  const parsed = parseDatabaseUrl(value);
  return Boolean(parsed?.hostname.toLowerCase().endsWith('.neon.tech'));
};

const isPooledDatabaseUrl = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  const parsed = parseDatabaseUrl(value);
  const host = parsed?.hostname.toLowerCase() || '';
  return (
    host.includes('pooler') ||
    host.includes('pgbouncer') ||
    normalized.includes('pgbouncer=true') ||
    normalized.includes('connection_limit=') ||
    normalized.includes('pool_timeout=')
  );
};

const resolveDatabasePoolMode = (): string | null => {
  const value = trimEnv('DATABASE_POOL_MODE');
  return value ? value.toLowerCase() : null;
};

// Required high-risk secrets/environment variables for backend startup.
// - AUTH_TOKEN_SECRET (or legacy SESSION_SECRET alias)
// - DATABASE_URL
// - SENSITIVE_DATA_KEY (required for production/shared_db)
export const REQUIRED_SECRETS = [
  'AUTH_TOKEN_SECRET (or SESSION_SECRET)',
  'DATABASE_URL',
  'SENSITIVE_DATA_KEY (production/shared_db)',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_FREE',
  'STRIPE_PRICE_GUIDED',
  'STRIPE_PRICE_ACCELERATED',
  'STRIPE_MODE',
  'STRIPE_SUCCESS_URL',
  'STRIPE_CANCEL_URL',
  'FRONTEND_BASE_URL',
] as const;

const hasSensitiveDataKey = (): boolean => hasNonEmptyEnv('SENSITIVE_DATA_KEY');
const hasEmailDeliveryConfig = (): boolean =>
  (hasNonEmptyEnv('EMAIL_USER') && hasNonEmptyEnv('EMAIL_PASSWORD')) ||
  (hasNonEmptyEnv('SMTP_HOST') && hasNonEmptyEnv('SMTP_PORT'));
const hasSmsDeliveryConfig = (): boolean =>
  hasNonEmptyEnv('TWILIO_ACCOUNT_SID') &&
  hasNonEmptyEnv('TWILIO_AUTH_TOKEN') &&
  hasNonEmptyEnv('TWILIO_FROM_NUMBER');

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
  const databasePoolMode = resolveDatabasePoolMode();
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

  if (!hasNonEmptyEnv('STRIPE_SECRET_KEY')) {
    missing.push('STRIPE_SECRET_KEY');
  }

  if (!hasNonEmptyEnv('STRIPE_WEBHOOK_SECRET')) {
    missing.push('STRIPE_WEBHOOK_SECRET');
  }

  if (!hasNonEmptyEnv('STRIPE_PRICE_FREE')) {
    missing.push('STRIPE_PRICE_FREE');
  }

  if (!hasNonEmptyEnv('STRIPE_PRICE_GUIDED')) {
    missing.push('STRIPE_PRICE_GUIDED');
  }

  if (!hasNonEmptyEnv('STRIPE_PRICE_ACCELERATED')) {
    missing.push('STRIPE_PRICE_ACCELERATED');
  }

  if (!hasNonEmptyEnv('STRIPE_MODE')) {
    missing.push('STRIPE_MODE');
  }

  if (!hasNonEmptyEnv('STRIPE_SUCCESS_URL')) {
    missing.push('STRIPE_SUCCESS_URL');
  }

  if (!hasNonEmptyEnv('STRIPE_CANCEL_URL')) {
    missing.push('STRIPE_CANCEL_URL');
  }

  if (!hasNonEmptyEnv('FRONTEND_BASE_URL')) {
    missing.push('FRONTEND_BASE_URL');
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

  const stripeMode = (trimEnv('STRIPE_MODE') || '').toLowerCase();
  if (isProduction && stripeMode !== 'live') {
    throw new Error('[STARTUP][FATAL] STRIPE_MODE must be set to live in production.');
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
    throw new Error(
      '[STARTUP][FATAL] AUTH_PERSISTENCE_BACKEND=shared_db requires DATABASE_URL to use postgres:// or postgresql://'
    );
  }

  if (databaseUrl && isPostgresUrl(databaseUrl)) {
    const targetsNeon = isNeonDatabaseUrl(databaseUrl);
    const usesPooledConnection = isPooledDatabaseUrl(databaseUrl);
    const hasSupportedPoolMode =
      databasePoolMode === 'session' || databasePoolMode === 'transaction';

    if ((isProduction || targetsNeon) && !usesPooledConnection) {
      const message =
        '[STARTUP][FATAL] DATABASE_URL must use the pooled Neon connection string for production/shared DB runtime.';
      if (isProduction) {
        throw new Error(message);
      }
      console.warn(message.replace('[FATAL]', '[WARN]'));
    }

    if ((isProduction || usesPooledConnection || targetsNeon) && !hasSupportedPoolMode) {
      const message =
        '[STARTUP][FATAL] DATABASE_POOL_MODE must be set to session or transaction to match the Neon pooler mode.';
      if (isProduction) {
        throw new Error(message);
      }
      console.warn(message.replace('[FATAL]', '[WARN]'));
    }
  }

  if (isProduction && !hasEmailDeliveryConfig()) {
    console.warn(
      '[STARTUP][WARN] Email delivery is not configured. Password reset email delivery is unavailable; normal sign-in is unaffected.'
    );
  }

};

export const hasOpenAiApiKey = (): boolean => hasNonEmptyEnv('OPENAI_API_KEY');

export const hasConfiguredAiProvider = (): boolean =>
  hasOpenAiApiKey() ||
  hasNonEmptyEnv('OPENROUTER_API_KEY') ||
  hasNonEmptyEnv('GROQ_API_KEY') ||
  (trimEnv('AI_LOCAL_FALLBACK_ENABLED') || 'true').toLowerCase() !== 'false' ||
  (trimEnv('AI_ENABLE_OLLAMA') || 'true').toLowerCase() !== 'false';

export const logStripeEnvironmentLoaded = (): void => {
  const requiredStripeKeys = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_FREE',
    'STRIPE_PRICE_GUIDED',
    'STRIPE_PRICE_ACCELERATED',
    'STRIPE_MODE',
    'STRIPE_SUCCESS_URL',
    'STRIPE_CANCEL_URL',
    'FRONTEND_BASE_URL',
  ] as const;
  const maskedStatus = requiredStripeKeys.reduce<Record<string, string>>((acc, key) => {
    acc[key] = hasNonEmptyEnv(key) ? 'present' : 'missing';
    return acc;
  }, {});

  console.log('[STARTUP] Stripe environment loaded: OK', JSON.stringify(maskedStatus));
};

export const logDeliveryEnvironmentLoaded = (): void => {
  console.log(
    '[STARTUP] Security delivery environment loaded:',
    JSON.stringify({
      email: hasEmailDeliveryConfig() ? 'present' : 'missing',
      legacySms: hasSmsDeliveryConfig() ? 'present' : 'optional_missing',
    })
  );
};
