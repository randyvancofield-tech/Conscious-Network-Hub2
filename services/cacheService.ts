// Cache service for responses, wisdom, and conversation history

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

export interface ConversationEntry {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  sources?: any[];
  favorite?: boolean;
  rating?: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private conversationHistory: Map<string, ConversationEntry[]> = new Map();
  private favorites: Map<string, string[]> = new Map();

  // Configuration
  private readonly WISDOM_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly QA_TTL = 60 * 60 * 1000; // 1 hour
  private readonly TRENDING_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly HISTORY_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize from localStorage
   */
  private initializeStorage(): void {
    try {
      const stored = localStorage.getItem('ethical_ai_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.conversationHistory = new Map(parsed.conversations || []);
        this.favorites = new Map(parsed.favorites || []);
      }
    } catch (error) {
      console.error('Failed to initialize cache from storage:', error);
    }
  }

  /**
   * Persist cache to localStorage
   */
  private persistToStorage(): void {
    try {
      const data = {
        conversations: Array.from(this.conversationHistory.entries()),
        favorites: Array.from(this.favorites.entries())
      };
      localStorage.setItem('ethical_ai_cache', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist cache to storage:', error);
    }
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl: number = this.QA_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cache entry if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cache daily wisdom
   */
  setDailyWisdom(wisdom: string, sources: any[]): void {
    this.set(`wisdom_${new Date().toDateString()}`, { wisdom, sources }, this.WISDOM_TTL);
  }

  /**
   * Get cached daily wisdom
   */
  getDailyWisdom(): { wisdom: string; sources: any[] } | null {
    return this.get(`wisdom_${new Date().toDateString()}`);
  }

  /**
   * Cache Q&A response
   */
  setQAResponse(question: string, response: string, sources: any[]): void {
    const key = `qa_${this.hashQuestion(question)}`;
    this.set(key, { question, response, sources }, this.QA_TTL);
  }

  /**
   * Get cached Q&A response
   */
  getQAResponse(question: string): { question: string; response: string; sources: any[] } | null {
    const key = `qa_${this.hashQuestion(question)}`;
    return this.get(key);
  }

  /**
   * Add conversation entry
   */
  addConversationEntry(userId: string, entry: Omit<ConversationEntry, 'id' | 'timestamp'>): ConversationEntry {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const fullEntry: ConversationEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now()
    };

    const history = this.conversationHistory.get(userId)!;
    history.push(fullEntry);

    // Cleanup old entries
    this.cleanupOldHistory(userId);
    this.persistToStorage();

    return fullEntry;
  }

  /**
   * Get conversation history for user
   */
  getConversationHistory(userId: string): ConversationEntry[] {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Search conversation history
   */
  searchConversation(userId: string, query: string): ConversationEntry[] {
    const history = this.getConversationHistory(userId);
    return history.filter(entry =>
      entry.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Export conversation as markdown
   */
  exportConversationMarkdown(userId: string): string {
    const history = this.getConversationHistory(userId);
    let markdown = '# Conversation History\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;

    history.forEach(entry => {
      const role = entry.role === 'user' ? '👤 You' : '🤖 AI';
      const time = new Date(entry.timestamp).toLocaleString();
      markdown += `## ${role} - ${time}\n\n`;
      markdown += `${entry.content}\n\n`;

      if (entry.sources && entry.sources.length > 0) {
        markdown += `**Sources:** ${entry.sources.map((s: any) => s.title).join(', ')}\n\n`;
      }

      if (entry.rating !== undefined) {
        markdown += `**Rating:** ${entry.rating}/5\n\n`;
      }

      markdown += '---\n\n';
    });

    return markdown;
  }

  /**
   * Export conversation as JSON
   */
  exportConversationJSON(userId: string): string {
    const history = this.getConversationHistory(userId);
    return JSON.stringify({
      exported: new Date().toISOString(),
      entries: history
    }, null, 2);
  }

  /**
   * Add favorite conversation entry
   */
  addFavorite(userId: string, entryId: string): void {
    if (!this.favorites.has(userId)) {
      this.favorites.set(userId, []);
    }

    const favorites = this.favorites.get(userId)!;
    if (!favorites.includes(entryId)) {
      favorites.push(entryId);
      this.persistToStorage();
    }
  }

  /**
   * Remove favorite
   */
  removeFavorite(userId: string, entryId: string): void {
    const favorites = this.favorites.get(userId);
    if (favorites) {
      const index = favorites.indexOf(entryId);
      if (index > -1) {
        favorites.splice(index, 1);
        this.persistToStorage();
      }
    }
  }

  /**
   * Get favorite entries
   */
  getFavorites(userId: string): ConversationEntry[] {
    const history = this.getConversationHistory(userId);
    const favoriteIds = this.favorites.get(userId) || [];
    return history.filter(entry => favoriteIds.includes(entry.id));
  }

  /**
   * Rate conversation entry
   */
  rateEntry(userId: string, entryId: string, rating: number): void {
    const history = this.conversationHistory.get(userId);
    if (history) {
      const entry = history.find(e => e.id === entryId);
      if (entry) {
        entry.rating = Math.max(1, Math.min(5, rating));
        this.persistToStorage();
      }
    }
  }

  /**
   * Clear conversation history for user
   */
  clearConversationHistory(userId: string): void {
    this.conversationHistory.delete(userId);
    this.favorites.delete(userId);
    this.persistToStorage();
  }

  /**
   * Cleanup old conversation entries beyond retention period
   */
  private cleanupOldHistory(userId: string): void {
    const history = this.conversationHistory.get(userId);
    if (!history) return;

    const now = Date.now();
    const filtered = history.filter(entry => now - entry.timestamp < this.HISTORY_RETENTION);

    if (filtered.length < history.length) {
      this.conversationHistory.set(userId, filtered);
    }
  }

  /**
   * Hash question for cache key
   */
  private hashQuestion(question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i++) {
      const char = question.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    cacheEntries: number;
    totalUsers: number;
    totalConversations: number;
    storageSizeKB: number;
  } {
    const storageSize = new Blob([JSON.stringify(localStorage)]).size / 1024;
    let totalConversations = 0;

    this.conversationHistory.forEach(history => {
      totalConversations += history.length;
    });

    return {
      cacheSize: this.cache.size,
      cacheEntries: this.cache.size,
      totalUsers: this.conversationHistory.size,
      totalConversations,
      storageSizeKB: storageSize
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
