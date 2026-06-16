import { Router, Request, Response } from 'express';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedRole,
  getAuthenticatedUserId,
  validateChatInput,
  requireAdminElevation,
  requireCanonicalIdentity,
} from '../middleware';
import { getVertexAIService } from '../services/vertexAiService';
import { chatWithOpenAI, isOpenAIConfigured } from "../services/openAiService";
import { createAdminMessage, normalizeAdminMessagePriority } from '../services/adminMessageStore';
import emailService from '../services/emailService';
import {
  buildAiContext,
  getAiContextIndexStatus,
  triggerAiContextCrawl,
} from '../services/aiContextIndex';
import {
  AI_SECURITY_SYSTEM_PROMPT,
  AI_USER_SAFETY_NOTICE,
  buildRuntimeGuardrailContext,
  sanitizeAiInput,
} from '../services/aiSafetyPolicy';
import {
  chatWithRuntimeAiProvider,
  getRuntimeProviderStatus,
  hasRuntimeAiProvider,
  type RuntimeAiProvider,
} from '../services/aiProviderService';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import {
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  isProviderCrmSoleAdmin,
} from '../services/providerCrm';

const router = Router();
router.use(requireCanonicalIdentity);

interface AiProviderResponse {
  provider: 'openai' | 'vertex' | RuntimeAiProvider;
  reply: string;
  citations: Array<{
    text?: string;
    web?: {
      uri: string;
      title: string;
    };
  }>;
  confidenceScore: number;
  processingTimeMs: number;
}

interface AiRequestContext {
  category?: string;
  userId?: string;
  route?: string;
  path?: string;
  pageTitle?: string;
  viewMode?: string;
}

const getVertexServiceOrNull = () => {
  try {
    return getVertexAIService();
  } catch {
    return null;
  }
};

const ensureAiAvailability = (res: Response): boolean => {
  if (getVertexServiceOrNull() || isOpenAIConfigured() || hasRuntimeAiProvider()) {
    return true;
  }

  res.status(503).json({
    error: 'AI service unavailable: no provider is currently configured',
    code: 'AI_PROVIDER_UNAVAILABLE',
  });
  return false;
};

const buildGroundedPrompt = (input: {
  message: string;
  contextText?: string;
  pageContextText?: string;
  userProfileContext?: string;
}): { systemPrompt: string; userPrompt: string } => {
  const safetyContext = buildRuntimeGuardrailContext(input.message);
  const systemPrompt = [
    AI_SECURITY_SYSTEM_PROMPT,
    safetyContext,
    (input.contextText || input.pageContextText)
      ? [
          'Ground platform-specific answers in the supplied context.',
          'Answer the direct question first. Keep short prompts short.',
          'If the user asks "what is this" or "what is this page for", use the supplied page context before broad platform context.',
          'If the question is ambiguous and no page context is available, ask one concise clarification question.',
          'For CNH questions, distinguish implemented app behavior from public website future intent or informational positioning.',
          'Use role-safe explanations for member, provider-application status, approved provider, and solo-admin distinctions.',
          'Never expose private session personalization data as a source, and do not claim unavailable services, grants, partnerships, or access permissions are complete unless the context explicitly says so.',
          'Use plain, readable paragraphs. Avoid raw markdown headings, tables, or compliance framework dumps unless the user asks for them.',
        ].join(' ')
      : '',
  ].filter(Boolean).join('\n\n');

  const userPrompt = [
    'User request:',
    input.message,
    input.pageContextText ? `\nPage context:\n${input.pageContextText}` : '',
    input.contextText ? `\nPlatform context:\n${input.contextText}` : '',
  ].filter(Boolean).join('\n\n');

  return { systemPrompt, userPrompt };
};

const normalizeConversationHistory = (
  value: unknown
): Array<{ role: string; content: string }> => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry: any) => ({
      role: typeof entry?.role === 'string' ? entry.role.trim().toLowerCase() : '',
      content: typeof entry?.content === 'string' ? entry.content.trim() : '',
    }))
    .filter((entry) => entry.content.length > 0 && (entry.role === 'user' || entry.role === 'assistant'))
    .slice(-40)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content,
    }));
};

