import { UserProfile } from '../types';

export const AUTH_TOKEN_KEY = 'hcn_auth_token';
export const ACTIVE_USER_CACHE_KEY = 'hcn_active_user';

const hasBrowserStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

export const getAuthToken = (): string | null => {
  if (!hasBrowserStorage()) return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
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
