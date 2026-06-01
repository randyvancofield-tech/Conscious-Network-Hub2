
import React, { useState, useRef, useEffect } from 'react';
import {
  Video, Calendar, Users, ShieldCheck, Zap,
  Clock, CheckCircle2,
  X, Camera, Mic, MicOff, CameraOff,
  Settings, Download, Share2, Info, Loader2, Play,
  Pause, Square, Image, Upload
} from 'lucide-react';
import type {
  Results as SelfieSegmentationResults,
  SelfieSegmentation as SelfieSegmentationInstance,
} from '@mediapipe/selfie_segmentation';
import type * as ThreeTypes from 'three';
import { UserProfile, Meeting } from '../types';
import {
  addProviderInviteGroupMember,
  createNativeProviderControlSession,
  createProviderInviteGroup,
  createProviderMeetingExternalLink,
  createProviderMeetingSession,
  endProviderMeetingSession,
  getUserDirectory,
  inviteUsersToProviderMeetingSession,
  joinExternalMeetingInvite,
  joinMeetingSession,
  leaveExternalMeetingInvite,
  leaveMeetingSession,
  listJoinableMeetingSessions,
  listProviderInviteGroups,
  listProviderMeetingSessions,
  previewExternalMeetingInvite,
  reportImmersiveSessionEvent,
  startProviderMeetingSession,
} from '../services/backendApiService';
import {
  PROVIDER_SESSION_TOKEN_EVENT,
  PROVIDER_SESSION_TOKEN_KEY,
  setProviderControlSession,
} from '../services/sessionService';
import type {
  ExternalMeetingPreview,
  MeetingSessionMode,
  MeetingSessionSummary,
  ProviderInviteGroup,
} from '../services/backendApiService';
import MeetingBrandLoop from './ui/MeetingBrandLoop';
import cnhLogo from '../src/assets/brand/conscious-network-hub-logo.png';

interface ConsciousMeetingsProps {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

interface MeetingDirectoryUser {
  id: string;
  name: string;
  handle: string | null;
}

interface PendingInviteMember {
  id: string;
  username: string;
  displayName: string;
}

interface InviteGroupTemplate {
  id: string;
  name: string;
  usernames: string[];
}

type MeetingNotes = NonNullable<Meeting['notes']>;

const toLocalDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalTimeInputValue = (date: Date): string => {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

const CNH_NATIVE_ROOM_PROVIDER_ID = 'cnh-native';
const CNH_NATIVE_ROOM_LABEL = 'Conscious Meetings Room (CNH Native)';

const toAppHostedRoomLink = (session?: MeetingSessionSummary | null): string => {
  const roomPath = session?.internalRoomPath || session?.standardRoomPath || session?.internalRoomUrl || '';
  if (!roomPath) return '';
  if (/^https?:\/\//i.test(roomPath)) return roomPath;
  const normalizedPath = roomPath.startsWith('/') ? roomPath : `/${roomPath}`;
  if (typeof window === 'undefined' || !window.location?.origin) return normalizedPath;
  return `${window.location.origin}${normalizedPath}`;
};

type SynthesisAgentMode = 'meeting-bot' | 'action-agent' | 'security-agent';

interface MeetingBackgroundPreset {
  id: string;
  label: string;
  type: 'image' | 'video';
  source: string;
}

const createBackgroundSvgDataUrl = (start: string, end: string, accent: string): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="hcn-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#hcn-bg)" />
      <circle cx="1090" cy="160" r="170" fill="${accent}" opacity="0.22" />
      <circle cx="210" cy="620" r="240" fill="${accent}" opacity="0.15" />
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const EMPTY_MEETING_NOTES = (): MeetingNotes => ({
  transcript: [],
  summary: '',
  decisions: [],
  actionItems: [],
});

const BACKGROUND_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_BACKGROUND_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const SYNTHESIS_AGENT_OPTIONS: Array<{ id: SynthesisAgentMode; label: string; description: string }> = [
  {
    id: 'meeting-bot',
    label: 'Meeting Bot',
    description: 'Balanced summary with key takeaways and participant alignment.',
  },
  {
    id: 'action-agent',
    label: 'Action Agent',
    description: 'Prioritizes next steps, owners, and due dates.',
  },
  {
    id: 'security-agent',
    label: 'Security Agent',
    description: 'Highlights privacy controls and meeting safety actions.',
  },
];

const BACKGROUND_PRESETS: MeetingBackgroundPreset[] = [
  {
    id: 'forest',
    label: 'Forest',
    type: 'image',
    source: createBackgroundSvgDataUrl('#0b1f16', '#1f6f43', '#8cffcb'),
  },
  {
    id: 'mountains',
    label: 'Mountains',
    type: 'image',
    source: createBackgroundSvgDataUrl('#111827', '#1d4ed8', '#93c5fd'),
  },
  {
    id: 'ocean',
    label: 'Ocean',
    type: 'image',
    source: createBackgroundSvgDataUrl('#082f49', '#0891b2', '#67e8f9'),
  },
  {
    id: 'nebula',
    label: 'Nebula Video',
    type: 'video',
    source: '/video/home-bg.mp4',
  },
];

const isApprovedProviderUser = (user: UserProfile | null): boolean =>
  Boolean(
    user?.role === 'provider' &&
      user.providerApproved === true &&
      String(user.providerApprovalStatus || '').trim().toLowerCase() === 'approved' &&
      !user.providerRevokedAt
  );

const ConsciousMeetings: React.FC<ConsciousMeetingsProps> = ({ user }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [activeTab, setActiveTab] = useState<'schedule' | 'lobby' | 'calendar'>('schedule');
  const [isSchedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [isNoteTakerOn, setNoteTakerOn] = useState(false);
  const [showSynthesisConsentModal, setShowSynthesisConsentModal] = useState(false);
  const [synthesisAgentMode, setSynthesisAgentMode] = useState<SynthesisAgentMode>('meeting-bot');
  const [isSynthesizingNotes, setIsSynthesizingNotes] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [isJoining, setIsJoining] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<MeetingDirectoryUser[]>([]);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [inviteUsernameInput, setInviteUsernameInput] = useState('');
  const [pendingInviteMembers, setPendingInviteMembers] = useState<PendingInviteMember[]>([]);
  const [inviteGroupTemplates, setInviteGroupTemplates] = useState<InviteGroupTemplate[]>([]);
  const [inviteGroupNameInput, setInviteGroupNameInput] = useState('');
  const [selectedInviteGroupId, setSelectedInviteGroupId] = useState('');
  const inviteGroupStorageKey = user?.id ? `hcn_meeting_invite_groups_${user.id}` : null;
  const [providerSessionToken, setProviderSessionToken] = useState('');
  const [providerInviteGroups, setProviderInviteGroups] = useState<ProviderInviteGroup[]>([]);
  const [hostedMeetingSessions, setHostedMeetingSessions] = useState<MeetingSessionSummary[]>([]);
  const [joinableMeetingSessions, setJoinableMeetingSessions] = useState<MeetingSessionSummary[]>([]);
  const [selectedHostedSessionId, setSelectedHostedSessionId] = useState('');
  const [hostSessionTitleInput, setHostSessionTitleInput] = useState('Provider-Led Session');
  const [hostSessionDescriptionInput, setHostSessionDescriptionInput] = useState(
    'A live Conscious Network Hub session for shared growth, grounded reflection, and practical next steps.'
  );
  const [hostSessionFocusAreaInput, setHostSessionFocusAreaInput] = useState('Mental Wellness');
  const [hostSessionDateInput, setHostSessionDateInput] = useState(() => toLocalDateInputValue(new Date()));
  const [hostSessionTimeInput, setHostSessionTimeInput] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 30);
    return toLocalTimeInputValue(date);
  });
  const [hostSessionMode, setHostSessionMode] = useState<MeetingSessionMode>('virtual');
  const [hostSessionMaxViewersInput, setHostSessionMaxViewersInput] = useState(120);
  const [hostSessionImmersiveGatewayEnabled, setHostSessionImmersiveGatewayEnabled] = useState(false);
  const [hostSessionLocalRecordingAllowed, setHostSessionLocalRecordingAllowed] = useState(false);
  const [providerGroupNameInput, setProviderGroupNameInput] = useState('');
  const [providerGroupMemberUsernameInput, setProviderGroupMemberUsernameInput] = useState('');
  const [inviteUsernamesBatchInput, setInviteUsernamesBatchInput] = useState('');
  const [selectedProviderGroupIds, setSelectedProviderGroupIds] = useState<string[]>([]);
  const [externalLinkTtlMinutesInput, setExternalLinkTtlMinutesInput] = useState(120);
  const [externalLinkMaxUsesInput, setExternalLinkMaxUsesInput] = useState(250);
  const [latestExternalJoinLink, setLatestExternalJoinLink] = useState('');
  const [meetingOpsStatus, setMeetingOpsStatus] = useState('');
  const [isMeetingOpsBusy, setIsMeetingOpsBusy] = useState(false);
  const [activeJoinedSessionId, setActiveJoinedSessionId] = useState<string | null>(null);
  const [externalInviteTokenInput, setExternalInviteTokenInput] = useState('');
  const [externalInvitePreview, setExternalInvitePreview] = useState<ExternalMeetingPreview | null>(null);
  const [externalGuestNameInput, setExternalGuestNameInput] = useState('');
  const [externalGuestEmailInput, setExternalGuestEmailInput] = useState('');
  const [externalGuestSessionToken, setExternalGuestSessionToken] = useState('');
  const selectedHostedSession =
    hostedMeetingSessions.find((session) => session.id === selectedHostedSessionId) || null;
  const selectedInternalRoomLink = toAppHostedRoomLink(selectedHostedSession);
  const formatMeetingTime = (value?: number | null): string =>
    value ? new Date(value).toLocaleString() : 'Unscheduled';
  const mapBackendSessionToMeeting = (session: MeetingSessionSummary): Meeting => {
    const providerParticipant = {
      id: session.providerUserId || session.providerDid || 'provider',
      name: session.providerDisplayName || 'Verified Provider',
      role: 'Provider' as const,
    };
    const participantRows = session.participants
      .filter((participant) => participant.kind !== 'provider')
      .map((participant) => ({
        id: participant.id,
        name: participant.displayName,
        role: 'User' as const,
      }));

    return {
      id: session.routeKey || session.id,
      title: session.title,
      hostUserId: session.providerUserId || '',
      providerId: session.providerDid || CNH_NATIVE_ROOM_PROVIDER_ID,
      startTime: formatMeetingTime(session.scheduledAtMs || session.startedAtMs || session.createdAtMs),
      endTime: session.endedAtMs ? formatMeetingTime(session.endedAtMs) : 'Open until host ends session',
      participants: [providerParticipant, ...participantRows],
      status:
        session.status === 'live'
          ? 'Live'
          : session.status === 'ended'
            ? 'Completed'
            : 'Upcoming',
      accessType: session.publicStream ? 'tier' : 'restricted',
      notes: EMPTY_MEETING_NOTES(),
    };
  };
  const syncMeetingsFromBackendSessions = (sessions: MeetingSessionSummary[]) => {
    const uniqueSessions = Array.from(
      new Map(sessions.map((session) => [session.id, session])).values()
    );
    setMeetings(uniqueSessions.map(mapBackendSessionToMeeting));
  };

  // Solo Session States
  const [isSoloSessionActive, setIsSoloSessionActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [backgroundType, setBackgroundType] = useState<'none' | 'blur' | 'image' | 'video'>('none');
  const [micLevel, setMicLevel] = useState(0);
  const [customBackgroundFile, setCustomBackgroundFile] = useState<File | null>(null);
  const [showBackgroundUploadPolicyModal, setShowBackgroundUploadPolicyModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isImmersiveStarting, setIsImmersiveStarting] = useState(false);
  const [isImmersiveActive, setIsImmersiveActive] = useState(false);
  const [immersiveError, setImmersiveError] = useState<string | null>(null);
  const [isImmersiveSupported, setIsImmersiveSupported] = useState(false);
  const [hasCheckedImmersiveSupport, setHasCheckedImmersiveSupport] = useState(false);
  const [immersiveDeviceProfile, setImmersiveDeviceProfile] = useState('unknown');
  const [immersiveSupportedModes, setImmersiveSupportedModes] = useState<Array<'immersive-ar' | 'immersive-vr'>>([]);
  const [immersiveActiveMode, setImmersiveActiveMode] = useState<'immersive-ar' | 'immersive-vr' | 'unknown'>('unknown');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const providerVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xrMountRef = useRef<HTMLDivElement>(null);
  const xrSessionRef = useRef<any>(null);
  const xrCleanupRef = useRef<(() => void) | null>(null);
  const segmentationRef = useRef<SelfieSegmentationInstance | null>(null);
  const processedStreamCleanupRef = useRef<(() => void) | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const selectedBackgroundRef = useRef<string | null>(null);
  const customBackgroundFileRef = useRef<File | null>(null);
  const immersiveSessionStartedAtMsRef = useRef<number | null>(null);
  const immersiveSessionModeRef = useRef<'immersive-ar' | 'immersive-vr' | 'unknown'>('unknown');
  const immersiveDeviceProfileRef = useRef<string>('unknown');
  const immersiveTelemetryOpenRef = useRef(false);

  const providerTokenStorageKey = PROVIDER_SESSION_TOKEN_KEY;
  const externalGuestSessionStorageKey = 'hcn_external_guest_session_token';

  const normalizeUsername = (input: string): string => input.trim().replace(/^@+/, '').toLowerCase();

  const resolveDirectoryUser = (usernameInput: string): MeetingDirectoryUser | null => {
    const normalized = normalizeUsername(usernameInput);
    if (!normalized) return null;

    const byHandle = directoryUsers.find(
      (entry) => entry.handle && normalizeUsername(entry.handle) === normalized
    );
    if (byHandle) return byHandle;

    const byName = directoryUsers.find((entry) => normalizeUsername(entry.name) === normalized);
    if (byName) return byName;

    return null;
  };

  const addInviteMemberByUsername = (usernameInput: string) => {
    const normalized = normalizeUsername(usernameInput);
    if (!normalized) return;

    setPendingInviteMembers((current) => {
      if (current.some((entry) => entry.username === normalized)) {
        return current;
      }

      const resolved = resolveDirectoryUser(normalized);
      const displayName = resolved?.name || normalized;
      const id = resolved?.id || `username:${normalized}`;
      return [...current, { id, username: normalized, displayName }];
    });

    setInviteUsernameInput('');
  };

  const removeInviteMember = (username: string) => {
    setPendingInviteMembers((current) =>
      current.filter((entry) => entry.username !== normalizeUsername(username))
    );
  };

  const applyInviteGroupTemplate = (groupId: string) => {
    setSelectedInviteGroupId(groupId);
    const selectedGroup = inviteGroupTemplates.find((entry) => entry.id === groupId);
    if (!selectedGroup) return;

    const loadedMembers = selectedGroup.usernames.map((username) => {
      const resolved = resolveDirectoryUser(username);
      return {
        id: resolved?.id || `username:${username}`,
        username,
        displayName: resolved?.name || username,
      };
    });
    setPendingInviteMembers(loadedMembers);
  };

  const saveInviteGroupTemplate = () => {
    const normalizedName = inviteGroupNameInput.trim();
    if (!normalizedName || pendingInviteMembers.length === 0) return;

    const usernames = [...new Set(pendingInviteMembers.map((entry) => entry.username))];
    const template: InviteGroupTemplate = {
      id: `grp_${Date.now()}`,
      name: normalizedName,
      usernames,
    };

    setInviteGroupTemplates((current) => [template, ...current].slice(0, 25));
    setSelectedInviteGroupId(template.id);
    setInviteGroupNameInput('');
  };

  const resetSchedulingComposer = () => {
    setSelectedSlot(null);
    setInviteUsernameInput('');
    setPendingInviteMembers([]);
    setInviteGroupNameInput('');
    setSelectedInviteGroupId('');
  };

  const checkPermissions = async () => {
    setPermissionState('pending');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPermissionState('granted');
    } catch (err) {
      setPermissionState('denied');
    }
  };

  const confirmBooking = async () => {
    setMeetingOpsStatus('Member self-booking is not active for launch. Providers publish real CNH rooms through host controls.');
    resetSchedulingComposer();
    setSchedulingModalOpen(false);
  };

  const revokeCustomBackgroundObjectUrl = (backgroundUrl: string | null, file: File | null) => {
    if (backgroundUrl && file && backgroundUrl.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundUrl);
    }
  };

