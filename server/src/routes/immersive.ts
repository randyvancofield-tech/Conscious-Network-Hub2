import { Request, Response, Router } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { validateJsonBody } from '../validation/jsonSchema';
import { immersiveSessionEventSchema } from '../validation/requestSchemas';

type ImmersiveEventType = 'start' | 'end' | 'error';
type ImmersiveSessionMode = 'immersive-ar' | 'immersive-vr' | 'unknown';

interface ImmersiveSessionEventBody {
  eventType: ImmersiveEventType;
  sessionMode?: ImmersiveSessionMode | null;
  deviceProfile?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  userAgent?: string | null;
  timestamp?: string | null;
}

const router = Router();
router.use(requireCanonicalIdentity);

const VALID_SESSION_MODES: readonly ImmersiveSessionMode[] = [
  'immersive-ar',
  'immersive-vr',
  'unknown',
];
const VALID_DEVICE_PROFILES = new Set([
  'meta-quest',
  'apple-vision-pro',
  'mobile-ar',
  'desktop-xr',
  'unknown',
]);
const MAX_EVENT_RATE_PER_HOUR = 240;
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

interface UserTelemetryState {
  activeSessionStartedAt: number | null;
  activeSessionMode: ImmersiveSessionMode;
  activeDeviceProfile: string;
  rateWindowStartedAt: number;
  rateWindowCount: number;
  lastEventAt: number;
}

const telemetryStateByUserId = new Map<string, UserTelemetryState>();

const normalizeNullableString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const normalizeDuration = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.min(Math.round(value), MAX_SESSION_DURATION_MS);
};

const normalizeSessionMode = (value: unknown): ImmersiveSessionMode => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_SESSION_MODES.includes(normalized as ImmersiveSessionMode)
    ? (normalized as ImmersiveSessionMode)
    : 'unknown';
};

const normalizeDeviceProfile = (value: unknown): string => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_DEVICE_PROFILES.has(normalized) ? normalized : 'unknown';
};

const normalizeClientTimestamp = (value: unknown): string | null => {
  const raw = normalizeNullableString(value, 64);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  const now = Date.now();
  const skewMs = Math.abs(now - parsed);
  if (skewMs > 7 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const readUserTelemetryState = (userId: string): UserTelemetryState => {
  const existing = telemetryStateByUserId.get(userId);
  if (existing) return existing;

  const initialized: UserTelemetryState = {
    activeSessionStartedAt: null,
    activeSessionMode: 'unknown',
    activeDeviceProfile: 'unknown',
    rateWindowStartedAt: Date.now(),
    rateWindowCount: 0,
    lastEventAt: 0,
  };
  telemetryStateByUserId.set(userId, initialized);
  return initialized;
};

const updateAndCheckEventRate = (state: UserTelemetryState): boolean => {
  const now = Date.now();
  if (now - state.rateWindowStartedAt >= ONE_HOUR_MS) {
    state.rateWindowStartedAt = now;
    state.rateWindowCount = 0;
  }

  state.rateWindowCount += 1;
  state.lastEventAt = now;
  return state.rateWindowCount <= MAX_EVENT_RATE_PER_HOUR;
};

/**
 * POST /api/immersive/session-event
 * Records immersive session lifecycle telemetry from authenticated users.
 */
router.post(
  '/session-event',
  validateJsonBody(immersiveSessionEventSchema),
  (req: Request, res: Response): void => {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = req.body as ImmersiveSessionEventBody;
    const userState = readUserTelemetryState(authUserId);
    const withinRate = updateAndCheckEventRate(userState);
    if (!withinRate) {
      res.status(429).json({ error: 'Too many immersive telemetry events' });
      return;
    }

    let sessionMode = normalizeSessionMode(payload.sessionMode);
    let deviceProfile = normalizeDeviceProfile(payload.deviceProfile);
    let durationMs = normalizeDuration(payload.durationMs);
    let errorMessage = normalizeNullableString(payload.errorMessage, 500);
    const userAgent =
      normalizeNullableString(payload.userAgent, 512) ||
      normalizeNullableString(req.headers['user-agent'], 512);
    const clientTimestamp = normalizeClientTimestamp(payload.timestamp);
    const now = Date.now();

    if (payload.eventType === 'start') {
      userState.activeSessionStartedAt = now;
      userState.activeSessionMode = sessionMode;
      userState.activeDeviceProfile = deviceProfile;
    } else if (payload.eventType === 'end') {
      if (!durationMs && userState.activeSessionStartedAt) {
        durationMs = Math.max(now - userState.activeSessionStartedAt, 0);
      }
      if (sessionMode === 'unknown' && userState.activeSessionMode !== 'unknown') {
        sessionMode = userState.activeSessionMode;
      }
      if (deviceProfile === 'unknown' && userState.activeDeviceProfile !== 'unknown') {
        deviceProfile = userState.activeDeviceProfile;
      }
      userState.activeSessionStartedAt = null;
      userState.activeSessionMode = 'unknown';
      userState.activeDeviceProfile = 'unknown';
    } else if (payload.eventType === 'error') {
      if (!errorMessage) {
        errorMessage = 'unknown_immersive_error';
      }
      if (sessionMode === 'unknown' && userState.activeSessionMode !== 'unknown') {
        sessionMode = userState.activeSessionMode;
      }
      if (deviceProfile === 'unknown' && userState.activeDeviceProfile !== 'unknown') {
        deviceProfile = userState.activeDeviceProfile;
      }
    }

    const outcome = payload.eventType === 'error' ? 'error' : 'success';
    recordAuditEvent(req, {
      domain: 'social',
      action: 'immersive_session_event',
      outcome,
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 202,
      metadata: {
        eventType: payload.eventType,
        sessionMode,
        deviceProfile,
        durationMs,
        hasErrorMessage: Boolean(errorMessage),
        errorCode: errorMessage ? errorMessage.slice(0, 80) : null,
        clientTimestamp,
        userAgent,
        activeSessionPresent: Boolean(userState.activeSessionStartedAt),
        eventRateWindowCount: userState.rateWindowCount,
      },
    });

    res.status(202).json({
      accepted: true,
      eventType: payload.eventType,
      sessionMode,
      recordedAt: new Date().toISOString(),
    });
  }
);

export default router;
