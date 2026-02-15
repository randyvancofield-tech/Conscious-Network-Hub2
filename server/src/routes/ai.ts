import { Router, Request, Response } from 'express';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  validateChatInput,
  requireCanonicalIdentity,
} from '../middleware';
import { getVertexAIService } from '../services/vertexAiService';
import { getKnowledgeContext, KnowledgeSource } from '../services/knowledgeService';
import emailService from '../services/emailService';
import { chatWithOpenAI } from "../services/openAiService";

const router = Router();
router.use(requireCanonicalIdentity);

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

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: object;
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface GroundingChunk {
  text?: string;
  web?: {
    uri: string;
    title: string;
  };
}

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

const mergeSources = (
  modelSources: Array<{ title?: string; url?: string; relevance?: number }> = [],
  knowledgeSources: KnowledgeSource[] = []
): GroundingChunk[] => {
  const normalized: GroundingChunk[] = [];
  const seen = new Set<string>();

  const pushChunk = (title?: string, url?: string, snippet?: string) => {
    if (!title) return;
    const key = `${title}|${url || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (url) {
      normalized.push({
        web: { uri: url, title }
      });
    } else if (snippet) {
      normalized.push({
        text: snippet
      });
    }
  };

  for (const source of modelSources) {
    pushChunk(source.title, source.url);
  }

  for (const source of knowledgeSources) {
    pushChunk(source.title, source.url, source.snippet);
  }

  return normalized.slice(0, 6);
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
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const reply = await chatWithOpenAI(message);

    res.json({
      provider: "openai",
      reply,
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({
      error: "AI service unavailable",
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
    const prompt =
      "Generate a short, professional, academically grounded daily insight focused on Ethical AI, cybersecurity, decentralized platforms, or blockchain-based social networks. Keep it concise and factual.";

    const reply = await chatWithOpenAI(prompt);

    res.json({
      provider: "openai",
      wisdom: reply,
      reply,
    });
  } catch (error) {
    console.error("AI wisdom error:", error);
    res.status(500).json({
      error: "Daily wisdom unavailable",
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
      normalizedTranscript.join('\n'),
    ].join('\n\n');

    const reply = await chatWithOpenAI(prompt);
    const parsed = parseMeetingSummary(reply);

    res.json({
      provider: 'openai',
      ...parsed,
      reply,
    });
  } catch (error) {
    console.error('Meeting summary error:', error);
    res.status(500).json({
      error: 'Meeting summarization unavailable',
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
    const { message, category = 'other', context, title: titleParam, userEmail } = req.body as any;

    const title = titleParam || 'Issue Report';
    const description = message;
    const reportEmail = process.env.REPORT_EMAIL || 'higherconscious.network1@gmail.com';

    let priority = 'MEDIUM';
    let analysis = '';
    let emailSent = false;

    // Wrap Vertex AI call with timeout to prevent hanging
    const aiTimeout = new Promise<{ priority: string; analysis: string }>((resolve) => {
      let completed = false;
      
      // Start AI analysis in parallel
      (async () => {
        try {
          console.log('[API] Attempting Vertex AI analysis...');
          const vertexAI = getVertexAIService();
          const response = await vertexAI.processPlatformIssue(title, description, category);
          
          if (!completed) {
            completed = true;
            console.log('[API] Vertex AI analysis complete');
            resolve({
              priority: response.priority || 'MEDIUM',
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
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  const requestStart = Date.now();
  console.log('[AI] GET /api/ai/trending received');
  try {
    const prompt =
      "List 5 current trending topics across ethical AI/governance, blockchain/Web3, and wellness/consciousness. For each, include a short explanation on a new line.";

    const reply = await chatWithOpenAI(prompt);

    const topics = reply
      .split('\n')
      .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(line => line.length > 3)
      .slice(0, 10);

    res.json({
      provider: "openai",
      topics: topics.length > 0 ? topics : [],
      insights: reply,
      reply,
      citations: [],
      confidenceScore: 75,
      processingTimeMs: Date.now() - requestStart,
    });
    console.log(`[AI] /trending response sent in ${Date.now() - requestStart}ms`);
    return;
  } catch (error) {
    console.error("Trending error:", error);
    res.status(500).json({
      error: "Failed to fetch trending topics",
    });
  }
});

export default router;



