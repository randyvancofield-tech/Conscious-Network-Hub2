import React, { useMemo, useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Layers,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  Square,
  UserRound,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types';
import type { MeetingSessionStatus, MeetingSessionSummary } from '../services/backendApiService';
import MeetingBrandLoop from './ui/MeetingBrandLoop';
import cnhLogo from '../src/assets/brand/conscious-network-hub-logo.png';

type SimulationRole = 'provider' | 'admin' | 'member' | 'guest';
type SimulationLifecycleState = MeetingSessionStatus | 'unknown';
type SimulatedActionStatus =
  | 'works-today'
  | 'simulation-only'
  | 'locked-future-build'
  | 'local-only'
  | 'role-restricted'
  | 'status-restricted';
type ReadinessCategory = 'worksToday' | 'simulationOnly' | 'lockedFuture';

interface SimulatedParticipant {
  id: string;
  displayName: string;
  role: 'provider' | 'admin' | 'member' | 'guest';
  joinedAtMs: number;
  status: 'present' | 'late' | 'muted' | 'camera-off' | 'disconnected' | 'left';
  micOn: boolean;
  cameraOn: boolean;
}

interface SimulatedAction {
  label: string;
  status: SimulatedActionStatus;
  category: ReadinessCategory;
  visible: boolean;
  enabled: boolean;
  access: string;
  copy: string;
  unavailableReason: string;
  futureUnlock: string;
}

const simulationRoles: Array<{ id: SimulationRole; label: string }> = [
  { id: 'provider', label: 'Provider / Host' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Authenticated Member' },
  { id: 'guest', label: 'Signed Guest' },
];

const simulationStates: Array<{ id: SimulationLifecycleState; label: string }> = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'live', label: 'Live' },
  { id: 'ended', label: 'Ended' },
  { id: 'archived', label: 'Archived' },
  { id: 'unknown', label: 'Error / Unknown' },
];

const simulationParticipants: SimulatedParticipant[] = [
  {
    id: 'sim-host-provider',
    displayName: 'CNH Provider Host',
    role: 'provider',
    joinedAtMs: Date.now() - 12 * 60 * 1000,
    status: 'present',
    micOn: true,
    cameraOn: true,
  },
  {
    id: 'sim-admin-founder',
    displayName: 'Founder Admin Observer',
    role: 'admin',
    joinedAtMs: Date.now() - 10 * 60 * 1000,
    status: 'present',
    micOn: false,
    cameraOn: true,
  },
  {
    id: 'sim-member-attendee',
    displayName: 'Member Attendee',
    role: 'member',
    joinedAtMs: Date.now() - 8 * 60 * 1000,
    status: 'muted',
    micOn: false,
    cameraOn: true,
  },
  {
    id: 'sim-guest-signed',
    displayName: 'Signed Guest',
    role: 'guest',
    joinedAtMs: Date.now() - 6 * 60 * 1000,
    status: 'camera-off',
    micOn: true,
    cameraOn: false,
  },
  {
    id: 'sim-late-joiner',
    displayName: 'Late Joiner',
    role: 'member',
    joinedAtMs: Date.now() - 90 * 1000,
    status: 'late',
    micOn: true,
    cameraOn: true,
  },
  {
    id: 'sim-disconnected',
    displayName: 'Disconnected Participant',
    role: 'guest',
    joinedAtMs: Date.now() - 4 * 60 * 1000,
    status: 'disconnected',
    micOn: false,
    cameraOn: false,
  },
  {
    id: 'sim-left',
    displayName: 'Participant Left',
    role: 'member',
    joinedAtMs: Date.now() - 15 * 60 * 1000,
    status: 'left',
    micOn: false,
    cameraOn: false,
  },
];

const lifecycleCopy: Record<SimulationLifecycleState, { title: string; message: string }> = {
  scheduled: {
    title: 'Waiting for Host',
    message: 'This simulated CNH room is scheduled. Users and signed guests cannot enter until the host starts the session.',
  },
  live: {
    title: 'Live QA Room',
    message: 'This simulated room is live. Entry, participant presence, and local-only recording truth states can be inspected without backend writes.',
  },
  ended: {
    title: 'Session Ended',
    message: 'This simulated meeting has ended. Active entry, signaling, AI notes, 5D entry, and recording controls are closed.',
  },
  archived: {
    title: 'Archive Summary',
    message: 'This simulated meeting is archived. Only metadata and summary-style status should remain visible.',
  },
  unknown: {
    title: 'Lifecycle Error',
    message: 'The simulated lifecycle state is unknown. The UI must fail closed and avoid active room controls.',
  },
};

