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

export type ProviderCrmToolId =
  | 'home'
  | 'members'
  | 'sessions'
  | 'roundtable'
  | 'follow-ups'
  | 'notes'
  | 'referrals'
  | 'content-courses'
  | 'analytics'
  | 'resources'
  | 'knowledge-center'
  | 'collaboration'
  | 'admin-support';

export interface ProviderCrmTool {
  id: ProviderCrmToolId;
  label: string;
  description: string;
  phase: string;
  providerVisible: boolean;
  adminOnly: boolean;
  enabledByDefault: boolean;
  enabled: boolean;
}

export interface ProviderCrmToolsResult {
  success: boolean;
  role: 'provider' | 'admin';
  tools: ProviderCrmTool[];
}

export interface ProviderCrmSummaryResult {
  success: boolean;
  role: 'provider' | 'admin';
  did: string;
  sessionId: string;
  summary: {
    activeToolCount: number;
    shellStatus: string;
    dataModelsEnabled: boolean;
    notesEnabled: boolean;
    relationshipManagementEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

export interface ProviderCrmAdminToolsResult {
  success: boolean;
  soleAdminEmail: string;
  visibilityControl: {
    source: string;
    persistentStorage: boolean;
    envOverrides?: string[];
  };
  tools: ProviderCrmTool[];
}

export type ProviderCrmRecordKind = 'client' | 'organization' | 'institution' | 'follow_up';
export type ProviderCrmRecordStatus = 'active' | 'watching' | 'contracting' | 'completed' | 'archived';
export type ProviderCrmPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ProviderCrmRecord {
  id: string;
  providerId: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  organizationName: string | null;
  kind: ProviderCrmRecordKind;
  title: string;
  treatmentFocus: string | null;
  businessFocus: string | null;
  status: ProviderCrmRecordStatus;
  priority: ProviderCrmPriority;
  nextActionAt: string | null;
  timezone: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRoundtableReservation {
  id: string;
  providerId: string;
  roomNumber: number;
  startAt: string;
  endAt: string;
  timezone: string;
  title: string;
  meetingSessionId: string;
  roomUrl: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  chatMode: 'native-room-signals';
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCrmWorkspace {
  scope: {
    role: 'provider' | 'admin';
    providerUserId: string;
    providerDid: string;
    providerDisplayName: string;
    visibility: 'provider-owned' | 'administrator-holistic';
  };
  metrics: {
    treatment: {
      activeClientRecords: number;
      dueFollowUps: number;
      upcomingRoundtables: number;
    };
    businessGrowth: {
      organizationsTracked: number;
      institutionContractOpportunities: number;
      urgentOpportunities: number;
    };
  };
  guidanceAlerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'urgent';
    title: string;
    detail: string;
    action: string;
  }>;
  records: ProviderCrmRecord[];
  roundtable: {
    label: 'Conscious Roundtable';
    roomCount: 12;
    dayStartHour: 8;
    hourCount: 12;
    timezone: string;
    reservations: ProviderRoundtableReservation[];
  };
  resources: Array<{
    id: string;
    title: string;
    category: string;
    summary: string;
    checklist: string[];
  }>;
}

export interface ProviderCrmWorkspaceResult {
  success: boolean;
  workspace: ProviderCrmWorkspace;
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
  routeKey?: string;
  title: string;
  description?: string;
  focusArea?: string;
  mode: MeetingSessionMode;
  status: MeetingSessionStatus;
  providerDid: string;
  providerUserId?: string | null;
  providerDisplayName?: string;
  maxViewers: number;
  publicStream?: boolean;
  nativeRoom?: {
    provider: 'native-webrtc-p2p';
    enabled: boolean;
    signaling: 'https-polling';
    serverRecordingEnabled: boolean;
    localRecordingAllowed: boolean;
    immersiveEnabled: boolean;
    securityLevel: string;
  };
  scheduledAtMs?: number;
  internalRoomPath?: string;
  internalRoomUrl?: string | null;
  standardRoomPath?: string;
  immersiveRoomPath?: string;
  vodPath?: string | null;
  participants: MeetingSessionParticipant[];
  invitedMembers: MeetingSessionInvite[];
  createdAtMs: number;
  updatedAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export interface MeetingRoomConfig {
  success: boolean;
  sessionId: string;
  routeKey: string;
  participantId: string;
  nativeRoom: {
    provider: 'native-webrtc-p2p';
    enabled: boolean;
    signaling: {
      transport: 'https-polling';
      messagesPath: string;
    };
    mediaTransport: string;
    iceServers: RTCIceServer[];
    globalReliability: {
      freeMode: string;
      turnRelayConfigured: boolean;
      note: string;
    };
  };
  immersive: {
    enabled: boolean;
    participantOptInRequired: boolean;
    localCapabilityRequired: boolean;
    supportedRoomPath: string;
  };
  recording: {
    serverRecordingEnabled: boolean;
    localParticipantRecordingAllowed: boolean;
    localOptInRequired: boolean;
    sharedRecordingDefault: boolean;
    policy: string;
  };
  security: {
    authentication: string;
    authorization: string;
    transport: string;
    serverMediaStorage: boolean;
    auditEvents: boolean;
  };
  participants: MeetingSessionParticipant[];
}

export interface MeetingSignalMessage {
  id: string;
  fromParticipantId: string;
  toParticipantId: string | null;
  type: 'offer' | 'answer' | 'ice' | 'presence' | 'renegotiate';
  payload: unknown;
  createdAtMs: number;
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
          text: 'Conscious Network Hub invites learning that protects dignity: bring spirituality, mental wellness, education, and community leadership into one thoughtful exchange today, while sharing only what supports trust and care.',
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

  async getProviderCrmTools(providerToken: string): Promise<ProviderCrmToolsResult | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      return await api<ProviderCrmToolsResult>('/provider/crm/tools', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      return null;
    }
  }

  async getProviderCrmSummary(providerToken: string): Promise<ProviderCrmSummaryResult | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      return await api<ProviderCrmSummaryResult>('/provider/crm/summary', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      return null;
    }
  }

  async getProviderCrmAdminTools(providerToken: string): Promise<ProviderCrmAdminToolsResult | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      return await api<ProviderCrmAdminToolsResult>('/provider/crm/admin/tools', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      return null;
    }
  }

  async updateProviderCrmToolVisibility(
    providerToken: string,
    toolId: ProviderCrmToolId,
    enabled: boolean
  ): Promise<ProviderCrmTool | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<any>(`/provider/crm/admin/tools/${encodeURIComponent(toolId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { enabled },
      });
      return data?.tool || null;
    } catch {
      return null;
    }
  }

  async getProviderCrmWorkspace(
    providerToken: string,
    timezone = 'UTC'
  ): Promise<ProviderCrmWorkspace | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<ProviderCrmWorkspaceResult>(
        `/provider/crm/workspace?timezone=${encodeURIComponent(timezone || 'UTC')}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return data?.workspace || null;
    } catch {
      return null;
    }
  }

