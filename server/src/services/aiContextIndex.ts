import { getPrisma } from './prismaClient';
import { localStore } from './persistenceStore';
import { normalizePrivacySettings } from './profileNormalization';
import { socialStore } from './socialStore';
import {
  getKnowledgeContext,
  type KnowledgeSource,
} from './knowledgeService';
import { redactSensitiveText } from './aiSafetyPolicy';

type IndexedSourceType = 'course' | 'social_post' | 'profile' | 'knowledge' | 'trusted';

interface IndexedDocument {
  id: string;
  title: string;
  content: string;
  sourceType: IndexedSourceType;
  ownerUserId?: string;
  visibility: 'public';
  updatedAt?: string;
}

export interface AiIndexStatus {
  enabled: boolean;
  crawling: boolean;
  lastCrawledAt: string | null;
  nextScheduledCrawlAt: string | null;
  documentCount: number;
  sourceCounts: Record<string, number>;
  lastError: string | null;
}

export interface AiContextResult {
  contextText: string;
  sources: KnowledgeSource[];
  userProfileContext?: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'have', 'has', 'will', 'can', 'how', 'what', 'when',
  'where', 'about', 'within', 'platform', 'network', 'hub',
]);

const MAX_INDEX_DOCS = 750;
const MAX_CONTEXT_CHARS = 5500;
const MAX_DOC_CHARS = 1400;

let indexedDocs: IndexedDocument[] = [];
let lastCrawledAt: string | null = null;
let nextScheduledCrawlAt: string | null = null;
let lastError: string | null = null;
let crawlPromise: Promise<void> | null = null;
let intervalHandle: NodeJS.Timeout | null = null;

const envEnabled = (name: string, defaultValue = true): boolean => {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw !== 'false' && raw !== '0' && raw !== 'off';
};

const isCrawlerEnabled = (): boolean =>
  envEnabled('AI_CRAWLER_ENABLED', String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'test');

const crawlIntervalMs = (): number => {
  const parsed = Number(process.env.AI_CRAWLER_INTERVAL_MS || '');
  if (Number.isFinite(parsed) && parsed >= 60000) return Math.min(parsed, 24 * 60 * 60 * 1000);
  return 10 * 60 * 1000;
};

const tokenize = (text: string): string[] =>
  redactSensitiveText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const scoreDocument = (queryTokens: string[], doc: IndexedDocument): number => {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set(tokenize(`${doc.title} ${doc.content}`));
  return queryTokens.reduce((score, token) => score + (haystack.has(token) ? 1 : 0), 0);
};

const compactText = (value: unknown, maxLength = MAX_DOC_CHARS): string =>
  redactSensitiveText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const pushDoc = (docs: IndexedDocument[], doc: IndexedDocument): void => {
  if (!doc.content.trim() || docs.length >= MAX_INDEX_DOCS) return;
  docs.push({
    ...doc,
    title: compactText(doc.title, 180),
    content: compactText(doc.content),
  });
};

const crawlCourses = async (docs: IndexedDocument[]): Promise<void> => {
  const db = getPrisma() as any;
  const courses = await db.course.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });

  for (const course of courses) {
    pushDoc(docs, {
      id: `course:${course.id}`,
      title: course.title || 'Course',
      content: [
        course.title,
        course.provider ? `Provider: ${course.provider}` : '',
        course.description,
        course.tier ? `Tier: ${course.tier}` : '',
      ].filter(Boolean).join('\n'),
      sourceType: 'course',
      visibility: 'public',
      updatedAt: course.updatedAt?.toISOString?.() || undefined,
    });
  }
};

const crawlPublicPosts = async (docs: IndexedDocument[]): Promise<void> => {
  const posts = await socialStore.listPosts({ limit: 200 });
  for (const post of posts) {
    if (post.visibility !== 'public') continue;
    pushDoc(docs, {
      id: `social:${post.id}`,
      title: 'Public community post',
      content: post.text || 'Public media post',
      sourceType: 'social_post',
      ownerUserId: post.authorId,
      visibility: 'public',
      updatedAt: post.updatedAt?.toISOString?.() || undefined,
    });
  }
};

const crawlPublicProfiles = async (docs: IndexedDocument[]): Promise<void> => {
  const users = await localStore.listUsers(250);
  for (const user of users) {
    const privacy = normalizePrivacySettings(user.privacySettings);
    if (privacy.profileVisibility === 'private') continue;
    pushDoc(docs, {
      id: `profile:${user.id}`,
      title: user.name || user.handle || 'Member profile',
      content: [
        user.name ? `Name: ${user.name}` : '',
        user.handle ? `Handle: ${user.handle}` : '',
        user.role ? `Role: ${user.role}` : '',
        user.tier ? `Tier: ${user.tier}` : '',
        user.location ? `Location: ${user.location}` : '',
        user.bio ? `Bio: ${user.bio}` : '',
        Array.isArray(user.interests) && user.interests.length > 0
          ? `Interests: ${user.interests.join(', ')}`
          : '',
      ].filter(Boolean).join('\n'),
      sourceType: 'profile',
      ownerUserId: user.id,
      visibility: 'public',
      updatedAt: user.updatedAt?.toISOString?.() || undefined,
    });
  }
};