const normalizeAiContext = (
  value: unknown,
  fallbackUserId?: string
): AiRequestContext => {
  const maybe = value && typeof value === 'object' ? (value as any) : {};
  const readString = (key: string, maxLength: number): string | undefined =>
    typeof maybe[key] === 'string' && maybe[key].trim().length > 0
      ? maybe[key].trim().slice(0, maxLength)
      : undefined;
  const category =
    readString('category', 100);
  const userId =
    typeof maybe.userId === 'string' && maybe.userId.trim().length > 0
      ? maybe.userId.trim()
      : fallbackUserId;

  return {
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(readString('route', 180) ? { route: readString('route', 180) } : {}),
    ...(readString('path', 180) ? { path: readString('path', 180) } : {}),
    ...(readString('pageTitle', 180) ? { pageTitle: readString('pageTitle', 180) } : {}),
    ...(readString('viewMode', 100) ? { viewMode: readString('viewMode', 100) } : {}),
  };
};

const buildPageContextText = (context?: AiRequestContext): string => {
  if (!context) return '';
  const route = context.route || context.path;
  const parts = [
    route ? `route=${route}` : '',
    context.pageTitle ? `pageTitle=${context.pageTitle}` : '',
    context.category ? `category=${context.category}` : '',
    context.viewMode ? `viewMode=${context.viewMode}` : '',
  ].filter(Boolean);
  return parts.join('; ');
};

const normalizeAiReplyForChat = (reply: string): string =>
  String(reply || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const finalizeAiResponse = (response: AiProviderResponse): AiProviderResponse => ({
  ...response,
  reply: normalizeAiReplyForChat(response.reply),
});

const isVertexFallbackText = (reply: string): boolean =>
  /^fallback:\s*unable to reach vertex ai/i.test(reply.trim());

const mapVertexCitations = (
  citations: Array<{
    title: string;
    url?: string;
    relevance?: number;
  }> = []
): Array<{
  text?: string;
  web?: {
    uri: string;
    title: string;
  };
}> =>
  citations
    .map((citation) => ({
      text: citation.title,
      web:
        citation.url && citation.url.trim().length > 0
          ? {
              uri: citation.url,
              title: citation.title,
            }
          : undefined,
    }))
    .filter((citation) => citation.text || citation.web);

const classifyAiError = (error: unknown): { statusCode: number; message: string } => {
  const maybeAny = error as any;
  const code = typeof maybeAny?.code === 'string' ? maybeAny.code.toLowerCase() : '';
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = Number(maybeAny?.status);

  if (code === 'insufficient_quota' || message.includes('insufficient_quota') || message.includes('quota')) {
    return {
      statusCode: 503,
      message: 'AI service is temporarily unavailable due to provider quota limits',
    };
  }

  if (status === 429 || message.includes('rate limit')) {
    return {
      statusCode: 429,
      message: 'AI service is rate limited right now; please retry shortly',
    };
  }

  return {
    statusCode: 500,
    message: 'AI service unavailable',
  };
};

const generateOpenAiResponse = async (message: string): Promise<AiProviderResponse> => {
  const start = Date.now();
  const reply = await chatWithOpenAI(message);
  return {
    provider: 'openai',
    reply,
    citations: [],
    confidenceScore: 75,
    processingTimeMs: Date.now() - start,
  };
};

const generateAiResponse = async (
  message: string,
  options?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    context?: AiRequestContext;
  }
): Promise<AiProviderResponse> => {
  const safeMessage = sanitizeAiInput(message);
  const aiContext = await buildAiContext(safeMessage, options?.context?.userId);
  const pageContextText = buildPageContextText(options?.context);
  const { systemPrompt, userPrompt } = buildGroundedPrompt({
    message: safeMessage,
    contextText: aiContext.contextText,
    pageContextText,
    userProfileContext: aiContext.userProfileContext,
  });
  const vertexService = getVertexServiceOrNull();

  if (vertexService) {
    const vertex = await vertexService.chat(userPrompt, options?.conversationHistory, {
      ...options?.context,
      knowledgeContext: aiContext.contextText,
      sources: aiContext.sources,
    });
    if (!isVertexFallbackText(vertex.reply)) {
      return finalizeAiResponse({
        provider: 'vertex',
        reply: vertex.reply,
        citations: [...mapVertexCitations(vertex.citations), ...mapVertexCitations(aiContext.sources)],
        confidenceScore: vertex.confidenceScore ?? 75,
        processingTimeMs: vertex.processingTimeMs ?? 0,
      });
    }
  }

  if (isOpenAIConfigured()) {
    try {
      const openAi = await generateOpenAiResponse(userPrompt);
      return finalizeAiResponse({
        ...openAi,
        citations: mapVertexCitations(aiContext.sources),
      });
    } catch (error) {
      console.warn('[AI] OpenAI provider failed; falling back to runtime provider chain:', error instanceof Error ? error.message : error);
    }
  }

  const runtime = await chatWithRuntimeAiProvider({
    message: userPrompt,
    systemPrompt,
    conversationHistory: options?.conversationHistory as Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  });

  return finalizeAiResponse({
    provider: runtime.provider,
    reply: runtime.reply,
    citations: mapVertexCitations(aiContext.sources),
    confidenceScore: runtime.provider === 'local' ? 55 : 78,
    processingTimeMs: runtime.processingTimeMs,
  });
};