const statusTone: Record<SimulatedActionStatus, string> = {
  'works-today': 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
  'simulation-only': 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
  'locked-future-build': 'border-slate-600/40 bg-slate-800/70 text-slate-300',
  'local-only': 'border-blue-300/30 bg-blue-400/10 text-blue-100',
  'role-restricted': 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  'status-restricted': 'border-orange-300/30 bg-orange-400/10 text-orange-100',
};

const statusLabel: Record<SimulatedActionStatus, string> = {
  'works-today': 'WORKS TODAY',
  'simulation-only': 'SIMULATION ONLY',
  'locked-future-build': 'LOCKED / FUTURE BUILD',
  'local-only': 'LOCAL ONLY',
  'role-restricted': 'ROLE RESTRICTED',
  'status-restricted': 'STATUS RESTRICTED',
};

const getRoleLabel = (role: SimulationRole): string =>
  simulationRoles.find((entry) => entry.id === role)?.label || role;

const getParticipantRoleLabel = (role: SimulatedParticipant['role']): string => {
  if (role === 'provider') return 'Provider / Host';
  if (role === 'admin') return 'Admin Observer';
  if (role === 'guest') return 'Signed Guest';
  return 'Member';
};

const isHostRole = (role: SimulationRole): boolean => role === 'provider' || role === 'admin';

const isEndedState = (state: SimulationLifecycleState): boolean => state === 'ended' || state === 'archived';

