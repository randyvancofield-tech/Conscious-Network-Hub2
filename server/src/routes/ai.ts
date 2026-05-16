import { Router, Request, Response } from 'express';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  validateChatInput,
  requireCanonicalIdentity,
} from '../middleware';
import { getVertexAIService } from '../services/vertexAiService';
import emailService from '../services/emailService';
import { chatWithOpenAI, isOpenAIConfigured } from "../services/openAiService";
import {
  buildAiContext,
  getAiContextIndexStatus,
  triggerAiContextCrawl,
} from '../services/aiContextIndex';
import {
  AI_SECURITY_SYSTEM_PROMPT,
  buildRuntimeGuardrailContext,
  sanitizeAiInput,
} from '../services/aiSafetyPolicy';
import {
  chatWithRuntimeAiProvider,
  getRuntimeProviderStatus,
  hasRuntimeAiProvider,
  type RuntimeAiProvider,
} from '../services/aiProviderService';

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
  userProfileContext?: string;
}): { systemPrompt: string; userPrompt: string } => {
  const safetyContext = buildRuntimeGuardrailContext(input.message);
  const systemPrompt = [
    AI_SECURITY_SYSTEM_PROMPT,
    safetyContext,
    input.contextText
      ? 'Ground platform-specific answers in the supplied context. Do not expose private session personalization data as a source.'
      : '',
  ].filter(Boolean).join('\n\n');

  const userPrompt = [
    'User request:',
    input.message,
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
): { category?: string; userId?: string } => {
  const maybe = value && typeof value === 'object' ? (value as any) : {};
  const category =
    typeof maybe.category === 'string' && maybe.category.trim().length > 0
      ? maybe.category.trim().slice(0, 100)
      : undefined;
  const userId =
    typeof maybe.userId === 'string' && maybe.userId.trim().length > 0
      ? maybe.userId.trim()
      : fallbackUserId;

  return {
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
  };
};

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
    context?: { category?: string; userId?: string };
  }
): Promise<AiProviderResponse> => {
  const safeMessage = sanitizeAiInput(message);
  const aiContext = await buildAiContext(safeMessage, options?.context?.userId);
  const { systemPrompt, userPrompt } = buildGroundedPrompt({
    message: safeMessage,
    contextText: aiContext.contextText,
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
      return {
        provider: 'vertex',
        reply: vertex.reply,
        citations: [...mapVertexCitations(vertex.citations), ...mapVertexCitations(aiContext.sources)],
        confidenceScore: vertex.confidenceScore ?? 75,
        processingTimeMs: vertex.processingTimeMs ?? 0,
      };
    }
  }

  if (isOpenAIConfigured()) {
    try {
      const openAi = await generateOpenAiResponse(userPrompt);
      return {
        ...openAi,
        citations: mapVertexCitations(aiContext.sources),
      };
    } catch (error) {
      console.warn('[AI] OpenAI provider failed; falling back to runtime provider chain:', error instanceof Error ? error.message : error);
    }
  }

  const runtime = await chatWithRuntimeAiProvider({
    message: userPrompt,
    systemPrompt,
    conversationHistory: options?.conversationHistory as Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  });

  return {
    provider: runtime.provider,
    reply: runtime.reply,
    citations: mapVertexCitations(aiContext.sources),
    confidenceScore: runtime.provider === 'local' ? 55 : 78,
    processingTimeMs: runtime.processingTimeMs,
  };
};

const buildDailyWisdomPrompt = (refreshNonce: string): string => {
  const focusThemes = [
    'privacy-preserving AI design',
    'community governance for digital well-being',
    'decentralized trust and cybersecurity resilience',
    'responsible identity systems and user autonomy',
    'ethical deployment practices in social learning platforms',
  ];
  const seed = Date.now() + refreshNonce.length;
  const selectedTheme = focusThemes[seed % focusThemes.length];
  const nowIso = new Date().toISOString();

  return [
    'Generate one concise Daily Wisdom insight for Conscious Network Hub.',
    'Write a fresh perspective that is not a repeated phrase.',
    'Keep it factual, practical, and under 90 words.',
    `Theme: ${selectedTheme}.`,
    `Timestamp: ${nowIso}.`,
    `Refresh nonce: ${refreshNonce}.`,
    'Include one specific action the user can take today.',
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
 * Process a platform issue report and send email
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
    let emailSent = false;

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

    // Send email to admin asynchronously (don't wait for it)
    try {
      console.log('[API] Sending issue report email...');
      const emailResult = await emailService.sendIssueReport({
        title,
        description,
        category,
        userEmail,
        priority,
        analysis
      });
      emailSent = emailResult?.success !== false;
      console.log('[API] ✅ Issue report email result:', emailResult);
    } catch (emailError) {
      console.error('[API] Failed to send email:', emailError);
      emailSent = false;
    }

    // Always return success response to frontend
    console.log('[API] Returning success response to client');
    res.json({
      ok: true,
      analysis: analysis || 'Issue report received and will be reviewed.',
      priority,
      suggestedActions: ['Issue has been forwarded to the team', 'You will receive updates via email'],
      reply: analysis || 'Issue report received and will be reviewed.',
      citations: [],
      confidenceScore: 80,
      processingTimeMs: 100,
      emailSent,
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
router.get('/status', async (req: Request, res: Response): Promise<void> => {
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
router.post('/reindex', async (_req: Request, res: Response): Promise<void> => {
  const status = await triggerAiContextCrawl('api');
  res.json({
    success: true,
    index: status,
  });
});

export default router;



