import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';
import { createSessionToken, hashPassword } from '../auth';
import { createProviderSessionToken } from '../auth/providerToken';
import {
  resolveBridgeProviderAudience,
  resolveBridgeProviderIssuer,
  resolveBridgeProviderSecret,
} from '../requiredEnv';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import { createProviderSession } from '../services/providerSessionStore';
import { createUserSession } from '../services/userSessionStore';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  providerBridgeConsumeLaunchCodeSchema,
  providerBridgeIssueLaunchCodeSchema,
} from '../validation/requestSchemas';

const router = Router();

const BRIDGE_CODE_TTL_MS = 120 * 1000;
const BRIDGE_TIMESTAMP_SKEW_MS = 60 * 1000;
const PROVIDER_DID_PREFIX = 'provider:';
const DEFAULT_PROVIDER_SCOPES = ['provider:read', 'provider:host'];
const DEFAULT_PROVIDER_TIER = 'Accelerated Tier';

const issueLaunchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bridge issue launch rate limit exceeded. Retry later.' },
});

const consumeLaunchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bridge consume launch rate limit exceeded. Retry later.' },
});

const normalizeScopes = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [...DEFAULT_PROVIDER_SCOPES];
  const scopes = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^provider:[a-z0-9:*_-]+$/.test(entry))
    .slice(0, 24);
  if (scopes.length === 0) return [...DEFAULT_PROVIDER_SCOPES];
  if (!scopes.includes('provider:read')) scopes.push('provider:read');
  if (!scopes.includes('provider:host')) scopes.push('provider:host');
  return Array.from(new Set(scopes)).sort();
};

const normalizeEmail = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const toTimestampMs = (raw: string): number | null => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed < 1e12 ? Math.floor(parsed * 1000) : Math.floor(parsed);
};

const hmacHex = (secret: string, payload: string): string =>
  crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

const toSafeLowerHex = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/^v1=/i, '')
    .toLowerCase();

const timingSafeEqualHex = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(toSafeLowerHex(left), 'utf8');
  const rightBuffer = Buffer.from(toSafeLowerHex(right), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const canonicalBridgeSignaturePayload = (input: {
  issuer: string;
  audience: string;
  timestampMs: number;
  providerExternalId: string;
  email: string;
  name: string;
  jti: string;
  scopes: string[];
}): string => {
  return [
    input.issuer,
    input.audience,
    String(input.timestampMs),
    input.providerExternalId,
    input.email,
    input.name,
    input.jti,
    input.scopes.join(','),
  ].join('\n');
};

const toBridgePublicUser = (user: Awaited<ReturnType<typeof localStore.getUserById>>) => ({
  id: user?.id || '',
  email: user?.email || '',
  name: user?.name || 'Provider',
  role: user?.role || 'user',
  providerExternalId: user?.providerExternalId || null,
  tier: user?.tier || null,
  subscriptionStatus: user?.subscriptionStatus || 'inactive',
  createdAt: user?.createdAt || new Date(),
  updatedAt: user?.updatedAt || new Date(),
  twoFactorEnabled: user?.twoFactorMethod ? user.twoFactorMethod !== 'none' : false,
  twoFactorMethod: user?.twoFactorMethod || 'none',
  phoneNumberMasked: null,
  walletDid: null,
});

const upsertBridgeProviderUser = async (input: {
  providerExternalId: string;
  email: string;
  name: string;
}): Promise<Awaited<ReturnType<typeof localStore.getUserById>>> => {
  const normalizedExternalId = String(input.providerExternalId || '').trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedName = String(input.name || '').trim() || 'Provider';

  const byExternalId = await localStore.getUserByProviderExternalId(normalizedExternalId);
  const byEmail = await localStore.getUserByEmail(normalizedEmail);

  if (byExternalId && byEmail && byExternalId.id !== byEmail.id) {
    throw new Error('Bridge identity conflict: providerExternalId/email mismatch');
  }

  const target = byExternalId || byEmail;
  if (!target) {
    const generatedPassword = hashPassword(crypto.randomBytes(32).toString('hex'));
    return localStore.createUser({
      email: normalizedEmail,
      name: normalizedName,
      password: generatedPassword,
      tier: DEFAULT_PROVIDER_TIER,
      role: 'provider',
      providerExternalId: normalizedExternalId,
      twoFactorMethod: 'none',
    });
  }

  const updated = await localStore.updateUser(target.id, {
    name: normalizedName,
    role: target.role === 'admin' ? 'admin' : 'provider',
    providerExternalId: normalizedExternalId,
    tier: target.tier || DEFAULT_PROVIDER_TIER,
  });

  return updated || target;
};

router.post(
  '/provider/issue-launch-code',
  issueLaunchLimiter,
  validateJsonBody(providerBridgeIssueLaunchCodeSchema),
  async (req: Request, res: Response): Promise<void> => {
    const issuer = resolveBridgeProviderIssuer();
    const audience = resolveBridgeProviderAudience();
    const secret = resolveBridgeProviderSecret();

    const headerIssuer = String(req.headers['x-bridge-issuer'] || '').trim();
    const headerTimestampRaw = String(req.headers['x-bridge-timestamp'] || '').trim();
    const headerSignature = String(req.headers['x-bridge-signature'] || '').trim();
    const headerKeyId = String(req.headers['x-bridge-key-id'] || '').trim() || null;

    const providerExternalId = String(req.body?.providerExternalId || '').trim();
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    const jti = String(req.body?.jti || '').trim();
    const requestAudience = String(req.body?.aud || '').trim();
    const scopes = normalizeScopes(req.body?.scopes);

    const deny = (statusCode: number, reason: string): void => {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_issue_launch_code',
        outcome: 'deny',
        statusCode,
        metadata: {
          reason,
          headerIssuer,
          requestAudience,
          providerExternalId,
          keyId: headerKeyId,
        },
      });
      res.status(statusCode).json({ error: reason });
    };

    if (!headerIssuer || headerIssuer !== issuer) {
      deny(401, 'Invalid bridge issuer');
      return;
    }

    if (!requestAudience || requestAudience !== audience) {
      deny(401, 'Invalid bridge audience');
      return;
    }

    const headerTimestampMs = toTimestampMs(headerTimestampRaw);
    if (!headerTimestampMs) {
      deny(400, 'Invalid bridge timestamp');
      return;
    }
    if (Math.abs(Date.now() - headerTimestampMs) > BRIDGE_TIMESTAMP_SKEW_MS) {
      deny(401, 'Bridge timestamp outside accepted skew');
      return;
    }

    if (!headerSignature) {
      deny(401, 'Missing bridge signature');
      return;
    }

    const signaturePayload = canonicalBridgeSignaturePayload({
      issuer: headerIssuer,
      audience: requestAudience,
      timestampMs: headerTimestampMs,
      providerExternalId,
      email,
      name,
      jti,
      scopes,
    });
    const expectedSignature = hmacHex(secret, signaturePayload);
    if (!timingSafeEqualHex(headerSignature, expectedSignature)) {
      deny(401, 'Invalid bridge signature');
      return;
    }

    const existingJti = await localStore.getProviderBridgeLaunchByJti(jti);
    if (existingJti) {
      deny(409, 'Launch assertion already used');
      return;
    }

    const now = Date.now();
    const launchCode = `pbl_${crypto.randomUUID()}`;
    const expiresAt = new Date(now + BRIDGE_CODE_TTL_MS);

    await localStore.createProviderBridgeLaunch({
      id: launchCode,
      providerExternalId,
      email,
      name,
      issuedAt: new Date(now),
      expiresAt,
      jti,
      scopes,
      createdAt: new Date(now),
    });

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_bridge_issue_launch_code',
      outcome: 'success',
      statusCode: 201,
      metadata: {
        providerExternalId,
        jti,
        expiresAt: expiresAt.toISOString(),
        keyId: headerKeyId,
      },
    });

    res.status(201).json({
      success: true,
      launchCode,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: Math.floor(BRIDGE_CODE_TTL_MS / 1000),
    });
  }
);