const getSimulationActions = (
  role: SimulationRole,
  state: SimulationLifecycleState,
  notesPersisted: boolean,
  immersiveEnabled: boolean
): SimulatedAction[] => {
  const live = state === 'live';
  const host = isHostRole(role);
  const ended = isEndedState(state);
  const unknown = state === 'unknown';
  const scheduled = state === 'scheduled';

  return [
    {
      label: 'Join',
      status: live ? 'works-today' : 'status-restricted',
      category: live ? 'worksToday' : 'lockedFuture',
      visible: true,
      enabled: live && !unknown,
      access: role === 'guest' ? 'Signed guests with a valid invite token.' : 'Authorized providers, admins, members, and signed guests.',
      copy: live
        ? `As ${getRoleLabel(role)}, this user can enter only because the simulated session is live.`
        : ended
          ? `As ${getRoleLabel(role)}, this user cannot enter because the session is no longer active.`
          : `As ${getRoleLabel(role)}, this user cannot enter until the host starts the session.`,
      unavailableReason: live ? 'No restriction in this live simulation state.' : 'Backend lifecycle rules reject non-live room entry.',
      futureUnlock: 'Already supported for authorized live sessions; future work is richer waiting-room copy and participant handoff.',
    },
    {
      label: 'Start Session',
      status: host ? (scheduled ? 'works-today' : 'status-restricted') : 'role-restricted',
      category: host && scheduled ? 'worksToday' : 'lockedFuture',
      visible: host,
      enabled: host && state === 'scheduled',
      access: 'Provider / host and admin role views only.',
      copy: host
        ? state === 'scheduled'
          ? `As ${getRoleLabel(role)}, starting the scheduled session is allowed in this simulation.`
          : 'Start is blocked after the session leaves Scheduled state.'
        : 'Members and signed guests do not see start controls.',
      unavailableReason: host ? 'Start only applies to Scheduled sessions.' : 'This role cannot host or start sessions.',
      futureUnlock: 'No Phase 2C feature unlock required; keep tied to provider/admin authorization.',
    },
    {
      label: 'End Session',
      status: host ? (live ? 'works-today' : 'status-restricted') : 'role-restricted',
      category: host && live ? 'worksToday' : 'lockedFuture',
      visible: host,
      enabled: host && live,
      access: 'Provider / host and admin role views only.',
      copy: host
        ? live
          ? `As ${getRoleLabel(role)}, ending the live session is allowed.`
          : 'End is blocked unless the session is Live.'
        : 'Members and signed guests do not see end controls.',
      unavailableReason: host ? 'End only applies to Live sessions.' : 'This role cannot end sessions.',
      futureUnlock: 'No Phase 2C feature unlock required; preserve lifecycle guard and audit behavior.',
    },
    {
      label: 'AI Notes',
      status: 'locked-future-build',
      category: 'lockedFuture',
      visible: true,
      enabled: false,
      access: 'No role can use this today.',
      copy:
        'AI notes are locked until real transcript capture, participant consent, session-scoped persistence, and permission checks are implemented.',
      unavailableReason: 'There is no transcript capture or secure session notes persistence in this phase.',
      futureUnlock: 'Transcript capture, consent, secure note storage, and role-based permission checks.',
    },
    {
      label: 'Notes Download',
      status: notesPersisted ? 'works-today' : 'locked-future-build',
      category: notesPersisted ? 'worksToday' : 'lockedFuture',
      visible: true,
      enabled: notesPersisted,
      access: 'Only users with permission to real persisted session notes.',
      copy: notesPersisted
        ? 'Download would be available only for real persisted session notes.'
        : 'Notes download is unavailable because this QA session has no persisted notes.',
      unavailableReason: notesPersisted ? 'No restriction in this scenario.' : 'This QA session does not create or persist notes.',
      futureUnlock: 'Session-scoped notes persistence plus permission checks.',
    },
    {
      label: 'Local Recording',
      status: live ? 'local-only' : 'status-restricted',
      category: live ? 'worksToday' : 'lockedFuture',
      visible: true,
      enabled: live && host,
      access: 'Provider / host and admin role views during Live sessions.',
      copy: live
        ? 'Recording is browser-local only. No cloud recording, server archive, replay, or VOD is created.'
        : 'Recording controls are unavailable outside a live session.',
      unavailableReason: live ? 'Local-only recording still depends on browser support and user action.' : 'Recording is status-restricted to Live sessions.',
      futureUnlock: 'Server recording/VOD requires consent, storage, retention, and permission policy.',
    },
    {
      label: '5D Entry',
      status: live && immersiveEnabled ? 'local-only' : 'status-restricted',
      category: live && immersiveEnabled ? 'simulationOnly' : 'lockedFuture',
      visible: true,
      enabled: live && immersiveEnabled,
      access: 'Authorized live-session users with browser/device support.',
      copy: live && immersiveEnabled
        ? '5D entry is lifecycle-available, but device/WebXR support is still local to the browser.'
        : ended
          ? '5D entry is closed because the session is no longer active.'
          : '5D entry is disabled until the room is live and the gateway is enabled.',
      unavailableReason: live && immersiveEnabled ? 'This remains a gated preview, not full multi-user spatial collaboration.' : '5D is lifecycle/status-restricted.',
      futureUnlock: 'Real multi-user spatial collaboration and supported device workflow.',
    },
    {
      label: 'Participant List',
      status: 'simulation-only',
      category: 'simulationOnly',
      visible: true,
      enabled: false,
      access: 'Admin QA view only in this panel.',
      copy: 'Participant presence, mic state, camera state, disconnected, and departed users are simulated for founder review.',
      unavailableReason: 'This panel does not create or mutate real participants.',
      futureUnlock: 'Real presence/attendance requires live WebRTC/session attendance integration.',
    },
    {
      label: 'Guest Access',
      status: 'simulation-only',
      category: 'simulationOnly',
      visible: true,
      enabled: false,
      access: 'Signed guest concept only in this simulation.',
      copy: 'Signed guest behavior is represented for role/lifecycle review without generating external invites.',
      unavailableReason: 'Simulation mode sends no guest invite and writes no guest session record.',
      futureUnlock: 'Preserve signed invite safety, then connect clearer guest-facing waiting/ended states.',
    },
  ];
};

