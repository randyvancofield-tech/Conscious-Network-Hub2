
import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, Calendar, Users, ShieldCheck, Zap, 
  Search, Filter, Clock, CreditCard, CheckCircle2, 
  Plus, X, Camera, Mic, MicOff, CameraOff, 
  Settings, Download, Share2, Info, Loader2, Play,
  ChevronRight, Pause, Square, Image, Upload
} from 'lucide-react';
import * as THREE from 'three';
import { UserProfile, Provider, Meeting } from '../types';
import { summarizeMeeting } from '../services/backendApiService';

interface ConsciousMeetingsProps {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const PROVIDERS: Provider[] = [
  {
    id: 'p1',
    name: 'Dr. Jordan Wells',
    specialty: 'Trauma-informed coaching',
    rating: 4.9,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    bio: 'Specialist in restorative trauma-informed coaching for digital nomads navigating decentralized systems.',
    availabilitySlots: ['Mon 10:00 AM', 'Wed 02:00 PM', 'Fri 09:00 AM'],
    tierIncludedMin: 'Guided Tier'
  },
  {
    id: 'p2',
    name: 'Coach Amira Santos',
    specialty: 'Conscious Careers',
    rating: 4.8,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    bio: 'Helping professionals navigate career transitions and find purpose in the decentralized economy.',
    availabilitySlots: ['Tue 11:00 AM', 'Thu 03:00 PM'],
    tierIncludedMin: 'Accelerated Tier'
  },
  {
    id: 'p3',
    name: 'Master Sven Bergstrom',
    specialty: 'Sovereign Performance',
    rating: 4.7,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
    bio: 'Performance expert focused on high-stakes decision making, sovereignty, and cognitive optimization.',
    availabilitySlots: ['Sat 10:00 AM'],
    tierIncludedMin: 'Accelerated Tier'
  }
];

const ConsciousMeetings: React.FC<ConsciousMeetingsProps> = ({ user }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([
    {
      id: 'm1',
      title: 'Divine Alignment Check-In (1:1)',
      hostUserId: user?.id || 'guest',
      providerId: 'p1',
      startTime: 'Today, 2:00 PM',
      endTime: 'Today, 3:00 PM',
      participants: [
        { id: user?.id || 'guest', name: user?.name || 'Guest', role: 'User' },
        { id: 'p1', name: 'Dr. Jordan Wells', role: 'Provider' }
      ],
      status: 'Upcoming',
      accessType: 'tier',
      notes: { transcript: [], summary: '', decisions: [], actionItems: [] }
    },
    {
      id: 'm2',
      title: 'Career Purpose Mapping (Group)',
      hostUserId: user?.id || 'guest',
      providerId: 'p2',
      startTime: 'Friday, 11:00 AM',
      endTime: 'Friday, 12:30 PM',
      participants: [
        { id: user?.id || 'guest', name: user?.name || 'Guest', role: 'User' },
        { id: 'p2', name: 'Coach Amira Santos', role: 'Provider' },
        { id: 'u2', name: 'Zara Khan', role: 'User' },
        { id: 'u3', name: 'Aarav Sharma', role: 'User' }
      ],
      status: 'Upcoming',
      accessType: 'tier',
      notes: { transcript: [], summary: '', decisions: [], actionItems: [] }
    }
  ]);

  const [activeTab, setActiveTab] = useState<'schedule' | 'lobby' | 'calendar'>('schedule');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isSchedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [isNoteTakerOn, setNoteTakerOn] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showIncludedOnly, setShowIncludedOnly] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Solo Session States
  const [isSoloSessionActive, setIsSoloSessionActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
  const [micLevel, setMicLevel] = useState(0);
  const [customBackgroundFile, setCustomBackgroundFile] = useState<File | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isImmersiveStarting, setIsImmersiveStarting] = useState(false);
  const [isImmersiveActive, setIsImmersiveActive] = useState(false);
  const [immersiveError, setImmersiveError] = useState<string | null>(null);
  const [isImmersiveSupported, setIsImmersiveSupported] = useState(false);
  const [hasCheckedImmersiveSupport, setHasCheckedImmersiveSupport] = useState(false);

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

  const mockTranscript = [
    "Jordan: Welcome to our session. How are you feeling about your digital boundaries?",
    "User: I'm feeling overwhelmed with information. I need to restrict my neural input.",
    "Jordan: Understood. Let's set a goal to implement a 2-hour digital fast daily.",
    "User: That sounds manageable. I'll start tomorrow.",
    "Jordan: Great, I will also provide you with the bio-hacking resource by Sven."
  ];