const crawlKnowledgeSeed = async (docs: IndexedDocument[]): Promise<void> => {
  const seed = await getKnowledgeContext(
    'Conscious Network Hub privacy security AI governance courses providers community wellness',
    { limit: 8, includeTrusted: true, includeProfile: true }
  );
  if (!seed.contextText.trim()) return;
  pushDoc(docs, {
    id: 'knowledge:bootstrap',
    title: 'Conscious Network Hub knowledge seed',
    content: seed.contextText,
    sourceType: 'knowledge',
    visibility: 'public',
  });
};

export const triggerAiContextCrawl = async (reason = 'manual'): Promise<AiIndexStatus> => {
  if (!isCrawlerEnabled()) return getAiContextIndexStatus();
  if (crawlPromise) {
    await crawlPromise;
    return getAiContextIndexStatus();
  }

  crawlPromise = (async () => {
    const docs: IndexedDocument[] = [];
    const errors: string[] = [];

    for (const task of [crawlKnowledgeSeed, crawlCourses, crawlPublicPosts, crawlPublicProfiles]) {
      try {
        await task(docs);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    indexedDocs = docs;
    lastCrawledAt = new Date().toISOString();
    nextScheduledCrawlAt = new Date(Date.now() + crawlIntervalMs()).toISOString();
    lastError = errors.length > 0 ? errors.join(' | ').slice(0, 500) : null;

    console.log(
      '[AI][CRAWLER]',
      JSON.stringify({
        reason,
        indexedDocuments: indexedDocs.length,
        lastError,
      })
    );
  })().finally(() => {
    crawlPromise = null;
  });

  await crawlPromise;
  return getAiContextIndexStatus();
};

export const startAiContextCrawler = (): void => {
  if (!isCrawlerEnabled() || intervalHandle) return;

  void triggerAiContextCrawl('startup');
  intervalHandle = setInterval(() => {
    void triggerAiContextCrawl('scheduled');
  }, crawlIntervalMs());
  intervalHandle.unref?.();
};

export const getAiContextIndexStatus = (): AiIndexStatus => {
  const sourceCounts: Record<string, number> = {};
  for (const doc of indexedDocs) {
    sourceCounts[doc.sourceType] = (sourceCounts[doc.sourceType] || 0) + 1;
  }

  return {
    enabled: isCrawlerEnabled(),
    crawling: Boolean(crawlPromise),
    lastCrawledAt,
    nextScheduledCrawlAt,
    documentCount: indexedDocs.length,
    sourceCounts,
    lastError,
  };
};

const buildUserProfileContext = async (userId?: string): Promise<string | undefined> => {
  if (!userId) return undefined;
  try {
    const user = await localStore.getUserById(userId);
    if (!user) return undefined;
    return compactText([
      `Authenticated role: ${user.role || 'user'}`,
      user.tier ? `Membership tier: ${user.tier}` : '',
      user.providerApprovalStatus ? `Provider status: ${user.providerApprovalStatus}` : '',
      Array.isArray(user.interests) && user.interests.length > 0
        ? `Stated interests: ${user.interests.join(', ')}`
        : '',
    ].filter(Boolean).join('\n'), 900);
  } catch {
    return undefined;
  }
};

export const buildAiContext = async (query: string, userId?: string): Promise<AiContextResult> => {
  if (indexedDocs.length === 0 && !crawlPromise) {
    if (isCrawlerEnabled()) {
      await triggerAiContextCrawl('on-demand');
    }
  } else if (crawlPromise) {
    await crawlPromise;
  }

  const queryTokens = tokenize(query);
  const localMatches = indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(queryTokens, doc) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const knowledge = await getKnowledgeContext(query, {
    limit: 4,
    includeTrusted: true,
    includeProfile: true,
  });
  const userProfileContext = await buildUserProfileContext(userId);

  const indexedContext = localMatches
    .map(({ doc }) => `Indexed ${doc.sourceType}: ${doc.title}\n${doc.content}`)
    .join('\n\n---\n\n');
  const contextText = [
    knowledge.contextText,
    indexedContext,
    userProfileContext ? `Private session personalization layer:\n${userProfileContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n===\n\n')
    .slice(0, MAX_CONTEXT_CHARS);

  const indexedSources: KnowledgeSource[] = localMatches.map(({ doc, score }) => ({
    title: doc.title,
    sourceType: doc.sourceType === 'trusted' ? 'trusted' : doc.sourceType === 'knowledge' ? 'internal' : 'hcn',
    relevance: Math.min(1, score / Math.max(1, queryTokens.length)),
    snippet: doc.content.slice(0, 220),
  }));

  return {
    contextText,
    sources: [...knowledge.sources, ...indexedSources].slice(0, 10),
    userProfileContext,
  };
};