  const clearEphemeralMeetingNotes = () => {
    setMeetings((currentMeetings) =>
      currentMeetings.map((meeting) => ({
        ...meeting,
        notes: EMPTY_MEETING_NOTES(),
      }))
    );
  };

  const clearSessionScopedSynthesis = () => {
    clearEphemeralMeetingNotes();
    setNoteTakerOn(false);
    setShowSynthesisConsentModal(false);
    setSynthesisAgentMode('meeting-bot');
    setIsSynthesizingNotes(false);
  };

  const generateAINotes = async (
    meetingId: string,
    agentMode: SynthesisAgentMode = synthesisAgentMode
  ) => {
    const meeting = meetings.find((entry) => entry.id === meetingId);
    if (!meeting) return;

    setIsSynthesizingNotes(true);
    try {
      setMeetingOpsStatus(
        `${agentMode.replace('-', ' ')} is gated until real transcript capture is connected. No synthetic transcript or generated notes were used.`
      );
    } finally {
      setIsSynthesizingNotes(false);
    }
  };

  const initiateSynthesisAgent = async () => {
    const activeMeeting = meetings[0];
    if (!activeMeeting) {
      setMeetingOpsStatus('No real meeting session is selected for synthesis.');
      return;
    }

    if (!isSoloSessionActive && !isJoining) {
      setMeetingOpsStatus('Start or join a real meeting session before initiating synthesis notes.');
      return;
    }

    if (!isNoteTakerOn) {
      setShowSynthesisConsentModal(true);
      return;
    }

    await generateAINotes(activeMeeting.id, synthesisAgentMode);
  };

  const toggleSynthesisNotetaker = () => {
    if (isNoteTakerOn) {
      clearSessionScopedSynthesis();
      return;
    }

    setShowSynthesisConsentModal(true);
  };

  const confirmSynthesisConsent = () => {
    setNoteTakerOn(true);
    setShowSynthesisConsentModal(false);
    setMeetingOpsStatus('Synthesis consent captured. Notes remain gated until real transcript capture is connected.');
  };

  const parseBatchUsernames = (rawValue: string): string[] => {
    return Array.from(
      new Set(
        String(rawValue || '')
          .split(/[\s,;\n\r\t]+/)
          .map((entry) => normalizeUsername(entry))
          .filter((entry) => entry.length > 0)
      )
    );
  };

  const refreshProviderMeetingData = async (tokenOverride?: string) => {
    const token = String(tokenOverride ?? providerSessionToken).trim();
    if (!token) {
      setProviderInviteGroups([]);
      setHostedMeetingSessions([]);
      setSelectedHostedSessionId('');
      syncMeetingsFromBackendSessions(joinableMeetingSessions);
      return;
    }

    const [groups, sessions] = await Promise.all([
      listProviderInviteGroups(token),
      listProviderMeetingSessions(token),
    ]);

    setProviderInviteGroups(groups);
    setHostedMeetingSessions(sessions);
    syncMeetingsFromBackendSessions([...sessions, ...joinableMeetingSessions]);
    setSelectedHostedSessionId((current) => {
      if (sessions.length === 0) return '';
      if (current && sessions.some((entry) => entry.id === current)) return current;
      return sessions[0].id;
    });
  };

  const refreshJoinableSessions = async () => {
    const sessions = await listJoinableMeetingSessions();
    setJoinableMeetingSessions(sessions);
    syncMeetingsFromBackendSessions([...hostedMeetingSessions, ...sessions]);
  };

  const disconnectProviderSessionToken = (
    statusMessage = 'Provider host session unavailable. Sign in through Provider Access to continue.'
  ) => {
    setProviderSessionToken('');
    setProviderInviteGroups([]);
    setHostedMeetingSessions([]);
    setSelectedHostedSessionId('');
    setSelectedProviderGroupIds([]);
    setLatestExternalJoinLink('');
    syncMeetingsFromBackendSessions(joinableMeetingSessions);
    setMeetingOpsStatus(statusMessage);
  };

