import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import type { KnowledgeSource } from './knowledgeService';

interface VertexAIConfig {
  projectId: string;
  region: string;
  model?: string;
}

interface ChatResponse {
  reply: string;
  citations?: Array<{
    title: string;
    url?: string;
    relevance?: number;
  }>;
  usage?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
  confidenceScore?: number;
  processingTimeMs?: number;
}

interface AIContext {
  category?: string;
  userId?: string;
  knowledgeContext?: string;
  sources?: KnowledgeSource[];
  hcnProfile?: string;
}

export class VertexAIService {
  private vertexAI: VertexAI;
  private model: string;
  private projectId: string;
  private region: string;

  constructor(config: VertexAIConfig) {
    this.projectId = config.projectId;
    this.region = config.region;
    this.model = config.model || 'gemini-1.5-flash-001';

    // Initialize Vertex AI - uses Application Default Credentials
    // In dev: set GOOGLE_APPLICATION_CREDENTIALS env var
    // In prod: use service account attached to Cloud Run/Compute Engine
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.region,
    });
  }

  /**
   * Send a chat message to Gemini via Vertex AI
   */
  async chat(
    message: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    context?: AIContext
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const generativeModel = this.vertexAI.getGenerativeModel({
        model: this.model,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
        systemInstruction: this.getSystemPrompt(context),
      });

      // Build chat history
      const history = (conversationHistory || []).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Start chat session
      const chat = generativeModel.startChat({ history });

      // Send message
      const response = await chat.sendMessage(message);

      const processingTime = Date.now() - startTime;

      // Extract response text
      const reply =
        response.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Unable to generate response';

      // Calculate confidence score based on model response
      const confidenceScore = this.calculateConfidence(response);

      // Extract citations if available
      const citations = this.extractCitations(response);

      // Get token usage if available
      const usage = response.response.usageMetadata
        ? {
            promptTokens: response.response.usageMetadata.promptTokenCount,
            responseTokens: response.response.usageMetadata.candidatesTokenCount,
            totalTokens: response.response.usageMetadata.totalTokenCount,
          }
        : undefined;

      return {
        reply,
        citations,
        usage,
        confidenceScore,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      console.error('Vertex AI Chat Error:', error);
      throw new Error(`Failed to process chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate daily wisdom
   */
  async generateWisdom(): Promise<ChatResponse> {
    const wisdomPrompt =
      'Provide a brief, inspiring piece of ethical AI wisdom focused on autonomy, privacy, and community consciousness. Keep it under 100 words.';

    return this.chat(wisdomPrompt);
  }

  /**
   * Process a platform issue/bug report
   */
  async processPlatformIssue(
    title: string,
    description: string,
    category: string
  ): Promise<ChatResponse & { priority?: string; suggestedActions?: string[] }> {
    const issuePrompt = `
You are an AI assistant helping to triage and analyze platform issues for Conscious Network Hub.

Issue Title: ${title}
Category: ${category}
Description: ${description}

Please provide:
1. A brief analysis of the issue
2. Priority level (CRITICAL, HIGH, MEDIUM, LOW)
3. 2-3 suggested next steps

Format your response with clear sections.
    `.trim();

    const response = await this.chat(issuePrompt);

    // Extract priority from response
    const priority = this.extractPriority(response.reply);
    const suggestedActions = this.extractActions(response.reply);

    return {
      ...response,
      priority,
      suggestedActions,
    };
  }

  /**
   * Get trending topics in AI/blockchain/wellness
   */
  async getTrendingTopics(): Promise<{ topics: string[]; insights: string }> {
    const trendPrompt = `
What are the top 5 current trending topics in:
1. Ethical AI and AI governance
2. Blockchain and Web3
3. Wellness and consciousness

List them briefly with 1-2 sentence explanations for each.
    `.trim();

    const response = await this.chat(trendPrompt);

    // Parse trending topics from response
    const topics = this.parseTopics(response.reply);

    return {
      topics,
      insights: response.reply,
    };
  }

  private getSystemPrompt(context?: AIContext): string {
    let basePrompt = `You are an ethical AI assistant for Conscious Network Hub, focused on:
- Restoring autonomy and protecting identity
- Community-centered decentralized learning
- Transparent AI practices
- Privacy-first architecture

Be helpful, honest, and clear in your responses.

You must cite sources whenever possible and avoid fabricating sources.`;

    if (context?.hcnProfile) {
      basePrompt += `\n\nHCN Official Profile:\n${context.hcnProfile}`;
    }

    if (context?.knowledgeContext) {
      basePrompt += `\n\nRelevant Knowledge:\n${context.knowledgeContext}`;
    }

    if (context?.sources && context.sources.length > 0) {
      const sourcesList = context.sources
        .map(source => `- ${source.title}${source.url ? ` (${source.url})` : ''}`)
        .join('\n');
      basePrompt += `\n\nGrounding Sources (use when relevant):\n${sourcesList}`;
    }

    if (context?.category) {
      basePrompt += `\n\nCategory: ${context.category}`;
    }

    return basePrompt;
  }

  private calculateConfidence(response: any): number {
    // Simple confidence calculation based on response structure
    // In production, you might use more sophisticated metrics
    const hasContent =
      response.response.candidates?.[0]?.content?.parts?.length > 0;
    const isComplete = response.response.candidates?.[0]?.finishReason === 'STOP';
    const hasSafetyRatings = response.response.candidates?.[0]?.safetyRatings;

    let score = 50; // base score

    if (hasContent) score += 30;
    if (isComplete) score += 15;
    if (hasSafetyRatings) score += 5;

    return Math.min(100, score);
  }

  private extractCitations(response: any): Array<{
    title: string;
    url?: string;
    relevance?: number;
  }> {
    // Vertex AI responses may include citations in certain models
    // This is a placeholder for future citation extraction
    const citations: Array<{ title: string; url?: string; relevance?: number }> =
      [];

    // In production, parse citations from response metadata if available
    // response.response.candidates?.[0]?.citations?.[0]

    return citations;
  }

  private extractPriority(text: string): string {
    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const upperText = text.toUpperCase();

    for (const priority of priorities) {
      if (upperText.includes(priority)) {
        return priority;
      }
    }

    return 'MEDIUM'; // default
  }

  private extractActions(text: string): string[] {
    // Simple extraction of suggested actions (numbered or bulleted items)
    const lines = text.split('\n');
    const actions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d+\./.test(trimmed) || /^[-*•]/.test(trimmed)) {
        const action = trimmed.replace(/^[\d.•*-]\s*/, '').trim();
        if (action && action.length > 5) {
          actions.push(action);
        }
      }
    }

    return actions.slice(0, 3); // limit to 3 actions
  }

  private parseTopics(text: string): string[] {
    // Simple topic extraction - split by newlines and filter
    const lines = text.split('\n');
    const topics: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.includes(':') && trimmed.length > 3) {
        // Extract topic name (before dash or colon if present)
        const topic = trimmed.split(/[-:]/)[0].trim();
        if (topic && !topic.includes('.')) {
          topics.push(topic);
        }
      }
    }

    return topics.filter((t) => t.length > 2).slice(0, 10);
  }
}

// Export singleton instance
let vertexAIInstance: VertexAIService | null = null;

export function initializeVertexAI(config: VertexAIConfig): VertexAIService {
  if (!vertexAIInstance) {
    vertexAIInstance = new VertexAIService(config);
  }
  return vertexAIInstance;
}

export function getVertexAIService(): VertexAIService {
  if (!vertexAIInstance) {
    throw new Error(
      'VertexAI not initialized. Call initializeVertexAI first.'
    );
  }
  return vertexAIInstance;
}
