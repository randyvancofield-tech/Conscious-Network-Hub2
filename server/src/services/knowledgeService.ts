import fs from 'fs/promises';
import path from 'path';
import trustedSources from '../data/trusted_sources.json';

interface HCNKnowledge {
  founder: { name: string; linkedinUrl: string; role: string };
  organization: { name: string; shortName: string; officialUrl: string; description: string };
  products: Array<{ name: string; shortName?: string; description: string; features?: string[]; focus?: string }>;
  scope: { answerable: string[]; notAnswerable: string[] };
  closedKnowledgeMessage: string;
  mvpNotice: string;
  lastUpdated: string;
}

export interface KnowledgeSource {
  title: string;
  url?: string;
  relevance?: number;
  snippet?: string;
  sourceType: 'trusted' | 'hcn' | 'internal';
}

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  sourceType: 'trusted' | 'hcn' | 'internal';
}

interface KnowledgeChunk extends KnowledgeDocument {
  score: number;
}

export interface KnowledgeContextResult {
  contextText: string;
  sources: KnowledgeSource[];
  hcnProfile?: string;
}

const ROOT_DIR = path.resolve(__dirname, '../../..');
const HCN_KNOWLEDGE_URL =
  process.env.HCN_KNOWLEDGE_URL || 'https://higherconscious.network/hcn-knowledge.json';
const KNOWLEDGE_TTL_MS = 10 * 60 * 1000;
const MAX_CHUNK_CHARS = 900;
const MAX_CONTEXT_CHARS = 4000;

const INTERNAL_DOCS = [
  'README.md',
  'SETUP_GUIDE.md',
  'BACKEND_IMPLEMENTATION_SUMMARY.md',
  'ETHICAL_AI_USER_GUIDE.md',
  'ETHICAL_AI_TECHNICAL_REFERENCE.md',
  'ETHICAL_AI_QUICK_REFERENCE.md',
  'ETHICAL_AI_IMPLEMENTATION_COMPLETE.md',
  'ETHICAL_AI_INSIGHT_IMPLEMENTATION.md',
  'docs/compliance/privacy-policy-draft.md',
  'docs/compliance/ai-transparency-policy-draft.md',
  'docs/compliance/blockchain-data-policy-draft.md',
  'docs/compliance/vendor-api-governance-policy-draft.md',
  'docs/compliance/nist-mapping-summary.md',
  'src/knowledge/hcn_scope.json'
];

let cachedDocs: KnowledgeDocument[] = [];
let cachedAt = 0;
let cachedProfile: string | undefined;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those',
  'as', 'it', 'its', 'into', 'about', 'over', 'under', 'within'
]);

const toAbsolutePath = (relativePath: string) => path.resolve(ROOT_DIR, relativePath);

const stripMarkdown = (text: string) => {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
};

const scoreChunk = (queryTokens: string[], chunkText: string): number => {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = new Set(tokenize(chunkText));
  let score = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += 1;
  }
  return score;
};

