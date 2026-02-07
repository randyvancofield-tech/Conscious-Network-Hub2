import { Router, Request, Response } from 'express';
import { validateChatInput } from '../middleware';
import { getVertexAIService } from '../services/vertexAiService';
import { getKnowledgeContext, KnowledgeSource } from '../services/knowledgeService';
import emailService from '../services/emailService';

const router = Router();

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
    const { message, conversationId, context, conversationHistory } =
      req.body as ChatRequest;
    const trimmedHistory = conversationHistory ? conversationHistory.slice(-40) : undefined;

    // Get Vertex AI service
    let response;
    let knowledge: Awaited<ReturnType<typeof getKnowledgeContext>> | null = null;
    try {
      const vertexAI = getVertexAIService();
      knowledge = await getKnowledgeContext(message, {
        includeTrusted: true,
        includeProfile: true,
        limit: 4,
      });
      const enrichedContext = {
        ...(context || {}),
        knowledgeContext: knowledge.contextText,
        sources: knowledge.sources,
        hcnProfile: knowledge.hcnProfile,
      };

      // Call Vertex AI
      response = await vertexAI.chat(
        message,
        trimmedHistory,
        enrichedContext
      );
    } catch (innerError: any) {
      console.warn('Vertex AI call failed, returning fallback response for dev:', innerError?.message || innerError);
      // Minimal fallback to allow frontend development without Vertex AI access
      res.json({
        reply: `Local fallback: Unable to reach Vertex AI model. Here's a sample reply to your question: "${message.substring(0, 200)}".`,
        citations: [],
        usage: {},
        confidenceScore: 60,
        processingTimeMs: 0,
        conversationId: conversationId || `conv_${Date.now()}`,
      });
      return;
    }

    const citations = mergeSources(response.citations || [], knowledge?.sources || []);

    // Send response
    res.json({
      reply: response.reply,
      citations,
      usage: response.usage || {},
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
      conversationId: conversationId || `conv_${Date.now()}`,
    });
  } catch (error) {
    console.error('Chat Error:', error);

    res.status(500).json({
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/wisdom
 * Get daily wisdom
 */
router.post('/wisdom', async (req: Request, res: Response): Promise<void> => {
  try {
    let response;
    try {
      const vertexAI = getVertexAIService();
      const knowledge = await getKnowledgeContext(
        `daily wisdom ${new Date().toISOString()} ethical AI consciousness decentralization`,
        { includeTrusted: true, includeProfile: true, limit: 3 }
      );
      response = await vertexAI.chat(
        `Provide a brief, inspiring piece of daily wisdom for ${new Date().toDateString()} focused on ethical AI, consciousness, decentralization, and community wellness. Include 1-2 sentences and keep it grounded in trusted sources.`,
        [],
        {
          knowledgeContext: knowledge.contextText,
          sources: knowledge.sources,
          hcnProfile: knowledge.hcnProfile,
          category: 'wisdom'
        }
      );
      const citations = mergeSources(response.citations || [], knowledge.sources);
      res.json({
        wisdom: response.reply,
        citations,
        confidenceScore: response.confidenceScore,
        processingTimeMs: response.processingTimeMs,
      });
      return;
    } catch (innerError: any) {
      console.warn('Vertex AI wisdom generation failed, returning fallback:', innerError?.message || innerError);
      res.json({
        wisdom: `Local fallback wisdom (${new Date().toDateString()}): Practice compassion and guard privacy as fundamental rights.`,
        citations: [],
        confidenceScore: 75,
        processingTimeMs: 0,
      });
      return;
    }
  } catch (error) {
    console.error('Wisdom Error:', error);

    res.status(500).json({
      error: 'Failed to generate wisdom',
      message: error instanceof Error ? error.message : 'Unknown error',
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
  try {
    let response;
    try {
      const vertexAI = getVertexAIService();
      const knowledge = await getKnowledgeContext(
        'trending ethical AI governance blockchain web3 wellness consciousness',
        { includeTrusted: true, includeProfile: false, limit: 4 }
      );
      response = await vertexAI.chat(
        `List 5 current trending topics across ethical AI/governance, blockchain/Web3, and wellness/consciousness. For each, include a short explanation.`,
        [],
        {
          knowledgeContext: knowledge.contextText,
          sources: knowledge.sources,
          category: 'trending'
        }
      );

      const topics = response.reply
        .split('\n')
        .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(line => line.length > 3)
        .slice(0, 10);

      res.json({
        topics: topics.length > 0 ? topics : [],
        insights: response.reply,
        citations: mergeSources(response.citations || [], knowledge.sources),
      });
      return;
    } catch (innerError: any) {
      console.warn('Vertex AI trending fetch failed, returning fallback:', innerError?.message || innerError);
      res.json({
        topics: ['AI Ethics', 'Privacy Protection', 'Decentralization'],
        insights: 'Local fallback: Unable to fetch live trending data.',
        citations: [],
      });
      return;
    }
  } catch (error) {
    console.error('Trending Error:', error);

    res.status(500).json({
      error: 'Failed to fetch trending topics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
