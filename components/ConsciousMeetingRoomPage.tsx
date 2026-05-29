import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Download,
  Layers,
  Loader2,
  Mic,
  Monitor,
  Radio,
  ShieldCheck,
  Square,
  Users,
  Video,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getMeetingSession,
  getMeetingRoomConfig,
  joinMeetingSession,
  leaveMeetingSession,
  MeetingRoomConfig,
  MeetingSessionSummary,
  postMeetingSignal,
} from '../services/backendApiService';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type ConsciousMeetingRoomPageProps = {
  sessionId?: string;
  user: UserProfile | null;
  onBack: () => void;
  onSignIn?: () => void;
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

const ConsciousMeetingRoomPage: React.FC<ConsciousMeetingRoomPageProps> = ({ sessionId = '', user, onBack, onSignIn }) => {
  const [session, setSession] = useState<MeetingSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomMode, setRoomMode] = useState<RoomMode>('standard');
  const [joinStatus, setJoinStatus] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [mediaDevicesReady, setMediaDevicesReady] = useState(false);
  const [roomConfig, setRoomConfig] = useState<MeetingRoomConfig | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording'>('idle');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setIsLoading(false);
      return;
    }
    if (!user) {
      setSession(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const nextSession = await getMeetingSession(sessionId);
    setSession(nextSession);
    setIsLoading(false);
  }, [sessionId, user]);

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
      localStream?.getTracks().forEach((track) => track.stop());
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [hasJoined, localStream, session?.id]);

  useEffect(() => {
    if (!localVideoRef.current || !localStream) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const participantCount = session?.participants?.length || 0;
  const scheduledAtMs = session?.scheduledAtMs || session?.startedAtMs || session?.createdAtMs || Date.now();
  const canEnter = Boolean(session && session.status === 'live' && user);
  const canUseImmersive =
    Boolean(session?.nativeRoom?.immersiveEnabled || session?.mode === 'immersive-5d') && xrSupported;
  const canRecordLocally = Boolean(
    roomConfig?.recording.localParticipantRecordingAllowed && hasJoined && localStream
  );

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
    const config = await getMeetingRoomConfig(session.routeKey || session.id);
    setRoomConfig(config);
    if (config) {
      void postMeetingSignal(session.routeKey || session.id, {
        type: 'presence',
        payload: {
          mode,
          participantId: config.participantId,
          supportsImmersive5d: xrSupported,
          localRecordingCapable: typeof MediaRecorder !== 'undefined',
        },
      });
    }
    setJoinStatus(mode === 'immersive-5d' ? 'Joined 5D gateway. Checking spatial profile...' : 'Joined Standard View.');
  };

  const enableLocalMedia = async () => {
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(nextStream);
      setMediaDevicesReady(true);
      setJoinStatus('Local camera and microphone are active for this browser only.');
    } catch {
      setJoinStatus('Camera and microphone permission was denied or unavailable.');
    }
  };

  const startLocalRecording = () => {
    if (!canRecordLocally || !localStream) {
      setJoinStatus('Local recording is unavailable until the provider enables it and your media is active.');
      return;
    }
    if (recordingState === 'recording') return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    const recorder = new MediaRecorder(localStream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      setRecordedChunks(chunks);
      setRecordingState('idle');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
    mediaRecorderRef.current = recorder;
    setRecordedChunks([]);
    setRecordingSeconds(0);
    recorder.start();
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);
    setRecordingState('recording');
    setJoinStatus('Private browser recording started. Nothing is uploaded to CNH storage.');
  };

  const stopLocalRecording = () => {
    mediaRecorderRef.current?.stop();
    setJoinStatus('Local recording stopped. Download is available only in this browser session.');
  };

  const downloadLocalRecording = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `conscious-meeting-local-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <PageShell>
        <SurfacePanel className="flex items-center justify-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
          Loading meeting room...
        </SurfacePanel>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7" />}
          title="Sign in required"
          description="Meeting rooms are protected member spaces. Sign in with your CNH account, then reopen the meeting link."
          action={
            onSignIn ? (
              <ActionButton type="button" onClick={onSignIn} icon={<ShieldCheck className="h-4 w-4" />}>
                Sign In
              </ActionButton>
            ) : (
              <ActionButton type="button" variant="secondary" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>
                Upcoming Sessions
              </ActionButton>
            )
          }
        />
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title="Meeting room not found"
          description="This meeting link is valid, but no active or archived Conscious Meeting matches it."
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
        eyebrow={`${session.status} meeting room`}
        title={session.title}
        description={session.description || 'Native Conscious Network Hub meeting room.'}
        actions={
          <>
            <ActionButton type="button" onClick={() => handleJoin('standard')} disabled={!canEnter} icon={<Monitor className="h-4 w-4" />}>
              Standard View
            </ActionButton>
            <ActionButton type="button" variant="secondary" onClick={() => handleJoin('immersive-5d')} disabled={!canEnter || !canUseImmersive} icon={<Layers className="h-4 w-4" />}>
              5D Provider Experience
            </ActionButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SurfacePanel className="space-y-5">
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            {roomMode === 'standard' ? (
              localStream ? (
                <video
                  ref={localVideoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full bg-black object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-6 text-center">
                  <Radio className="mb-4 h-12 w-12 text-blue-300" />
                  <h2 className="text-xl font-black uppercase text-white">Native Standard Room</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    This room uses CNH-issued meeting links, signed-session access, and browser WebRTC readiness without a paid meeting vendor.
                  </p>
                </div>
              )
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => void enableLocalMedia()}
              disabled={!hasJoined}
              icon={<Camera className="h-4 w-4" />}
            >
              Enable Media
            </ActionButton>
            <ActionButton
              type="button"
              variant="secondary"
              className={recordingState === 'recording' ? 'border-red-400/30 bg-red-500/20 text-red-100 hover:bg-red-500/30' : ''}
              onClick={recordingState === 'recording' ? stopLocalRecording : startLocalRecording}
              disabled={!hasJoined || (!canRecordLocally && recordingState !== 'recording')}
              icon={recordingState === 'recording' ? <Square className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            >
              {recordingState === 'recording' ? `Stop ${recordingSeconds}s` : 'Record Locally'}
            </ActionButton>
            <ActionButton
              type="button"
              variant="secondary"
              onClick={downloadLocalRecording}
              disabled={recordedChunks.length === 0}
              icon={<Download className="h-4 w-4" />}
            >
              Download
            </ActionButton>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
            {roomConfig?.recording.localParticipantRecordingAllowed
              ? 'Provider enabled participant-side recording. Each participant records only in their own browser after opting in.'
              : 'Server recording is off. Participant-side local recording is disabled unless the provider enables it for this session.'}
          </div>
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
                CNH room link verified
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
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                {roomConfig?.nativeRoom.globalReliability.turnRelayConfigured
                  ? 'TURN relay configured for restrictive networks'
                  : 'Free P2P/STUN mode; restrictive networks may need TURN'}
              </p>
              <p className="flex items-center gap-2">
                <Layers className={`h-4 w-4 ${session.nativeRoom?.immersiveEnabled ? 'text-teal-300' : 'text-slate-500'}`} />
                {session.nativeRoom?.immersiveEnabled ? '5D gateway provider-enabled' : '5D gateway off for this room'}
              </p>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </PageShell>
  );
};

export default ConsciousMeetingRoomPage;