const chunkDocument = (doc: KnowledgeDocument): KnowledgeDocument[] => {
  const chunks: KnowledgeDocument[] = [];
  const paragraphs = doc.content.split(/\n{2,}/g);

  let buffer = '';
  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n${paragraph}` : paragraph;
    if (next.length > MAX_CHUNK_CHARS) {
      if (buffer) {
        chunks.push({ ...doc, content: buffer });
        buffer = paragraph;
      } else {
        chunks.push({ ...doc, content: paragraph.slice(0, MAX_CHUNK_CHARS) });
        buffer = paragraph.slice(MAX_CHUNK_CHARS);
      }
    } else {
      buffer = next;
    }
  }

  if (buffer.trim()) {
    chunks.push({ ...doc, content: buffer });
  }

  return chunks;
};

const readFileIfExists = async (relativePath: string): Promise<string | null> => {
  try {
    const filePath = toAbsolutePath(relativePath);
    const data = await fs.readFile(filePath, 'utf-8');
    return data;
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const loadHCNKnowledge = async (): Promise<HCNKnowledge | null> => {
  const remote = await fetchWithTimeout(HCN_KNOWLEDGE_URL, 4000);
  if (remote) {
    try {
      return JSON.parse(remote) as HCNKnowledge;
    } catch {
      // fall through to local
    }
  }

  const local = await readFileIfExists('src/knowledge/hcn_scope.json');
  if (!local) return null;

  try {
    return JSON.parse(local) as HCNKnowledge;
  } catch {
    return null;
  }
};

const formatHCNProfile = (knowledge: HCNKnowledge | null): { text: string; sources: KnowledgeSource[] } => {
  if (!knowledge) {
    return {
      text: 'HCN profile data is currently unavailable. Provide answers based on verified HCN documents only.',
      sources: []
    };
  }

  const profileText = [
    `Founder: ${knowledge.founder.name} (${knowledge.founder.role})`,
    `Founder LinkedIn: ${knowledge.founder.linkedinUrl}`,
    `Organization: ${knowledge.organization.name} (${knowledge.organization.shortName})`,
    `Official Site: ${knowledge.organization.officialUrl}`,
    `Mission: ${knowledge.organization.description}`,
    'Key Products:',
    ...knowledge.products.map(product => {
      const featureLine = product.features ? ` Features: ${product.features.join('; ')}` : '';
      const focusLine = product.focus ? ` Focus: ${product.focus}` : '';
      return `- ${product.name}: ${product.description}${featureLine}${focusLine}`;
    }),
    `MVP Notice: ${knowledge.mvpNotice}`
  ].join('\n');

  return {
    text: profileText,
    sources: [
      {
        title: 'Higher Conscious Network Official Site',
        url: knowledge.organization.officialUrl,
        sourceType: 'hcn'
      },
      {
        title: `${knowledge.founder.name} LinkedIn`,
        url: knowledge.founder.linkedinUrl,
        sourceType: 'hcn'
      }
    ]
  };
};

const loadInternalDocs = async (): Promise<KnowledgeDocument[]> => {
  const docs: KnowledgeDocument[] = [];

  for (const relativePath of INTERNAL_DOCS) {
    const data = await readFileIfExists(relativePath);
    if (!data) continue;

    let content = data;
    if (relativePath.endsWith('.md')) {
      content = stripMarkdown(data);
    } else if (relativePath.endsWith('.json')) {
      try {
        content = stripMarkdown(JSON.stringify(JSON.parse(data), null, 2));
      } catch {
        content = stripMarkdown(data);
      }
    }

    docs.push({
      id: `internal:${relativePath}`,
      title: relativePath.split('/').pop() || relativePath,
      content,
      sourceType: 'internal'
    });
  }

  return docs;
};

const loadTrustedDocs = (): KnowledgeDocument[] => {
  return (trustedSources || []).map((source, idx) => ({
    id: `trusted:${idx}`,
    title: source.title,
    content: source.summary,
    url: source.url,
    sourceType: 'trusted'
  }));
};

const loadKnowledgeDocuments = async (): Promise<KnowledgeDocument[]> => {
  const now = Date.now();
  if (cachedDocs.length > 0 && now - cachedAt < KNOWLEDGE_TTL_MS) {
    return cachedDocs;
  }

  const docs: KnowledgeDocument[] = [];

  const hcnKnowledge = await loadHCNKnowledge();
  const profile = formatHCNProfile(hcnKnowledge);
  cachedProfile = profile.text;

  if (hcnKnowledge) {
    docs.push({
      id: 'hcn:profile',
      title: 'HCN Official Profile',
      content: profile.text,
      url: hcnKnowledge.organization.officialUrl,
      sourceType: 'hcn'
    });
  }

  docs.push(...loadTrustedDocs());
  docs.push(...(await loadInternalDocs()));

  cachedDocs = docs;
  cachedAt = now;

  return docs;
};

export const getKnowledgeContext = async (
  query: string,
  options: { limit?: number; includeTrusted?: boolean; includeProfile?: boolean } = {}
): Promise<KnowledgeContextResult> => {
  const docs = await loadKnowledgeDocuments();
  const queryTokens = tokenize(query);

  const chunks = docs.flatMap(doc => chunkDocument(doc));
  const scoredChunks: KnowledgeChunk[] = chunks.map(chunk => ({
    ...chunk,
    score: scoreChunk(queryTokens, chunk.content)
  }));

  const limit = options.limit ?? 4;
  const includeTrusted = options.includeTrusted ?? true;
  const includeProfile = options.includeProfile ?? true;

  const sorted = scoredChunks
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected: KnowledgeChunk[] = [];

  for (const chunk of sorted) {
    if (selected.length >= limit) break;
    selected.push(chunk);
  }

  if (includeTrusted) {
    const trusted = scoredChunks
      .filter(chunk => chunk.sourceType === 'trusted')
      .sort((a, b) => b.score - a.score);

    for (const chunk of trusted) {
      if (selected.length >= limit) break;
      if (!selected.find(sel => sel.id === chunk.id)) {
        selected.push({ ...chunk, score: chunk.score || 1 });
      }
    }
  }

  if (includeProfile && cachedProfile && !selected.find(sel => sel.id === 'hcn:profile')) {
    selected.unshift({
      id: 'hcn:profile',
      title: 'HCN Official Profile',
      content: cachedProfile,
      url: docs.find(doc => doc.id === 'hcn:profile')?.url,
      sourceType: 'hcn',
      score: 1
    });
  }

  let contextText = selected
    .map(chunk => `Source: ${chunk.title}\n${chunk.content}`)
    .join('\n\n---\n\n');

  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = contextText.slice(0, MAX_CONTEXT_CHARS);
  }

  const sources: KnowledgeSource[] = selected.map(chunk => ({
    title: chunk.title,
    url: chunk.url,
    relevance: chunk.score ? Math.min(1, chunk.score / Math.max(1, queryTokens.length)) : undefined,
    snippet: chunk.content.slice(0, 220),
    sourceType: chunk.sourceType
  }));

  return {
    contextText,
    sources,
    hcnProfile: cachedProfile
  };
};