const buildSimulatedSession = (state: SimulationLifecycleState): MeetingSessionSummary => {
  const now = Date.now();
  const normalizedStatus: MeetingSessionStatus = state === 'unknown' ? 'scheduled' : state;
  return {
    id: 'qa-sim-session-001',
    routeKey: 'qa-sim-session-001',
    title: 'Phase 2B Meeting Lifecycle QA Session',
    description: 'Admin-only simulated CNH meeting room for role/state inspection.',
    focusArea: 'Launch QA',
    mode: 'immersive-5d',
    status: normalizedStatus,
    providerDid: 'did:cnh:qa-provider',
    providerUserId: 'qa-provider-host',
    providerDisplayName: 'CNH Provider Host',
    maxViewers: 120,
    publicStream: false,
    nativeRoom: {
      provider: 'native-webrtc-p2p',
      enabled: true,
      signaling: 'https-polling',
      serverRecordingEnabled: false,
      localRecordingAllowed: true,
      immersiveEnabled: true,
      securityLevel: 'admin-qa-simulation',
    },
    scheduledAtMs: now + 30 * 60 * 1000,
    internalRoomPath: '/conscious-meetings/session/qa-sim-session-001',
    internalRoomUrl: null,
    standardRoomPath: '/conscious-meetings/session/qa-sim-session-001',
    immersiveRoomPath: '/conscious-meetings/session/qa-sim-session-001?mode=immersive-5d',
    vodPath: null,
    participants: state === 'live'
      ? simulationParticipants
          .filter((participant) => participant.status !== 'left')
          .map((participant) => ({
            id: participant.id,
            kind: participant.role === 'provider' ? 'provider' : participant.role === 'guest' ? 'guest' : 'user',
            displayName: participant.displayName,
            joinedAtMs: participant.joinedAtMs,
          }))
      : [],
    invitedMembers: [
      {
        key: 'qa-invite-member',
        userId: 'qa-member-attendee',
        username: 'member.attendee',
        displayName: 'Member Attendee',
        source: 'direct',
        groupId: null,
        invitedAtMs: now - 60 * 60 * 1000,
      },
      {
        key: 'qa-invite-group',
        userId: null,
        username: 'founder-roundtable',
        displayName: 'Founder Roundtable Group',
        source: 'group',
        groupId: 'qa-group-founders',
        invitedAtMs: now - 55 * 60 * 1000,
      },
    ],
    createdAtMs: now - 2 * 60 * 60 * 1000,
    updatedAtMs: now,
    startedAtMs: state === 'live' || isEndedState(state) ? now - 12 * 60 * 1000 : null,
    endedAtMs: isEndedState(state) ? now - 2 * 60 * 1000 : null,
  };
};

const getScenarioResult = (role: SimulationRole, state: SimulationLifecycleState): string => {
  const roleLabel = getRoleLabel(role);
  if (state === 'scheduled') {
    return role === 'provider' || role === 'admin'
      ? `As ${roleLabel} in Scheduled state, this user can review the room and start the session; members and signed guests must wait.`
      : `As ${roleLabel} in Scheduled state, this user cannot enter until the host starts the session.`;
  }
  if (state === 'live') {
    return role === 'provider' || role === 'admin'
      ? `As ${roleLabel} in Live state, ending the session is available; AI notes remain locked; recording is browser-local only.`
      : `As ${roleLabel} in Live state, joining is allowed when authorized; AI notes and notes download remain locked.`;
  }
  if (state === 'ended') {
    return `As ${roleLabel} in Ended state, active entry, signaling, recording, AI notes, notes download, and 5D controls remain closed.`;
  }
  if (state === 'archived') {
    return `As ${roleLabel} in Archived state, only metadata-style review should remain; no active room, replay, VOD, or participant mutation is available.`;
  }
  return `As ${roleLabel} in Error / Unknown state, the interface must fail closed and avoid active meeting controls.`;
};

const categoryLabels: Record<ReadinessCategory, string> = {
  worksToday: 'Works Today',
  simulationOnly: 'Simulation Only',
  lockedFuture: 'Locked / Future Build',
};

const categoryDescriptions: Record<ReadinessCategory, string> = {
  worksToday: 'Launch-supported behavior for the selected role/state, or local-only behavior that is truthfully labeled.',
  simulationOnly: 'Displayed for founder/admin QA only; no production records, invites, signals, or participants are created.',
  lockedFuture: 'Blocked until the required lifecycle, consent, storage, permission, or implementation work exists.',
};

