import { createClientIsolatedSearchContext, sanitizeExternalRequestPayload } from './wisdomCompliance';

export interface ClientSearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  source: 'browser-open-web';
}

const OPEN_SEARCH_PROXY = 'https://r.jina.ai/http://https://html.duckduckgo.com/html/?q=';
const OPEN_SEARCH_TIMEOUT_MS = 6000;

const toSearchSnippet = (text: string): string => {
  const normalized = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
};

const parseOpenSearchResults = (html: string): ClientSearchResult[] => {
  const matches = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi));
  const results: ClientSearchResult[] = [];

  for (const match of matches) {
    const href = String(match[1] || '').trim();
    const label = toSearchSnippet(String(match[2] || ''));
    if (!href || !label || href.includes('javascript:')) continue;
    if (!href.startsWith('http')) continue;

    const title = label.length > 90 ? `${label.slice(0, 87)}...` : label;
    results.push({
      id: `web-${results.length}-${Date.now()}`,
      title: title || 'Open web result',
      description: `Browser-side open-web result from ${new URL(href).hostname}`,
      url: href,
      source: 'browser-open-web',
    });

    if (results.length >= 4) break;
  }

  return results;
};

export const fetchClientSideOpenSearchResults = async (query: string): Promise<ClientSearchResult[]> => {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];

  const payload = sanitizeExternalRequestPayload({ query: trimmed });
  const url = `${OPEN_SEARCH_PROXY}${encodeURIComponent(payload.query)}`;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), OPEN_SEARCH_TIMEOUT_MS);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html, text/plain',
      },
      signal: controller.signal,
    });
    window.clearTimeout(timeout);

    if (!response.ok) throw new Error(`Open search proxy responded with ${response.status}`);

    const html = await response.text();
    const parsed = parseOpenSearchResults(html);

    if (parsed.length > 0) {
      const contextText = parsed
        .map((result) => `- ${result.title}: ${result.description}`)
        .join('\n');
      createClientIsolatedSearchContext(contextText, { source: 'browser-open-web' });
      return parsed;
    }

    return [];
  } catch {
    return [];
  }
};
