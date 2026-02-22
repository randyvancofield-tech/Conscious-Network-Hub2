import { UserProfile } from '../types';

export const AUTH_TOKEN_KEY = 'hcn_auth_token';
export const ACTIVE_USER_CACHE_KEY = 'hcn_active_user';

interface SessionTokenPayload {
  userId: string;
  sessionId?: string;
  issuedAt: number;
  expiresAt: number;
}

const hasBrowserStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
};

const parseSessionTokenPayload = (token: string): SessionTokenPayload | null => {
  if (!token || typeof token !== 'string') return null;
  const [payloadSegment] = token.split('.');
  if (!payloadSegment) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadSegment)) as SessionTokenPayload;
    if (!parsed?.userId || !Number.isFinite(parsed.expiresAt)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const isExpiredToken = (token: string, skewMs = 5000): boolean => {
  const payload = parseSessionTokenPayload(token);
  if (!payload) return true;
  return payload.expiresAt <= Date.now() + Math.max(0, skewMs);
};

export const getAuthToken = (): string | null => {
  if (!hasBrowserStorage()) return null;
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  if (isExpiredToken(token)) {
    clearAuthSession();
    return null;
  }

  return token;
};

export const setAuthSession = (token: string, user?: UserProfile | null): void => {
  if (!hasBrowserStorage()) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(ACTIVE_USER_CACHE_KEY, JSON.stringify(user));
  }
};

export const clearAuthSession = (): void => {
  if (!hasBrowserStorage()) return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ACTIVE_USER_CACHE_KEY);
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
