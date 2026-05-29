import { UserProfile } from '../types';

export const AUTH_TOKEN_KEY = 'hcn_auth_token';
const LEGACY_EXTERNAL_AUTH_TOKEN_KEY = 'auth_token';
export const ACTIVE_USER_CACHE_KEY = 'hcn_active_user';
export const PLATFORM_SESSION_KEY = 'hcn_platform_session';
export const PROVIDER_SESSION_TOKEN_KEY = 'hcn_provider_session_token';
export const PROVIDER_SESSION_TOKEN_EVENT = 'hcn:provider-session-token-updated';
export const ADMIN_ELEVATION_TOKEN_KEY = 'hcn_admin_elevation_token';

type PlatformSessionRole = 'guest' | 'user' | 'applicant' | 'provider' | 'admin';
type PlatformSessionTier = 'free' | 'guided' | 'accelerated';

interface PlatformSessionState {
  isAuthenticated: boolean;
  role: PlatformSessionRole;
  tier?: PlatformSessionTier;
  permissions: string[];
}

interface SessionTokenPayload {
  userId?: string;
  sub?: string;
  email?: string;
  role?: string;
  walletAddress?: string;
  walletDid?: string;
  sessionId?: string;
  issuedAt?: number;
  expiresAt?: number;
  iat?: number;
  exp?: number;
}

const hasBrowserStorage = (): boolean => typeof window !== 'undefined';
const hasBrowserLocalStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;
const hasBrowserSessionStorage = (): boolean =>
  typeof window !== 'undefined' && !!window.sessionStorage;

const normalizePlatformTier = (tier?: string | null): PlatformSessionTier => {
  const normalized = String(tier || '').trim().toLowerCase();
  if (normalized.includes('accelerated')) return 'accelerated';
  if (normalized.includes('guided')) return 'guided';
  return 'free';
};

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

export const parseAuthTokenPayload = (token: string): SessionTokenPayload | null => {
  if (!token || typeof token !== 'string') return null;
  const segments = token.split('.');
  const payloadSegment = segments.length === 3 ? segments[1] : segments[0];
  if (!payloadSegment) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadSegment)) as SessionTokenPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const isExpiredToken = (token: string, skewMs = 5000): boolean => {
  const payload = parseAuthTokenPayload(token);
  if (!payload) return true;
  if (Number.isFinite(payload.expiresAt)) {
    return Number(payload.expiresAt) <= Date.now() + Math.max(0, skewMs);
  }
  if (Number.isFinite(payload.exp)) {
    return Number(payload.exp) * 1000 <= Date.now() + Math.max(0, skewMs);
  }
  return true;
};

const getStoredTokenCandidates = (): string[] => {
  if (!hasBrowserSessionStorage()) return [];
  return [AUTH_TOKEN_KEY]
    .map((key) => window.sessionStorage.getItem(key))
    .filter((token): token is string => Boolean(token));
};

export const getAuthToken = (): string | null => {
  if (!hasBrowserStorage()) return null;

  for (const token of getStoredTokenCandidates()) {
    if (!isExpiredToken(token)) {
      return token;
    }
  }

  clearAuthSession();
  return null;
};

const writePlatformSession = (session: PlatformSessionState): void => {
  if (!hasBrowserSessionStorage()) return;
  window.sessionStorage.setItem(PLATFORM_SESSION_KEY, JSON.stringify(session));
  if (hasBrowserLocalStorage()) {
    window.localStorage.removeItem(PLATFORM_SESSION_KEY);
  }
};

export const setGuestSession = (): void => {
  if (!hasBrowserStorage()) return;
  if (hasBrowserSessionStorage()) {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    window.sessionStorage.removeItem(PLATFORM_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_ELEVATION_TOKEN_KEY);
  }
  if (hasBrowserLocalStorage()) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_EXTERNAL_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    window.localStorage.removeItem(PLATFORM_SESSION_KEY);
  }
  setProviderControlSession('');
  writePlatformSession({
    isAuthenticated: false,
    role: 'guest',
    permissions: [],
  });
};

export const setUserAuthSession = (token: string, user?: UserProfile | null): void => {
  if (!hasBrowserSessionStorage()) return;
  const platformUser = user ? { ...user, role: user.role || 'user' } : null;
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  if (platformUser) {
    window.sessionStorage.setItem(ACTIVE_USER_CACHE_KEY, JSON.stringify(platformUser));
  } else {
    window.sessionStorage.removeItem(ACTIVE_USER_CACHE_KEY);
  }
  if (hasBrowserLocalStorage()) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_EXTERNAL_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    window.localStorage.removeItem(PLATFORM_SESSION_KEY);
  }
  const role: PlatformSessionRole =
    platformUser?.role === 'admin'
      ? 'admin'
      : platformUser?.role === 'applicant'
        ? 'applicant'
        : platformUser?.role === 'provider'
          ? 'provider'
          : 'user';
  writePlatformSession({
    isAuthenticated: true,
    role,
    tier: normalizePlatformTier(platformUser?.tier),
    permissions:
      platformUser?.role === 'admin'
        ? ['admin:dashboard', 'provider:portal']
        : platformUser?.role === 'provider'
          ? ['provider:portal']
          : [],
  });
};

export const setProviderControlSession = (token: string): void => {
  if (typeof window === 'undefined') return;
  const normalized = String(token || '').trim();
  if (hasBrowserSessionStorage()) {
    if (normalized) {
      window.sessionStorage.setItem(PROVIDER_SESSION_TOKEN_KEY, normalized);
    } else {
      window.sessionStorage.removeItem(PROVIDER_SESSION_TOKEN_KEY);
    }
  }
  window.dispatchEvent(
    new CustomEvent(PROVIDER_SESSION_TOKEN_EVENT, {
      detail: { token: normalized },
    })
  );
};

export const getProviderControlSession = (): string | null => {
  if (!hasBrowserSessionStorage()) return null;
  const token = String(window.sessionStorage.getItem(PROVIDER_SESSION_TOKEN_KEY) || '').trim();
  return token || null;
};

export const clearAuthSession = (): void => {
  if (!hasBrowserStorage()) return;
  if (hasBrowserSessionStorage()) {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    window.sessionStorage.removeItem(PLATFORM_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_ELEVATION_TOKEN_KEY);
  }
  if (hasBrowserLocalStorage()) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_EXTERNAL_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    window.localStorage.removeItem(PLATFORM_SESSION_KEY);
  }
  setProviderControlSession('');
};

export const setAdminElevationToken = (token: string): void => {
  if (!hasBrowserSessionStorage()) return;
  const normalized = String(token || '').trim();
  if (normalized) {
    window.sessionStorage.setItem(ADMIN_ELEVATION_TOKEN_KEY, normalized);
  } else {
    window.sessionStorage.removeItem(ADMIN_ELEVATION_TOKEN_KEY);
  }
};

export const getAdminElevationToken = (): string | null => {
  if (!hasBrowserSessionStorage()) return null;
  const token = String(window.sessionStorage.getItem(ADMIN_ELEVATION_TOKEN_KEY) || '').trim();
  return token || null;
};

export const getCachedAuthUser = (): UserProfile | null => {
  if (!hasBrowserSessionStorage()) return null;
  const token = getAuthToken();
  if (!token) return null;

  try {
    const cached = JSON.parse(window.sessionStorage.getItem(ACTIVE_USER_CACHE_KEY) || 'null') as
      | UserProfile
      | null;
    return cached?.id ? cached : null;
  } catch {
    return null;
  }
};

export const buildAuthHeaders = (
  initHeaders: Record<string, string> = {}
): Record<string, string> => {
  const headers = { ...initHeaders };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};