const buildDailyWisdomPrompt = (refreshNonce: string): string => {
  const focusThemes = [
    'spirituality, mental wellness, and lifelong education',
    'collaboration among providers, institutions, cultural leaders, and members',
    'privacy-preserving trust in a decentralized social learning ecosystem',
    'ethical SaaS leadership for communities that serve people across disciplines',
    'high-value guidance that blends wisdom, care, evidence, and consent',
  ];
  const seed = Date.now() + refreshNonce.length;
  const selectedTheme = focusThemes[seed % focusThemes.length];

  return [
    'Generate one concise Daily Wisdom insight for Conscious Network Hub.',
    'Conscious Network Hub is a decentralized SaaS social learning ecosystem integrating spirituality, mental wellness, holistic care, cultural education, provider collaboration, religious and institutional leadership, and member learning.',
    'Write for a global community of users, professional providers, organizational leaders, educators, life coaches, spiritualists, cultural enthusiasts, and mental wellness experts.',
    'Keep the tone elevated, practical, inclusive, current, and values-aligned without sounding technical or promotional.',
    'Do not mention backend providers, model availability, prompts, timestamps, nonces, implementation details, or configuration.',
    'Keep it under 90 words and include one grounded action the reader can take today.',
    `Theme: ${selectedTheme}.`,
  ].join(' ');
};

const enforceCanonicalBodyUser = (req: Request, res: Response): boolean => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  const bodyUserId =
    (typeof req.body?.userId === 'string' ? req.body.userId : undefined) ||
    (typeof req.body?.context?.userId === 'string' ? req.body.context.userId : undefined);

  if (bodyUserId && !enforceAuthenticatedUserMatch(req, res, bodyUserId, 'body.userId/context.userId')) {
    return false;
  }

  return true;
};

const requireAdminAiOperations = async (req: Request, res: Response): Promise<boolean> => {
  if (getAuthenticatedRole(req) !== 'admin') {
    res.status(403).json({ error: 'Administrative access is required' });
    return false;
  }

  const actorUserId = getAuthenticatedUserId(req);
  const actor = actorUserId ? await localStore.getUserById(actorUserId) : null;
  if (!isProviderCrmSoleAdmin(actor)) {
    recordAuditEvent(req, {
      domain: 'ai',
      action: 'admin_ai_operation',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: {
        reason: 'sole_founder_admin_required',
        requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      },
    });
    res.status(403).json({
      error: 'Solo founder admin access required',
      requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
    });
    return false;
  }

  return true;
};

interface MeetingActionItem {
  owner: string;
  task: string;
  dueDate: string;
}

interface MeetingSummary {
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItem[];
}

