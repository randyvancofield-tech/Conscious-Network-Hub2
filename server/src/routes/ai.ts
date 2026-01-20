import { Router, Request, Response } from 'express';
import { validateChatInput } from '../middleware';
import { getVertexAIService } from '../services/vertexAiService';

const router = Router();

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: object;
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * POST /api/ai/chat
 * Send a message to the AI and get a response
 */
router.post('/chat', validateChatInput, async (req: Request, res: Response) => {
  try {
    const { message, conversationId, context, conversationHistory } =
      req.body as ChatRequest;

    // Get Vertex AI service
    const vertexAI = getVertexAIService();

    // Call Vertex AI
    const response = await vertexAI.chat(
      message,
      conversationHistory,
      context
    );

    // Send response
    res.json({
      reply: response.reply,
      citations: response.citations || [],
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
router.post('/wisdom', async (req: Request, res: Response) => {
  try {
    const vertexAI = getVertexAIService();
    const response = await vertexAI.generateWisdom();

    res.json({
      wisdom: response.reply,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
    });
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
 * Process a platform issue report
 */
router.post('/report-issue', validateChatInput, async (req: Request, res: Response) => {
  try {
    const { message, category = 'other', context } = req.body as any;

    // For this endpoint, we expect title and description in the message
    // Or they can be provided separately
    const title = (req.body as any).title || 'Issue Report';
    const description = message;

    const vertexAI = getVertexAIService();
    const response = await vertexAI.processPlatformIssue(
      title,
      description,
      category
    );

    res.json({
      analysis: response.reply,
      priority: response.priority,
      suggestedActions: response.suggestedActions,
      confidenceScore: response.confidenceScore,
      processingTimeMs: response.processingTimeMs,
    });
  } catch (error) {
    console.error('Issue Report Error:', error);

    res.status(500).json({
      error: 'Failed to process issue report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/trending
 * Get trending topics
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const vertexAI = getVertexAIService();
    const response = await vertexAI.getTrendingTopics();

    res.json({
      topics: response.topics,
      insights: response.insights,
    });
  } catch (error) {
    console.error('Trending Error:', error);

    res.status(500).json({
      error: 'Failed to fetch trending topics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
