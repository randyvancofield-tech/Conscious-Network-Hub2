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
type SimulatedActionStatus = 'working' | 'local-only' | 'gated' | 'unavailable';

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
  visible: boolean;
  enabled: boolean;
  copy: string;
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
  working: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
  'local-only': 'border-blue-300/30 bg-blue-400/10 text-blue-100',
  gated: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  unavailable: 'border-slate-600/40 bg-slate-800/70 text-slate-400',
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

  return [
    {
      label: 'Join Visibility',
      status: live ? 'working' : 'gated',
      visible: true,
      enabled: live && !unknown,
      copy: live
        ? 'Join is visible and active for authorized live access.'
        : ended
          ? 'Join is hidden or disabled because the session is no longer active.'
          : 'Join is disabled until the provider starts the session.',
    },
    {
      label: 'Start Control',
      status: host && state === 'scheduled' ? 'working' : 'gated',
      visible: host,
      enabled: host && state === 'scheduled',
      copy: host
        ? state === 'scheduled'
          ? 'Host/admin can start the scheduled session.'
          : 'Start is disabled once the session is live, ended, archived, or unknown.'
        : 'Start is not visible to members or signed guests.',
    },
    {
      label: 'End Control',
      status: host && live ? 'working' : 'gated',
      visible: host,
      enabled: host && live,
      copy: host
        ? live
          ? 'Host/admin can end the live session.'
          : 'End is disabled unless the session is live.'
        : 'End is not visible to members or signed guests.',
    },
    {
      label: 'AI Notes',
      status: 'unavailable',
      visible: true,
      enabled: false,
      copy:
        'AI notes are locked until real transcript capture, participant consent, session-scoped persistence, and permission checks are implemented.',
    },
    {
      label: 'Notes Download',
      status: notesPersisted ? 'working' : 'unavailable',
      visible: true,
      enabled: notesPersisted,
      copy: notesPersisted
        ? 'Download would be available only for real persisted session notes.'
        : 'Notes download is unavailable because this QA session has no persisted notes.',
    },
    {
      label: 'Recording',
      status: live ? 'local-only' : 'gated',
      visible: true,
      enabled: live && host,
      copy: live
        ? 'Recording is browser-local only. No cloud recording, server archive, replay, or VOD is created.'
        : 'Recording controls are unavailable outside a live session.',
    },
    {
      label: '5D Entry',
      status: live && immersiveEnabled ? 'local-only' : 'gated',
      visible: true,
      enabled: live && immersiveEnabled,
      copy: live && immersiveEnabled
        ? '5D entry is lifecycle-available, but device/WebXR support is still local to the browser.'
        : ended
          ? '5D entry is closed because the session is no longer active.'
          : '5D entry is disabled until the room is live and the gateway is enabled.',
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

const ActionStatusPill: React.FC<{ action: SimulatedAction }> = ({ action }) => (
  <div className={`rounded-xl border p-4 ${statusTone[action.status]} ${!action.visible ? 'opacity-60' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{action.status}</p>
        <h4 className="mt-1 text-sm font-black uppercase text-white">{action.label}</h4>
      </div>
      {action.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <X className="h-4 w-4 text-slate-500" />}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-200">{action.copy}</p>
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
  const copy = lifecycleCopy[simulationState];
  const activeParticipants =
    simulationState === 'live'
      ? simulationParticipants
      : simulationParticipants.filter((participant) => participant.role === 'provider');
  const activeLiveParticipantCount =
    simulationState === 'live'
      ? simulationParticipants.filter((participant) => participant.status !== 'left').length
      : activeParticipants.length;
  const departedParticipantCount =
    simulationState === 'live'
      ? simulationParticipants.filter((participant) => participant.status === 'left').length
      : 0;
  const visibleParticipantSummary =
    simulationState === 'live' && departedParticipantCount > 0
      ? `${activeLiveParticipantCount} active + ${departedParticipantCount} left`
      : `${activeParticipants.length} visible`;
  const hostView = simulationRole === 'provider' || simulationRole === 'admin';

  const transitionTo = (nextState: SimulationLifecycleState) => {
    setSimulationState(nextState);
    setSimulationNotice(
      `QA transition simulated locally: ${simulationState.toUpperCase()} -> ${nextState.toUpperCase()}. No backend route was called.`
    );
  };

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
            <h4 className="text-sm font-black uppercase tracking-widest text-white">Role / Lifecycle Controls</h4>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              These controls change local QA state only. They do not call provider session APIs.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Simulated Role</label>
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
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Lifecycle State</label>
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => transitionTo('live')}
              disabled={simulationState !== 'scheduled'}
              className="rounded-xl bg-teal-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              scheduled to live
            </button>
            <button
              type="button"
              onClick={() => transitionTo('ended')}
              disabled={simulationState !== 'live'}
              className="rounded-xl bg-red-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              live to ended
            </button>
            <button
              type="button"
              onClick={() => transitionTo('archived')}
              disabled={simulationState !== 'ended'}
              className="rounded-xl bg-blue-600 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors disabled:bg-slate-800 disabled:text-slate-600"
            >
              ended to archive
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-300">
            {simulationNotice}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">MeetingSession-shaped state</p>
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
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Contract Snapshot</p>
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
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Multi-User Host View</h4>
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
            {activeParticipants.map((participant) => (
              <div key={participant.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
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
                    {participant.status}
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
                {participant.status === 'left' && (
                  <p className="mt-3 rounded-lg border border-slate-600/40 bg-slate-900/60 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Recently departed - not counted as active
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6 space-y-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-white">Action Truth-State</h4>
          <div className="grid grid-cols-1 gap-3">
            {simulatedActions.map((action) => (
              <ActionStatusPill key={action.label} action={action} />
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border-white/10 p-5 sm:p-6">
        <h4 className="text-sm font-black uppercase tracking-widest text-white">Locked / Future Work Boundary</h4>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ['AI Notes', 'Unavailable until transcript capture, consent, secure note persistence, and permission checks are implemented.', Zap],
            ['Notes Download', 'Unavailable unless real session notes exist in trusted persistence.', Download],
            ['Server Recording / VOD', 'Not active. This QA mode preserves browser-local recording truth only.', Square],
            ['5D Collaboration', 'Lifecycle-gated preview only. Real multi-user spatial collaboration is not implemented here.', Layers],
            ['Signed Guest', 'Concept shown for QA. No real external invite is generated in simulation mode.', ShieldCheck],
            ['Archive', 'Archive state shown as metadata only. No fake replay or VOD is created.', Archive],
          ].map(([title, description, Icon]) => (
            <div key={title as string} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              {typeof Icon !== 'string' && <Icon className="h-5 w-5 text-blue-300" />}
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-white">{title as string}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{description as string}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MeetingSimulationQA;