router.post(
  '/provider/consume-launch-code',
  consumeLaunchLimiter,
  validateJsonBody(providerBridgeConsumeLaunchCodeSchema),
  async (req: Request, res: Response): Promise<void> => {
    const allowedOrigin = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
    const originHeader = String(req.headers.origin || '').trim().replace(/\/+$/, '');
    if (allowedOrigin && originHeader && originHeader !== allowedOrigin) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'deny',
        statusCode: 403,
        metadata: {
          reason: 'origin_mismatch',
          originHeader,
        },
      });
      res.status(403).json({ error: 'Origin mismatch for provider launch consume' });
      return;
    }

    const code = String(req.body?.code || '').trim();
    const launch = await localStore.getProviderBridgeLaunchById(code);
    if (!launch) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'deny',
        statusCode: 404,
        metadata: { reason: 'launch_code_not_found' },
      });
      res.status(404).json({ error: 'Launch code not found' });
      return;
    }

    const now = Date.now();
    if (launch.expiresAt.getTime() <= now) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'deny',
        statusCode: 410,
        metadata: {
          reason: 'launch_code_expired',
          providerExternalId: launch.providerExternalId,
        },
      });
      res.status(410).json({ error: 'Launch code expired' });
      return;
    }

    if (launch.consumedAt) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'deny',
        statusCode: 409,
        metadata: {
          reason: 'launch_code_already_consumed',
          providerExternalId: launch.providerExternalId,
        },
      });
      res.status(409).json({ error: 'Launch code already consumed' });
      return;
    }

    const consumed = await localStore.consumeProviderBridgeLaunch(code, new Date(now));
    if (!consumed || !consumed.consumedAt) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'error',
        statusCode: 500,
        metadata: {
          reason: 'launch_code_consume_failed',
          providerExternalId: launch.providerExternalId,
        },
      });
      res.status(500).json({ error: 'Failed to consume launch code' });
      return;
    }

    const user = await upsertBridgeProviderUser({
      providerExternalId: consumed.providerExternalId,
      email: consumed.email,
      name: consumed.name,
    });
    if (!user) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'error',
        statusCode: 500,
        metadata: {
          reason: 'provider_user_upsert_failed',
          providerExternalId: consumed.providerExternalId,
        },
      });
      res.status(500).json({ error: 'Failed to establish provider user' });
      return;
    }

    const persistedSession = await createUserSession(user.id);
    const session = createSessionToken(user.id, {
      sessionId: persistedSession.id,
      expiresAt: persistedSession.expiresAt.getTime(),
    });

    const providerDid = `${PROVIDER_DID_PREFIX}${user.id}`;
    const providerSession = await createProviderSession(providerDid, consumed.scopes);
    const providerToken = createProviderSessionToken(
      providerSession.id,
      providerSession.did,
      providerSession.scopes
    );

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_bridge_consume_launch_code',
      outcome: 'success',
      actorUserId: user.id,
      targetUserId: user.id,
      statusCode: 200,
      metadata: {
        providerExternalId: consumed.providerExternalId,
        providerSessionId: providerSession.id,
        userSessionId: persistedSession.id,
      },
    });

    res.json({
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
      providerSession: {
        token: providerToken.token,
        expiresAt: providerToken.expiresAt,
      },
      user: toBridgePublicUser(user),
    });
  }
);

export default router;