const buildReadinessGroups = (actions: SimulatedAction[]): Record<ReadinessCategory, SimulatedAction[]> => ({
  worksToday: actions.filter((action) => action.category === 'worksToday'),
  simulationOnly: actions.filter((action) => action.category === 'simulationOnly'),
  lockedFuture: actions.filter((action) => action.category === 'lockedFuture'),
});

const ActionStatusPill: React.FC<{ action: SimulatedAction }> = ({ action }) => (
  <div className={`rounded-xl border p-4 ${statusTone[action.status]} ${!action.visible ? 'opacity-60' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{statusLabel[action.status]}</p>
        <h4 className="mt-1 text-sm font-black uppercase text-white">{action.label}</h4>
      </div>
      {action.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <X className="h-4 w-4 text-slate-500" />}
    </div>
    <div className="mt-3 space-y-2 text-xs leading-5 text-slate-200">
      <p>{action.copy}</p>
      <p><span className="font-black uppercase tracking-widest text-slate-400">Access:</span> {action.access}</p>
      <p><span className="font-black uppercase tracking-widest text-slate-400">Why:</span> {action.unavailableReason}</p>
      <p><span className="font-black uppercase tracking-widest text-slate-400">Unlock:</span> {action.futureUnlock}</p>
    </div>
    {!action.visible && <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Not visible to this role</p>}
  </div>
);

interface MeetingSimulationQAProps {
  user: UserProfile | null;
}

const MeetingSimulationQA: React.FC<MeetingSimulationQAProps> = ({ user }) => {
  const [simulationRole, setSimulationRole] = useState<SimulationRole>('admin');
  const [simulationState, setSimulationState] = useState<SimulationLifecycleState>('scheduled');
  const [simulationNotice, setSimulationNotice] = useState(
    'Simulation mode is local-only. No real meeting sessions, invites, participants, recordings, notes, or VOD records are created.'
  );

  const isAdmin = user?.role === 'admin';
  const simulatedSession = useMemo(() => buildSimulatedSession(simulationState), [simulationState]);
  const simulatedActions = useMemo(
    () => getSimulationActions(simulationRole, simulationState, false, Boolean(simulatedSession.nativeRoom?.immersiveEnabled)),
    [simulationRole, simulationState, simulatedSession.nativeRoom?.immersiveEnabled]
  );
  const readinessGroups = useMemo(() => buildReadinessGroups(simulatedActions), [simulatedActions]);
  const copy = lifecycleCopy[simulationState];
  const activeParticipants =
    simulationState === 'live'
      ? simulationParticipants.filter((participant) => participant.status !== 'left')
      : simulationParticipants.filter((participant) => participant.role === 'provider');
  const departedParticipants =
    simulationState === 'live'
      ? simulationParticipants.filter((participant) => participant.status === 'left')
      : [];
  const activeLiveParticipantCount =
    simulationState === 'live'
      ? activeParticipants.length
      : activeParticipants.length;
  const visibleParticipantSummary =
    simulationState === 'live' && departedParticipants.length > 0
      ? `${activeLiveParticipantCount} active + ${departedParticipants.length} departed`
      : `${activeParticipants.length} visible`;
  const hostView = simulationRole === 'provider' || simulationRole === 'admin';
  const scenarioResult = getScenarioResult(simulationRole, simulationState);
  const checklist = [
    'Select role',
    'Select lifecycle state',
    'Review scenario result',
    'Review participants',
    'Review feature readiness',
    'Confirm what remains locked',
    'Identify next build priority',
  ];
  const nextBuildPriorities = [
    'Transcript capture and participant consent',
    'Session-scoped AI notes persistence',
    'Real WebRTC peer exchange',
    'Chat, presence, and attendance',
    'Server recording/VOD only after consent, storage, retention, and permissions are defined',
  ];

  const transitionTo = (nextState: SimulationLifecycleState) => {
    setSimulationState(nextState);
    setSimulationNotice(
      `QA transition simulated locally: ${simulationState.toUpperCase()} -> ${nextState.toUpperCase()}. No backend route was called.`
    );
  };

  const renderParticipantCard = (participant: SimulatedParticipant, departed = false) => (
    <div key={participant.id} className={`rounded-xl border p-4 ${departed ? 'border-slate-600/40 bg-slate-900/60' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-200">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white">{participant.displayName}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
              {getParticipantRoleLabel(participant.role)}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-300">
          {departed ? 'recently departed' : participant.status}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
          participant.micOn ? 'border-emerald-300/30 text-emerald-200' : 'border-slate-600/40 text-slate-500'
        }`}>
          {participant.micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          {participant.micOn ? 'Mic On' : 'Muted'}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
          participant.cameraOn ? 'border-blue-300/30 text-blue-200' : 'border-slate-600/40 text-slate-500'
        }`}>
          <Video className="h-3 w-3" />
          {participant.cameraOn ? 'Camera On' : 'Camera Off'}
        </span>
      </div>
      {departed && (
        <p className="mt-3 rounded-lg border border-slate-600/40 bg-black/30 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
          Recently departed - not counted as active
        </p>
      )}
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="glass-panel rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 text-amber-200" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Admin Simulation Restricted</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Meeting simulation is reserved for the founder/admin QA path. It is not available to providers, members, or signed guests.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="glass-panel rounded-2xl border-cyan-300/25 bg-cyan-300/[0.04] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200">Founder / Admin QA Workflow</p>
            <h3 className="text-2xl font-black uppercase leading-tight text-white">Guided Meeting Lifecycle Review</h3>
            <p className="text-sm font-bold leading-6 text-cyan-50">
              Simulation only. No production session, invite, participant, recording, note, signal, archive, replay, or VOD record is created.
            </p>
            <p className="text-sm leading-6 text-slate-300">
              Use this panel to select a role and meeting state, then verify what that user should see, what works today, what is simulated, and what remains locked for future development.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Guided Admin Checklist</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {checklist.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-[10px] font-black text-cyan-100">
                    {index + 1}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border-blue-300/20 p-0">
        <div className="grid gap-0 lg:grid-cols-[0.44fr_1fr]">
          <div className="flex flex-col justify-between gap-5 bg-slate-950/80 p-5 sm:p-6 lg:p-8">
            <div className="space-y-4">
              <img src={cnhLogo} alt="Conscious Network Hub" className="h-16 w-16 rounded-2xl bg-white/95 object-contain p-1.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200">Admin QA Simulation</p>
                <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">Meeting Lifecycle Lab</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Inspect role-specific meeting truth states without mutating production sessions or sending real invites.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100">
              Local QA only: lifecycle transitions, participant presence, recording, AI notes, and 5D controls are simulated for inspection.
            </div>
          </div>
          <div className="relative min-h-64 overflow-hidden bg-black">
            <MeetingBrandLoop
              alt="Conscious Meetings admin QA simulation"
              className="h-full min-h-64 w-full"
              imageClassName="h-full w-full object-cover"
              eager
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/10" />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current simulated surface</p>
              <p className="mt-1 text-lg font-black uppercase text-white">{copy.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{copy.message}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Step 1 + Step 2</p>
            <h4 className="mt-1 text-sm font-black uppercase tracking-widest text-white">Select Role And Lifecycle State</h4>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              These simulation controls change local QA state only. They do not call provider session APIs or create production activity.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Step 1: Simulated Role</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {simulationRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSimulationRole(role.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${
                    simulationRole === role.id
                      ? 'border-blue-300/50 bg-blue-500/20 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-white'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Step 2: Lifecycle State</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {simulationStates.map((state) => (
                <button
                  key={state.id}
                  type="button"
                  onClick={() => setSimulationState(state.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${
                    simulationState === state.id
                      ? 'border-teal-300/50 bg-teal-500/20 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-white'
                  }`}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/[0.07] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-200">Step 3: Scenario Result</p>
            <p className="mt-2 text-sm font-bold leading-6 text-white">{scenarioResult}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => transitionTo('live')}
              disabled={simulationState !== 'scheduled'}
              className="rounded-xl bg-teal-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              Simulate Scheduled To Live
            </button>
            <button
              type="button"
              onClick={() => transitionTo('ended')}
              disabled={simulationState !== 'live'}
              className="rounded-xl bg-red-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              Simulate Live To Ended
            </button>
            <button
              type="button"
              onClick={() => transitionTo('archived')}
              disabled={simulationState !== 'ended'}
              className="rounded-xl bg-blue-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              Simulate Ended To Archive
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-300">
            {simulationNotice}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Scenario State</p>
              <h4 className="mt-2 text-xl font-black uppercase text-white">{simulatedSession.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">{simulatedSession.description}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
              {simulationState}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Role View</p>
              <p className="mt-1 text-sm font-black uppercase text-white">{getRoleLabel(simulationRole)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Participants</p>
              <p className="mt-1 text-sm font-black uppercase text-white">{simulatedSession.participants.length}/{simulatedSession.maxViewers}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Signed Invites</p>
              <p className="mt-1 text-sm font-black uppercase text-white">{simulatedSession.invitedMembers.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Server Recording</p>
              <p className="mt-1 text-sm font-black uppercase text-white">Off</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Technical Session Snapshot</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300 sm:grid-cols-2">
              <p>Provider: {simulatedSession.providerDisplayName}</p>
              <p>Mode: {simulatedSession.mode}</p>
              <p>Native room: {simulatedSession.nativeRoom?.enabled ? 'enabled' : 'off'}</p>
              <p>Signaling: {simulatedSession.nativeRoom?.signaling}</p>
              <p>5D gateway: {simulatedSession.nativeRoom?.immersiveEnabled ? 'enabled' : 'off'}</p>
              <p>VOD path: {simulatedSession.vodPath || 'none'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Step 4</p>
              <h4 className="mt-1 text-sm font-black uppercase tracking-widest text-white">Participant Simulation</h4>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {hostView
                  ? 'Host/admin view includes participant status and action availability.'
                  : 'Member/guest view shows participant context without host controls.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
              <Users className="h-3 w-3" />
              {visibleParticipantSummary}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeParticipants.map((participant) => renderParticipantCard(participant))}
          </div>

          {departedParticipants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recently Departed - Not Active</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {departedParticipants.map((participant) => renderParticipantCard(participant, true))}
              </div>
            </div>
          )}

          {departedParticipants.length === 0 && simulationState !== 'live' && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
              Departed participants appear only in the Live simulation state and are separated from active attendees.
            </p>
          )}
        </div>

        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Scenario Action Details</p>
          <h4 className="text-sm font-black uppercase tracking-widest text-white">Who Can Do What</h4>
          <div className="grid grid-cols-1 gap-3">
            {simulatedActions.map((action) => (
              <ActionStatusPill key={action.label} action={action} />
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Step 5</p>
        <h4 className="mt-1 text-sm font-black uppercase tracking-widest text-white">Feature Readiness</h4>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Features are grouped by launch reality so simulation, local-only behavior, and future build work cannot be confused with production capability.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {(Object.keys(categoryLabels) as ReadinessCategory[]).map((category) => (
            <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white">{categoryLabels[category]}</p>
              <p className="mt-2 min-h-12 text-xs leading-5 text-slate-500">{categoryDescriptions[category]}</p>
              <div className="mt-4 space-y-3">
                {readinessGroups[category].length > 0 ? (
                  readinessGroups[category].map((action) => (
                    <div key={`${category}-${action.label}`} className={`rounded-xl border p-3 ${statusTone[action.status]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-75">{statusLabel[action.status]}</p>
                          <p className="mt-1 text-xs font-black uppercase text-white">{action.label}</p>
                        </div>
                        {action.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <X className="h-4 w-4 text-slate-500" />}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-200">{action.copy}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-500">
                    No features fall into this category for the selected role/state.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Step 6</p>
        <h4 className="mt-1 text-sm font-black uppercase tracking-widest text-white">Next Build Priorities</h4>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {nextBuildPriorities.map((priority, index) => (
            <div key={priority} className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Priority {index + 1}</p>
              <p className="mt-2 text-xs leading-5 text-slate-200">{priority}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MeetingSimulationQA;
