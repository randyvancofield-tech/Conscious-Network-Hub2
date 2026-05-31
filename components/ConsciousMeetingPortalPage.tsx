import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Layers,
  Mic,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Video,
  XCircle,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ActionButton, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';
import MeetingBrandLoop from './ui/MeetingBrandLoop';
import VisualRenderBoundary from './ui/VisualRenderBoundary';
import cnhLogo from '../src/assets/brand/conscious-network-hub-logo.png';

const LazyConsciousMeetings = React.lazy(() => import('./ConsciousMeetings'));

type ConsciousMeetingPortalPageProps = {
  user: UserProfile | null;
  onOpenUpcoming: () => void;
  operationsEnabled?: boolean;
};

type DeviceCheck = {
  cameraCount: number;
  microphoneCount: number;
  webXrSupported: boolean;
  immersiveVrSupported: boolean;
  checkedAtMs: number;
};

type NavigatorWithXR = Navigator & {
  xr?: {
    isSessionSupported?: (mode: 'immersive-vr' | 'immersive-ar' | 'inline') => Promise<boolean>;
  };
};

const getPlatformLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Browser device';
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = browserNavigator.userAgentData?.platform || navigator.platform || 'Browser device';
  return platform;
};

const ConsciousMeetingPortalPageContent: React.FC<ConsciousMeetingPortalPageProps> = ({
  user,
  onOpenUpcoming,
  operationsEnabled = false,
}) => {
  const [deviceCheck, setDeviceCheck] = useState<DeviceCheck | null>(null);
  const [history, setHistory] = useState<DeviceCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const historyKey = user?.id ? `hcn.meetingDeviceHistory.${user.id}` : 'hcn.meetingDeviceHistory.guest';
  const canOpenHostConsole =
    operationsEnabled || user?.role === 'provider' || user?.role === 'admin';

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(historyKey) || '[]');
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 5));
    } catch {
      setHistory([]);
    }
  }, [historyKey]);

  const runDeviceCheck = useCallback(async () => {
    setIsChecking(true);
    let cameraCount = 0;
    let microphoneCount = 0;

    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraCount = devices.filter((device) => device.kind === 'videoinput').length;
        microphoneCount = devices.filter((device) => device.kind === 'audioinput').length;
      }
    } catch {
      cameraCount = 0;
      microphoneCount = 0;
    }

    const xr = (navigator as NavigatorWithXR).xr;
    const webXrSupported = Boolean(xr?.isSessionSupported);
    let immersiveVrSupported = false;
    if (xr?.isSessionSupported) {
      try {
        immersiveVrSupported = await xr.isSessionSupported('immersive-vr');
      } catch {
        immersiveVrSupported = false;
      }
    }

    const nextCheck = {
      cameraCount,
      microphoneCount,
      webXrSupported,
      immersiveVrSupported,
      checkedAtMs: Date.now(),
    };
    setDeviceCheck(nextCheck);
    setHistory((current) => {
      const nextHistory = [nextCheck, ...current].slice(0, 5);
      window.localStorage.setItem(historyKey, JSON.stringify(nextHistory));
      return nextHistory;
    });
    setIsChecking(false);
  }, [historyKey]);

  useEffect(() => {
    void runDeviceCheck();
  }, [runDeviceCheck]);

  const identityRows = useMemo(
    () => [
      ['Identity', user?.name || 'Guest participant'],
      ['Role', user?.role || 'visitor'],
      ['Membership', user?.tier || 'No active tier detected'],
      ['Device', getPlatformLabel()],
    ],
    [user]
  );

  const deviceRows = [
    {
      label: 'Camera',
      value: `${deviceCheck?.cameraCount || 0} detected`,
      ready: Boolean(deviceCheck?.cameraCount),
      icon: <Camera className="h-4 w-4" />,
    },
    {
      label: 'Microphone',
      value: `${deviceCheck?.microphoneCount || 0} detected`,
      ready: Boolean(deviceCheck?.microphoneCount),
      icon: <Mic className="h-4 w-4" />,
    },
    {
      label: 'WebXR',
      value: deviceCheck?.immersiveVrSupported ? 'Immersive VR ready' : deviceCheck?.webXrSupported ? 'Browser profile ready' : 'Standard mode ready',
      ready: Boolean(deviceCheck?.webXrSupported || deviceCheck?.immersiveVrSupported),
      icon: <Layers className="h-4 w-4" />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Conscious Meetings"
        title="Meeting Portal"
        description="Unified access for identity readiness, device checks, configuration history, and provider-hosted internal session controls."
        actions={
          <>
            <ActionButton type="button" variant="secondary" onClick={onOpenUpcoming} icon={<Video className="h-4 w-4" />}>
              Upcoming Sessions
            </ActionButton>
            <ActionButton type="button" onClick={runDeviceCheck} disabled={isChecking} icon={<RefreshCw className="h-4 w-4" />}>
              Check Devices
            </ActionButton>
          </>
        }
      />

      <SurfacePanel className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_0.55fr]">
          <div className="relative min-h-56 overflow-hidden bg-black">
            <MeetingBrandLoop
              alt="Conscious Meetings branded WebRTC room animation"
              className="h-full min-h-56 w-full"
              imageClassName="h-full w-full object-cover"
              eager
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/60" />
          </div>
          <div className="flex flex-col justify-center gap-4 bg-slate-950/70 p-5 sm:p-6 lg:p-8">
            <img
              src={cnhLogo}
              alt="Conscious Network Hub"
              className="h-20 w-20 rounded-2xl bg-white/95 object-contain p-1.5 shadow-xl"
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Branded Meeting Gateway</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                CNH meeting confirmations, checks, and host controls use the native WebRTC room identity.
              </p>
            </div>
          </div>
        </div>
      </SurfacePanel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfacePanel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Identity Access Management</h2>
            <ShieldCheck className="h-5 w-5 text-blue-300" />
          </div>
          <div className="grid gap-3">
            {identityRows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Device And Spatial Configuration</h2>
            <Monitor className="h-5 w-5 text-teal-300" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {deviceRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${row.ready ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-500/10 text-slate-400'}`}>
                  {row.icon}
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{row.label}</p>
                <p className="mt-1 text-xs font-bold text-white">{row.value}</p>
              </div>
            ))}
          </div>
          {!deviceCheck?.immersiveVrSupported && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-xs leading-5 text-amber-100">
              5D Provider Experience will prompt for physical spatial tools or offer Standard View when WebXR tracking is unavailable.
            </div>
          )}
        </SurfacePanel>
      </div>

      <SurfacePanel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Configuration History</h2>
            <p className="mt-1 text-xs text-slate-500">Recent checks are stored locally for this browser profile.</p>
          </div>
          <Clock className="h-5 w-5 text-slate-400" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.checkedAtMs} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {new Date(entry.checkedAtMs).toLocaleString()}
                </p>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <p className="flex items-center gap-2">
                    {entry.cameraCount > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-slate-500" />}
                    Camera {entry.cameraCount}
                  </p>
                  <p className="flex items-center gap-2">
                    {entry.microphoneCount > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-slate-500" />}
                    Mic {entry.microphoneCount}
                  </p>
                  <p className="flex items-center gap-2">
                    {entry.webXrSupported ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-slate-500" />}
                    WebXR
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-5">
              Device history will appear after the first portal check.
            </div>
          )}
        </div>
      </SurfacePanel>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Live Stream Readiness</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Certified host operations are available only for verified provider accounts and the solo admin operator.
          </p>
        </div>
        {canOpenHostConsole ? (
          <React.Suspense fallback={<SurfacePanel className="text-sm text-slate-300">Loading provider host console...</SurfacePanel>}>
            <LazyConsciousMeetings user={user} />
          </React.Suspense>
        ) : (
          <SurfacePanel className="space-y-4 border-amber-300/20 bg-amber-300/[0.04]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-amber-200" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Provider Host Console Unavailable</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Provider host controls require an approved provider account or admin operations access. Members can join authorized sessions from the upcoming board.
                </p>
              </div>
            </div>
            <ActionButton type="button" variant="secondary" onClick={onOpenUpcoming} icon={<Video className="h-4 w-4" />}>
              View Upcoming Sessions
            </ActionButton>
          </SurfacePanel>
        )}
      </section>
    </PageShell>
  );
};

const ConsciousMeetingPortalPage: React.FC<ConsciousMeetingPortalPageProps> = (props) => (
  <VisualRenderBoundary moduleName="ConsciousMeetingPortalPage" fallbackTitle="Meeting portal could not render.">
    <ConsciousMeetingPortalPageContent {...props} />
  </VisualRenderBoundary>
);

export default ConsciousMeetingPortalPage;
