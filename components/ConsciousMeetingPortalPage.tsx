import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Home,
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
import {
  canUseMediaDevices,
  canUseWebGl,
  hasLiveAudioTracks,
  hasLiveVideoTracks,
  isBrowserSecureContext,
  normalizeMediaDeviceError,
  requestMeetingMediaStream,
  stopMediaStream,
} from '../services/mediaDeviceSupport';

const LazyConsciousMeetings = React.lazy(() => import('./ConsciousMeetings'));

type ConsciousMeetingPortalPageProps = {
  user: UserProfile | null;
  onOpenUpcoming: () => void;
  onExit: () => void;
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

type ReadinessState = 'Ready' | 'Blocked' | 'Unsupported' | 'Needs Permission';

type ProviderSelfTestState = {
  secureContext: { status: ReadinessState; detail: string };
  camera: { status: ReadinessState; detail: string };
  microphone: { status: ReadinessState; detail: string };
  mobileCamera: { status: ReadinessState; detail: string };
  background: { status: ReadinessState; detail: string };
  webGl: { status: ReadinessState; detail: string };
  webXr: { status: ReadinessState; detail: string };
  deviceList: string;
  nextAction: string;
  checkedAtMs: number | null;
  usedFallbackConstraints: boolean;
};

const createInitialSelfTestState = (): ProviderSelfTestState => ({
  secureContext: {
    status: isBrowserSecureContext() ? 'Ready' : 'Blocked',
    detail: isBrowserSecureContext()
      ? 'HTTPS or localhost detected for camera and WebXR APIs.'
      : 'Camera, microphone, and WebXR require HTTPS or localhost.',
  },
  camera: {
    status: 'Needs Permission',
    detail: 'Click Run Provider Self-Test to request camera access and confirm a live video track.',
  },
  microphone: {
    status: 'Needs Permission',
    detail: 'Click Run Provider Self-Test to request microphone access and confirm a live audio track.',
  },
  mobileCamera: {
    status: 'Needs Permission',
    detail: 'Open this same portal on the mobile device and run the self-test to capture the real mobile browser result.',
  },
  background: {
    status: 'Ready',
    detail: 'Default meeting scene is available for preview. Person cutout/segmentation is not implied unless enabled in host controls.',
  },
  webGl: {
    status: canUseWebGl() ? 'Ready' : 'Unsupported',
    detail: canUseWebGl()
      ? 'WebGL canvas rendering is available for spatial and visual effects.'
      : 'This browser could not initialize WebGL canvas rendering.',
  },
  webXr: {
    status: 'Needs Permission',
    detail: 'Click Run Provider Self-Test to check WebXR immersive support for this browser profile.',
  },
  deviceList: 'Device labels become available only after the browser grants camera/microphone permission.',
  nextAction: 'Run the provider self-test before hosting a pilot session.',
  checkedAtMs: null,
  usedFallbackConstraints: false,
});

const getPlatformLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Browser device';
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = browserNavigator.userAgentData?.platform || navigator.platform || 'Browser device';
  return platform;
};

const isMobileBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const browserNavigator = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return Boolean(browserNavigator.userAgentData?.mobile) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
};

const readinessBadgeClass = (status: ReadinessState): string => {
  if (status === 'Ready') return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100';
  if (status === 'Blocked') return 'border-red-300/30 bg-red-400/10 text-red-100';
  if (status === 'Unsupported') return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
  return 'border-blue-300/30 bg-blue-400/10 text-blue-100';
};

const getWebXrReadiness = async (): Promise<{ status: ReadinessState; detail: string }> => {
  if (!isBrowserSecureContext()) {
    return {
      status: 'Blocked',
      detail: '5D/WebXR checks require HTTPS or localhost.',
    };
  }
  if (!canUseWebGl()) {
    return {
      status: 'Unsupported',
      detail: '5D requires WebGL canvas rendering, which this browser could not initialize.',
    };
  }

  const xr = (navigator as NavigatorWithXR).xr;
  if (!xr?.isSessionSupported) {
    return {
      status: 'Unsupported',
      detail: 'This browser does not expose WebXR. Standard meeting view remains available.',
    };
  }

  try {
    const [vrSupported, arSupported] = await Promise.all([
      xr.isSessionSupported('immersive-vr').catch(() => false),
      xr.isSessionSupported('immersive-ar').catch(() => false),
    ]);
    if (vrSupported || arSupported) {
      return {
        status: 'Ready',
        detail: `WebXR reports ${[vrSupported ? 'immersive-vr' : '', arSupported ? 'immersive-ar' : '']
          .filter(Boolean)
          .join(' and ')} support. Camera permission is still required before entering 5D.`,
      };
    }
    return {
      status: 'Unsupported',
      detail: 'WebXR is present, but this device reports no immersive AR or VR session support.',
    };
  } catch {
    return {
      status: 'Unsupported',
      detail: 'The browser could not complete WebXR readiness checks.',
    };
  }
};

