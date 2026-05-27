import { getAuthToken } from './sessionService';

const configuredBaseUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();
const allowRemoteBackendInDev =
  String(import.meta.env.VITE_ALLOW_REMOTE_BACKEND_IN_DEV || '').trim().toLowerCase() === 'true';
const isRemoteHttpUrl = /^https?:\/\//i.test(configuredBaseUrl);
const isLocalBackendUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
  configuredBaseUrl
);
const shouldIgnoreRemoteDevBackend =
  import.meta.env.DEV && isRemoteHttpUrl && !isLocalBackendUrl && !allowRemoteBackendInDev;

export const BASE_URL = shouldIgnoreRemoteDevBackend ? '' : configuredBaseUrl;

const normalizedBaseUrl = String(BASE_URL).replace(/\/+$/, '');

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

  const response = await fetch(url, {
    ...rest,
    credentials,
    headers,
    body: shouldSerializeJson ? JSON.stringify(body) : (body as BodyInit | null | undefined),
  });
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
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};

export const getBackendBaseUrl = (): string => normalizedBaseUrl;
