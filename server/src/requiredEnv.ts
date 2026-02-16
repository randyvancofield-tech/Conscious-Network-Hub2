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

// Required high-risk secrets/environment variables for backend startup.
// - AUTH_TOKEN_SECRET (or legacy SESSION_SECRET alias)
// - DATABASE_URL
// - OPENAI_API_KEY
export const REQUIRED_SECRETS = [
  'AUTH_TOKEN_SECRET (or SESSION_SECRET)',
  'DATABASE_URL',
  'OPENAI_API_KEY',
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

  if (!hasNonEmptyEnv('AUTH_TOKEN_SECRET') && !hasNonEmptyEnv('SESSION_SECRET')) {
    missing.push('AUTH_TOKEN_SECRET (or SESSION_SECRET)');
  }

  if (!hasNonEmptyEnv('DATABASE_URL')) {
    missing.push('DATABASE_URL');
  }

  if (!hasNonEmptyEnv('OPENAI_API_KEY')) {
    missing.push('OPENAI_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `[STARTUP][FATAL] Missing required secrets/environment variables: ${missing.join(', ')}`
    );
  }
};