const sanitizeMeetingSummary = (
  raw: any,
  fallbackSummary: string
): MeetingSummary => {
  const summary =
    typeof raw?.summary === 'string' && raw.summary.trim().length > 0
      ? raw.summary.trim()
      : fallbackSummary;

  const decisions = Array.isArray(raw?.decisions)
    ? raw.decisions
        .filter((decision: unknown): decision is string => typeof decision === 'string')
        .map((decision: string) => decision.trim())
        .filter((decision: string) => decision.length > 0)
    : [];

  const actionItems = Array.isArray(raw?.actionItems)
    ? raw.actionItems
        .map((item: any) => ({
          owner: typeof item?.owner === 'string' ? item.owner.trim() : '',
          task: typeof item?.task === 'string' ? item.task.trim() : '',
          dueDate: typeof item?.dueDate === 'string' ? item.dueDate.trim() : '',
        }))
        .filter((item: MeetingActionItem) => item.owner || item.task || item.dueDate)
    : [];

  return {
    summary,
    decisions,
    actionItems,
  };
};

const parseMeetingSummary = (reply: string): MeetingSummary => {
  const fallbackSummary = reply?.trim() || 'Meeting summary unavailable.';

  try {
    return sanitizeMeetingSummary(JSON.parse(reply), fallbackSummary);
  } catch {
    const jsonStart = reply.indexOf('{');
    const jsonEnd = reply.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const candidate = reply.slice(jsonStart, jsonEnd + 1);
      try {
        return sanitizeMeetingSummary(JSON.parse(candidate), fallbackSummary);
      } catch {
        // Fall through to plain-text fallback.
      }
    }
  }

  return {
    summary: fallbackSummary,
    decisions: [],
    actionItems: [],
  };
};

/**
 * POST /api/ai/chat
 * Send a message to the AI and get a response
 */
router.post('/chat', validateChatInput, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!enforceCanonicalBodyUser(req, res)) {
      return;
    }
    if (!ensureAiAvailability(res)) {
      return;
    }
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const authUserId = getAuthenticatedUserId(req) || undefined;
    const conversationHistory = normalizeConversationHistory(req.body?.conversationHistory);
    const context = normalizeAiContext(req.body?.context, authUserId);
    const response = await generateAiResponse(sanitizeAiInput(message), {
      conversationHistory,
      context,
    });

    res.json({
      provider: response.provider,
      safetyNotice: AI_USER_SAFETY_NOTICE,
      reply: response.reply,
      citations: response.citations,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    const classified = classifyAiError(error);
    res.status(classified.statusCode).json({
      error: classified.message,
    });
  }
});

/**
 * POST /api/ai/wisdom
 * Get daily wisdom
 */
router.post('/wisdom', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!enforceCanonicalBodyUser(req, res)) {
      return;
    }
    if (!ensureAiAvailability(res)) {
      return;
    }
    const authUserId = getAuthenticatedUserId(req) || undefined;
    const bodyNonce = typeof req.body?.refreshNonce === 'string' ? req.body.refreshNonce.trim() : '';
    const refreshNonce =
      bodyNonce.length > 0
        ? bodyNonce.slice(0, 80)
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const prompt = buildDailyWisdomPrompt(refreshNonce);

    const response = await generateAiResponse(prompt, {
      context: {
        category: 'daily-wisdom',
        userId: authUserId,
      },
    });

    res.json({
      provider: response.provider,
      safetyNotice: AI_USER_SAFETY_NOTICE,
      wisdom: response.reply,
      reply: response.reply,
      citations: response.citations,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
      generatedAt: new Date().toISOString(),
      refreshNonce,
    });
  } catch (error) {
    console.error("AI wisdom error:", error);
    const classified = classifyAiError(error);
    res.status(classified.statusCode).json({
      error: classified.message,
    });
  }
});

/**
 * POST /api/ai/summarize-meeting
 * Summarize a meeting transcript and extract decisions/action items.
 */