  async createProviderCrmRecord(
    providerToken: string,
    input: {
      kind: ProviderCrmRecordKind;
      title: string;
      clientDisplayName?: string;
      organizationName?: string;
      treatmentFocus?: string;
      businessFocus?: string;
      status?: ProviderCrmRecordStatus;
      priority?: ProviderCrmPriority;
      nextActionAt?: string | null;
      timezone?: string;
    }
  ): Promise<ProviderCrmRecord | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<{ success: boolean; record: ProviderCrmRecord }>('/provider/crm/records', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: input,
      });
      return data?.record || null;
    } catch {
      return null;
    }
  }

  async createProviderRoundtableReservation(
    providerToken: string,
    input: {
      roomNumber: number;
      startAt: string;
      timezone: string;
      title: string;
    }
  ): Promise<ProviderRoundtableReservation | null> {
    const token = String(providerToken || '').trim();
    if (!token) return null;
    try {
      const data = await api<{ success: boolean; reservation: ProviderRoundtableReservation }>(
        '/provider/crm/roundtable/reservations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: input,
        }
      );
      return data?.reservation || null;
    } catch {
      return null;
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
    input: {
      title: string;
      mode: MeetingSessionMode;
      maxViewers: number;
      description?: string;
      focusArea?: string;
      scheduledAtMs?: number;
      publicStream?: boolean;
      immersiveEnabled?: boolean;
      localRecordingAllowed?: boolean;
    }
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
          description: input.description || undefined,
          focusArea: input.focusArea || undefined,
          scheduledAtMs: input.scheduledAtMs || undefined,
          publicStream: input.publicStream ?? true,
          immersiveEnabled: input.immersiveEnabled ?? input.mode === 'immersive-5d',
          localRecordingAllowed: input.localRecordingAllowed ?? false,
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

  async listUpcomingMeetingSessions(): Promise<MeetingSessionSummary[]> {
    try {
      const data = await api<any>('/meeting/user/sessions/upcoming', { method: 'GET' });
      if (!data || !Array.isArray(data.sessions)) return [];
      return data.sessions as MeetingSessionSummary[];
    } catch {
      return [];
    }
  }

  async listArchivedMeetingSessions(): Promise<MeetingSessionSummary[]> {
    try {
      const data = await api<any>('/meeting/user/sessions/archive', { method: 'GET' });
      if (!data || !Array.isArray(data.sessions)) return [];
      return data.sessions as MeetingSessionSummary[];
    } catch {
      return [];
    }
  }

  async getMeetingSession(sessionId: string): Promise<MeetingSessionSummary | null> {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    try {
      const data = await api<any>(`/meeting/user/sessions/${encodeURIComponent(id)}`, { method: 'GET' });
      if (!data?.session) return null;
      return data.session as MeetingSessionSummary;
    } catch {
      return null;
    }
  }

  async getMeetingRoomConfig(sessionId: string): Promise<MeetingRoomConfig | null> {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    try {
      const data = await api<any>(`/meeting/user/sessions/${encodeURIComponent(id)}/room-config`, {
        method: 'GET',
      });
      if (!data?.nativeRoom || !data?.participantId) return null;
      return data as MeetingRoomConfig;
    } catch {
      return null;
    }
  }

  async listMeetingSignals(sessionId: string, afterMs = 0): Promise<{
    participantId: string;
    signals: MeetingSignalMessage[];
    latestSignalAtMs: number;
  } | null> {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    try {
      const data = await api<any>(
        `/meeting/user/sessions/${encodeURIComponent(id)}/signals?afterMs=${encodeURIComponent(String(afterMs || 0))}`,
        { method: 'GET' }
      );
      if (!data || !Array.isArray(data.signals)) return null;
      return {
        participantId: String(data.participantId || ''),
        signals: data.signals as MeetingSignalMessage[],
        latestSignalAtMs: Number(data.latestSignalAtMs || afterMs || 0),
      };
    } catch {
      return null;
    }
  }

  async postMeetingSignal(
    sessionId: string,
    input: {
      type: MeetingSignalMessage['type'];
      payload: unknown;
      toParticipantId?: string | null;
    }
  ): Promise<boolean> {
    const id = String(sessionId || '').trim();
    if (!id) return false;
    try {
      await api(`/meeting/user/sessions/${encodeURIComponent(id)}/signals`, {
        method: 'POST',
        body: {
          type: input.type,
          payload: input.payload ?? {},
          toParticipantId: input.toParticipantId || null,
        },
      });
      return true;
    } catch {
      return false;
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

export async function getProviderCrmTools(
  providerToken: string
): Promise<ProviderCrmToolsResult | null> {
  return backendAPI.getProviderCrmTools(providerToken);
}

export async function getProviderCrmSummary(
  providerToken: string
): Promise<ProviderCrmSummaryResult | null> {
  return backendAPI.getProviderCrmSummary(providerToken);
}

export async function getProviderCrmAdminTools(
  providerToken: string
): Promise<ProviderCrmAdminToolsResult | null> {
  return backendAPI.getProviderCrmAdminTools(providerToken);
}

export async function updateProviderCrmToolVisibility(
  providerToken: string,
  toolId: ProviderCrmToolId,
  enabled: boolean
): Promise<ProviderCrmTool | null> {
  return backendAPI.updateProviderCrmToolVisibility(providerToken, toolId, enabled);
}

export async function getProviderCrmWorkspace(
  providerToken: string,
  timezone = 'UTC'
): Promise<ProviderCrmWorkspace | null> {
  return backendAPI.getProviderCrmWorkspace(providerToken, timezone);
}

export async function createProviderCrmRecord(
  providerToken: string,
  input: {
    kind: ProviderCrmRecordKind;
    title: string;
    clientDisplayName?: string;
    organizationName?: string;
    treatmentFocus?: string;
    businessFocus?: string;
    status?: ProviderCrmRecordStatus;
    priority?: ProviderCrmPriority;
    nextActionAt?: string | null;
    timezone?: string;
  }
): Promise<ProviderCrmRecord | null> {
  return backendAPI.createProviderCrmRecord(providerToken, input);
}

export async function createProviderRoundtableReservation(
  providerToken: string,
  input: {
    roomNumber: number;
    startAt: string;
    timezone: string;
    title: string;
  }
): Promise<ProviderRoundtableReservation | null> {
  return backendAPI.createProviderRoundtableReservation(providerToken, input);
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
  input: {
    title: string;
    mode: MeetingSessionMode;
    maxViewers: number;
    description?: string;
    focusArea?: string;
    scheduledAtMs?: number;
    publicStream?: boolean;
    immersiveEnabled?: boolean;
    localRecordingAllowed?: boolean;
  }
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

export async function listUpcomingMeetingSessions(): Promise<MeetingSessionSummary[]> {
  return backendAPI.listUpcomingMeetingSessions();
}

export async function listArchivedMeetingSessions(): Promise<MeetingSessionSummary[]> {
  return backendAPI.listArchivedMeetingSessions();
}

export async function getMeetingSession(
  sessionId: string
): Promise<MeetingSessionSummary | null> {
  return backendAPI.getMeetingSession(sessionId);
}

export async function getMeetingRoomConfig(sessionId: string): Promise<MeetingRoomConfig | null> {
  return backendAPI.getMeetingRoomConfig(sessionId);
}

export async function listMeetingSignals(
  sessionId: string,
  afterMs = 0
): Promise<{ participantId: string; signals: MeetingSignalMessage[]; latestSignalAtMs: number } | null> {
  return backendAPI.listMeetingSignals(sessionId, afterMs);
}

export async function postMeetingSignal(
  sessionId: string,
  input: {
    type: MeetingSignalMessage['type'];
    payload: unknown;
    toParticipantId?: string | null;
  }
): Promise<boolean> {
  return backendAPI.postMeetingSignal(sessionId, input);
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
