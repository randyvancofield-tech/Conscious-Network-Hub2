import { Request } from 'express';

const trimBaseUrl = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin.replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

const splitConfiguredOrigins = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map(trimBaseUrl)
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => entry.toLowerCase());

const getRequestOrigin = (req: Request): string => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`.replace(/\/+$/, '');
};

const getFrontendOrigins = (): Set<string> =>
  new Set([
    ...splitConfiguredOrigins(process.env.FRONTEND_BASE_URL),
    ...splitConfiguredOrigins(process.env.CORS_ORIGINS),
  ]);

const isFrontendOrigin = (origin: string | null | undefined): boolean => {
  if (!origin) return false;
  return getFrontendOrigins().has(origin.toLowerCase());
};

export const getBackendPublicBaseUrl = (req: Request): string => {
  const explicitBackendBaseUrl = trimBaseUrl(process.env.BACKEND_PUBLIC_BASE_URL);
  if (explicitBackendBaseUrl) return explicitBackendBaseUrl;

  const configuredPublicBaseUrl = trimBaseUrl(process.env.PUBLIC_BASE_URL);
  if (configuredPublicBaseUrl && !isFrontendOrigin(configuredPublicBaseUrl)) {
    return configuredPublicBaseUrl;
  }

  const requestOrigin = getRequestOrigin(req);
  if (configuredPublicBaseUrl && isFrontendOrigin(configuredPublicBaseUrl) && !isFrontendOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return configuredPublicBaseUrl || requestOrigin;
};

export const absolutizeBackendUrl = (
  req: Request,
  value?: string | null
): string | null | undefined => {
  if (!value) return value;
  const raw = String(value).trim();
  if (!raw) return raw;

  try {
    const parsed = /^[a-z][a-z0-9+.-]*:/i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, getBackendPublicBaseUrl(req));

    if (/^\/(?:api\/upload|uploads)\/object\//i.test(parsed.pathname) && isFrontendOrigin(parsed.origin)) {
      return `${getBackendPublicBaseUrl(req)}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
    return `${getBackendPublicBaseUrl(req)}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${getBackendPublicBaseUrl(req)}${path}`;
  }
};
