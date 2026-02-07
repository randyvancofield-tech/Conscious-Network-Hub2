/**
 * Backend API Service for Conscious Network Hub
 * 
 * This service communicates with the secure backend API instead of calling
 * Google Cloud Vertex AI directly. This ensures API keys are never exposed
 * to the frontend.
 */

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export interface GroundingChunk {
  text?: string;
  web?: {
    uri: string;
    title: string;
  };
}

export interface EnhancedResponse {
  text: string;
  groundingChunks: GroundingChunk[];
  confidenceScore: number; // 0-100
  sourceCount: number;
  processingTimeMs: number;
  trendingTopics?: string[];
}

// Get backend API URL from environment or use default
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class BackendAPIService {
  private baseUrl: string;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private activeHistoryKey: string;
  private readonly maxHistoryEntries = 20;

  constructor() {
    this.baseUrl = BACKEND_URL;
    this.activeHistoryKey = this.getHistoryKey();
    this.loadConversationHistory();
  }

  /**
   * Send a chat message to the backend API
   */
  async askEthicalAI(
    question: string,
    context?: { category?: string; userId?: string },
    onStream?: (chunk: string) => void
  ): Promise<EnhancedResponse> {
    try {
      // Ensure we load the correct user-scoped history
      this.loadConversationHistory(context?.userId);

      const response = await fetch(`${this.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          context,
          conversationHistory: this.conversationHistory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get response from backend');
      }

      const data = await response.json();

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: question },
        { role: 'assistant', content: data.reply }
      );

      if (this.conversationHistory.length > this.maxHistoryEntries) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryEntries);
      }

      this.saveConversationHistory();

      return {
        text: data.reply,
        groundingChunks: data.citations || [],
        confidenceScore: data.confidenceScore || 75,
        sourceCount: (data.citations || []).length,
        processingTimeMs: data.processingTimeMs || 0,
      };
    } catch (error) {
      console.error('Backend API Error:', error);
      throw error;
    }
  }

  /**
   * Get daily wisdom from backend
   */
  async getDailyWisdom(): Promise<EnhancedResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/wisdom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch daily wisdom');
      }

      const data = await response.json();

      return {
        text: data.wisdom,
        groundingChunks: [],
        confidenceScore: data.confidenceScore || 80,
        sourceCount: 0,
        processingTimeMs: data.processingTimeMs || 0,
      };
    } catch (error) {
      console.error('Wisdom Fetch Error:', error);
      throw error;
    }
  }

  /**
   * Process a platform issue report
   */
  async processPlatformIssue(issue: {
    title: string;
    description: string;
    category: string;
    userEmail?: string;
  }): Promise<EnhancedResponse & { priority?: string; nextSteps?: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/report-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: issue.title,
          message: issue.description,
          category: issue.category,
          userEmail: issue.userEmail,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process issue report');
      }

      const data = await response.json();

      return {
        text: data.analysis,
        groundingChunks: [],
        confidenceScore: data.confidenceScore || 80,
        sourceCount: 0,
        processingTimeMs: data.processingTimeMs || 0,
        priority: data.priority,
        nextSteps: data.suggestedActions,
      };
    } catch (error) {
      console.error('Issue Report Error:', error);
      throw error;
    }
  }

  /**
   * Generate suggested follow-up questions
   */
  async generateSuggestedQuestions(
    lastQuestion: string,
    lastResponse: string
  ): Promise<string[]> {
    // Generate questions based on the last exchange
    // This is a simple implementation - you could also call the backend
    const keywords = this.extractKeywords(lastResponse);
    const suggestions = [
      `Can you elaborate more on ${keywords[0] || 'that'}?`,
      `How does this relate to privacy and security?`,
      `What are the next steps or implications?`,
    ];

    return suggestions;
  }

  /**
   * Get trending topics
   */
  async getTrendingInsights(): Promise<{
    topics: string[];
    insights: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/trending`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trending topics');
      }

      const data = await response.json();

      return {
        topics: data.topics || [],
        insights: data.insights || '',
      };
    } catch (error) {
      console.error('Trending Topics Error:', error);
      return {
        topics: ['AI Ethics', 'Privacy Protection', 'Decentralization'],
        insights: 'Unable to fetch live trending data',
      };
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(userId?: string): void {
    this.loadConversationHistory(userId);
    this.conversationHistory = [];
    localStorage.removeItem(this.activeHistoryKey);
  }

  /**
   * Get current conversation history
   */
  getHistory(userId?: string): Array<{ role: string; content: string }> {
    this.loadConversationHistory(userId);
    return [...this.conversationHistory];
  }

  /**
   * Save conversation history to localStorage
   */
  private saveConversationHistory(): void {
    try {
      localStorage.setItem(
        this.activeHistoryKey,
        JSON.stringify(this.conversationHistory)
      );
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  /**
   * Load conversation history from localStorage
   */
  private loadConversationHistory(userId?: string): void {
    this.activeHistoryKey = this.getHistoryKey(userId);
    try {
      const saved = localStorage.getItem(this.activeHistoryKey);
      if (saved) {
        this.conversationHistory = JSON.parse(saved);
      } else {
        this.conversationHistory = [];
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
      this.conversationHistory = [];
    }
  }

  private getHistoryKey(userId?: string): string {
    return `conversation_history_${userId || 'default'}`;
  }

  /**
   * Extract keywords from text for suggestions
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
    ]);

    return words
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .slice(0, 3);
  }
}

// Export singleton instance
const backendAPI = new BackendAPIService();

export default backendAPI;

// Also export individual functions for compatibility with existing code
export async function askEthicalAI(
  question: string,
  context?: { category?: string; userId?: string },
  onStream?: (chunk: string) => void
): Promise<EnhancedResponse> {
  return backendAPI.askEthicalAI(question, context, onStream);
}

export async function getDailyWisdom(): Promise<EnhancedResponse> {
  return backendAPI.getDailyWisdom();
}

export async function processPlatformIssue(issue: {
  title: string;
  description: string;
  category: string;
  userEmail?: string;
}): Promise<EnhancedResponse & { priority?: string; nextSteps?: string[] }> {
  return backendAPI.processPlatformIssue(issue);
}

export async function getTrendingInsights(): Promise<{
  topics: string[];
  insights: string;
}> {
  return backendAPI.getTrendingInsights();
}

export async function generateSuggestedQuestions(
  lastQuestion: string,
  lastResponse: string
): Promise<string[]> {
  return backendAPI.generateSuggestedQuestions(lastQuestion, lastResponse);
}
