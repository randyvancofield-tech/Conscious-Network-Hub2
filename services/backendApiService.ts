/**
 * Backend API Service for Conscious Network Hub
 * 
 * This service communicates with the secure backend API instead of calling
 * Google Cloud Vertex AI directly. This ensures API keys are never exposed
 * to the frontend.
 */
import { api, getBackendBaseUrl } from './apiClient';

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

export interface MeetingSummary {
  summary: string;
  decisions: string[];
  actionItems: Array<{
    owner: string;
    task: string;
    dueDate: string;
  }>;
}

export interface ImmersiveSessionEventInput {
  eventType: 'start' | 'end' | 'error';
  sessionMode?: 'immersive-ar' | 'immersive-vr' | 'unknown' | null;
  deviceProfile?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  userAgent?: string | null;
  timestamp?: string | null;
}

export interface DirectoryUserEntry {
  id: string;
  name: string;
  handle: string | null;
}

export interface ProviderInviteGroupMember {
  userId: string | null;
  username: string;
  displayName: string;
}

export interface ProviderInviteGroup {
  id: string;
  name: string;
  members: ProviderInviteGroupMember[];
  createdAt: string;
  updatedAt: string;
}

export type MeetingSessionMode = 'virtual' | 'solo' | 'immersive-5d';
export type MeetingSessionStatus = 'scheduled' | 'live' | 'ended';

export interface MeetingSessionParticipant {
  id: string;
  kind: 'provider' | 'user' | 'guest';
  displayName: string;
  joinedAtMs: number;
}

export interface MeetingSessionInvite {
  key: string;
  userId: string | null;
  username: string;
  displayName: string;
  source: 'direct' | 'group';
  groupId: string | null;
  invitedAtMs: number;
}

export interface MeetingSessionSummary {
  id: string;
  title: string;
  mode: MeetingSessionMode;
  status: MeetingSessionStatus;
  providerDid: string;
  maxViewers: number;
  participants: MeetingSessionParticipant[];
  invitedMembers: MeetingSessionInvite[];
  createdAtMs: number;
  updatedAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export interface MeetingExternalLink {
  id: string;
  inviteToken: string;
  joinUrl: string;
  expiresAtMs: number;
  maxUses: number;
  uses: number;
}

export interface ExternalMeetingPreview {
  session: {
    id: string;
    title: string;
    mode: MeetingSessionMode;
    status: MeetingSessionStatus;
    maxViewers: number;
    participantCount: number;
    remainingCapacity: number;
  };
  link: {
    id: string;
    expiresAtMs: number;
    uses: number;
    maxUses: number;
  };
}

export interface ExternalMeetingJoinResult {
  guest: {
    participantId: string;
    name: string;
    email: string;
  };
  guestSessionToken: string;
  session: MeetingSessionSummary;
}

export interface NativeProviderSessionResult {
  token: string;
  expiresAt: number;
  session: {
    id: string;
    did: string;
    scopes: string[];
    issuedAt: string;
    expiresAt: string;
  };
}

class BackendAPIService {
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private activeHistoryKey: string;
  private readonly maxHistoryEntries = 40;

  constructor() {
    this.activeHistoryKey = this.getHistoryKey();
    this.loadConversationHistory();
  }

  private getBackendLabel(): string {
    return getBackendBaseUrl() || 'same-origin /api';
  }

  /**
   * Send a chat message to the backend API
   */
  async askEthicalAI(
    question: string,
    context?: { category?: string; userId?: string },
    _onStream?: (chunk: string) => void
  ): Promise<EnhancedResponse> {
    try {
      // Ensure we load the correct user-scoped history
      this.loadConversationHistory(context?.userId);

      const data = await api<any>('/ai/chat', {
        method: 'POST',
        body: {
          message: question,
          context,
          conversationHistory: this.conversationHistory,
        },
      });

      if (!data) {
        console.error('Empty response body from /api/ai/chat');
        throw new Error('Backend returned empty response for /api/ai/chat');
      }

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: question },
        { role: 'assistant', content: data.reply || data.test || 'No reply returned by backend.' }
      );

