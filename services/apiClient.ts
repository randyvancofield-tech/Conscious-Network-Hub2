import { getAuthToken } from './sessionService';

const PRODUCTION_BACKEND_FALLBACK_URL = 'https://conscious-network-backend.onrender.com';
const LOCAL_BACKEND_URL_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;
const LOCAL_BROWSER_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const PRODUCTION_FRONTEND_HOSTNAMES = new Set(['conscious-network.org', 'www.conscious-network.org']);

const configuredBaseUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();
const currentBrowserHostname =
  typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : '';
const isLocalBrowserHostname = LOCAL_BROWSER_HOSTNAMES.has(currentBrowserHostname);
const isConfiguredLocalBackendUrl = LOCAL_BACKEND_URL_PATTERN.test(configuredBaseUrl);
const shouldUseKnownProductionBackend =
  import.meta.env.PROD &&
  ((!configuredBaseUrl && PRODUCTION_FRONTEND_HOSTNAMES.has(currentBrowserHostname)) ||
    (isConfiguredLocalBackendUrl && !isLocalBrowserHostname));
const resolvedBaseUrl = shouldUseKnownProductionBackend ? PRODUCTION_BACKEND_FALLBACK_URL : configuredBaseUrl;
const allowRemoteBackendInDev =
  String(import.meta.env.VITE_ALLOW_REMOTE_BACKEND_IN_DEV || '').trim().toLowerCase() === 'true';
const isRemoteHttpUrl = /^https?:\/\//i.test(resolvedBaseUrl);
const isLocalBackendUrl = LOCAL_BACKEND_URL_PATTERN.test(resolvedBaseUrl);
const shouldIgnoreRemoteDevBackend =
  import.meta.env.DEV && isRemoteHttpUrl && !isLocalBackendUrl && !allowRemoteBackendInDev;

export const BASE_URL = shouldIgnoreRemoteDevBackend ? '' : resolvedBaseUrl;

const normalizedBaseUrl = String(BASE_URL).replace(/\/+$/, '');
const uploadObjectPathPattern = /^\/(?:api\/upload|uploads)\/object\//i;
const encryptedUploadObjectKeyPattern = /^pglo3\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const decodeBase64UrlJson = (value: string): Record<string, unknown> | null => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const looksLikeUploadObjectKey = (value: string): boolean => {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('/') || raw.includes(':') || /\s/.test(raw)) return false;
  if (encryptedUploadObjectKeyPattern.test(raw)) return true;

  const parsed = decodeBase64UrlJson(raw);
  const version = Number(parsed?.v);
  const oid = Number(parsed?.oid);
  return (
    (version === 1 || version === 2) &&
    Number.isFinite(oid) &&
    oid > 0 &&
    typeof parsed?.mimeType === 'string' &&
    parsed.mimeType.trim().length > 0
  );
};

const publicUploadObjectUrl = (objectKey: string): string => {
  const path = `/uploads/object/${encodeURIComponent(objectKey)}`;
  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
};

const shouldRewriteFrontendHostedUploadUrl = (raw: string): string | null => {
  if (!normalizedBaseUrl) return null;

  try {
    const parsed = new URL(raw);
    if (!uploadObjectPathPattern.test(parsed.pathname)) return null;

    const backendOrigin = new URL(normalizedBaseUrl).origin;
    if (parsed.origin === backendOrigin) return null;

    const currentOrigin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : '';
    const knownFrontendHost =
      parsed.hostname === 'conscious-network.org' ||
      parsed.hostname === 'www.conscious-network.org';
    if (!knownFrontendHost && (!currentOrigin || parsed.origin !== currentOrigin)) {
      return null;
    }

    return `${backendOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown, fallbackMessage: string) {
    const baseMessage =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: unknown }).error || fallbackMessage)
        : data && typeof data === 'object' && 'message' in data
          ? String((data as { message?: unknown }).message || fallbackMessage)
          : fallbackMessage;
    const details =
      data && typeof data === 'object' && Array.isArray((data as { details?: unknown }).details)
        ? (data as { details: unknown[] }).details
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];
    const message = details.length ? `${baseMessage}: ${details.join('; ')}` : baseMessage;

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type ApiBody = BodyInit | Record<string, unknown> | unknown[] | null;

export type ApiOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: ApiBody;
  headers?: HeadersInit;
  auth?: boolean;
};

const hasHeader = (headers: Headers, name: string): boolean => headers.has(name);

const isFormDataBody = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const isNativeBody = (body: unknown): body is BodyInit =>
  typeof body === 'string' ||
  isFormDataBody(body) ||
  (typeof Blob !== 'undefined' && body instanceof Blob) ||
  (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) ||
  (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer);

const normalizePath = (path: string): string => {
  const normalized = String(path || '').trim();
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const buildUrl = (path: string): string => `${normalizedBaseUrl}${path}`;

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const request = async <T>(url: string, options: ApiOptions = {}): Promise<T> => {
  const { body, headers: initHeaders, auth = true, credentials = 'include', ...rest } = options;
  const headers = new Headers(initHeaders);
  const isFormData = isFormDataBody(body);
  const shouldSerializeJson =
    body !== undefined && body !== null && !isNativeBody(body);

  if (!isFormData && !hasHeader(headers, 'Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth && !hasHeader(headers, 'Authorization')) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials,
      headers,
      body: shouldSerializeJson ? JSON.stringify(body) : (body as BodyInit | null | undefined),
    });
  } catch (error) {
    const target = (() => {
      try {
        return new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined).origin;
      } catch {
        return normalizedBaseUrl || 'same-origin backend';
      }
    })();
    const cause = error instanceof Error ? error.message : 'network request was blocked or unavailable';
    throw new Error(
      `Backend connection failed for ${target}. Confirm Cloudflare Pages sets VITE_BACKEND_URL=${PRODUCTION_BACKEND_FALLBACK_URL}, the Render backend is running, and Render CORS_ORIGINS includes https://conscious-network.org. Cause: ${cause}`
    );
  }
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, data, `Backend request failed with HTTP ${response.status}`);
  }

  if (typeof data === 'string') {
    throw new Error(`Backend returned non-JSON response from ${response.url}`);
  }

  return data as T;
};

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  return request<T>(buildUrl(`/api${normalizePath(path)}`), options);
}

export async function apiHealth<T = unknown>(options: ApiOptions = {}): Promise<T> {
  return request<T>(buildUrl('/health'), { ...options, auth: false });
}

export const backendAssetUrl = (value: unknown): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return shouldRewriteFrontendHostedUploadUrl(raw) || raw;
  }
  if (looksLikeUploadObjectKey(raw)) {
    return publicUploadObjectUrl(raw);
  }
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};

export const getBackendBaseUrl = (): string => normalizedBaseUrl;