router.post('/summarize-meeting', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!enforceCanonicalBodyUser(req, res)) {
      return;
    }
    if (!ensureAiAvailability(res)) {
      return;
    }
    const { transcript } = req.body as { transcript?: unknown };

    if (!Array.isArray(transcript)) {
      res.status(400).json({ error: 'Transcript must be an array of strings' });
      return;
    }

    const normalizedTranscript = transcript
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (normalizedTranscript.length === 0) {
      res.status(400).json({ error: 'Transcript must include at least one non-empty line' });
      return;
    }

    const prompt = [
      'Summarize this meeting transcript and extract decisions and action items.',
      'Return only valid JSON with this exact shape:',
      '{"summary":"string","decisions":["string"],"actionItems":[{"owner":"string","task":"string","dueDate":"string"}]}',
      'Use empty strings or empty arrays when details are missing.',
      'Transcript:',
      sanitizeAiInput(normalizedTranscript.join('\n'), 12000),
    ].join('\n\n');

    const authUserId = getAuthenticatedUserId(req) || undefined;
    const response = await generateAiResponse(prompt, {
      context: {
        category: 'meeting-summary',
        userId: authUserId,
      },
    });
    const parsed = parseMeetingSummary(response.reply);

    res.json({
      provider: response.provider,
      safetyNotice: AI_USER_SAFETY_NOTICE,
      ...parsed,
      reply: response.reply,
      citations: response.citations,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
    });
  } catch (error) {
    console.error('Meeting summary error:', error);
    const classified = classifyAiError(error);
    res.status(classified.statusCode).json({
      error: classified.message,
    });
  }
});

/**
 * POST /api/ai/report-issue
 * Process a platform issue report and route it to the admin inbox.
 */