  const checkPermissions = async () => {
    setPermissionState('pending');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPermissionState('granted');
    } catch (err) {
      setPermissionState('denied');
    }
  };

  const handleSchedule = (provider: Provider) => {
    setSelectedProvider(provider);
    setSelectedSlot(provider.availabilitySlots?.[0] || null);
    setSchedulingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!selectedProvider || !user) return;

    const isIncluded =
      user.tier === 'Accelerated Tier' ||
      (user.tier === 'Guided Tier' && selectedProvider.tierIncludedMin === 'Guided Tier');

    if (!isIncluded) {
      alert('This provider requires Guided or Accelerated tier access.');
      return;
    }

    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: `${selectedProvider.specialty} Session`,
      hostUserId: user.id,
      providerId: selectedProvider.id,
      startTime: selectedSlot || selectedProvider.availabilitySlots?.[0] || 'Next Available',
      endTime: selectedSlot ? `${selectedSlot} + 60m` : 'Next Available + 60m',
      participants: [
        { id: user.id, name: user.name, role: 'User' },
        { id: selectedProvider.id, name: selectedProvider.name, role: 'Provider' }
      ],
      status: 'Upcoming',
      accessType: 'tier'
    };

    setMeetings([newMeeting, ...meetings]);
    setSelectedSlot(null);
    setSchedulingModalOpen(false);
    setActiveTab('calendar');
  };

  const generateAINotes = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const result = await summarizeMeeting(mockTranscript);
    if (result) {
      setMeetings(prev =>
        prev.map(m => (m.id === meetingId ? { ...m, notes: { ...result, transcript: mockTranscript } } : m))
      );
    }
  };

  const filteredProviders = PROVIDERS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier =
      !showIncludedOnly ||
      user?.tier === 'Accelerated Tier' ||
      (user?.tier === 'Guided Tier' && p.tierIncludedMin === 'Guided Tier');
    return matchesSearch && matchesTier;
  });

  const hasLiveTracks = (candidate: MediaStream | null): candidate is MediaStream =>
    candidate instanceof MediaStream && candidate.getTracks().some((track) => track.readyState === 'live');

  const hasLiveVideoTracks = (candidate: MediaStream | null): candidate is MediaStream =>
    candidate instanceof MediaStream && candidate.getVideoTracks().some((track) => track.readyState === 'live');

  const getProviderMediaStream = (): MediaStream | null => {
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
    position: THREE.Vector3,
    forward: THREE.Vector3,
    up: THREE.Vector3
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
    if (!isImmersiveSupported || !hasCheckedImmersiveSupport) {
      setImmersiveError('Immersive mode is not supported on this browser/device.');
      return;
    }

    setImmersiveError(null);
    setIsImmersiveStarting(true);

    let cleanedUp = false;
    let session: any = null;
    let handleSessionEnd: (() => void) | null = null;
    let mount: HTMLElement | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let videoTexture: THREE.VideoTexture | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.MeshBasicMaterial | null = null;
    let borderGeometry: THREE.RingGeometry | null = null;
    let borderMaterial: THREE.MeshBasicMaterial | null = null;
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

      setIsImmersiveActive(false);
      setIsImmersiveStarting(false);
    };

    try {
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

      const arSupported = await xrSystem.isSessionSupported('immersive-ar');
      const vrSupported = await xrSystem.isSessionSupported('immersive-vr');

      let sessionMode: 'immersive-ar' | 'immersive-vr' | null = null;
      if (arSupported) sessionMode = 'immersive-ar';
      if (!sessionMode && vrSupported) sessionMode = 'immersive-vr';
      if (!sessionMode) {
        throw new Error('No immersive-ar or immersive-vr session is supported on this device.');
      }

      session = await xrSystem.requestSession(sessionMode, {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
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

      renderer.setAnimationLoop(() => {
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
      setIsImmersiveActive(true);
      setIsImmersiveStarting(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start immersive session.';
      setImmersiveError(message);
      cleanup();
    }
  };

  // Solo Session Functions
  const startSoloSession = async () => {
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
      alert('Camera and microphone access is required for solo sessions. Please check your browser permissions.');
    }
  };

  const stopSoloSession = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (mediaRecorderRef.current && recordingState !== 'idle') {
      stopRecording();
    }
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
    if (!stream) return;

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

    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

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

  const selectBackground = (background: string, type: 'image' | 'video') => {
    setSelectedBackground(background);
    setBackgroundType(type);
    setCustomBackgroundFile(null); // Clear custom file when selecting preset
  };

  const handleCustomBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous custom background URL
      if (customBackgroundFile && selectedBackground) {
        URL.revokeObjectURL(selectedBackground);
      }
      
      const url = URL.createObjectURL(file);
      setSelectedBackground(url);
      setBackgroundType(file.type.startsWith('video/') ? 'video' : 'image');
      setCustomBackgroundFile(file);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReschedule = (meeting: Meeting) => {
    const provider = PROVIDERS.find((entry) => entry.id === meeting.providerId) || null;
    if (provider) {
      setSelectedProvider(provider);
      setSelectedSlot(meeting.startTime);
      setSchedulingModalOpen(true);
      return;
    }
    alert('Provider details unavailable for reschedule.');
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
      alert('Meeting synthesis copied for participant sync.');
    } catch {
      alert('Unable to access clipboard. Please copy notes manually.');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkImmersiveSupport = async () => {
      if (typeof navigator === 'undefined') {
        if (!cancelled) {
          setIsImmersiveSupported(false);
          setHasCheckedImmersiveSupport(true);
        }
        return;
      }

      const xrSystem = (navigator as Navigator & { xr?: any }).xr;
      if (!xrSystem) {
        if (!cancelled) {
          setIsImmersiveSupported(false);
          setHasCheckedImmersiveSupport(true);
        }
        return;
      }

      try {
        const [arSupported, vrSupported] = await Promise.all([
          xrSystem.isSessionSupported('immersive-ar'),
          xrSystem.isSessionSupported('immersive-vr'),
        ]);

        if (!cancelled) {
          setIsImmersiveSupported(Boolean(arSupported || vrSupported));
        }
      } catch {
        if (!cancelled) {
          setIsImmersiveSupported(false);
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // Clean up custom background URL
      if (customBackgroundFile && selectedBackground) {
        URL.revokeObjectURL(selectedBackground);
      }
    };
  }, [stream, customBackgroundFile, selectedBackground]);

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
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
  }, [stream, isSoloSessionActive]);

  const canEnterImmersiveView = hasCheckedImmersiveSupport && isImmersiveSupported;

  return (
    <div className="min-h-0 flex flex-col gap-4 sm:gap-6 md:gap-8 animate-in fade-in duration-700 relative">
      <div ref={xrMountRef} className="fixed inset-0 z-[250] pointer-events-none" />
      <video ref={providerVideoRef} className="hidden" autoPlay playsInline muted />

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 md:gap-6 relative z-10">
        <div className="space-y-2">
          <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-2 sm:gap-3 md:gap-4">
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
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { id: 'lobby', label: 'Live Lobby', icon: <Play className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { id: 'calendar', label: 'My Calendar', icon: <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> }
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
          <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  placeholder="Find a provider..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                />
              </div>
              <button
                onClick={() => setShowFilterPanel((prev) => !prev)}
                className="px-4 sm:px-6 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-2xl text-slate-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" /> <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest hidden xs:inline">Filter</span>
              </button>
            </div>

            {showFilterPanel && (
              <div className="glass-panel p-4 sm:p-5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center gap-4">
                <label className="flex items-center gap-3 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showIncludedOnly}
                    onChange={(e) => setShowIncludedOnly(e.target.checked)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  Show only providers included in my tier
                </label>
                <button
                  onClick={() => {
                    setShowIncludedOnly(false);
                    setShowFilterPanel(false);
                  }}
                  className="sm:ml-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 pb-10 sm:pb-16 md:pb-20">
              {filteredProviders.map(provider => {
                const isIncluded =
                  user?.tier === 'Accelerated Tier' ||
                  (user?.tier === 'Guided Tier' && provider.tierIncludedMin === 'Guided Tier');

                return (
                  <div
                    key={provider.id}
                    className="glass-panel group rounded-2xl sm:rounded-[1.5rem] md:rounded-[2.25rem] lg:rounded-[2.5rem] overflow-hidden flex flex-col border-white/5 hover:border-blue-500/30 transition-all duration-500 shadow-2xl relative"
                  >
                    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 md:space-y-6">
                      <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                        <img
                          src={provider.avatar}
                          className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-xl md:rounded-2xl object-cover ring-4 ring-white/5 shadow-2xl"
                        />
                        <div>
                          <h4 className="text-base sm:text-lg md:text-xl font-black text-white uppercase tracking-tighter leading-none">
                            {provider.name}
                          </h4>
                          <p className="text-[9px] sm:text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1 sm:mt-2">
                            {provider.specialty}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2 xs:gap-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <span>Next Slot: {provider.availabilitySlots?.[0]}</span>
                          <span className="flex items-center gap-1 text-yellow-400">
                            <CheckCircle2 className="w-3 h-3" /> {provider.rating} Rating
                          </span>
                        </div>

                        <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-2xl border border-white/5 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                            <span className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest">
                              Access Layer
                            </span>
                          </div>

                          {isIncluded ? (
                            <span className="px-2 sm:px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full text-[8px] sm:text-[9px] font-black uppercase">
                              Tier Included
                            </span>
                          ) : (
                            <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[8px] sm:text-[9px] font-black uppercase">
                              {provider.tierIncludedMin || 'Guided Tier'}+
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSchedule(provider)}
                        className="w-full py-3 sm:py-4 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl md:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl transition-all hover:-translate-y-1 active:scale-95"
                      >
                        Schedule 1:1 Session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 md:space-y-12 animate-in fade-in py-4 sm:py-6 md:py-10">
            {!isSoloSessionActive ? (
              <>
                <div className="glass-panel p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.25rem] md:rounded-[2.5rem] lg:rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 sm:p-10 md:p-12 lg:p-16 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Video className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 text-blue-400" />
                  </div>

                  <div className="relative z-10 space-y-6 sm:space-y-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                      <span className="text-[9px] sm:text-[10px] font-black text-teal-400 uppercase tracking-[0.4em]">Next Session Ready</span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-3 sm:mb-4">
                        {meetings[0].title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-slate-400 text-xs sm:text-sm font-medium">
                        <span className="flex items-center gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4" /> {meetings[0].startTime}</span>
                        <span className="flex items-center gap-2"><Users className="w-3 h-3 sm:w-4 sm:h-4" /> {meetings[0].participants.length} Participants</span>
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
                          onClick={() => setIsJoining(true)}
                          className="flex-1 py-4 sm:py-5 md:py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg lg:text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 sm:gap-4"
                        >
                          {isJoining ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                          Join Virtual Session
                        </button>

                        <button
                          onClick={startSoloSession}
                          className="flex-1 py-4 sm:py-5 md:py-6 bg-teal-600 hover:bg-teal-500 text-white rounded-xl sm:rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-lg lg:text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 sm:gap-4"
                        >
                          <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                          Start Solo Session
                        </button>
                      </div>

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
                {/* Background */}
                {selectedBackground && (
                  <div className="absolute inset-0 -z-10">
                    {backgroundType === 'image' ? (
                      <img src={selectedBackground} className="w-full h-full object-cover opacity-30" alt="Background" />
                    ) : (
                      <video src={selectedBackground} className="w-full h-full object-cover opacity-30" autoPlay loop muted playsInline />
                    )}
                  </div>
                )}

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
                    <div className="flex items-center justify-center gap-4">
                      {recordingState === 'idle' && (
                        <button
                          onClick={startRecording}
                          className="px-6 sm:px-8 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
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
                          className="px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all"
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
                        onClick={() => selectBackground(null, 'image')}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          !selectedBackground ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-600 rounded mx-auto mb-2 flex items-center justify-center">
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">None</span>
                        </div>
                      </button>

                      {/* Sample backgrounds - in real app, these would be user-uploaded */}
                      <button
                        onClick={() => selectBackground('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1000', 'image')}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          selectedBackground === 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1000' && !customBackgroundFile ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <Image className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Forest</span>
                        </div>
                      </button>

                      <button
                        onClick={() => selectBackground('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1000', 'image')}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          selectedBackground === 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1000' && !customBackgroundFile ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <Image className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Mountains</span>
                        </div>
                      </button>

                      <button
                        onClick={() => selectBackground('https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&q=80&w=1000', 'image')}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          selectedBackground === 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&q=80&w=1000' && !customBackgroundFile ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-center">
                          <Image className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Ocean</span>
                        </div>
                      </button>

                      {/* Custom Upload */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all ${
                          customBackgroundFile ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
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
                        accept="image/*,video/*,video/mp4,.mp4"
                        onChange={handleCustomBackgroundUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Notetaker Preview Settings */}
            <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.25rem] md:rounded-[2.5rem] border-blue-500/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="p-3 sm:p-4 bg-blue-600/10 rounded-lg sm:rounded-2xl">
                  <Zap className={`w-5 h-5 sm:w-6 sm:h-6 ${isNoteTakerOn ? 'text-teal-400 animate-pulse' : 'text-slate-600'}`} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">AI Synthesis Notetaker</h4>
                  <p className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest mt-1">Real-time transcription & action extraction</p>
                </div>
              </div>
              <button
                onClick={() => setNoteTakerOn(!isNoteTakerOn)}
                className={`px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                  isNoteTakerOn
                    ? 'bg-teal-500/20 border-teal-500/40 text-teal-400 shadow-glow'
                    : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                }`}
              >
                {isNoteTakerOn ? 'Synthesis Active' : 'Enable Synthesis'}
              </button>
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
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="glass-panel rounded-lg sm:rounded-[1.5rem] md:rounded-[2.25rem] lg:rounded-[2.5rem] p-4 sm:p-6 md:p-8 border-white/5 hover:border-blue-500/20 transition-all shadow-xl group">
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
                            {meeting.accessType === 'tier' ? 'Tier Access' : 'Restricted'}
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
                      <span className="text-white font-mono font-bold text-sm sm:text-base">{meetings.length + 12}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Integrity Logs</span>
                      <span className="text-white font-mono font-bold text-sm sm:text-base">840 Recorded</span>
                    </div>
                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Provider Nodes</span>
                      <span className="text-white font-mono font-bold text-sm sm:text-base">3 Active</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6 sm:p-8 rounded-lg sm:rounded-2xl md:rounded-[2.5rem] lg:rounded-[2.75rem] border-blue-500/20 shadow-2xl space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-2 sm:gap-3 text-blue-400">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                    <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Meeting Integrity</h4>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed font-light italic">
                    By entering a virtual session, all participants agree to end-to-end encrypted recording if Synthesis is enabled. Data remains private to the host and participants.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduling Modal */}
      {isSchedulingModalOpen && selectedProvider && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] lg:rounded-[4rem] relative animate-in zoom-in duration-300 border-blue-500/20 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => {
                setSchedulingModalOpen(false);
                setSelectedSlot(null);
              }}
              className="absolute top-4 sm:top-6 md:top-8 lg:top-10 right-4 sm:right-6 md:right-8 lg:right-10 p-2 sm:p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8 md:mb-10">
              <img src={selectedProvider.avatar} className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl object-cover ring-8 ring-white/5 shadow-2xl" />
              <div className="flex-1">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">{selectedProvider.name}</h3>
                <p className="text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-widest mt-1 sm:mt-2 md:mt-3">{selectedProvider.specialty}</p>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[8px] sm:text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest pt-2 sm:pt-3 md:pt-4">
                  <span className="flex items-center gap-1 sm:gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4" /> 60 Minute Session</span>
                  <span className="flex items-center gap-1 sm:gap-2"><ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" /> Verified Provider</span>
                </div>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5 sm:ml-1">Select Synchronous Slot</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {selectedProvider.availabilitySlots?.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-4 sm:p-5 rounded-lg sm:rounded-2xl border transition-all text-xs sm:text-sm font-bold uppercase tracking-widest ${
                        selectedSlot === slot
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5 sm:ml-1">Invite Participants</h4>
                <div className="relative">
                  <Plus className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    placeholder="Add users by node ID or handle..."
                    className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-blue-600/10 border border-blue-500/20 rounded-lg sm:rounded-xl md:rounded-[1.5rem] lg:rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="text-center sm:text-left w-full sm:w-auto">
                  <h5 className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Access Protocol</h5>
                  <p className="text-white font-bold text-sm sm:text-base md:text-lg uppercase tracking-tighter">
                    {user?.tier === 'Accelerated Tier' || (user?.tier === 'Guided Tier' && selectedProvider.tierIncludedMin === 'Guided Tier')
                      ? 'Included with Membership'
                      : `${selectedProvider.tierIncludedMin || 'Guided Tier'}+ Required`}
                  </p>
                </div>
                <button
                  onClick={confirmBooking}
                  className="w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl md:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                >
                  Confirm Anchor Session <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .shadow-glow { box-shadow: 0 0 15px rgba(45, 212, 191, 0.4); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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