  const hydrateProviderSessionToken = async (
    tokenOverride?: string,
    source: 'native-session' | 'storage-sync' = 'storage-sync'
  ) => {
    const normalized = String(tokenOverride || '').trim();
    if (!normalized) {
      disconnectProviderSessionToken();
      return;
    }

    setIsMeetingOpsBusy(true);
    setProviderSessionToken(normalized);
    setMeetingOpsStatus(
      source === 'native-session'
        ? 'Native provider session detected. Host controls unlocked.'
        : 'Restoring native provider session...'
    );
    try {
      await refreshProviderMeetingData(normalized);
      if (source !== 'native-session') {
        setMeetingOpsStatus('Native provider session active. Host controls unlocked.');
      }
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const createHostedSession = async () => {
    const token = providerSessionToken.trim();
    if (!token) {
      setMeetingOpsStatus('Sign in through Provider Access to unlock host controls.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Creating provider-hosted session...');
    try {
      const scheduledAtMs = Date.parse(`${hostSessionDateInput}T${hostSessionTimeInput || '12:00'}`);
      const created = await createProviderMeetingSession(token, {
        title: hostSessionTitleInput,
        mode: hostSessionMode,
        maxViewers: hostSessionMaxViewersInput,
        description: hostSessionDescriptionInput,
        focusArea: hostSessionFocusAreaInput,
        scheduledAtMs: Number.isFinite(scheduledAtMs) ? scheduledAtMs : Date.now(),
        publicStream: true,
        immersiveEnabled: hostSessionMode === 'immersive-5d' || hostSessionImmersiveGatewayEnabled,
        localRecordingAllowed: hostSessionLocalRecordingAllowed,
      });
      if (!created) {
        setMeetingOpsStatus('Unable to create provider session.');
        return;
      }
      await refreshProviderMeetingData(token);
      setHostedMeetingSessions((current) => [
        created,
        ...current.filter((session) => session.id !== created.id),
      ]);
      setSelectedHostedSessionId(created.id);
      setMeetingOpsStatus(
        `${CNH_NATIVE_ROOM_LABEL} created. CNH room link is ready to copy: ${created.title}`
      );
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const createProviderGroupFromProfile = async () => {
    const token = providerSessionToken.trim();
    const groupName = providerGroupNameInput.trim();
    if (!token) {
      setMeetingOpsStatus('Sign in through Provider Access to unlock host controls.');
      return;
    }
    if (!groupName) {
      setMeetingOpsStatus('Provider group name is required.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Creating provider profile group...');
    try {
      const created = await createProviderInviteGroup(token, groupName);
      if (!created) {
        setMeetingOpsStatus('Unable to create provider group.');
        return;
      }
      setProviderGroupNameInput('');
      await refreshProviderMeetingData(token);
      setMeetingOpsStatus(`Provider group created: ${created.name}`);
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const addMemberToProviderProfileGroup = async () => {
    const token = providerSessionToken.trim();
    const normalizedUsername = normalizeUsername(providerGroupMemberUsernameInput);
    const targetGroupId = selectedProviderGroupIds[0] || providerInviteGroups[0]?.id || '';
    if (!token) {
      setMeetingOpsStatus('Sign in through Provider Access to unlock host controls.');
      return;
    }
    if (!targetGroupId) {
      setMeetingOpsStatus('Select at least one provider group first.');
      return;
    }
    if (!normalizedUsername) {
      setMeetingOpsStatus('Username is required to add group member.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Adding member to provider group...');
    try {
      const updated = await addProviderInviteGroupMember(token, targetGroupId, normalizedUsername);
      if (!updated) {
        setMeetingOpsStatus('Unable to add member to provider group.');
        return;
      }
      setProviderGroupMemberUsernameInput('');
      await refreshProviderMeetingData(token);
      setMeetingOpsStatus(`Added @${normalizedUsername} to ${updated.name}.`);
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const startHostedSession = async () => {
    const token = providerSessionToken.trim();
    const sessionId = selectedHostedSessionId.trim();
    if (!token || !sessionId) {
      setMeetingOpsStatus('Select a provider-hosted session first.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Starting hosted session...');
    try {
      const started = await startProviderMeetingSession(token, sessionId);
      if (!started) {
        setMeetingOpsStatus('Unable to start hosted session.');
        return;
      }
      await refreshProviderMeetingData(token);
      setHostedMeetingSessions((current) => [
        started,
        ...current.filter((session) => session.id !== started.id),
      ]);
      setSelectedHostedSessionId(started.id);
      setActiveJoinedSessionId(started.id);
      setIsJoining(true);
      setMeetingOpsStatus(`${CNH_NATIVE_ROOM_LABEL} is live: ${started.title}`);
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const endHostedSession = async () => {
    const token = providerSessionToken.trim();
    const sessionId = selectedHostedSessionId.trim();
    if (!token || !sessionId) {
      setMeetingOpsStatus('Select a provider-hosted session first.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Ending hosted session...');
    try {
      const ended = await endProviderMeetingSession(token, sessionId);
      if (!ended) {
        setMeetingOpsStatus('Unable to end hosted session.');
        return;
      }
      await refreshProviderMeetingData(token);
      setActiveJoinedSessionId((current) => (current === sessionId ? null : current));
      setLatestExternalJoinLink('');
      setMeetingOpsStatus('Hosted session ended and removed.');
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const inviteUsersIntoHostedSession = async () => {
    const token = providerSessionToken.trim();
    const sessionId = selectedHostedSessionId.trim();
    if (!token || !sessionId) {
      setMeetingOpsStatus('Select a provider-hosted session first.');
      return;
    }

    const usernames = parseBatchUsernames(inviteUsernamesBatchInput);
    if (usernames.length === 0 && selectedProviderGroupIds.length === 0) {
      setMeetingOpsStatus('Add usernames or select provider groups to invite.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Sending invites to users/groups...');
    try {
      const updated = await inviteUsersToProviderMeetingSession(token, sessionId, {
        usernames,
        groupIds: selectedProviderGroupIds,
      });
      if (!updated) {
        setMeetingOpsStatus('Unable to send invites for hosted session.');
        return;
      }
      setInviteUsernamesBatchInput('');
      setSelectedProviderGroupIds([]);
      await refreshProviderMeetingData(token);
      setHostedMeetingSessions((current) => [
        updated,
        ...current.filter((session) => session.id !== updated.id),
      ]);
      setSelectedHostedSessionId(updated.id);
      await refreshJoinableSessions();
      setMeetingOpsStatus('Platform invites sent. CNH room link remains ready to copy.');
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const generateHostedSessionExternalLink = async () => {
    const token = providerSessionToken.trim();
    const sessionId = selectedHostedSessionId.trim();
    if (!token || !sessionId) {
      setMeetingOpsStatus('Select a provider-hosted session first.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Generating external guest join link...');
    try {
      const link = await createProviderMeetingExternalLink(token, sessionId, {
        expiresInMinutes: externalLinkTtlMinutesInput,
        maxUses: externalLinkMaxUsesInput,
      });
      if (!link) {
        setMeetingOpsStatus('Unable to create external guest link.');
        return;
      }
      setLatestExternalJoinLink(link.joinUrl);
      try {
        await navigator.clipboard.writeText(link.joinUrl);
        setMeetingOpsStatus('External guest link copied to clipboard.');
      } catch {
        setMeetingOpsStatus('External guest link generated.');
      }
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const joinInvitedSession = async (sessionId: string) => {
    const normalizedId = String(sessionId || '').trim();
    if (!normalizedId) return;

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Joining invited meeting session...');
    try {
      const joined = await joinMeetingSession(normalizedId, user?.name || undefined);
      if (!joined) {
        setMeetingOpsStatus('Unable to join invited session.');
        return;
      }
      setActiveJoinedSessionId(joined.id);
      setIsJoining(true);
      await refreshJoinableSessions();
      setMeetingOpsStatus(`Joined session: ${joined.title}`);
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const leaveActiveJoinedSession = async () => {
    if (!activeJoinedSessionId) return;
    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Leaving active joined session...');
    try {
      const left = await leaveMeetingSession(activeJoinedSessionId);
      if (!left) {
        setMeetingOpsStatus('Unable to leave active session.');
        return;
      }
      setActiveJoinedSessionId(null);
      setIsJoining(false);
      await refreshJoinableSessions();
      setMeetingOpsStatus('You left the active meeting session.');
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const previewExternalInvite = async (tokenInput?: string) => {
    const token = String(tokenInput ?? externalInviteTokenInput).trim();
    if (!token) {
      setMeetingOpsStatus('External invite token is required.');
      return;
    }
    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Validating external invite token...');
    try {
      const preview = await previewExternalMeetingInvite(token);
      if (!preview) {
        setExternalInvitePreview(null);
        setMeetingOpsStatus('External invite token is invalid or expired.');
        return;
      }
      setExternalInvitePreview(preview);
      setMeetingOpsStatus('External invite is valid. Complete guest sign-in to join.');
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const joinAsExternalGuest = async () => {
    const token = externalInviteTokenInput.trim();
    if (!token) {
      setMeetingOpsStatus('External invite token is required.');
      return;
    }
    if (!externalGuestNameInput.trim() || !externalGuestEmailInput.trim()) {
      setMeetingOpsStatus('Guest name and email are required.');
      return;
    }

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Joining as external guest...');
    try {
      const joined = await joinExternalMeetingInvite(
        token,
        externalGuestNameInput,
        externalGuestEmailInput
      );
      if (!joined) {
        setMeetingOpsStatus('Unable to join as external guest.');
        return;
      }
      setExternalInvitePreview({
        session: {
          id: joined.session.id,
          title: joined.session.title,
          mode: joined.session.mode,
          status: joined.session.status,
          maxViewers: joined.session.maxViewers,
          participantCount: joined.session.participants.length,
          remainingCapacity: Math.max(joined.session.maxViewers - joined.session.participants.length, 0),
        },
        link: {
          id: 'active',
          expiresAtMs: Date.now() + 12 * 60 * 60 * 1000,
          uses: 0,
          maxUses: 0,
        },
      });
      setExternalGuestSessionToken(joined.guestSessionToken);
      try {
        window.sessionStorage.setItem(externalGuestSessionStorageKey, joined.guestSessionToken);
      } catch {
        // Ignore storage exceptions.
      }
      setActiveJoinedSessionId(joined.session.id);
      setIsJoining(true);
      setMeetingOpsStatus('External guest joined. Platform features remain restricted.');
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const leaveExternalGuestSession = async () => {
    const token = externalGuestSessionToken.trim();
    if (!token) return;

    setIsMeetingOpsBusy(true);
    setMeetingOpsStatus('Leaving external guest session...');
    try {
      const left = await leaveExternalMeetingInvite(token);
      if (left) {
        setExternalGuestSessionToken('');
        setExternalInvitePreview(null);
        setActiveJoinedSessionId(null);
        setIsJoining(false);
        try {
          window.sessionStorage.removeItem(externalGuestSessionStorageKey);
        } catch {
          // Ignore storage exceptions.
        }
        setMeetingOpsStatus('External guest session closed.');
      } else {
        setMeetingOpsStatus('Unable to close external guest session.');
      }
    } finally {
      setIsMeetingOpsBusy(false);
    }
  };

  const hasLiveTracks = (candidate: MediaStream | null): candidate is MediaStream =>
    candidate instanceof MediaStream && candidate.getTracks().some((track) => track.readyState === 'live');

  const hasLiveVideoTracks = (candidate: MediaStream | null): candidate is MediaStream =>
    candidate instanceof MediaStream && candidate.getVideoTracks().some((track) => track.readyState === 'live');

  const getProviderMediaStream = (): MediaStream | null => {
    if (hasLiveTracks(processedStream)) {
      return processedStream;
    }

    if (hasLiveTracks(stream)) {
      return stream;
    }

    const userVideoStream =
      videoRef.current?.srcObject instanceof MediaStream ? videoRef.current.srcObject : null;
    if (hasLiveTracks(userVideoStream)) {
      return userVideoStream;
    }

    const providerVideoStream =
      providerVideoRef.current?.srcObject instanceof MediaStream ? providerVideoRef.current.srcObject : null;
    if (hasLiveTracks(providerVideoStream)) {
      return providerVideoStream;
    }

    return null;
  };

  const setPannerPosition = (panner: PannerNode, x: number, y: number, z: number) => {
    const currentTime = panner.context.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, currentTime);
      panner.positionY.setValueAtTime(y, currentTime);
      panner.positionZ.setValueAtTime(z, currentTime);
      return;
    }
    panner.setPosition(x, y, z);
  };

  const setListenerPose = (
    listener: AudioListener,
    position: ThreeTypes.Vector3,
    forward: ThreeTypes.Vector3,
    up: ThreeTypes.Vector3
  ) => {
    const currentTime = (listener as any).context?.currentTime ?? 0;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(position.x, currentTime);
      listener.positionY.setValueAtTime(position.y, currentTime);
      listener.positionZ.setValueAtTime(position.z, currentTime);
    } else {
      listener.setPosition(position.x, position.y, position.z);
    }

    if ((listener as any).forwardX) {
      (listener as any).forwardX.setValueAtTime(forward.x, currentTime);
      (listener as any).forwardY.setValueAtTime(forward.y, currentTime);
      (listener as any).forwardZ.setValueAtTime(forward.z, currentTime);
      (listener as any).upX.setValueAtTime(up.x, currentTime);
      (listener as any).upY.setValueAtTime(up.y, currentTime);
      (listener as any).upZ.setValueAtTime(up.z, currentTime);
    } else {
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  };

  const getImmersiveDeviceProfile = (): string => {
    if (typeof navigator === 'undefined') return 'unknown';
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('quest') || userAgent.includes('oculus')) return 'meta-quest';
    if (userAgent.includes('vision') || userAgent.includes('xros')) return 'apple-vision-pro';
    if (
      userAgent.includes('android') ||
      userAgent.includes('iphone') ||
      userAgent.includes('ipad')
    ) {
      return 'mobile-ar';
    }
    return 'desktop-xr';
  };

  const getPreferredSessionModes = (
    deviceProfile: string
  ): Array<'immersive-ar' | 'immersive-vr'> => {
    if (deviceProfile === 'meta-quest') {
      return ['immersive-vr', 'immersive-ar'];
    }
    if (deviceProfile === 'apple-vision-pro' || deviceProfile === 'mobile-ar') {
      return ['immersive-ar', 'immersive-vr'];
    }
    return ['immersive-ar', 'immersive-vr'];
  };

  const closeImmersiveTelemetry = () => {
    if (!immersiveTelemetryOpenRef.current) return;

    const startedAt = immersiveSessionStartedAtMsRef.current;
    const durationMs = typeof startedAt === 'number' ? Math.max(Date.now() - startedAt, 0) : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    void reportImmersiveSessionEvent({
      eventType: 'end',
      sessionMode: immersiveSessionModeRef.current,
      deviceProfile: immersiveDeviceProfileRef.current,
      durationMs,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    immersiveTelemetryOpenRef.current = false;
    immersiveSessionStartedAtMsRef.current = null;
    immersiveSessionModeRef.current = 'unknown';
    immersiveDeviceProfileRef.current = 'unknown';
    setImmersiveActiveMode('unknown');
  };

  const exitImmersiveView = async () => {
    const session = xrSessionRef.current;
    if (session) {
      try {
        await session.end();
      } catch {
        xrCleanupRef.current?.();
      }
      return;
    }
    xrCleanupRef.current?.();
  };

  const enterImmersiveView = async () => {
    if (isImmersiveStarting || isImmersiveActive) return;
    if (!providerSessionToken.trim()) {
      const message = 'Provider host access is required. Sign in through Provider Access.';
      setImmersiveError(message);
      return;
    }
    if (!isImmersiveSupported || !hasCheckedImmersiveSupport) {
      const unsupportedMessage = 'Immersive mode is not supported on this browser/device.';
      setImmersiveError(unsupportedMessage);
      void reportImmersiveSessionEvent({
        eventType: 'error',
        sessionMode: 'unknown',
        deviceProfile: getImmersiveDeviceProfile(),
        errorMessage: unsupportedMessage,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setImmersiveError(null);
    setIsImmersiveStarting(true);

    let cleanedUp = false;
    let session: any = null;
    let selectedSessionMode: 'immersive-ar' | 'immersive-vr' | 'unknown' = 'unknown';
    let selectedDeviceProfile = 'unknown';
    let handleSessionEnd: (() => void) | null = null;
    let mount: HTMLElement | null = null;
    let scene: ThreeTypes.Scene | null = null;
    let camera: ThreeTypes.PerspectiveCamera | null = null;
    let renderer: ThreeTypes.WebGLRenderer | null = null;
    let videoTexture: ThreeTypes.VideoTexture | null = null;
    let geometry: ThreeTypes.PlaneGeometry | null = null;
    let material: ThreeTypes.MeshBasicMaterial | null = null;
    let borderGeometry: ThreeTypes.RingGeometry | null = null;
    let borderMaterial: ThreeTypes.MeshBasicMaterial | null = null;
    let particlesGeometry: ThreeTypes.BufferGeometry | null = null;
    let particlesMaterial: ThreeTypes.PointsMaterial | null = null;
    let particlesPositionAttribute: ThreeTypes.BufferAttribute | null = null;
    let particleBasePositions: Float32Array | null = null;
    let particlePhases: Float32Array | null = null;
    let particleSpeeds: Float32Array | null = null;
    let particleDrifts: Float32Array | null = null;
    let handleResize: (() => void) | null = null;
    let audioContext: AudioContext | null = null;
    let streamSource: MediaStreamAudioSourceNode | null = null;
    let panner: PannerNode | null = null;

    const cleanup = (options?: { skipSessionEnd?: boolean }) => {
      if (cleanedUp) return;
      cleanedUp = true;

      if (renderer) {
        renderer.setAnimationLoop(null);
      }

      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }

      if (session && handleSessionEnd) {
        session.removeEventListener('end', handleSessionEnd);
      }

      if (!options?.skipSessionEnd && session && xrSessionRef.current === session) {
        session.end().catch(() => undefined);
      }

      if (streamSource) {
        streamSource.disconnect();
      }
      if (panner) {
        panner.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => undefined);
      }

      videoTexture?.dispose();
      geometry?.dispose();
      material?.dispose();
      borderGeometry?.dispose();
      borderMaterial?.dispose();
      particlesGeometry?.dispose();
      particlesMaterial?.dispose();
      renderer?.dispose();

      if (renderer && mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }

      if (xrSessionRef.current === session) {
        xrSessionRef.current = null;
      }
      if (xrCleanupRef.current === cleanup) {
        xrCleanupRef.current = null;
      }
      closeImmersiveTelemetry();

      setIsImmersiveActive(false);
      setIsImmersiveStarting(false);
    };

    try {
      const THREE = await import('./immersive/threeRuntime');
      const xrSystem = (navigator as Navigator & { xr?: any }).xr;
      if (!xrSystem) {
        throw new Error('WebXR is unavailable on this browser/device.');
      }

      const providerStream = getProviderMediaStream();
      if (!providerStream || !hasLiveTracks(providerStream) || !hasLiveVideoTracks(providerStream)) {
        throw new Error('No provider media stream is available for immersive mapping.');
      }

      const providerVideo = providerVideoRef.current;
      if (!providerVideo) {
        throw new Error('Provider video element is unavailable.');
      }

      providerVideo.srcObject = providerStream;
      providerVideo.muted = true;
      providerVideo.playsInline = true;
      providerVideo.autoplay = true;
      try {
        await providerVideo.play();
      } catch {
        // Keep going; VideoTexture can still bind when the stream starts.
      }

      selectedDeviceProfile = getImmersiveDeviceProfile();
      const sessionModePreference = getPreferredSessionModes(selectedDeviceProfile);
      const supportEntries = await Promise.all(
        sessionModePreference.map(async (mode) => ({
          mode,
          supported: await xrSystem.isSessionSupported(mode),
        }))
      );

      const supportedModes = supportEntries.filter((entry) => entry.supported).map((entry) => entry.mode);
      if (supportedModes.length === 0) {
        throw new Error('No immersive-ar or immersive-vr session is supported on this device.');
      }

      let requestError: Error | null = null;
      for (const mode of supportedModes) {
        try {
          session = await xrSystem.requestSession(mode, {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
          });
          selectedSessionMode = mode;
          break;
        } catch (primaryError) {
          try {
            session = await xrSystem.requestSession(mode);
            selectedSessionMode = mode;
            break;
          } catch (fallbackError) {
            requestError =
              fallbackError instanceof Error
                ? fallbackError
                : primaryError instanceof Error
                ? primaryError
                : new Error('Unable to establish immersive session for this device.');
          }
        }
      }

      if (!session || selectedSessionMode === 'unknown') {
        throw requestError || new Error('Unable to establish immersive session for this device.');
      }

      xrSessionRef.current = session;

      mount = xrMountRef.current || document.body;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
      camera.position.set(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      xrCleanupRef.current = cleanup;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local');
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const curvedWidth = 2.2;
      const curvedHeight = 1.25;
      const curvatureDepth = 0.2;
      geometry = new THREE.PlaneGeometry(curvedWidth, curvedHeight, 56, 1);
      const positionAttr = geometry.attributes.position;
      for (let i = 0; i < positionAttr.count; i += 1) {
        const x = positionAttr.getX(i);
        const normalized = x / (curvedWidth * 0.5);
        const zOffset = -Math.pow(normalized, 2) * curvatureDepth;
        positionAttr.setZ(i, zOffset);
      }
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();

      videoTexture = new THREE.VideoTexture(providerVideo);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.generateMipmaps = false;

      material = new THREE.MeshBasicMaterial({
        map: videoTexture,
        side: THREE.DoubleSide,
        transparent: true,
      });

      const curvedScreen = new THREE.Mesh(geometry, material);
      curvedScreen.position.set(0, 0, -2);
      scene.add(curvedScreen);

      borderGeometry = new THREE.RingGeometry(0.94, 0.97, 64);
      borderMaterial = new THREE.MeshBasicMaterial({ color: 0x6ea6ff, opacity: 0.18, transparent: true });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      border.position.set(0, 0, -1.99);
      scene.add(border);

      const light = new THREE.AmbientLight(0xffffff, 1);
      scene.add(light);

      const particleCount = 280;
      particleBasePositions = new Float32Array(particleCount * 3);
      particlePhases = new Float32Array(particleCount);
      particleSpeeds = new Float32Array(particleCount);
      particleDrifts = new Float32Array(particleCount);
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i += 1) {
        const index = i * 3;
        const radius = 1.5 + Math.random() * 3.2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = (Math.random() - 0.5) * 2.8;
        const z = radius * Math.cos(phi) - 1.2;

        particleBasePositions[index] = x;
        particleBasePositions[index + 1] = y;
        particleBasePositions[index + 2] = z;

        particlePositions[index] = x;
        particlePositions[index + 1] = y;
        particlePositions[index + 2] = z;

        particlePhases[i] = Math.random() * Math.PI * 2;
        particleSpeeds[i] = 0.18 + Math.random() * 0.35;
        particleDrifts[i] = 0.015 + Math.random() * 0.06;
      }

      particlesGeometry = new THREE.BufferGeometry();
      particlesPositionAttribute = new THREE.BufferAttribute(particlePositions, 3);
      particlesGeometry.setAttribute('position', particlesPositionAttribute);
      particlesMaterial = new THREE.PointsMaterial({
        color: 0x8ec5ff,
        size: 0.035,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const particleField = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particleField);

      const AudioContextCtor =
        window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextCtor && providerStream.getAudioTracks().some((track) => track.readyState === 'live')) {
        audioContext = new AudioContextCtor();
        await audioContext.resume();

        streamSource = audioContext.createMediaStreamSource(providerStream);
        panner = audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 20;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        setPannerPosition(panner, 0, 0, -2);

        streamSource.connect(panner);
        panner.connect(audioContext.destination);
      }

      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      const forward = new THREE.Vector3();
      const up = new THREE.Vector3();
      const xrClock = new THREE.Clock();

      renderer.setAnimationLoop(() => {
        if (
          particlesPositionAttribute &&
          particleBasePositions &&
          particlePhases &&
          particleSpeeds &&
          particleDrifts
        ) {
          const elapsed = xrClock.getElapsedTime();
          const positions = particlesPositionAttribute.array as Float32Array;
          const total = particlePhases.length;
          for (let i = 0; i < total; i += 1) {
            const index = i * 3;
            const phase = particlePhases[i] + elapsed * particleSpeeds[i];
            const drift = particleDrifts[i];
            positions[index] = particleBasePositions[index] + Math.sin(phase) * drift;
            positions[index + 1] =
              particleBasePositions[index + 1] + Math.cos(phase * 0.7) * drift * 0.45;
            positions[index + 2] =
              particleBasePositions[index + 2] + Math.sin(phase * 0.5) * drift * 0.35;
          }
          particlesPositionAttribute.needsUpdate = true;
        }

        if (audioContext && panner) {
          const xrCamera = renderer.xr.getCamera();
          xrCamera.getWorldPosition(worldPosition);
          xrCamera.getWorldQuaternion(worldQuaternion);
          forward.set(0, 0, -1).applyQuaternion(worldQuaternion).normalize();
          up.set(0, 1, 0).applyQuaternion(worldQuaternion).normalize();
          setListenerPose(audioContext.listener, worldPosition, forward, up);
        }

        renderer.render(scene, camera);
      });

      handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      handleSessionEnd = () => {
        cleanup({ skipSessionEnd: true });
      };

      session.addEventListener('end', handleSessionEnd);

      await renderer.xr.setSession(session);
      immersiveSessionModeRef.current = selectedSessionMode;
      immersiveDeviceProfileRef.current = selectedDeviceProfile;
      immersiveSessionStartedAtMsRef.current = Date.now();
      immersiveTelemetryOpenRef.current = true;
      setImmersiveActiveMode(selectedSessionMode);
      void reportImmersiveSessionEvent({
        eventType: 'start',
        sessionMode: selectedSessionMode,
        deviceProfile: selectedDeviceProfile,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      });

      setIsImmersiveActive(true);
      setIsImmersiveStarting(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start immersive session.';
      setImmersiveError(message);
      void reportImmersiveSessionEvent({
        eventType: 'error',
        sessionMode: selectedSessionMode,
        deviceProfile: selectedDeviceProfile,
        errorMessage: message,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      });
      cleanup();
    }
  };

  // Solo Session Functions
  const startSoloSession = async () => {
    if (!providerSessionToken.trim()) {
      setMeetingOpsStatus('Provider host access is required. Sign in through Provider Access.');
      return;
    }
    try {
      setPermissionState('pending');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setStream(mediaStream);
      setPermissionState('granted');
      setIsSoloSessionActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Setup audio analyser for mic level
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(mediaStream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMicLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setMicLevel(average / 255);
          requestAnimationFrame(updateMicLevel);
        }
      };
      updateMicLevel();

    } catch (err) {
      setPermissionState('denied');
      setMeetingOpsStatus('Camera and microphone access is required for solo sessions. Please check your browser permissions.');
    }
  };

  const stopSoloSession = () => {
    if (providerSessionToken.trim() && selectedHostedSessionId.trim()) {
      void endProviderMeetingSession(providerSessionToken.trim(), selectedHostedSessionId.trim());
    }

    if (externalGuestSessionToken.trim()) {
      void leaveExternalMeetingInvite(externalGuestSessionToken.trim());
      setExternalGuestSessionToken('');
      try {
        window.sessionStorage.removeItem(externalGuestSessionStorageKey);
      } catch {
        // Ignore storage exceptions.
      }
    } else if (activeJoinedSessionId) {
      void leaveMeetingSession(activeJoinedSessionId);
    }

    processedStreamCleanupRef.current?.();
    setProcessedStream(null);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (mediaRecorderRef.current && recordingState !== 'idle') {
      stopRecording();
    }
    revokeCustomBackgroundObjectUrl(selectedBackgroundRef.current, customBackgroundFileRef.current);
    selectedBackgroundRef.current = null;
    customBackgroundFileRef.current = null;
    setSelectedBackground(null);
    setBackgroundType('none');
    setCustomBackgroundFile(null);
    setShowBackgroundUploadPolicyModal(false);
    clearSessionScopedSynthesis();
    setIsJoining(false);
    setActiveJoinedSessionId(null);
    setIsSoloSessionActive(false);
    setPermissionState('idle');
    setRecordingState('idle');
    setRecordedChunks([]);
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const startRecording = () => {
    const activeMeeting = meetings[0];
    const canSaveRecording = Boolean(user?.id && activeMeeting && user.id === activeMeeting.hostUserId);
    if (!canSaveRecording) {
      setMeetingOpsStatus('Only the session initiator can record or download the meeting video.');
      return;
    }

    const recordingStream = hasLiveTracks(processedStream) ? processedStream : stream;
    if (!recordingStream) return;

    // Check supported mime types
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser choose
        }
      }
    }

    const mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : {});

    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      setRecordedChunks(chunks);
    };

    mediaRecorder.start();
    setRecordingState('recording');
    setIsRecording(true);
    setRecordingDuration(0);

    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingState('idle');
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const downloadRecording = () => {
    const activeMeeting = meetings[0];
    const canSaveRecording = Boolean(user?.id && activeMeeting && user.id === activeMeeting.hostUserId);
    if (!canSaveRecording) {
      setMeetingOpsStatus('Only the session initiator can download the meeting video.');
      return;
    }

    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conscious-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearBackgroundEffect = () => {
    revokeCustomBackgroundObjectUrl(selectedBackground, customBackgroundFile);
    setSelectedBackground(null);
    setBackgroundType('none');
    setCustomBackgroundFile(null);
  };

  const selectBlurBackground = () => {
    revokeCustomBackgroundObjectUrl(selectedBackground, customBackgroundFile);
    setSelectedBackground(null);
    setBackgroundType('blur');
    setCustomBackgroundFile(null);
  };

  const selectBackground = (background: string, type: 'image' | 'video') => {
    revokeCustomBackgroundObjectUrl(selectedBackground, customBackgroundFile);
    setSelectedBackground(background);
    setBackgroundType(type);
    setCustomBackgroundFile(null); // Clear custom file when selecting preset
  };

  const handleCustomBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const normalizedType = file.type.toLowerCase();
    const isImage = normalizedType.startsWith('image/');
    const isAllowedVideo = ALLOWED_BACKGROUND_VIDEO_TYPES.has(normalizedType);
    if (!isImage && !isAllowedVideo) {
      setMeetingOpsStatus('Allowed background uploads: JPG, PNG, WEBP, GIF, MP4, or WEBM.');
      event.target.value = '';
      return;
    }

    if (file.size > BACKGROUND_UPLOAD_MAX_BYTES) {
      setMeetingOpsStatus('Background upload must be 25 MB or less.');
      event.target.value = '';
      return;
    }

    revokeCustomBackgroundObjectUrl(selectedBackground, customBackgroundFile);
    const url = URL.createObjectURL(file);
    setSelectedBackground(url);
    setBackgroundType(isImage ? 'image' : 'video');
    setCustomBackgroundFile(file);
    event.target.value = '';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReschedule = (meeting: Meeting) => {
    setMeetingOpsStatus('Reschedule is unavailable here. Providers update scheduled CNH rooms through host controls.');
  };

  const downloadMeetingNotes = (meeting: Meeting) => {
    if (!meeting.notes?.summary) return;
    const content = [
      `Meeting: ${meeting.title}`,
      `Status: ${meeting.status}`,
      `Start: ${meeting.startTime}`,
      '',
      `Summary: ${meeting.notes.summary}`,
      '',
      'Decisions:',
      ...(meeting.notes.decisions || []).map((item) => `- ${item}`),
      '',
      'Action Items:',
      ...(meeting.notes.actionItems || []).map(
        (item) => `- ${item.owner}: ${item.task} (Due: ${item.dueDate})`
      ),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meeting-notes-${meeting.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const syncMeetingNotes = async (meeting: Meeting) => {
    if (!meeting.notes?.summary) return;
    const payload = `${meeting.title}\n${meeting.notes.summary}`;
    try {
      await navigator.clipboard.writeText(payload);
      setMeetingOpsStatus('Meeting synthesis copied for participant sync.');
    } catch {
      setMeetingOpsStatus('Unable to access clipboard. Please copy notes manually.');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadDirectory = async () => {
      if (!user?.id) {
        setDirectoryUsers([]);
        setIsDirectoryLoading(false);
        return;
      }

      setIsDirectoryLoading(true);
      const entries = await getUserDirectory();
      if (!cancelled) {
        setDirectoryUsers(entries);
        setIsDirectoryLoading(false);
      }
    };

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedProviderToken = String(window.sessionStorage.getItem(providerTokenStorageKey) || '').trim();
    if (savedProviderToken) {
      void hydrateProviderSessionToken(savedProviderToken, 'storage-sync');
    }

    const savedGuestToken = String(window.sessionStorage.getItem(externalGuestSessionStorageKey) || '').trim();
    if (savedGuestToken) {
      setExternalGuestSessionToken(savedGuestToken);
    }

    const params = new URLSearchParams(window.location.search);
    const externalInviteToken = String(params.get('externalMeetingInvite') || '').trim();
    if (externalInviteToken) {
      setExternalInviteTokenInput(externalInviteToken);
      void previewExternalInvite(externalInviteToken);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProviderTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ token?: string }>;
      const nextToken = String(customEvent.detail?.token || '').trim();
      if (!nextToken) {
        disconnectProviderSessionToken(
          'Provider host session ended. Sign in through Provider Access to host sessions.'
        );
        return;
      }
      void hydrateProviderSessionToken(nextToken, 'native-session');
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.storageArea !== window.sessionStorage) return;
      if (event.key !== providerTokenStorageKey) return;
      const nextToken = String(event.newValue || '').trim();
      if (!nextToken) {
        disconnectProviderSessionToken('Provider host session ended. Sign in through Provider Access.');
        return;
      }
      void hydrateProviderSessionToken(nextToken, 'storage-sync');
    };

    window.addEventListener(PROVIDER_SESSION_TOKEN_EVENT, handleProviderTokenUpdate as EventListener);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener(
        PROVIDER_SESSION_TOKEN_EVENT,
        handleProviderTokenUpdate as EventListener
      );
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin' && !isApprovedProviderUser(user)) return;
    if (providerSessionToken.trim()) return;

    let cancelled = false;
    const initializeNativeProviderSession = async () => {
      setMeetingOpsStatus('Initializing native provider host controls...');
      const session = await createNativeProviderControlSession();
      if (cancelled) return;
      if (!session?.token) {
        setMeetingOpsStatus('Provider host controls are unavailable for this account.');
        return;
      }
      setProviderControlSession(session.token);
      await hydrateProviderSessionToken(session.token, 'native-session');
    };

    void initializeNativeProviderSession();
    return () => {
      cancelled = true;
    };
  }, [providerSessionToken, user?.id, user?.role, user?.providerApproved, user?.providerApprovalStatus, user?.providerRevokedAt]);

  useEffect(() => {
    void refreshJoinableSessions();
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = () => {
      if (providerSessionToken.trim() && selectedHostedSessionId.trim()) {
        void endProviderMeetingSession(providerSessionToken.trim(), selectedHostedSessionId.trim());
      }
      if (externalGuestSessionToken.trim()) {
        void leaveExternalMeetingInvite(externalGuestSessionToken.trim());
      } else if (activeJoinedSessionId) {
        void leaveMeetingSession(activeJoinedSessionId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [externalGuestSessionToken, activeJoinedSessionId, providerSessionToken, selectedHostedSessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!inviteGroupStorageKey) {
      setInviteGroupTemplates([]);
      setSelectedInviteGroupId('');
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(inviteGroupStorageKey);
      if (!rawValue) {
        setInviteGroupTemplates([]);
        setSelectedInviteGroupId('');
        return;
      }

      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        setInviteGroupTemplates([]);
        setSelectedInviteGroupId('');
        return;
      }

      const loadedTemplates = parsed
        .map((entry: any) => ({
          id: String(entry?.id || '').trim(),
          name: String(entry?.name || '').trim(),
          usernames: Array.isArray(entry?.usernames)
            ? entry.usernames
                .map((username: any) => normalizeUsername(String(username || '')))
                .filter((username: string) => username.length > 0)
            : [],
        }))
        .filter(
          (entry: InviteGroupTemplate) =>
            entry.id.length > 0 && entry.name.length > 0 && entry.usernames.length > 0
        )
        .slice(0, 25);

      setInviteGroupTemplates(loadedTemplates);
      setSelectedInviteGroupId((current) =>
        loadedTemplates.some((group) => group.id === current) ? current : ''
      );
    } catch {
      setInviteGroupTemplates([]);
      setSelectedInviteGroupId('');
    }
  }, [inviteGroupStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !inviteGroupStorageKey) return;

    try {
      if (inviteGroupTemplates.length === 0) {
        window.localStorage.removeItem(inviteGroupStorageKey);
        return;
      }

      window.localStorage.setItem(
        inviteGroupStorageKey,
        JSON.stringify(inviteGroupTemplates.slice(0, 25))
      );
    } catch {
      // Ignore storage exceptions in constrained browser contexts.
    }
  }, [inviteGroupStorageKey, inviteGroupTemplates]);

  useEffect(() => {
    let cancelled = false;

    const checkImmersiveSupport = async () => {
      if (typeof navigator === 'undefined') {
        if (!cancelled) {
          setIsImmersiveSupported(false);
          setImmersiveDeviceProfile('unknown');
          setImmersiveSupportedModes([]);
          setHasCheckedImmersiveSupport(true);
        }
        return;
      }

      const xrSystem = (navigator as Navigator & { xr?: any }).xr;
      const deviceProfile = getImmersiveDeviceProfile();
      if (!xrSystem) {
        if (!cancelled) {
          setIsImmersiveSupported(false);
          setImmersiveDeviceProfile(deviceProfile);
          setImmersiveSupportedModes([]);
          setHasCheckedImmersiveSupport(true);
        }
        return;
      }

      try {
        const preferredModes = getPreferredSessionModes(deviceProfile);
        const supportEntries = await Promise.all(
          preferredModes.map(async (mode) => ({
            mode,
            supported: await xrSystem.isSessionSupported(mode),
          }))
        );
        const supportedModes = supportEntries
          .filter((entry) => entry.supported)
          .map((entry) => entry.mode);

        if (!cancelled) {
          setIsImmersiveSupported(supportedModes.length > 0);
          setImmersiveDeviceProfile(deviceProfile);
          setImmersiveSupportedModes(supportedModes);
        }
      } catch {
        if (!cancelled) {
          setIsImmersiveSupported(false);
          setImmersiveDeviceProfile(deviceProfile);
          setImmersiveSupportedModes([]);
        }
      } finally {
        if (!cancelled) {
          setHasCheckedImmersiveSupport(true);
        }
      }
    };

    checkImmersiveSupport();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    processedStreamCleanupRef.current?.();
    processedStreamCleanupRef.current = null;

    if (!stream || !hasLiveVideoTracks(stream)) {
      setProcessedStream(null);
      return;
    }

    const shouldProcessStream =
      backgroundType === 'blur' || ((backgroundType === 'image' || backgroundType === 'video') && Boolean(selectedBackground));
    if (!shouldProcessStream) {
      setProcessedStream(null);
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    let compositedStream: MediaStream | null = null;
    let compositedVideoTrack: MediaStreamTrack | null = null;
    let cameraInputVideo: HTMLVideoElement | null = null;
    let backgroundVideo: HTMLVideoElement | null = null;
    let backgroundImage: HTMLImageElement | null = null;
    let renderCanvas: HTMLCanvasElement | null = null;
    let renderContext: CanvasRenderingContext2D | null = null;
    let localSegmentation: SelfieSegmentationInstance | null = null;
    let cleaningUp = false;

    const cleanupProcessing = () => {
      if (cleaningUp) return;
      cleaningUp = true;
      cancelled = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (backgroundVideo) {
        backgroundVideo.pause();
        backgroundVideo.src = '';
        backgroundVideo.load();
        backgroundVideo = null;
      }

      if (cameraInputVideo) {
        cameraInputVideo.pause();
        cameraInputVideo.srcObject = null;
        cameraInputVideo = null;
      }

      if (compositedVideoTrack) {
        compositedVideoTrack.stop();
        compositedVideoTrack = null;
      }

      if (localSegmentation) {
        localSegmentation.close().catch(() => undefined);
        localSegmentation = null;
      }
      if (segmentationRef.current) {
        segmentationRef.current = null;
      }

      if (processedStreamCleanupRef.current === cleanupProcessing) {
        processedStreamCleanupRef.current = null;
      }

      setProcessedStream((currentStream) => (currentStream === compositedStream ? null : currentStream));
    };

    processedStreamCleanupRef.current = cleanupProcessing;

    const initializeProcessing = async () => {
      try {
        cameraInputVideo = document.createElement('video');
        cameraInputVideo.autoplay = true;
        cameraInputVideo.muted = true;
        cameraInputVideo.playsInline = true;
        cameraInputVideo.srcObject = stream;
        await cameraInputVideo.play();

        if (cancelled) return;

        const videoTrack = stream.getVideoTracks()[0] ?? null;
        const trackSettings = videoTrack?.getSettings?.();
        const width = typeof trackSettings?.width === 'number' && trackSettings.width > 0 ? trackSettings.width : 1280;
        const height = typeof trackSettings?.height === 'number' && trackSettings.height > 0 ? trackSettings.height : 720;

        renderCanvas = document.createElement('canvas');
        renderCanvas.width = width;
        renderCanvas.height = height;

        renderContext = renderCanvas.getContext('2d', { alpha: true });
        if (!renderContext) {
          throw new Error('Unable to initialize background compositor.');
        }

        if (backgroundType === 'image' && selectedBackground) {
          backgroundImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new window.Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Background image failed to load.'));
            image.src = selectedBackground;
          });
        } else if (backgroundType === 'video' && selectedBackground) {
          backgroundVideo = document.createElement('video');
          backgroundVideo.src = selectedBackground;
          backgroundVideo.loop = true;
          backgroundVideo.muted = true;
          backgroundVideo.playsInline = true;
          backgroundVideo.crossOrigin = 'anonymous';
          backgroundVideo.preload = 'auto';
          try {
            await backgroundVideo.play();
          } catch {
            // Keep rendering; once user interacts again, video background can resume.
          }
        }

        const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');
        localSegmentation = new SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        segmentationRef.current = localSegmentation;
        localSegmentation.setOptions({ modelSelection: 1, selfieMode: true });
        localSegmentation.onResults((results: SelfieSegmentationResults) => {
          if (cancelled || !renderContext || !renderCanvas) return;

          const canvasWidth = renderCanvas.width;
          const canvasHeight = renderCanvas.height;
          renderContext.clearRect(0, 0, canvasWidth, canvasHeight);

          renderContext.save();
          renderContext.drawImage(results.image as CanvasImageSource, 0, 0, canvasWidth, canvasHeight);
          renderContext.globalCompositeOperation = 'destination-in';
          renderContext.drawImage(results.segmentationMask as CanvasImageSource, 0, 0, canvasWidth, canvasHeight);
          renderContext.restore();

          renderContext.globalCompositeOperation = 'destination-over';

          if (backgroundType === 'blur') {
            renderContext.save();
            renderContext.filter = 'blur(18px)';
            renderContext.drawImage(results.image as CanvasImageSource, 0, 0, canvasWidth, canvasHeight);
            renderContext.restore();
          } else if (backgroundType === 'video' && backgroundVideo && backgroundVideo.readyState >= 2) {
            renderContext.drawImage(backgroundVideo, 0, 0, canvasWidth, canvasHeight);
          } else if (backgroundType === 'image' && backgroundImage) {
            renderContext.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
          } else {
            renderContext.fillStyle = '#0f172a';
            renderContext.fillRect(0, 0, canvasWidth, canvasHeight);
          }

          renderContext.globalCompositeOperation = 'source-over';
        });

        await localSegmentation.initialize();
        if (cancelled) return;

        compositedStream = renderCanvas.captureStream(30);
        stream.getAudioTracks().forEach((audioTrack) => compositedStream?.addTrack(audioTrack));
        compositedVideoTrack = compositedStream.getVideoTracks()[0] ?? null;
        setProcessedStream(compositedStream);

        const processFrame = async () => {
          if (cancelled || !localSegmentation || !cameraInputVideo) return;

          if (cameraInputVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              await localSegmentation.send({ image: cameraInputVideo });
            } catch {
              // Ignore intermittent model frame errors and continue.
            }
          }

          if (!cancelled) {
            rafId = requestAnimationFrame(() => {
              void processFrame();
            });
          }
        };

        void processFrame();
      } catch {
        cleanupProcessing();
      }
    };

    void initializeProcessing();

    return () => {
      cleanupProcessing();
    };
  }, [stream, backgroundType, selectedBackground]);

  useEffect(() => {
    liveStreamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    selectedBackgroundRef.current = selectedBackground;
    customBackgroundFileRef.current = customBackgroundFile;
  }, [selectedBackground, customBackgroundFile]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      processedStreamCleanupRef.current?.();

      const activeStream = liveStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      revokeCustomBackgroundObjectUrl(selectedBackgroundRef.current, customBackgroundFileRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      const session = xrSessionRef.current;
      if (session) {
        session.end().catch(() => undefined);
        xrSessionRef.current = null;
      }
      xrCleanupRef.current?.();
    };
  }, []);

  // Set video srcObject when stream is available
  useEffect(() => {
    if (!videoRef.current) return;

    const displayStream = hasLiveTracks(processedStream) ? processedStream : stream;
    videoRef.current.srcObject = displayStream || null;

    if (displayStream) {
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream, processedStream]);

  // Keep a dedicated provider video element synced for WebXR texture mapping.
  useEffect(() => {
    const providerVideo = providerVideoRef.current;
    if (!providerVideo) return;

    const providerStream = getProviderMediaStream();
    if (!providerStream || !hasLiveTracks(providerStream)) {
      providerVideo.srcObject = null;
      return;
    }

    providerVideo.srcObject = providerStream;
    providerVideo.muted = true;
    providerVideo.playsInline = true;
    providerVideo.autoplay = true;
    providerVideo.play().catch(() => undefined);

    const clearWhenInactive = () => {
      if (
        providerVideoRef.current?.srcObject === providerStream &&
        !providerStream.getTracks().some((track) => track.readyState === 'live')
      ) {
        providerVideoRef.current.srcObject = null;
      }
    };

    const tracks = providerStream.getTracks();
    tracks.forEach((track) => track.addEventListener('ended', clearWhenInactive));
    providerStream.addEventListener('inactive', clearWhenInactive);

    return () => {
      tracks.forEach((track) => track.removeEventListener('ended', clearWhenInactive));
      providerStream.removeEventListener('inactive', clearWhenInactive);
      clearWhenInactive();
    };
  }, [stream, processedStream, isSoloSessionActive]);

  const canEnterImmersiveView = hasCheckedImmersiveSupport && isImmersiveSupported;
  const activeMeeting = meetings[0] || null;
  const hasActiveMeetingNotes = Boolean(activeMeeting?.notes?.summary);
  const canSaveRecording = Boolean(user?.id && activeMeeting && user.id === activeMeeting.hostUserId);
  const canUseHostConsole = user?.role === 'admin' || isApprovedProviderUser(user);

  if (!canUseHostConsole) {
    return (
      <div className="glass-panel rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 text-amber-200" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Provider Host Console Restricted</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Host controls are reserved for approved providers and the solo admin operator. Members can join only authorized sessions from the upcoming board or signed room links.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-col gap-4 sm:gap-6 md:gap-8 animate-in fade-in duration-700 relative">
      <div ref={xrMountRef} className="fixed inset-0 z-[250] pointer-events-none" />
      <video ref={providerVideoRef} className="hidden" autoPlay playsInline muted />

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 md:gap-6 relative z-10">
        <div className="space-y-2">
          <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl font-black text-white uppercase tracking-tighter leading-tight flex items-center gap-2 sm:gap-3 md:gap-4">
            <Video className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-blue-400" />
            Conscious Meetings
          </h2>
          <p className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-blue-400/60 uppercase tracking-[0.35em] sm:tracking-[0.4em] md:tracking-[0.5em]">
            Virtual Sovereignty & Expert Wisdom
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          <div className="glass-panel px-4 sm:px-5 md:px-6 py-2 sm:py-3 md:py-4 rounded-xl sm:rounded-2xl border-white/5 shadow-xl flex items-center gap-3 sm:gap-4">
            <div className="text-right">
              <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Access Tier</p>
              <p className="text-sm sm:text-base md:text-lg font-mono font-bold text-white">{user?.tier || 'Community'}</p>
            </div>
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
          </div>
        </div>
      </header>

      {/* Tabs (scrollable on mobile) */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl w-full sm:w-fit overflow-x-auto custom-scrollbar scrollable-x">
        {[
          { id: 'schedule', label: 'Host Path', icon: <Calendar className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { id: 'lobby', label: 'Live Lobby', icon: <Play className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { id: 'calendar', label: 'Session Ledger', icon: <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span className="hidden xs:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 animate-in slide-in-from-bottom-4">
            <div className="glass-panel md:col-span-2 p-5 sm:p-6 md:p-8 rounded-2xl border-white/10 space-y-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-200">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-white">
                    Real Provider Publishing Path
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-400">
                    Local booking cards are disabled for launch. Use Live Lobby host controls to create real CNH rooms, invite users or groups, and share signed internal meeting links.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hosted Rooms</p>
                  <p className="mt-1 text-2xl font-black text-white">{hostedMeetingSessions.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Joinable</p>
                  <p className="mt-1 text-2xl font-black text-white">{joinableMeetingSessions.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Host Access</p>
                  <p className="mt-1 text-sm font-black uppercase text-white">
                    {providerSessionToken.trim() ? 'Active' : 'Locked'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('lobby')}
                className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Open Host Controls
              </button>
            </div>

            <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-300/20 bg-amber-300/[0.04] space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Member Booking</h4>
              <p className="text-xs leading-5 text-slate-300">
                Self-service scheduling is gated for launch until provider availability is backed by real calendars and payment/membership rules.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 md:space-y-12 animate-in fade-in py-4 sm:py-6 md:py-10">
            {!isSoloSessionActive ? (
              <>
                <div className="glass-panel p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.25rem] md:rounded-[2.5rem] xl:rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 sm:p-10 md:p-12 lg:p-16 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Video className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 text-blue-400" />
                  </div>

                  <div className="relative z-10 space-y-6 sm:space-y-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                      <span className="text-[9px] sm:text-[10px] font-black text-teal-400 uppercase tracking-[0.4em]">Next Session Ready</span>
                    </div>

                    <div className="relative aspect-[16/7] overflow-hidden rounded-2xl border border-blue-300/20 bg-black/40">
                      <MeetingBrandLoop
                        alt="Conscious Meetings branded WebRTC room animation"
                        className="h-full w-full"
                        imageClassName="h-full w-full object-cover"
                        eager
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 backdrop-blur-md">
                        <img src={cnhLogo} alt="" className="h-8 w-8 rounded-xl bg-white/95 object-contain p-1" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-blue-100">CNH Native Room</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-3 sm:mb-4">
                        {activeMeeting?.title || 'No Real Session Selected'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-slate-400 text-xs sm:text-sm font-medium">
                        <span className="flex items-center gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4" /> {activeMeeting?.startTime || 'Create or join a CNH room'}</span>
                        <span className="flex items-center gap-2"><Users className="w-3 h-3 sm:w-4 sm:h-4" /> {activeMeeting?.participants.length || 0} Participants</span>
                      </div>
                    </div>

                    {/* Pre-join flow */}
                    <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 border-t border-white/5">
                      <h4 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware Manifest</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <button
                          onClick={checkPermissions}
                          className={`flex items-center justify-between p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-2xl border transition-all ${
                            permissionState === 'granted'
                              ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            {permissionState === 'granted' ? <Camera className="w-5 h-5 sm:w-6 sm:h-6" /> : <CameraOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                            <span className="text-[8px] sm:text-xs font-bold uppercase tracking-widest">Visual Input</span>
                          </div>
                          {permissionState === 'granted'
                            ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            : permissionState === 'pending'
                              ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              : <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                          }
                        </button>

                        <button
                          onClick={checkPermissions}
                          className={`flex items-center justify-between p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-2xl border transition-all ${
                            permissionState === 'granted'
                              ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            {permissionState === 'granted' ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                            <span className="text-[8px] sm:text-xs font-bold uppercase tracking-widest">Audio Input</span>
                          </div>
                          {permissionState === 'granted'
                            ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            : permissionState === 'pending'
                              ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              : <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                          }
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button
                          disabled={permissionState !== 'granted'}
                          onClick={async () => {
                            if (joinableMeetingSessions.length === 0) {
                              setMeetingOpsStatus('No invited platform session available to join.');
                              return;
                            }
                            const liveSession =
                              joinableMeetingSessions.find((entry) => entry.status === 'live') ||
                              joinableMeetingSessions[0];
                            await joinInvitedSession(liveSession.id);
                          }}
                          className="cnh-action-label flex-1 py-4 sm:py-5 md:py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg 2xl:text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 sm:gap-4"
                        >
                          {isJoining ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                          Join Virtual Session
                        </button>

                        <button
                          onClick={startSoloSession}
                          disabled={!providerSessionToken.trim()}
                          className="cnh-action-label flex-1 py-4 sm:py-5 md:py-6 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg 2xl:text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 sm:gap-4"
                        >
                          <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                          Start Solo Session
                        </button>
                      </div>

                      {!providerSessionToken.trim() && (
                        <p className="text-[9px] sm:text-[10px] text-amber-300 uppercase tracking-widest text-center">
                          Native provider access is required to host sessions (virtual, solo, and 5D immersive).
                        </p>
                      )}

                      {canEnterImmersiveView ? (
                        <button
                          onClick={isImmersiveActive ? exitImmersiveView : enterImmersiveView}
                          disabled={isImmersiveStarting}
                          className="w-full py-4 sm:py-5 md:py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg lg:text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 sm:gap-4"
                        >
                          {isImmersiveStarting ? (
                            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                          ) : (
                            <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                          )}
                          {isImmersiveActive ? 'Exit 5D Immersive View' : 'Enter 5D Immersive View'}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-4 sm:py-5 md:py-6 bg-slate-800 text-slate-500 rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg lg:text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 sm:gap-4 cursor-not-allowed"
                        >
                          <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                          {hasCheckedImmersiveSupport ? '5D Immersive View Unavailable' : 'Checking 5D Device Support'}
                        </button>
                      )}

                      <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest text-center">
                        Auto-optimized for Meta Quest, Apple Vision Pro, and mobile AR goggles
                      </p>

                      <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 space-y-3">
                        <h5 className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest">
                          XR Device Diagnostics
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                          <div className="flex justify-between items-center p-2.5 rounded-lg bg-black/20">
                            <span className="text-slate-500">Device Profile</span>
                            <span className="text-white">{immersiveDeviceProfile}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 rounded-lg bg-black/20">
                            <span className="text-slate-500">XR Ready</span>
                            <span className={canEnterImmersiveView ? 'text-teal-400' : 'text-rose-300'}>
                              {canEnterImmersiveView ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 rounded-lg bg-black/20">
                            <span className="text-slate-500">Supported Modes</span>
                            <span className="text-white">
                              {immersiveSupportedModes.length > 0 ? immersiveSupportedModes.join(', ') : 'None'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 rounded-lg bg-black/20">
                            <span className="text-slate-500">Active Mode</span>
                            <span className={immersiveActiveMode === 'unknown' ? 'text-slate-300' : 'text-teal-300'}>
                              {immersiveActiveMode}
                            </span>
                          </div>
                        </div>
                      </div>

                      {immersiveError && (
                        <p className="text-[10px] sm:text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl px-4 py-3">
                          {immersiveError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Solo Session Active UI
              <div className="glass-panel p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.25rem] md:rounded-[2.5rem] lg:rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-6 sm:space-y-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[9px] sm:text-[10px] font-black text-red-400 uppercase tracking-[0.4em]">Solo Session Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEnterImmersiveView ? (
                        <button
                          onClick={isImmersiveActive ? exitImmersiveView : enterImmersiveView}
                          disabled={isImmersiveStarting}
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest transition-all"
                        >
                          {isImmersiveActive ? 'Exit 5D View' : 'Enter 5D View'}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 text-slate-500 rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest cursor-not-allowed"
                        >
                          5D Unavailable
                        </button>
                      )}
                      <button
                        onClick={stopSoloSession}
                        className="px-4 sm:px-6 py-2 sm:py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest transition-all"
                      >
                        End Session
                      </button>
                    </div>
                  </div>

                  {/* Video Preview */}
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-64 sm:h-80 md:h-96 bg-black rounded-lg sm:rounded-2xl object-cover"
                    />
                    
                    {/* Recording Indicator */}
                    {recordingState !== 'idle' && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        REC {formatDuration(recordingDuration)}
                      </div>
                    )}

                    {/* Mic Level Indicator */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 text-white">
                        <Mic className="w-4 h-4" />
                        <div className="flex-1 bg-black/50 rounded-full h-2">
                          <div 
                            className="bg-teal-400 h-full rounded-full transition-all duration-100"
                            style={{ width: `${micLevel * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div className="space-y-4">
                    {!canSaveRecording && (
                      <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        Only session initiator can record/download video
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-4">
                      {recordingState === 'idle' && (
                        <button
                          onClick={startRecording}
                          disabled={!canSaveRecording}
                          className="px-6 sm:px-8 py-3 sm:py-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                          <Play className="w-5 h-5" />
                          Start Recording
                        </button>
                      )}

                      {recordingState === 'recording' && (
                        <>
                          <button
                            onClick={pauseRecording}
                            className="px-6 sm:px-8 py-3 sm:py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Pause className="w-5 h-5" />
                            Pause
                          </button>
                          <button
                            onClick={stopRecording}
                            className="px-6 sm:px-8 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Square className="w-5 h-5" />
                            Stop
                          </button>
                        </>
                      )}

                      {recordingState === 'paused' && (
                        <>
                          <button
                            onClick={resumeRecording}
                            className="px-6 sm:px-8 py-3 sm:py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Play className="w-5 h-5" />
                            Resume
                          </button>
                          <button
                            onClick={stopRecording}
                            className="px-6 sm:px-8 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Square className="w-5 h-5" />
                            Stop
                          </button>
                        </>
                      )}
                    </div>

                    {recordedChunks.length > 0 && (
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={downloadRecording}
                          disabled={!canSaveRecording}
                          className="px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                          <Download className="w-5 h-5" />
                          Download ({formatDuration(recordingDuration)})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Background Selection */}
                  <div className="space-y-4">
                    <h4 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Meeting Background</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      <button
                        onClick={clearBackgroundEffect}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          backgroundType === 'none' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-600 rounded mx-auto mb-2 flex items-center justify-center">
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">None</span>
                        </div>
                      </button>

                      <button
                        onClick={selectBlurBackground}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          backgroundType === 'blur' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <Camera className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Blur</span>
                        </div>
                      </button>

                      {BACKGROUND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => selectBackground(preset.source, preset.type)}
                          className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                            selectedBackground === preset.source && backgroundType === preset.type && !customBackgroundFile
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-center">
                            {preset.type === 'video' ? (
                              <Video className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                            ) : (
                              <Image className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                            )}
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">{preset.label}</span>
                          </div>
                        </button>
                      ))}

                      {/* Custom Upload */}
                      <button
                        onClick={() => setShowBackgroundUploadPolicyModal(true)}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          customBackgroundFile && (backgroundType === 'image' || backgroundType === 'video')
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Upload</span>
                        </div>
                      </button>

                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                        onChange={handleCustomBackgroundUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Notetaker Preview Settings */}
            <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.25rem] md:rounded-[2.5rem] border-blue-500/10 shadow-xl space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="p-3 sm:p-4 bg-blue-600/10 rounded-lg sm:rounded-2xl">
                    <Zap className={`w-5 h-5 sm:w-6 sm:h-6 ${isNoteTakerOn ? 'text-teal-400 animate-pulse' : 'text-slate-600'}`} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">AI Synthesis Notetaker</h4>
                    <p className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest mt-1">Transcript capture gated for launch</p>
                  </div>
                </div>
                <button
                  onClick={toggleSynthesisNotetaker}
                  className={`px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                    isNoteTakerOn
                      ? 'bg-teal-500/20 border-teal-500/40 text-teal-400 shadow-glow'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                  }`}
                >
                  {isNoteTakerOn ? 'Disable Synthesis' : 'Enable Synthesis'}
                </button>
              </div>

              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest">
                Synthesis does not display synthetic transcripts. Notes unlock only after real captured transcript support is connected.
              </p>

              {isNoteTakerOn && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {SYNTHESIS_AGENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSynthesisAgentMode(option.id)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          synthesisAgentMode === option.id
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{option.label}</p>
                        <p className="text-[8px] sm:text-[9px] mt-1 text-slate-300 normal-case tracking-normal leading-relaxed">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={initiateSynthesisAgent}
                      disabled={isSynthesizingNotes || (!isSoloSessionActive && !isJoining)}
                      className="flex-1 px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {isSynthesizingNotes ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {isSynthesizingNotes ? 'Generating Notes' : 'Initiate Agent Notes'}
                    </button>
                    <button
                      onClick={() => activeMeeting && downloadMeetingNotes(activeMeeting)}
                      disabled={!hasActiveMeetingNotes}
                      className="flex-1 px-4 sm:px-6 py-3 bg-white/5 hover:bg-white/10 disabled:bg-slate-800 disabled:text-slate-600 border border-white/10 text-slate-300 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download Session Notes
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] border-blue-500/10 shadow-xl space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">
                  Provider Session Orchestration
                </h4>
                <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest">
                  Provider-only host controls
                </span>
              </div>

              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest">
                Providers create/start sessions, invite platform users/groups, and issue external guest links.
                Provider host access is granted through native CNH provider authentication.
              </p>

              <div className="relative overflow-hidden rounded-2xl border border-blue-300/20 bg-black/40">
                <MeetingBrandLoop
                  alt="Conscious Meetings branded WebRTC room animation"
                  className="h-44 w-full sm:h-52"
                  imageClassName="h-full w-full object-cover"
                  eager
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
                <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 backdrop-blur-md">
                  <img src={cnhLogo} alt="" className="h-9 w-9 rounded-xl bg-white/95 object-contain p-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-100">
                    Branded CNH Meeting Confirmation
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest">
                  Host Access Status
                </p>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest mt-1 text-white">
                  {providerSessionToken.trim() ? 'Active (CNH Verified)' : 'Not Active'}
                </p>
                {!providerSessionToken.trim() && (
                  <p className="text-[9px] sm:text-[10px] text-amber-300 uppercase tracking-widest mt-2">
                    Sign in through Provider Access to unlock host controls.
                  </p>
                )}
              </div>

              {providerSessionToken.trim() && (
                <div className="space-y-5 border-t border-white/10 pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <input
                      type="text"
                      value={hostSessionTitleInput}
                      onChange={(event) => setHostSessionTitleInput(event.target.value)}
                      placeholder="Session title"
                      className="md:col-span-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <input
                      type="text"
                      value={hostSessionFocusAreaInput}
                      onChange={(event) => setHostSessionFocusAreaInput(event.target.value)}
                      placeholder="Professional focus area"
                      className="md:col-span-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <select
                      value={CNH_NATIVE_ROOM_PROVIDER_ID}
                      disabled
                      className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-cyan-300/20 rounded-xl text-xs text-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all font-medium disabled:opacity-100"
                    >
                      <option value={CNH_NATIVE_ROOM_PROVIDER_ID}>{CNH_NATIVE_ROOM_LABEL}</option>
                    </select>
                    <input
                      type="date"
                      value={hostSessionDateInput}
                      onChange={(event) => setHostSessionDateInput(event.target.value)}
                      className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <input
                      type="time"
                      value={hostSessionTimeInput}
                      onChange={(event) => setHostSessionTimeInput(event.target.value)}
                      className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <select
                      value={hostSessionMode}
                      onChange={(event) => setHostSessionMode(event.target.value as MeetingSessionMode)}
                      className="md:col-span-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    >
                      <option value="virtual">Virtual</option>
                      <option value="solo">Solo</option>
                      <option value="immersive-5d">5D Immersive</option>
                    </select>
                    <input
                      type="number"
                      min={2}
                      max={500}
                      value={hostSessionMaxViewersInput}
                      onChange={(event) => setHostSessionMaxViewersInput(Number(event.target.value || 120))}
                      placeholder="Max viewers"
                      className="md:col-span-3 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <textarea
                      value={hostSessionDescriptionInput}
                      onChange={(event) => setHostSessionDescriptionInput(event.target.value)}
                      placeholder="Session description"
                      className="md:col-span-6 w-full min-h-[96px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-xs leading-5 text-cyan-50">
                      <input
                        type="checkbox"
                        checked={hostSessionMode === 'immersive-5d' || hostSessionImmersiveGatewayEnabled}
                        disabled={hostSessionMode === 'immersive-5d'}
                        onChange={(event) => setHostSessionImmersiveGatewayEnabled(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                      />
                      <span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-cyan-100">
                          5D Participant Gateway
                        </span>
                        Participants can choose 5D only when their local browser/device supports WebXR. Standard View remains available.
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-xs leading-5 text-amber-50">
                      <input
                        type="checkbox"
                        checked={hostSessionLocalRecordingAllowed}
                        onChange={(event) => setHostSessionLocalRecordingAllowed(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-amber-400"
                      />
                      <span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-amber-100">
                          Participant-Side Recording
                        </span>
                        Allows each participant to record only inside their own browser after they opt in. CNH server recording stays off.
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={createHostedSession}
                      disabled={isMeetingOpsBusy}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Create CNH Room
                    </button>
                    <button
                      onClick={startHostedSession}
                      disabled={isMeetingOpsBusy || !selectedHostedSessionId}
                      className="px-4 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Start Session
                    </button>
                    <button
                      onClick={endHostedSession}
                      disabled={isMeetingOpsBusy || !selectedHostedSessionId}
                      className="px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      End Session
                    </button>
                    <button
                      onClick={() => void refreshProviderMeetingData()}
                      disabled={isMeetingOpsBusy}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:bg-slate-800 disabled:text-slate-600 border border-white/10 text-slate-300 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Refresh Host Data
                    </button>
                  </div>

                  <select
                    value={selectedHostedSessionId}
                    onChange={(event) => setSelectedHostedSessionId(event.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                  >
                    <option value="">
                      {hostedMeetingSessions.length === 0
                        ? `No ${CNH_NATIVE_ROOM_LABEL} sessions yet`
                        : 'Select hosted session'}
                    </option>
                    {hostedMeetingSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title} - CNH Native [{session.mode}{session.nativeRoom?.immersiveEnabled ? ', 5D' : ''}{session.nativeRoom?.localRecordingAllowed ? ', local rec' : ''}] ({session.status}) - {new Date(session.scheduledAtMs || session.createdAtMs).toLocaleString()} - {session.participants.length}/{session.maxViewers}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-cyan-50">
                        Internal {CNH_NATIVE_ROOM_LABEL}
                      </p>
                      <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-cyan-200">
                        Signed CNH access
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <input
                        type="text"
                        value={selectedInternalRoomLink || 'Create or select a hosted session to generate the CNH room link.'}
                        readOnly
                        className="md:col-span-4 w-full px-4 py-3 bg-black/30 border border-cyan-300/20 rounded-xl text-[10px] text-cyan-50"
                      />
                      <button
                        onClick={async () => {
                          if (!selectedInternalRoomLink) return;
                          try {
                            await navigator.clipboard.writeText(selectedInternalRoomLink);
                            setMeetingOpsStatus('CNH room link copied.');
                          } catch {
                            setMeetingOpsStatus('Copy failed. You can manually share the CNH room link.');
                          }
                        }}
                        disabled={!selectedInternalRoomLink}
                        className="md:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedInternalRoomLink || typeof window === 'undefined') return;
                          window.open(selectedInternalRoomLink, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!selectedInternalRoomLink}
                        className="md:col-span-1 px-4 py-3 bg-white/5 hover:bg-white/10 disabled:bg-slate-800 disabled:text-slate-600 border border-white/10 text-slate-200 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Open
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={providerGroupNameInput}
                      onChange={(event) => setProviderGroupNameInput(event.target.value)}
                      placeholder="Create provider group name"
                      className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <button
                      onClick={() => void createProviderGroupFromProfile()}
                      disabled={isMeetingOpsBusy}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Create Group
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={providerGroupMemberUsernameInput}
                      onChange={(event) => setProviderGroupMemberUsernameInput(event.target.value)}
                      placeholder="Add username to first selected group"
                      className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <button
                      onClick={() => void addMemberToProviderProfileGroup()}
                      disabled={isMeetingOpsBusy}
                      className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 disabled:bg-slate-800 disabled:text-slate-600 border border-white/10 text-slate-300 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Add To Group
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <textarea
                      value={inviteUsernamesBatchInput}
                      onChange={(event) => setInviteUsernamesBatchInput(event.target.value)}
                      placeholder="Invite usernames (comma, space, or newline separated)"
                      className="w-full min-h-[100px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar scrollable">
                      <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest">
                        Provider Profile Groups
                      </p>
                      {providerInviteGroups.length === 0 && (
                        <p className="text-[9px] text-slate-500">No provider groups found.</p>
                      )}
                      {providerInviteGroups.map((group) => {
                        const checked = selectedProviderGroupIds.includes(group.id);
                        return (
                          <label
                            key={group.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-lg bg-black/20 border border-white/10 text-xs text-slate-300"
                          >
                            <span className="truncate">{group.name} ({group.members.length})</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setSelectedProviderGroupIds((current) => {
                                  if (event.target.checked) return [...current, group.id];
                                  return current.filter((entry) => entry !== group.id);
                                });
                              }}
                              className="w-4 h-4 accent-blue-500"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={inviteUsersIntoHostedSession}
                    disabled={isMeetingOpsBusy || !selectedHostedSessionId}
                    className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Send Platform Invites (Users + Groups)
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={externalLinkTtlMinutesInput}
                      onChange={(event) => setExternalLinkTtlMinutesInput(Number(event.target.value || 120))}
                      placeholder="Link TTL (minutes)"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={externalLinkMaxUsesInput}
                      onChange={(event) => setExternalLinkMaxUsesInput(Number(event.target.value || 250))}
                      placeholder="Max external joins"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <button
                      onClick={generateHostedSessionExternalLink}
                      disabled={isMeetingOpsBusy || !selectedHostedSessionId}
                      className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Create External Link
                    </button>
                  </div>

                  {latestExternalJoinLink && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={latestExternalJoinLink}
                        readOnly
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-[10px] text-slate-300"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(latestExternalJoinLink);
                            setMeetingOpsStatus('External invite link copied.');
                          } catch {
                            setMeetingOpsStatus('Copy failed. You can manually share the link.');
                          }
                        }}
                        className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Copy External Link
                      </button>
                    </div>
                  )}
                </div>
              )}

              {meetingOpsStatus && (
                <p className="text-[9px] sm:text-[10px] text-blue-300 uppercase tracking-widest">
                  {meetingOpsStatus}
                </p>
              )}
            </div>

            <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] border-white/10 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">
                  Invited Platform Sessions
                </h4>
                <button
                  onClick={() => void refreshJoinableSessions()}
                  disabled={isMeetingOpsBusy}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:bg-slate-800 disabled:text-slate-600 border border-white/10 text-slate-300 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {joinableMeetingSessions.length === 0 && (
                  <p className="text-[10px] sm:text-xs text-slate-500">No joinable meeting invites found.</p>
                )}
                {joinableMeetingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">
                        {session.title}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                        {session.mode} | {session.status} | {session.participants.length}/{session.maxViewers}
                      </p>
                    </div>
                    <button
                      onClick={() => void joinInvitedSession(session.id)}
                      disabled={isMeetingOpsBusy || session.status === 'ended'}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      Join Session
                    </button>
                  </div>
                ))}
              </div>
              {activeJoinedSessionId && (
                <button
                  onClick={() => void leaveActiveJoinedSession()}
                  disabled={isMeetingOpsBusy}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Leave Active Session
                </button>
              )}
            </div>

            <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] border-white/10 shadow-xl space-y-4">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">
                External Guest Join (Restricted Access)
              </h4>
              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest">
                Guests provide email + name for this session only and do not gain platform feature access.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={externalInviteTokenInput}
                  onChange={(event) => setExternalInviteTokenInput(event.target.value)}
                  placeholder="External invite token"
                  className="md:col-span-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                />
                <button
                  onClick={() => void previewExternalInvite()}
                  disabled={isMeetingOpsBusy}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Validate Link
                </button>
              </div>

              {externalInvitePreview && (
                <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">
                    {externalInvitePreview.session.title}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest">
                    {externalInvitePreview.session.mode} | {externalInvitePreview.session.status} | Capacity {externalInvitePreview.session.participantCount}/{externalInvitePreview.session.maxViewers}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={externalGuestNameInput}
                      onChange={(event) => setExternalGuestNameInput(event.target.value)}
                      placeholder="Guest full name"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                    <input
                      type="email"
                      value={externalGuestEmailInput}
                      onChange={(event) => setExternalGuestEmailInput(event.target.value)}
                      placeholder="Guest email"
                      className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                  </div>
                  {!externalGuestSessionToken ? (
                    <button
                      onClick={() => void joinAsExternalGuest()}
                      disabled={isMeetingOpsBusy}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Join as External Guest
                    </button>
                  ) : (
                    <button
                      onClick={() => void leaveExternalGuestSession()}
                      disabled={isMeetingOpsBusy}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Exit External Guest Session
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6 sm:space-y-8 md:space-y-10 animate-in slide-in-from-right-4 pb-10 sm:pb-16 md:pb-20">
            <h3 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] flex items-center gap-2 sm:gap-3">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" /> Sovereign Schedule
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
              {/* Upcoming List */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
                {meetings.length === 0 && (
                  <div className="glass-panel rounded-2xl p-6 sm:p-8 border-white/10">
                    <h4 className="text-sm font-black uppercase tracking-widest text-white">
                      No real meeting sessions loaded
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      The ledger only shows backend-created CNH rooms. Create a hosted session or refresh invited platform sessions to populate this view.
                    </p>
                  </div>
                )}
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="glass-panel rounded-lg sm:rounded-[1.5rem] md:rounded-[2.25rem] lg:rounded-[2.5rem] p-4 sm:p-6 md:p-8 border-white/5 hover:border-blue-500/20 transition-all shadow-xl group">
                    <div className="relative mb-5 aspect-[16/6] overflow-hidden rounded-xl border border-blue-300/20 bg-black/40">
                      <MeetingBrandLoop
                        alt="Conscious Meetings branded room animation"
                        className="h-full w-full"
                        imageClassName="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 backdrop-blur-md">
                        <img src={cnhLogo} alt="" className="h-7 w-7 rounded-lg bg-white/95 object-contain p-0.5" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-blue-100">Branded CNH Post</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 sm:gap-6">
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span
                            className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${
                              meeting.status === 'Live'
                                ? 'bg-red-500/20 text-red-400 animate-pulse'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {meeting.status}
                          </span>
                          <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                            {meeting.accessType === 'tier' ? 'Open Access' : 'Restricted'}
                          </span>
                        </div>

                        <h4 className="text-lg sm:text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-blue-400 transition-colors">
                          {meeting.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span className="flex items-center gap-1 sm:gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4" /> {meeting.startTime}</span>
                          <span className="flex items-center gap-1 sm:gap-2"><Users className="w-3 h-3 sm:w-4 sm:h-4" /> {meeting.participants.length} Participating</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col gap-2 sm:gap-3 justify-start sm:justify-end shrink-0">
                        <button
                          onClick={() => generateAINotes(meeting.id)}
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex-1 sm:flex-none"
                        >
                          View Synthesis
                        </button>
                        <button
                          onClick={() => handleReschedule(meeting)}
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all flex-1 sm:flex-none"
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>

                    {meeting.notes && meeting.notes.summary && (
                      <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5 space-y-4 sm:space-y-6 animate-in slide-in-from-top-4">
                        <div className="bg-blue-600/5 p-4 sm:p-6 rounded-lg sm:rounded-2xl border border-blue-500/10">
                          <h5 className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2">
                            <Zap className="w-3 h-3 sm:w-4 sm:h-4" /> Synthesis Summary
                          </h5>
                          <p className="text-xs sm:text-sm text-slate-300 italic leading-relaxed">{meeting.notes.summary}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div>
                            <h5 className="text-[8px] sm:text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 sm:mb-4">Decisions</h5>
                            <ul className="space-y-1 sm:space-y-2">
                              {meeting.notes.decisions.map((d, i) => (
                                <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white">
                                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className="text-[8px] sm:text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 sm:mb-4">Action Items</h5>
                            <ul className="space-y-2 sm:space-y-3">
                              {meeting.notes.actionItems.map((a, i) => (
                                <li key={i} className="p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest">{a.owner}</span>
                                    <span className="text-[7px] sm:text-[8px] text-slate-600 uppercase font-black tracking-widest">{a.dueDate}</span>
                                  </div>
                                  <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium">{a.task}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:gap-4">
                          <button
                            onClick={() => downloadMeetingNotes(meeting)}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-slate-400"
                          >
                            <Download className="w-3 h-3 sm:w-4 sm:h-4" /> Download Notes
                          </button>
                          <button
                            onClick={() => syncMeetingNotes(meeting)}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-slate-400"
                          >
                            <Share2 className="w-3 h-3 sm:w-4 sm:h-4" /> Sync to participants
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sidebar Calendar Stats */}
              <div className="space-y-6 sm:space-y-8">
                <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] lg:rounded-[2.75rem] border-white/5 shadow-2xl space-y-6 sm:space-y-8">
                  <h4 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Sovereign Statistics</h4>

                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Sessions</span>
                      <span className="text-white font-mono font-bold text-sm sm:text-base">{meetings.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Meeting Source</span>
                      <span className="text-white font-mono font-bold text-sm sm:text-base">Backend</span>
                    </div>
                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Host Controls</span>
                      <span className="text-white font-mono font-bold text-sm sm:text-base">
                        {providerSessionToken.trim() ? 'Active' : 'Locked'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] lg:rounded-[2.75rem] border-blue-500/20 shadow-2xl space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-2 sm:gap-3 text-blue-400">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                    <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Meeting Integrity</h4>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed font-light italic">
                    Synthesis remains gated until transcript capture is real; this portal will not surface synthetic notes as participant data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSynthesisConsentModal && (
        <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
          <div className="glass-panel w-full max-w-xl my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar p-6 sm:p-8 rounded-2xl border border-blue-500/30 shadow-2xl space-y-4 sm:space-y-5">
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">Enable AI Synthesis?</h3>
            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">
              Security and usage notice: synthesis notes remain gated until real transcript capture is connected. No synthetic transcript will be used.
            </p>
            <ul className="text-[10px] sm:text-xs text-slate-400 space-y-1">
              <li>- Transcript processing must come from a real active session.</li>
              <li>- Session notes are not written to long-term storage by this portal.</li>
              <li>- Disable synthesis at any time to clear notes immediately.</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowSynthesisConsentModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSynthesisConsent}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Enable Synthesis
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackgroundUploadPolicyModal && (
        <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
          <div className="glass-panel w-full max-w-xl my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar p-6 sm:p-8 rounded-2xl border border-blue-500/30 shadow-2xl space-y-4 sm:space-y-5">
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">Background Upload Rules</h3>
            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">
              Uploads are temporary for the current meeting session only and are never stored by Conscious Network Hub.
            </p>
            <ul className="text-[10px] sm:text-xs text-slate-400 space-y-1">
              <li>- Supported files: JPG, PNG, WEBP, GIF, MP4, WEBM.</li>
              <li>- Maximum size: 25 MB.</li>
              <li>- Uploaded files are deleted from memory when the meeting session ends.</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowBackgroundUploadPolicyModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBackgroundUploadPolicyModal(false);
                  fileInputRef.current?.click();
                }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .shadow-glow { box-shadow: 0 0 15px rgba(45, 212, 191, 0.4); }
        .no-scrollbar { -ms-overflow-style: auto; scrollbar-width: thin; }
        .no-scrollbar::-webkit-scrollbar { display: block; width: 8px; height: 8px; }
        @keyframes pulse-meeting {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ConsciousMeetings;