router.post('/report-issue', validateChatInput, async (req: Request, res: Response): Promise<void> => {
  console.log('[API] POST /api/ai/report-issue - Issue report received');
  
  try {
    if (!enforceCanonicalBodyUser(req, res)) {
      return;
    }
    const { message, category = 'other', title: titleParam, userEmail } = req.body as any;

    const title = titleParam || 'Issue Report';
    const description = message;

    let priority = 'MEDIUM';
    let analysis = '';

    // Wrap AI call with timeout to prevent hanging
    const aiTimeout = new Promise<{ priority: string; analysis: string }>((resolve) => {
      let completed = false;
      
      // Start AI analysis in parallel
      (async () => {
        try {
          console.log('[API] Attempting AI issue analysis...');
          const response = await generateAiResponse(
            [
              'Analyze this platform issue report.',
              `Title: ${sanitizeAiInput(title, 160)}`,
              `Category: ${sanitizeAiInput(category, 80)}`,
              `Description: ${sanitizeAiInput(description, 4000)}`,
              'Return a concise triage note with priority level CRITICAL, HIGH, MEDIUM, or LOW and 2-3 next steps.',
            ].join('\n'),
            {
              context: {
                category: 'platform-issue',
                userId: getAuthenticatedUserId(req) || undefined,
              },
            }
          );
          
          if (!completed) {
            completed = true;
            console.log('[API] AI issue analysis complete');
            const priorityMatch = /\b(CRITICAL|HIGH|MEDIUM|LOW)\b/i.exec(response.reply);
            resolve({
              priority: priorityMatch?.[1]?.toUpperCase() || 'MEDIUM',
              analysis: response.reply,
            });
          }
        } catch (aiError: any) {
          if (!completed) {
            completed = true;
            console.warn('[API] Vertex AI analysis failed:', aiError?.message || aiError);
            resolve({
              priority: 'MEDIUM',
              analysis: `Issue received and will be reviewed. Category: ${category}`,
            });
          }
        }
      })();

      // Set a 5 second timeout
      setTimeout(() => {
        if (!completed) {
          completed = true;
          console.warn('[API] Vertex AI analysis timeout after 5 seconds');
          resolve({
            priority: 'MEDIUM',
            analysis: `Issue received and will be reviewed. Category: ${category}`,
          });
        }
      }, 5000);
    });

    // Wait for AI analysis (with timeout)
    const aiResult = await aiTimeout;
    priority = aiResult.priority;
    analysis = aiResult.analysis;

    const adminMessage = await createAdminMessage({
      type: 'report_issue',
      subject: title,
      message: description,
      priority: normalizeAdminMessagePriority(priority),
      submitterEmail: userEmail,
      submitterUserId: getAuthenticatedUserId(req),
      category,
      source: 'ai_report_issue',
      aiAnalysis: analysis,
      metadata: {
        delivery: 'admin_console',
        aiTriagePriority: priority,
        emailNotification: emailService.configured() ? 'attempt_pending' : 'configuration_required',
        targetRecipient: emailService.adminRecipient(),
      },
    });
    const emailConfigured = emailService.configured();
    const emailResult = emailConfigured
      ? await emailService.sendIssueReport({
          userEmail,
          title,
          description,
          category,
          priority,
          analysis,
        })
      : { ok: true, skipped: true, reason: 'email_not_configured' };
    const emailStatus = emailConfigured
      ? emailResult.ok && !emailResult.skipped
        ? 'sent'
        : 'failed'
      : 'configuration-required';

    // Always return success response to frontend
    console.log('[API] Returning success response to client');
    res.json({
      ok: true,
      analysis: analysis || 'Issue report received and will be reviewed.',
      priority,
      suggestedActions: ['Issue has been routed to the Admin Console', 'An administrator will review the report'],
      reply: analysis || 'Issue report received and will be reviewed.',
      citations: [],
      confidenceScore: 80,
      processingTimeMs: 100,
      ticketId: adminMessage.id,
      delivery: {
        internal: 'admin-console',
        email: emailStatus,
        recipient: emailService.adminRecipient(),
      },
      emailConfigured,
      emailSent: emailStatus === 'sent',
      emailStatus,
    });
  } catch (error) {
    console.error('[API] Issue Report Error:', error);
    
    // Always return a JSON response, even on error
    res.status(500).json({
      ok: false,
      error: 'Failed to process issue report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/trending
 * Get trending topics
 */
router.get('/trending', async (_req: Request, res: Response): Promise<void> => {
  const requestStart = Date.now();
  console.log('[AI] GET /api/ai/trending received');
  try {
    if (!ensureAiAvailability(res)) {
      return;
    }
    const prompt =
      "List 5 current trending topics across ethical AI/governance, blockchain/Web3, and wellness/consciousness. For each, include a short explanation on a new line.";

    const response = await generateAiResponse(prompt, {
      context: {
        category: 'trending-topics',
      },
    });
    const reply = response.reply;

    const topics = reply
      .split('\n')
      .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(line => line.length > 3)
      .slice(0, 10);

    res.json({
      provider: response.provider,
      safetyNotice: AI_USER_SAFETY_NOTICE,
      topics: topics.length > 0 ? topics : [],
      insights: reply,
      reply,
      citations: response.citations,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs || Date.now() - requestStart,
    });
    console.log(`[AI] /trending response sent in ${Date.now() - requestStart}ms`);
    return;
  } catch (error) {
    console.error("Trending error:", error);
    const classified = classifyAiError(error);
    res.status(classified.statusCode).json({
      error: classified.message,
    });
  }
});

/**
 * GET /api/ai/status
 * Operational diagnostics for AI provider and crawler health.
 */
router.get('/status', requireAdminElevation, async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdminAiOperations(req, res))) {
    return;
  }
  recordAuditEvent(req, {
    domain: 'ai',
    action: 'admin_ai_status',
    outcome: 'success',
    actorUserId: getAuthenticatedUserId(req),
    statusCode: 200,
  });
  res.json({
    success: true,
    userId: getAuthenticatedUserId(req),
    providers: {
      vertex: Boolean(getVertexServiceOrNull()),
      openai: isOpenAIConfigured(),
      runtime: getRuntimeProviderStatus(),
    },
    index: getAiContextIndexStatus(),
  });
});

/**
 * POST /api/ai/reindex
 * Refresh the public-only AI context index.
 */
router.post('/reindex', requireAdminElevation, async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdminAiOperations(req, res))) {
    return;
  }
  const status = await triggerAiContextCrawl('api');
  recordAuditEvent(req, {
    domain: 'ai',
    action: 'admin_ai_reindex',
    outcome: 'success',
    actorUserId: getAuthenticatedUserId(req),
    statusCode: 200,
    metadata: {
      lastCrawledAt: status.lastCrawledAt,
      documentCount: status.documentCount,
    },
  });
  res.json({
    success: true,
    index: status,
  });
});

export default router;



