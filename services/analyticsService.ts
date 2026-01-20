// Analytics service for tracking user behavior and engagement

export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  timestamp: number;
  data: any;
  duration?: number; // in milliseconds
}

export interface UserStats {
  totalQuestions: number;
  totalIssueReports: number;
  viewCount: { insight: number; qa: number; report: number; analytics: number };
  avgResponseTime: number;
  favoriteCount: number;
  lastActive: number;
  sessionDuration: number;
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private userStats: Map<string, UserStats> = new Map();
  private sessionStartTime = Date.now();
  private currentUserId: string | undefined;

  // Event tracking
  private readonly MAX_EVENTS = 1000;
  private readonly EVENT_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.initializeFromStorage();
  }

  /**
   * Set current user ID
   */
  setUserId(userId?: string): void {
    this.currentUserId = userId;
  }

  /**
   * Track event
   */
  trackEvent(eventType: string, data: any = {}, duration?: number): void {
    const event: AnalyticsEvent = {
      eventType,
      userId: this.currentUserId,
      timestamp: Date.now(),
      data,
      duration
    };

    this.events.push(event);

    // Cleanup if too many events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Update user stats
    if (this.currentUserId) {
      this.updateUserStats(eventType, duration);
    }

    this.persistToStorage();
  }

  /**
   * Track view mode change
   */
  trackViewChange(mode: 'insight' | 'qa' | 'report' | 'analytics'): void {
    this.trackEvent('view_change', { mode });
  }

  /**
   * Track question asked
   */
  trackQuestion(question: string, category: string, responseTime: number): void {
    this.trackEvent('question_asked', {
      questionLength: question.length,
      category,
      hasFollowUp: false
    }, responseTime);
  }

  /**
   * Track issue report
   */
  trackIssueReport(category: string, severity: string): void {
    this.trackEvent('issue_reported', {
      category,
      severity
    });
  }

  /**
   * Track response rating
   */
  trackResponseRating(entryId: string, rating: number): void {
    this.trackEvent('response_rated', {
      entryId,
      rating
    });
  }

  /**
   * Track favorite action
   */
  trackFavoriteAction(entryId: string, added: boolean): void {
    this.trackEvent('favorite_toggled', {
      entryId,
      added
    });
  }

  /**
   * Track message reaction
   */
  trackReaction(entryId: string, reaction: string): void {
    this.trackEvent('message_reacted', {
      entryId,
      reaction
    });
  }

  /**
   * Track conversation export
   */
  trackExport(format: 'markdown' | 'json'): void {
    this.trackEvent('conversation_exported', { format });
  }

  /**
   * Track voice input
   */
  trackVoiceInput(duration: number, success: boolean): void {
    this.trackEvent('voice_input', { success }, duration);
  }

  /**
   * Track search
   */
  trackSearch(query: string, resultCount: number): void {
    this.trackEvent('search', {
      queryLength: query.length,
      resultCount
    });
  }

  /**
   * Get user statistics
   */
  getUserStats(userId?: string): UserStats {
    const id = userId || this.currentUserId;
    if (!id) {
      return this.getDefaultStats();
    }

    return this.userStats.get(id) || this.getDefaultStats();
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    const recentEvents = this.events.filter(e => Date.now() - e.timestamp < 24 * 60 * 60 * 1000);

    const questionCount = recentEvents.filter(e => e.eventType === 'question_asked').length;
    const issueCount = recentEvents.filter(e => e.eventType === 'issue_reported').length;
    const ratingCount = recentEvents.filter(e => e.eventType === 'response_rated').length;

    const avgResponseTimes: number[] = recentEvents
      .filter(e => e.eventType === 'question_asked' && e.duration)
      .map(e => e.duration!) as number[];

    const avgResponseTime = avgResponseTimes.length > 0
      ? avgResponseTimes.reduce((a, b) => a + b) / avgResponseTimes.length
      : 0;

    const ratingValues = recentEvents
      .filter(e => e.eventType === 'response_rated')
      .map(e => e.data.rating);

    const avgRating = ratingValues.length > 0
      ? ratingValues.reduce((a: number, b: number) => a + b) / ratingValues.length
      : 0;

    return {
      period: '24 hours',
      totalEvents: recentEvents.length,
      questionsAsked: questionCount,
      issuesReported: issueCount,
      ratingsGiven: ratingCount,
      averageResponseTime: Math.round(avgResponseTime),
      averageRating: Math.round(avgRating * 100) / 100,
      uniqueUsers: new Set(recentEvents.map(e => e.userId)).size,
      sessionDuration: Math.round((Date.now() - this.sessionStartTime) / 1000)
    };
  }

  /**
   * Get trending topics
   */
  getTrendingTopics(limit: number = 5) {
    const categoryMap = new Map<string, number>();

    this.events
      .filter(e => e.eventType === 'question_asked')
      .forEach(e => {
        const category = e.data.category;
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

    return Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * Get most rated responses
   */
  getMostRatedResponses(limit: number = 5) {
    const ratingMap = new Map<string, { sum: number; count: number }>();

    this.events
      .filter(e => e.eventType === 'response_rated')
      .forEach(e => {
        const id = e.data.entryId;
        const existing = ratingMap.get(id) || { sum: 0, count: 0 };
        ratingMap.set(id, {
          sum: existing.sum + e.data.rating,
          count: existing.count + 1
        });
      });

    return Array.from(ratingMap.entries())
      .map(([id, stats]) => ({
        entryId: id,
        averageRating: stats.sum / stats.count,
        ratingCount: stats.count
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);
  }

  /**
   * Get user engagement score (0-100)
   */
  getUserEngagementScore(userId?: string): number {
    const id = userId || this.currentUserId;
    if (!id) return 0;

    const stats = this.userStats.get(id);
    if (!stats) return 0;

    const questionWeight = Math.min(stats.totalQuestions * 10, 30);
    const issueWeight = Math.min(stats.totalIssueReports * 5, 20);
    const favoriteWeight = Math.min(stats.favoriteCount * 10, 20);
    const ratingWeight = Object.values(stats.viewCount).reduce((a, b) => a + b) * 2;

    let score = questionWeight + issueWeight + favoriteWeight + Math.min(ratingWeight, 30);
    return Math.min(Math.round(score), 100);
  }

  /**
   * Export analytics data
   */
  exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        summary: this.getAnalyticsSummary(),
        events: this.events
      }, null, 2);
    } else {
      // CSV format
      let csv = 'Timestamp,Event Type,User ID,Duration,Data\n';
      this.events.forEach(event => {
        csv += `"${new Date(event.timestamp).toISOString()}","${event.eventType}","${event.userId}","${event.duration || ''}","${JSON.stringify(event.data).replace(/"/g, '""')}"\n`;
      });
      return csv;
    }
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
    this.persistToStorage();
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    return Math.round((Date.now() - this.sessionStartTime) / 1000);
  }

  /**
   * Private methods
   */

  private updateUserStats(eventType: string, duration?: number): void {
    if (!this.currentUserId) return;

    let stats = this.userStats.get(this.currentUserId) || this.getDefaultStats();

    switch (eventType) {
      case 'question_asked':
        stats.totalQuestions++;
        stats.viewCount.qa++;
        break;
      case 'issue_reported':
        stats.totalIssueReports++;
        stats.viewCount.report++;
        break;
      case 'view_change':
        // Updated in component
        break;
      case 'favorite_toggled':
        stats.favoriteCount++;
        break;
    }

    stats.lastActive = Date.now();
    this.userStats.set(this.currentUserId, stats);
  }

  private getDefaultStats(): UserStats {
    return {
      totalQuestions: 0,
      totalIssueReports: 0,
      viewCount: { insight: 0, qa: 0, report: 0, analytics: 0 },
      avgResponseTime: 0,
      favoriteCount: 0,
      lastActive: Date.now(),
      sessionDuration: 0
    };
  }

  private initializeFromStorage(): void {
    try {
      const stored = localStorage.getItem('ethical_ai_analytics');
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
      }
    } catch (error) {
      console.error('Failed to initialize analytics from storage:', error);
    }
  }

  private persistToStorage(): void {
    try {
      // Only keep recent events to avoid storage bloat
      const recentEvents = this.events.filter(e => Date.now() - e.timestamp < this.EVENT_RETENTION);
      localStorage.setItem('ethical_ai_analytics', JSON.stringify({ events: recentEvents }));
    } catch (error) {
      console.error('Failed to persist analytics to storage:', error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