const ConsciousMeetingPortalPageContent: React.FC<ConsciousMeetingPortalPageProps> = ({
  user,
  onOpenUpcoming,
  onExit,
  operationsEnabled = false,
}) => {
  const [deviceCheck, setDeviceCheck] = useState<DeviceCheck | null>(null);
  const [history, setHistory] = useState<DeviceCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isSelfTesting, setIsSelfTesting] = useState(false);
  const [selfTest, setSelfTest] = useState<ProviderSelfTestState>(() => createInitialSelfTestState());
  const [selfTestStream, setSelfTestStream] = useState<MediaStream | null>(null);
  const selfTestVideoRef = useRef<HTMLVideoElement | null>(null);
  const historyKey = user?.id ? `hcn.meetingDeviceHistory.${user.id}` : 'hcn.meetingDeviceHistory.guest';
  const isApprovedProvider =
    user?.role === 'provider' &&
    user.providerApproved === true &&
    String(user.providerApprovalStatus || '').trim().toLowerCase() === 'approved' &&
    !user.providerRevokedAt;
  const canOpenHostConsole =
    operationsEnabled || user?.role === 'admin' || isApprovedProvider;

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

  useEffect(() => {
    if (!selfTestVideoRef.current) return;
    selfTestVideoRef.current.srcObject = selfTestStream;
    if (selfTestStream) {
      selfTestVideoRef.current.play().catch(() => undefined);
    }
  }, [selfTestStream]);

  useEffect(() => {
    return () => {
      stopMediaStream(selfTestStream);
    };
  }, [selfTestStream]);

  const stopProviderSelfTest = useCallback(() => {
    stopMediaStream(selfTestStream);
    setSelfTestStream(null);
    setSelfTest((current) => ({
      ...current,
      camera: {
        status: 'Needs Permission',
        detail: 'Preview stopped. Run the provider self-test again before hosting to confirm a live camera track.',
      },
      microphone: {
        status: 'Needs Permission',
        detail: 'Preview stopped. Run the provider self-test again before hosting to confirm a live microphone track.',
      },
      mobileCamera: {
        status: isMobileBrowser() ? 'Needs Permission' : current.mobileCamera.status,
        detail: isMobileBrowser()
          ? 'Preview stopped on this mobile browser. Run the self-test again before hosting.'
          : current.mobileCamera.detail,
      },
      nextAction: 'Preview stopped. Run the provider self-test again before hosting.',
    }));
  }, [selfTestStream]);

  const runProviderSelfTest = useCallback(async () => {
    setIsSelfTesting(true);
    stopMediaStream(selfTestStream);
    setSelfTestStream(null);

    const secureStatus = isBrowserSecureContext();
    const mediaSupported = canUseMediaDevices();
    const webGlReady = canUseWebGl();
    const webXr = await getWebXrReadiness();
    const mobile = isMobileBrowser();

    if (!secureStatus || !mediaSupported) {
      const reason = normalizeMediaDeviceError(new DOMException('Media devices unavailable', 'NotAllowedError'));
      setSelfTest({
        secureContext: {
          status: secureStatus ? 'Ready' : 'Blocked',
          detail: secureStatus ? 'HTTPS or localhost detected.' : reason,
        },
        camera: {
          status: mediaSupported ? 'Needs Permission' : 'Unsupported',
          detail: reason,
        },
        microphone: {
          status: mediaSupported ? 'Needs Permission' : 'Unsupported',
          detail: reason,
        },
        mobileCamera: {
          status: mobile ? (mediaSupported ? 'Needs Permission' : 'Unsupported') : 'Needs Permission',
          detail: mobile ? reason : 'Open this same portal on the mobile device and run the self-test to capture the real mobile browser result.',
        },
        background: {
          status: 'Ready',
          detail: 'Default meeting scene is available. Person cutout/segmentation is not implied unless enabled in host controls.',
        },
        webGl: {
          status: webGlReady ? 'Ready' : 'Unsupported',
          detail: webGlReady ? 'WebGL canvas rendering is available.' : 'This browser could not initialize WebGL canvas rendering.',
        },
        webXr,
        deviceList: 'Device labels become available only after the browser grants camera/microphone permission.',
        nextAction: reason,
        checkedAtMs: Date.now(),
        usedFallbackConstraints: false,
      });
      setIsSelfTesting(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      const mediaRequest = await requestMeetingMediaStream();
      stream = mediaRequest.stream;
      const hasVideo = hasLiveVideoTracks(stream);
      const hasAudio = hasLiveAudioTracks(stream);
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const cameraCount = devices.filter((device) => device.kind === 'videoinput').length;
      const microphoneCount = devices.filter((device) => device.kind === 'audioinput').length;

      if (!hasVideo || !hasAudio) {
        stopMediaStream(stream);
        stream = null;
      }

      setSelfTestStream(stream);
      setSelfTest({
        secureContext: {
          status: 'Ready',
          detail: 'Secure context confirmed for camera, microphone, and WebXR APIs.',
        },
        camera: {
          status: hasVideo ? 'Ready' : 'Blocked',
          detail: hasVideo
            ? mediaRequest.usedFallbackConstraints
              ? 'Live camera track confirmed using the browser fallback profile.'
              : 'Live camera track confirmed with the provider meeting profile.'
            : 'The browser returned no live video track. Check camera permission, browser settings, or another app using the camera.',
        },
        microphone: {
          status: hasAudio ? 'Ready' : 'Blocked',
          detail: hasAudio
            ? 'Live microphone track confirmed.'
            : 'The browser returned no live audio track. Check microphone permission, browser settings, or another app using the microphone.',
        },
        mobileCamera: {
          status: mobile ? (hasVideo ? 'Ready' : 'Blocked') : 'Needs Permission',
          detail: mobile
            ? hasVideo
              ? 'Mobile browser camera produced a live video track.'
              : 'Mobile browser did not produce a live camera track. Try Safari/Chrome permissions, HTTPS, and camera access settings.'
            : 'Desktop check completed. Open this same portal on mobile and run the self-test to prove the mobile camera path.',
        },
        background: {
          status: 'Ready',
          detail: 'Default meeting scene is visible in the preview. Custom backgrounds remain local to the host browser; person cutout/segmentation is not implied unless explicitly enabled.',
        },
        webGl: {
          status: webGlReady ? 'Ready' : 'Unsupported',
          detail: webGlReady ? 'WebGL canvas rendering is available for spatial and background preview effects.' : 'This browser could not initialize WebGL canvas rendering.',
        },
        webXr,
        deviceList:
          cameraCount || microphoneCount
            ? `Browser reports ${cameraCount} camera device(s) and ${microphoneCount} microphone device(s) after permission.`
            : 'Permission completed, but the browser did not expose device counts.',
        nextAction:
          hasVideo && hasAudio
            ? 'Provider self-test passed for this browser. Enter host controls to create or start the pilot room.'
            : 'Resolve the blocked camera or microphone item before hosting a live provider pilot room.',
        checkedAtMs: Date.now(),
        usedFallbackConstraints: mediaRequest.usedFallbackConstraints,
      });
    } catch (error) {
      stopMediaStream(stream);
      const reason = normalizeMediaDeviceError(error);
      setSelfTest({
        secureContext: {
          status: 'Ready',
          detail: 'Secure context confirmed.',
        },
        camera: {
          status: 'Blocked',
          detail: reason,
        },
        microphone: {
          status: 'Blocked',
          detail: reason,
        },
        mobileCamera: {
          status: mobile ? 'Blocked' : 'Needs Permission',
          detail: mobile ? reason : 'Open this same portal on mobile and run the self-test to capture the mobile browser result.',
        },
        background: {
          status: 'Ready',
          detail: 'Default meeting scene remains available even if camera startup is blocked.',
        },
        webGl: {
          status: webGlReady ? 'Ready' : 'Unsupported',
          detail: webGlReady ? 'WebGL canvas rendering is available.' : 'This browser could not initialize WebGL canvas rendering.',
        },
        webXr,
        deviceList: 'Device labels become available only after camera/microphone permission succeeds.',
        nextAction: reason,
        checkedAtMs: Date.now(),
        usedFallbackConstraints: false,
      });
    } finally {
      setIsSelfTesting(false);
    }
  }, [selfTestStream]);

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
  const readinessItems = [
    ['Secure Context', selfTest.secureContext],
    ['Camera Preview', selfTest.camera],
    ['Microphone Track', selfTest.microphone],
    ['Mobile Camera Path', selfTest.mobileCamera],
    ['Background Preview', selfTest.background],
    ['WebGL', selfTest.webGl],
    ['5D / WebXR', selfTest.webXr],
  ] as const;
  const exitLabel = user ? 'Dashboard' : 'Hub Home';

  return (
    <PageShell>
      <PageHeader
        eyebrow="Conscious Meetings"
        title="Meeting Portal"
        description="Unified access for identity readiness, device checks, configuration history, and provider-hosted internal session controls."
        actions={
          <div className="grid w-full max-w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <ActionButton type="button" variant="secondary" onClick={onExit} icon={<Home className="h-4 w-4" />} className="w-full sm:w-auto">
              {exitLabel}
            </ActionButton>
            <ActionButton type="button" variant="secondary" onClick={onOpenUpcoming} icon={<Video className="h-4 w-4" />} className="w-full sm:w-auto">
              Upcoming Sessions
            </ActionButton>
            <ActionButton
              type="button"
              onClick={runDeviceCheck}
              disabled={isChecking}
              icon={<RefreshCw className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Check Devices
            </ActionButton>
          </div>
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

      <SurfacePanel className="space-y-5 border-cyan-300/20 bg-cyan-400/[0.03]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Provider Pilot Self-Test</p>
            <h2 className="break-normal text-[clamp(1.25rem,2vw,1.65rem)] font-black uppercase leading-tight text-white [overflow-wrap:normal] [word-break:normal]">
              Camera, Mic, Background, And 5D Readiness
            </h2>
            <p className="text-sm leading-6 text-slate-300">
              Run this before hosting. It requests browser permission, verifies live camera and microphone tracks, checks 5D prerequisites, and previews the default meeting scene without creating a meeting room.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[30rem] lg:shrink-0">
            <ActionButton
              type="button"
              onClick={runProviderSelfTest}
              disabled={isSelfTesting}
              icon={<Camera className="h-4 w-4" />}
              className="w-full"
            >
              {isSelfTesting ? 'Testing Devices' : 'Run Provider Self-Test'}
            </ActionButton>
            <ActionButton
              type="button"
              variant="secondary"
              onClick={stopProviderSelfTest}
              disabled={!selfTestStream}
              icon={<XCircle className="h-4 w-4" />}
              className="w-full"
            >
              Stop Preview
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div className="relative aspect-video min-h-52">
              <MeetingBrandLoop
                alt="Default Conscious Meetings background preview"
                className="absolute inset-0 h-full w-full"
                imageClassName="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
              {selfTestStream ? (
                <video
                  ref={selfTestVideoRef}
                  className="absolute bottom-4 right-4 h-28 w-36 rounded-2xl border border-cyan-200/40 bg-black object-cover shadow-2xl shadow-cyan-950/50 sm:h-36 sm:w-48"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="absolute bottom-4 right-4 max-w-[13rem] rounded-2xl border border-white/10 bg-black/65 p-4 text-xs leading-5 text-slate-300">
                  Preview appears here after permission. Browser autoplay is muted and inline for mobile compatibility.
                </div>
              )}
              <div className="absolute bottom-4 left-4 max-w-md rounded-2xl border border-white/10 bg-black/65 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-200">Visual Boundary</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Background frame/scene preview is active. Person cutout, cloud recording, and server VOD are not implied by this self-test.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {readinessItems.map(([label, item]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${readinessBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Browser Device List</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{selfTest.deviceList}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Constraint Profile</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {selfTest.usedFallbackConstraints
                ? 'Browser fallback constraints were used after the preferred meeting profile was unavailable.'
                : 'Preferred provider meeting constraints will be used unless the browser reports they are overconstrained.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Next Action</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{selfTest.nextAction}</p>
          </div>
        </div>
      </SurfacePanel>

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
