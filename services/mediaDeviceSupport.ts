export const MEETING_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  } as MediaTrackConstraints,
};

export const BASIC_MEETING_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: true,
  audio: true,
};

export type MeetingMediaRequestResult = {
  stream: MediaStream;
  usedFallbackConstraints: boolean;
};

export const isBrowserSecureContext = (): boolean => {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext) return true;
  const host = window.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1';
};

export const canUseMediaDevices = (): boolean =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export const stopMediaStream = (stream?: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Browser track cleanup should never block UI teardown.
    }
  });
};

export const hasLiveTracks = (candidate: MediaStream | null | undefined): candidate is MediaStream =>
  candidate instanceof MediaStream && candidate.getTracks().some((track) => track.readyState === 'live');

export const hasLiveVideoTracks = (candidate: MediaStream | null | undefined): candidate is MediaStream =>
  candidate instanceof MediaStream && candidate.getVideoTracks().some((track) => track.readyState === 'live');

export const hasLiveAudioTracks = (candidate: MediaStream | null | undefined): candidate is MediaStream =>
  candidate instanceof MediaStream && candidate.getAudioTracks().some((track) => track.readyState === 'live');

export const normalizeMediaDeviceError = (error: unknown): string => {
  if (!isBrowserSecureContext()) {
    return 'Camera and microphone require a secure HTTPS context. Use the live HTTPS site or localhost for testing.';
  }

  if (!canUseMediaDevices()) {
    return 'This browser does not expose camera or microphone controls. Try a current Chrome, Edge, Safari, or mobile browser that supports media devices.';
  }

  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera or microphone permission was denied. Allow camera and microphone access in the browser, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No usable camera or microphone was found. Connect a device or enable one in system settings.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera or microphone is already in use by another app or browser tab. Close the other app and retry.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'The selected camera or microphone cannot satisfy the requested quality. Try another device or browser.';
  }
  if (name === 'AbortError') {
    return 'The browser stopped camera or microphone startup before it completed. Refresh the room and try again.';
  }

  return 'Camera and microphone could not start on this device. Check browser permissions, device availability, and secure HTTPS access.';
};

const shouldRetryWithBasicConstraints = (error: unknown): boolean => {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';
  return name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError';
};

export const requestMeetingMediaStream = async (): Promise<MeetingMediaRequestResult> => {
  if (!isBrowserSecureContext() || !canUseMediaDevices()) {
    throw new DOMException('Media devices unavailable', 'NotAllowedError');
  }

  try {
    return {
      stream: await navigator.mediaDevices.getUserMedia(MEETING_MEDIA_CONSTRAINTS),
      usedFallbackConstraints: false,
    };
  } catch (error) {
    if (!shouldRetryWithBasicConstraints(error)) {
      throw error;
    }
  }

  return {
    stream: await navigator.mediaDevices.getUserMedia(BASIC_MEETING_MEDIA_CONSTRAINTS),
    usedFallbackConstraints: true,
  };
};

export const canUseWebGl = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
};
