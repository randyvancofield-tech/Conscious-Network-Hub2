type WisdomComplianceContext = {
  text: string;
  source: string;
  createdAt: number;
};

let clientWisdomContext: WisdomComplianceContext | null = null;

const FORBIDDEN_PATTERNS = [
  /__cnh[a-zA-Z0-9_]+/g,
  /hcn_[a-zA-Z0-9_]+/g,
  /process\.env\.[A-Z0-9_]+/g,
  /\/server\/src\/[A-Za-z0-9_./-]+/g,
  /\/api\/provider\/auth[\/A-Za-z0-9_.-]*/g,
];

const sanitizeText = (value: string): string => {
  let sanitized = String(value || '').trim();
  if (!sanitized) return '';

  for (const pattern of FORBIDDEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.replace(/\s{2,}/g, ' ').trim();
};

export const createClientIsolatedSearchContext = (text: string, metadata?: { source?: string }): string => {
  const sanitizedText = sanitizeText(text);
  const source = sanitizeText(metadata?.source || 'browser');
  clientWisdomContext = {
    text: sanitizedText,
    source,
    createdAt: Date.now(),
  };
  return sanitizedText;
};

export const getClientWisdomContext = (): string => clientWisdomContext?.text || '';

export const clearClientWisdomContext = (): void => {
  clientWisdomContext = null;
};

export const sanitizeExternalRequestPayload = <T>(payload: T): T => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeExternalRequestPayload(item)) as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const cleaned = sanitizeText(value);
      if (cleaned) {
        sanitized[key] = cleaned;
      }
      continue;
    }

    if (value && typeof value === 'object') {
      const nested = sanitizeExternalRequestPayload(value);
      sanitized[key] = nested;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized as T;
};

export const buildClientSideWisdomPayload = (input: { message: string; contextText?: string; pageContextText?: string }) => {
  const message = sanitizeText(input.message);
  const contextText = input.contextText ? sanitizeText(input.contextText) : '';
  const pageContextText = input.pageContextText ? sanitizeText(input.pageContextText) : '';

  return {
    message,
    contextText,
    pageContextText,
    externalSearchContext: getClientWisdomContext(),
  };
};

export const enforceClientWisdomCompliance = (payload: unknown): void => {
  const sanitized = sanitizeExternalRequestPayload(payload);
  const serialized = JSON.stringify(sanitized);
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(serialized))) {
    throw new Error('Client-side compliance guard blocked this outbound payload.');
  }
};