      if (this.conversationHistory.length > this.maxHistoryEntries) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryEntries);
      }

      this.saveConversationHistory();

      return {
        text: data.reply || data.test || 'No reply returned by backend.',
        groundingChunks: data.citations || [],
        confidenceScore: data.confidenceScore || 75,
        sourceCount: (data.citations || []).length,
        processingTimeMs: data.processingTimeMs || 0,
      };
    } catch (error) {
      console.error('Backend API Error:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
        return {
          text: `Local fallback: AI backend unreachable at ${this.getBackendLabel()}. Please start or configure the backend.`,
          groundingChunks: [],
          confidenceScore: 50,
          sourceCount: 0,
          processingTimeMs: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Get daily wisdom from backend
   */
  async getDailyWisdom(): Promise<EnhancedResponse> {
    try {
      const refreshNonce = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const data = await api<any>(`/ai/wisdom?refresh=${encodeURIComponent(refreshNonce)}`, {
        method: 'POST',
        cache: 'no-store',
        body: {
          refreshNonce,
        },
      });

      if (!data || (typeof data.reply === 'undefined' && typeof data.wisdom === 'undefined')) {
        console.error('Invalid or empty JSON from /api/ai/wisdom:', data);
        throw new Error('Invalid JSON from backend');
      }

      return {
        text: data.reply || data.wisdom,
        groundingChunks: data.citations || [],
        confidenceScore: data.confidenceScore || 80,
        sourceCount: (data.citations || []).length,
        processingTimeMs: data.processingTimeMs || 0,
      };
    } catch (error) {
      console.error('Wisdom Fetch Error:', error);
      const message = error instanceof Error ? error.message : String(error);
      const lowered = message.toLowerCase();
      const isNetworkError =
        (error instanceof TypeError && lowered.includes('failed to fetch')) ||
        lowered.includes('networkerror');
      if (isNetworkError) {
        return {
          text: `Local fallback wisdom: backend unreachable at ${this.getBackendLabel()}.`,
          groundingChunks: [],
          confidenceScore: 60,
          sourceCount: 0,
          processingTimeMs: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Summarize a meeting transcript
   */
  async summarizeMeeting(transcript: string[]): Promise<MeetingSummary | null> {
    try {
      const data = await api<any>('/ai/summarize-meeting', {
        method: 'POST',
        body: { transcript },
      });
      if (!data || typeof data.summary !== 'string') {
        throw new Error('Invalid JSON from backend');
      }

      const decisions = Array.isArray(data.decisions)
        ? data.decisions
            .filter((decision: unknown): decision is string => typeof decision === 'string')
            .map((decision: string) => decision.trim())
            .filter((decision: string) => decision.length > 0)
        : [];

      const actionItems = Array.isArray(data.actionItems)
        ? data.actionItems
            .map((item: any) => ({
              owner: typeof item?.owner === 'string' ? item.owner.trim() : '',
              task: typeof item?.task === 'string' ? item.task.trim() : '',
              dueDate: typeof item?.dueDate === 'string' ? item.dueDate.trim() : '',
            }))
            .filter((item: { owner: string; task: string; dueDate: string }) => (
              item.owner.length > 0 || item.task.length > 0 || item.dueDate.length > 0
            ))
        : [];

      return {
        summary: data.summary.trim(),
        decisions,
        actionItems,
      };
    } catch (error) {
      console.error('Meeting Summary Error:', error);
      return null;
    }
  }

  async reportImmersiveSessionEvent(input: ImmersiveSessionEventInput): Promise<void> {
    try {
      await api('/immersive/session-event', {
        method: 'POST',
        body: {
          eventType: input.eventType,
          sessionMode: input.sessionMode || 'unknown',
          deviceProfile: input.deviceProfile || null,
          durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
          errorMessage: input.errorMessage || null,
          userAgent: input.userAgent || null,
          timestamp: input.timestamp || new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('Immersive telemetry unavailable:', error);
    }
  }

  async getUserDirectory(): Promise<DirectoryUserEntry[]> {
    try {
      const data = await api<any>('/user/directory', { method: 'GET' });
      if (!data || !Array.isArray(data.users)) {
        return [];
      }

      return data.users
        .map((entry: any) => ({
          id: String(entry?.id || '').trim(),
          name: String(entry?.name || 'Node').trim() || 'Node',
          handle: typeof entry?.handle === 'string' && entry.handle.trim() ? entry.handle.trim() : null,
        }))
        .filter((entry: DirectoryUserEntry) => entry.id.length > 0);
    } catch {
      return [];
    }
  }

  async createNativeProviderControlSession(): Promise<NativeProviderSessionResult | null> {
    try {
      const data = await api<any>('/provider/auth/session', {
        method: 'POST',
      });
      if (!data?.token || !data?.session?.id) {
        return null;
      }
      return data as NativeProviderSessionResult;
    } catch {
      return null;
    }
  }

  async listProviderInviteGroups(providerToken: string): Promise<ProviderInviteGroup[]> {
    const token = String(providerToken || '').trim();
    if (!token) return [];
    try {
      const data = await api<any>('/provider/session/groups', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!data || !Array.isArray(data.groups)) return [];
      return data.groups as ProviderInviteGroup[];
    } catch {
      return [];
    }
  }

  async createProviderInviteGroup(
    providerToken: string,
    groupName: string
  ): Promise<ProviderInviteGroup | null> {
    const token = String(providerToken || '').trim();
    const normalizedName = String(groupName || '').trim();
    if (!token || !normalizedName) return null;
    try {
      const data = await api<any>('/provider/session/groups', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { name: normalizedName },
      });
      if (!data?.group) return null;
      return data.group as ProviderInviteGroup;
    } catch {
      return null;
    }
  }

  async addProviderInviteGroupMember(
    providerToken: string,
    groupId: string,
    username: string
  ): Promise<ProviderInviteGroup | null> {
    const token = String(providerToken || '').trim();
    const normalizedGroupId = String(groupId || '').trim();
    const normalizedUsername = String(username || '').trim();
    if (!token || !normalizedGroupId || !normalizedUsername) return null;
    try {
      const data = await api<any>(`/provider/session/groups/${encodeURIComponent(normalizedGroupId)}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { username: normalizedUsername },
      });
      if (!data?.group) return null;
      return data.group as ProviderInviteGroup;
    } catch {
      return null;
    }
  }

  async listProviderMeetingSessions(providerToken: string): Promise<MeetingSessionSummary[]> {
    const token = String(providerToken || '').trim();
    if (!token) return [];
    try {
      const data = await api<any>('/meeting/provider/sessions', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!data || !Array.isArray(data.sessions)) return [];
      return data.sessions as MeetingSessionSummary[];
    } catch {
      return [];
    }
  }

  async createProviderMeetingSession(
    providerToken: string,
    input: { title: string; mode: MeetingSessionMode; maxViewers: number }
  ): Promise<MeetingSessionSummary | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<any>('/meeting/provider/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          title: input.title,
          mode: input.mode,
          maxViewers: input.maxViewers,
        },
      });
      if (!data?.session) return null;
      return data.session as MeetingSessionSummary;
    } catch {
      return null;
    }
  }

  async startProviderMeetingSession(
    providerToken: string,
    sessionId: string
  ): Promise<MeetingSessionSummary | null> {
    const token = String(providerToken || '').trim();
    const id = String(sessionId || '').trim();
    if (!token || !id) return null;
    try {
      const data = await api<any>(`/meeting/provider/sessions/${encodeURIComponent(id)}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!data?.session) return null;
      return data.session as MeetingSessionSummary;
    } catch {
      return null;
    }
  }

  async endProviderMeetingSession(
    providerToken: string,
    sessionId: string
  ): Promise<boolean> {
    const token = String(providerToken || '').trim();
    const id = String(sessionId || '').trim();
    if (!token || !id) return false;
    try {
      await api(`/meeting/provider/sessions/${encodeURIComponent(id)}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async inviteUsersToProviderMeetingSession(
    providerToken: string,
    sessionId: string,
    input: { usernames?: string[]; groupIds?: string[] }
  ): Promise<MeetingSessionSummary | null> {
    const token = String(providerToken || '').trim();
    const id = String(sessionId || '').trim();
    if (!token || !id) return null;
    try {
      const data = await api<any>(`/meeting/provider/sessions/${encodeURIComponent(id)}/invite-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          usernames: Array.isArray(input.usernames) ? input.usernames : [],
          groupIds: Array.isArray(input.groupIds) ? input.groupIds : [],
        },
      });
      if (!data?.session) return null;
      return data.session as MeetingSessionSummary;
    } catch {
      return null;
    }
  }

  async createProviderMeetingExternalLink(
    providerToken: string,
    sessionId: string,
    input: { expiresInMinutes: number; maxUses: number }
  ): Promise<MeetingExternalLink | null> {
    const token = String(providerToken || '').trim();
    const id = String(sessionId || '').trim();
    if (!token || !id) return null;
    try {
      const data = await api<any>(`/meeting/provider/sessions/${encodeURIComponent(id)}/external-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          expiresInMinutes: input.expiresInMinutes,
          maxUses: input.maxUses,
        },
      });
      if (!data?.link) return null;
      return data.link as MeetingExternalLink;
    } catch {
      return null;
    }
  }

  async listJoinableMeetingSessions(): Promise<MeetingSessionSummary[]> {
    try {
      const data = await api<any>('/meeting/user/sessions/joinable', { method: 'GET' });
      if (!data || !Array.isArray(data.sessions)) return [];
      return data.sessions as MeetingSessionSummary[];
    } catch {
      return [];
    }
  }

  async joinMeetingSession(
    sessionId: string,
    displayName?: string
  ): Promise<MeetingSessionSummary | null> {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    try {
      const data = await api<any>(`/meeting/user/sessions/${encodeURIComponent(id)}/join`, {
        method: 'POST',
        body: {
          displayName: displayName || null,
        },
      });
      if (!data?.session) return null;
      return data.session as MeetingSessionSummary;
    } catch {
      return null;
    }
  }

  async leaveMeetingSession(sessionId: string): Promise<boolean> {
    const id = String(sessionId || '').trim();
    if (!id) return false;
    try {
      await api(`/meeting/user/sessions/${encodeURIComponent(id)}/leave`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  async previewExternalMeetingInvite(inviteToken: string): Promise<ExternalMeetingPreview | null> {
    const token = String(inviteToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<any>('/meeting/guest/preview', {
        method: 'POST',
        auth: false,
        body: { inviteToken: token },
      });
      if (!data?.session || !data?.link) return null;
      return data as ExternalMeetingPreview;
    } catch {
      return null;
    }
  }

  async joinExternalMeetingInvite(
    inviteToken: string,
    name: string,
    email: string
  ): Promise<ExternalMeetingJoinResult | null> {
    const token = String(inviteToken || '').trim();
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!token || !normalizedName || !normalizedEmail) return null;
    try {
      const data = await api<any>('/meeting/guest/join', {
        method: 'POST',
        auth: false,
        body: {
          inviteToken: token,
          name: normalizedName,
          email: normalizedEmail,
        },
      });
      if (!data?.guest || !data?.guestSessionToken || !data?.session) return null;
      return data as ExternalMeetingJoinResult;
    } catch {
      return null;
    }
  }

  async leaveExternalMeetingInvite(guestSessionToken: string): Promise<boolean> {
    const token = String(guestSessionToken || '').trim();
    if (!token) return false;
    try {
      await api('/meeting/guest/leave', {
        method: 'POST',
        auth: false,
        body: { guestSessionToken: token },
      });
      return true;
    } catch {
      return false;
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
      const data = await api<any>('/ai/report-issue', {
        method: 'POST',
        body: {
          title: issue.title,
          message: issue.description,
          category: issue.category,
          userEmail: issue.userEmail,
        },
      });
      if (!data || typeof data.analysis === 'undefined') {
        throw new Error('Invalid JSON from backend');
      }

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
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
        return {
          text: `Issue captured locally: backend unreachable at ${this.getBackendLabel()}.`,
          groundingChunks: [],
          confidenceScore: 60,
          sourceCount: 0,
          processingTimeMs: 0,
          priority: 'MEDIUM',
          nextSteps: ['Retry when backend is online']
        };
      }
      throw error;
    }
  }

  /**
   * Generate suggested follow-up questions
   */
  async generateSuggestedQuestions(
    _lastQuestion: string,
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
      const data = await api<any>('/ai/trending', { method: 'GET' });
      if (!data || typeof data.insights === 'undefined') {
        throw new Error('Invalid JSON from backend');
      }

      return {
        topics: data.topics || [],
        insights: data.insights || '',
      };
    } catch (error) {
      console.error('Trending Topics Error:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
        return {
          topics: ['AI Ethics', 'Privacy Protection', 'Decentralization'],
          insights: `AI backend unavailable at ${this.getBackendLabel()}. Start or configure the backend.`,
        };
      }
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

export async function summarizeMeeting(transcript: string[]): Promise<MeetingSummary | null> {
  return backendAPI.summarizeMeeting(transcript);
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

export async function reportImmersiveSessionEvent(
  input: ImmersiveSessionEventInput
): Promise<void> {
  return backendAPI.reportImmersiveSessionEvent(input);
}

export async function getUserDirectory(): Promise<DirectoryUserEntry[]> {
  return backendAPI.getUserDirectory();
}

export async function createNativeProviderControlSession(): Promise<NativeProviderSessionResult | null> {
  return backendAPI.createNativeProviderControlSession();
}

export async function listProviderInviteGroups(
  providerToken: string
): Promise<ProviderInviteGroup[]> {
  return backendAPI.listProviderInviteGroups(providerToken);
}

export async function createProviderInviteGroup(
  providerToken: string,
  groupName: string
): Promise<ProviderInviteGroup | null> {
  return backendAPI.createProviderInviteGroup(providerToken, groupName);
}

export async function addProviderInviteGroupMember(
  providerToken: string,
  groupId: string,
  username: string
): Promise<ProviderInviteGroup | null> {
  return backendAPI.addProviderInviteGroupMember(providerToken, groupId, username);
}

export async function listProviderMeetingSessions(
  providerToken: string
): Promise<MeetingSessionSummary[]> {
  return backendAPI.listProviderMeetingSessions(providerToken);
}

export async function createProviderMeetingSession(
  providerToken: string,
  input: { title: string; mode: MeetingSessionMode; maxViewers: number }
): Promise<MeetingSessionSummary | null> {
  return backendAPI.createProviderMeetingSession(providerToken, input);
}

export async function startProviderMeetingSession(
  providerToken: string,
  sessionId: string
): Promise<MeetingSessionSummary | null> {
  return backendAPI.startProviderMeetingSession(providerToken, sessionId);
}

export async function endProviderMeetingSession(
  providerToken: string,
  sessionId: string
): Promise<boolean> {
  return backendAPI.endProviderMeetingSession(providerToken, sessionId);
}

export async function inviteUsersToProviderMeetingSession(
  providerToken: string,
  sessionId: string,
  input: { usernames?: string[]; groupIds?: string[] }
): Promise<MeetingSessionSummary | null> {
  return backendAPI.inviteUsersToProviderMeetingSession(providerToken, sessionId, input);
}

export async function createProviderMeetingExternalLink(
  providerToken: string,
  sessionId: string,
  input: { expiresInMinutes: number; maxUses: number }
): Promise<MeetingExternalLink | null> {
  return backendAPI.createProviderMeetingExternalLink(providerToken, sessionId, input);
}

export async function listJoinableMeetingSessions(): Promise<MeetingSessionSummary[]> {
  return backendAPI.listJoinableMeetingSessions();
}

export async function joinMeetingSession(
  sessionId: string,
  displayName?: string
): Promise<MeetingSessionSummary | null> {
  return backendAPI.joinMeetingSession(sessionId, displayName);
}

export async function leaveMeetingSession(sessionId: string): Promise<boolean> {
  return backendAPI.leaveMeetingSession(sessionId);
}

export async function previewExternalMeetingInvite(
  inviteToken: string
): Promise<ExternalMeetingPreview | null> {
  return backendAPI.previewExternalMeetingInvite(inviteToken);
}

export async function joinExternalMeetingInvite(
  inviteToken: string,
  name: string,
  email: string
): Promise<ExternalMeetingJoinResult | null> {
  return backendAPI.joinExternalMeetingInvite(inviteToken, name, email);
}

export async function leaveExternalMeetingInvite(
  guestSessionToken: string
): Promise<boolean> {
  return backendAPI.leaveExternalMeetingInvite(guestSessionToken);
}
