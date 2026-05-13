import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Layers,
  Loader2,
  Mic,
  Monitor,
  Radio,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getMeetingSession,
  joinMeetingSession,
  leaveMeetingSession,
  MeetingSessionSummary,
} from '../services/backendApiService';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type ConsciousMeetingRoomPageProps = {
  sessionId?: string;
  user: UserProfile | null;
  onBack: () => void;
};

type RoomMode = 'standard' | 'immersive-5d';

type NavigatorWithXR = Navigator & {
  xr?: {
    isSessionSupported?: (mode: 'immersive-vr' | 'immersive-ar' | 'inline') => Promise<boolean>;
  };
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ConsciousMeetingRoomPage: React.FC<ConsciousMeetingRoomPageProps> = ({ sessionId = '', user, onBack }) => {
  const [session, setSession] = useState<MeetingSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomMode, setRoomMode] = useState<RoomMode>('standard');
  const [joinStatus, setJoinStatus] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [mediaDevicesReady, setMediaDevicesReady] = useState(false);

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const nextSession = await getMeetingSession(sessionId);
    setSession(nextSession);
    setIsLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    let cancelled = false;
    const inspectDevice = async () => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        if (!cancelled) {
          setMediaDevicesReady(Boolean(devices?.some((device) => device.kind === 'audioinput' || device.kind === 'videoinput')));
        }
      } catch {
        if (!cancelled) setMediaDevicesReady(false);
      }

      const xr = (navigator as NavigatorWithXR).xr;
      if (xr?.isSessionSupported) {
        try {
          const supported = await xr.isSessionSupported('immersive-vr');
          if (!cancelled) setXrSupported(Boolean(supported));
        } catch {
          if (!cancelled) setXrSupported(false);
        }
      }
    };
    void inspectDevice();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hasJoined && session?.id) {
        void leaveMeetingSession(session.id);
      }
    };
  }, [hasJoined, session?.id]);

  const participantCount = session?.participants?.length || 0;
  const scheduledAtMs = session?.scheduledAtMs || session?.startedAtMs || session?.createdAtMs || Date.now();
  const canEnter = Boolean(session && session.status === 'live' && user);

  const providerName = useMemo(
    () => session?.providerDisplayName || 'Verified Provider',
    [session?.providerDisplayName]
  );

  const handleJoin = async (mode: RoomMode) => {
    if (!session) return;
    setRoomMode(mode);
    if (session.status !== 'live') {
      setJoinStatus('This room is staged. The live action unlocks when the provider starts the stream.');
      return;
    }
    if (!user) {
      setJoinStatus('Sign in to enter this internal meeting room.');
      return;
    }
    setJoinStatus('Joining internal CNH room...');
    const joined = await joinMeetingSession(session.routeKey || session.id, user.name);
    if (!joined) {
      setJoinStatus('Unable to join this room yet. Please refresh the meeting board or try again.');
      return;
    }
    setSession(joined);
    setHasJoined(true);
    setJoinStatus(mode === 'immersive-5d' ? 'Joined 5D gateway. Checking spatial profile...' : 'Joined Standard View.');
  };

  if (isLoading) {
    return (
      <PageShell>
        <SurfacePanel className="flex items-center justify-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
          Loading internal meeting room...
        </SurfacePanel>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title="Meeting room not found"
          description="This internal endpoint is valid, but no active or archived Conscious Meeting matches it."
          action={
            <ActionButton type="button" variant="secondary" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>
              Upcoming Sessions
            </ActionButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ActionButton type="button" variant="ghost" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>
        Upcoming Sessions
      </ActionButton>

      <PageHeader
        eyebrow={`${session.status} internal room`}
        title={session.title}
        description={session.description || 'Native Conscious Network Hub meeting room.'}
        actions={
          <>
            <ActionButton type="button" onClick={() => handleJoin('standard')} disabled={!canEnter} icon={<Monitor className="h-4 w-4" />}>
              Standard View
            </ActionButton>
            <ActionButton type="button" variant="secondary" onClick={() => handleJoin('immersive-5d')} disabled={!canEnter} icon={<Layers className="h-4 w-4" />}>
              5D Provider Experience
            </ActionButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SurfacePanel className="space-y-5">
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            {roomMode === 'standard' ? (
              <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-6 text-center">
                <Radio className="mb-4 h-12 w-12 text-blue-300" />
                <h2 className="text-xl font-black uppercase text-white">Internal Standard View</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Provider audio and video render here through the native CNH live stream pipeline when the room is broadcasting.
                </p>
              </div>
            ) : (
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.28),transparent_28%),linear-gradient(160deg,rgba(8,47,73,0.94),rgba(2,6,23,0.98))] p-6 text-center">
                <div className="absolute inset-6 rounded-full border border-cyan-200/20" />
                <div className="absolute inset-16 rounded-full border border-blue-200/10" />
                <Layers className="relative mb-4 h-12 w-12 text-teal-200" />
                <h2 className="relative text-xl font-black uppercase text-white">5D Spatial Viewport</h2>
                <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  {xrSupported
                    ? 'WebXR tracking profile detected. The provider stream is ready for spatial placement.'
                    : 'WebXR tracking is not detected. Connect your spatial tools or continue in Standard View.'}
                </p>
              </div>
            )}
          </div>

          {joinStatus && (
            <div className="rounded-xl border border-blue-300/20 bg-blue-400/10 p-4 text-sm leading-6 text-blue-100">
              {joinStatus}
            </div>
          )}
        </SurfacePanel>

        <SurfacePanel className="space-y-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Room Metadata</h2>
          {[
            ['Provider', providerName],
            ['Focus Area', session.focusArea || 'Conscious Development'],
            ['Localized Start', timeFormatter.format(scheduledAtMs)],
            ['Participants', `${participantCount}/${session.maxViewers}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
              <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
            </div>
          ))}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Gateway Readiness</p>
            <div className="space-y-3 text-xs text-slate-300">
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Internal CNH route verified
              </p>
              <p className="flex items-center gap-2">
                <Camera className={`h-4 w-4 ${mediaDevicesReady ? 'text-emerald-300' : 'text-slate-500'}`} />
                Browser media profile {mediaDevicesReady ? 'available' : 'limited'}
              </p>
              <p className="flex items-center gap-2">
                <Mic className={`h-4 w-4 ${mediaDevicesReady ? 'text-emerald-300' : 'text-slate-500'}`} />
                Audio profile {mediaDevicesReady ? 'available' : 'limited'}
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-300" />
                {session.publicStream ? 'Open to signed-in CNH users' : 'Invite-managed access'}
              </p>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </PageShell>
  );
};

export default ConsciousMeetingRoomPage;
