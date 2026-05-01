import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';
import { ethers } from 'ethers';
import { createSessionToken } from '../auth';
import { createProviderSessionToken } from '../auth/providerToken';
import {
  resolveBridgeProviderAudience,
  resolveBridgeProviderIssuer,
  resolveBridgeProviderSecret,
} from '../requiredEnv';
import { recordAuditEvent } from '../services/auditTelemetry';
import {
  toBridgePublicUser,
  upsertBridgeProviderUser,
} from '../services/bridgeProviderUser';
import {
  getProviderDidForUserId,
  revokeProviderAccessForUser,
} from '../services/providerAccess';
import { localStore } from '../services/persistenceStore';
import { createProviderSession } from '../services/providerSessionStore';
import { createUserSession } from '../services/userSessionStore';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  providerBridgeConsumeLaunchCodeSchema,
  providerBridgeIssueLaunchCodeSchema,
  providerBridgeRevokeAccessSchema,
} from '../validation/requestSchemas';

const router = Router();

const BRIDGE_CODE_TTL_MS = 120 * 1000;
const BRIDGE_TIMESTAMP_SKEW_MS = 60 * 1000;
const DEFAULT_PROVIDER_SCOPES = ['provider:read', 'provider:host'];

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

const revokeAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bridge provider revocation rate limit exceeded. Retry later.' },
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

const normalizeRequiredString = (value: unknown): string => String(value || '').trim();

const normalizeWalletAddress = (value: unknown): string | null => {
  const raw = normalizeRequiredString(value);
  if (!raw) return null;
  try {
    return ethers.getAddress(raw);
  } catch {
    return null;
  }
};

const normalizeProviderRole = (value: unknown): 'provider' | null => {
  return normalizeRequiredString(value).toLowerCase() === 'provider' ? 'provider' : null;
};

const normalizeApprovalStatus = (value: unknown): string | null => {
  const normalized = normalizeRequiredString(value).toLowerCase();
  return normalized || null;
};

const normalizeProviderApproved = (value: unknown): boolean => value === true;

const parseDidPkh = (value: unknown): { chainId: number; address: string; did: string } | null => {
  const raw = normalizeRequiredString(value);
  const match = /^did:pkh:eip155:(\d+):(0x[a-f0-9]{40})$/i.exec(raw);
  if (!match) return null;
  const chainId = Number(match[1]);
  if (!Number.isFinite(chainId) || chainId <= 0) return null;
  try {
    const address = ethers.getAddress(match[2]);
    return {
      chainId: Math.floor(chainId),
      address,
      did: `did:pkh:eip155:${Math.floor(chainId)}:${address.toLowerCase()}`,
    };
  } catch {
    return null;
  }
};

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
  role: 'provider';
  approvalStatus: 'approved';
  walletAddress: string;
  walletDid: string;
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
    input.role,
    input.approvalStatus,
    input.walletAddress,
    input.walletDid,
    input.jti,
    input.scopes.join(','),
  ].join('\n');
};

const canonicalBridgeRevocationSignaturePayload = (input: {
  issuer: string;
  audience: string;
  timestampMs: number;
  providerExternalId: string;
  email: string;
  role: 'provider';
  approvalStatus: string;
  providerApproved: boolean;
  jti: string;
  reason: string;
}): string => {
  return [
    input.issuer,
    input.audience,
    String(input.timestampMs),
    input.providerExternalId,
    input.email,
    input.role,
    input.approvalStatus,
    String(input.providerApproved),
    input.jti,
    input.reason,
  ].join('\n');
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
    const role = normalizeProviderRole(req.body?.role);
    const approvalStatus = normalizeApprovalStatus(req.body?.approvalStatus);
    const approvalStatusWasProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'approvalStatus');
    const providerApproved = normalizeProviderApproved(req.body?.providerApproved);
    const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
    const walletDid = parseDidPkh(req.body?.walletDid);
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
          role: role || String(req.body?.role || '').trim() || null,
          approvalStatus: approvalStatus || null,
          providerApproved,
          keyId: headerKeyId,
        },
      });
      res.status(statusCode).json({ error: reason });
    };

    if (role !== 'provider') {
      deny(403, 'Provider bridge role required');
      return;
    }

    if (approvalStatusWasProvided && approvalStatus !== 'approved') {
      deny(403, 'Provider approval required');
      return;
    }

    if (!providerApproved && approvalStatus !== 'approved') {
      deny(403, 'Provider approval required');
      return;
    }

    if (!walletAddress) {
      deny(400, 'Invalid provider wallet address');
      return;
    }

    if (!walletDid) {
      deny(400, 'Invalid provider wallet DID');
      return;
    }

    if (walletDid.address.toLowerCase() !== walletAddress.toLowerCase()) {
      deny(400, 'Provider wallet DID/address mismatch');
      return;
    }

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
      role,
      approvalStatus: 'approved',
      walletAddress,
      walletDid: walletDid.did,
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
      role,
      approvalStatus: 'approved',
      providerApproved: true,
      walletAddress,
      walletDid: walletDid.did,
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
        walletChainId: walletDid.chainId,
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
  '/provider/revoke-access',
  revokeAccessLimiter,
  validateJsonBody(providerBridgeRevokeAccessSchema),
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
    const role = normalizeProviderRole(req.body?.role);
    const approvalStatus = normalizeApprovalStatus(req.body?.approvalStatus);
    const providerApproved = normalizeProviderApproved(req.body?.providerApproved);
    const reason = String(req.body?.reason || '').trim().slice(0, 512);
    const jti = String(req.body?.jti || '').trim();
    const requestAudience = String(req.body?.aud || '').trim();

    const deny = (statusCode: number, denyReason: string): void => {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_revoke_access',
        outcome: 'deny',
        statusCode,
        metadata: {
          reason: denyReason,
          headerIssuer,
          requestAudience,
          providerExternalId,
          role: role || String(req.body?.role || '').trim() || null,
          approvalStatus,
          providerApproved,
          keyId: headerKeyId,
        },
      });
      res.status(statusCode).json({ error: denyReason });
    };

    if (role !== 'provider') {
      deny(403, 'Provider bridge role required');
      return;
    }

    if (!approvalStatus || approvalStatus === 'approved' || providerApproved === true) {
      deny(403, 'Non-approved provider status required');
      return;
    }

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

    const signaturePayload = canonicalBridgeRevocationSignaturePayload({
      issuer: headerIssuer,
      audience: requestAudience,
      timestampMs: headerTimestampMs,
      providerExternalId,
      email,
      role,
      approvalStatus,
      providerApproved: false,
      jti,
      reason,
    });
    const expectedSignature = hmacHex(secret, signaturePayload);
    if (!timingSafeEqualHex(headerSignature, expectedSignature)) {
      deny(401, 'Invalid bridge signature');
      return;
    }

    const providerUser = await localStore.getUserByProviderExternalId(providerExternalId);
    if (!providerUser) {
      deny(404, 'Provider user not found');
      return;
    }

    if (email && providerUser.email !== email) {
      deny(409, 'Provider identity email mismatch');
      return;
    }

    const revoked = await revokeProviderAccessForUser(providerUser, { approvalStatus });

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_bridge_revoke_access',
      outcome: 'success',
      actorUserId: revoked.user.id,
      targetUserId: revoked.user.id,
      statusCode: 200,
      metadata: {
        providerExternalId,
        approvalStatus,
        providerSessionsRevoked: revoked.providerSessionsRevoked,
        userSessionsRevoked: revoked.userSessionsRevoked,
        jti,
        reason: reason || null,
        keyId: headerKeyId,
      },
    });

    res.json({
      success: true,
      providerExternalId,
      providerUserId: revoked.user.id,
      approvalStatus: revoked.user.providerApprovalStatus,
      providerApproved: revoked.user.providerApproved,
      providerRevokedAt: revoked.user.providerRevokedAt,
      providerSessionsRevoked: revoked.providerSessionsRevoked,
      userSessionsRevoked: revoked.userSessionsRevoked,
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

    if (
      consumed.role !== 'provider' ||
      consumed.providerApproved !== true ||
      !consumed.walletAddress ||
      !consumed.walletDid
    ) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_bridge_consume_launch_code',
        outcome: 'deny',
        statusCode: 403,
        metadata: {
          reason: 'provider_launch_not_approved_or_wallet_bound',
          providerExternalId: consumed.providerExternalId,
          role: consumed.role,
          providerApproved: consumed.providerApproved,
        },
      });
      res.status(403).json({ error: 'Provider launch is not approved or wallet-bound' });
      return;
    }

    const user = await upsertBridgeProviderUser({
      providerExternalId: consumed.providerExternalId,
      email: consumed.email,
      name: consumed.name,
      role: 'provider',
      walletAddress: consumed.walletAddress,
      walletDid: consumed.walletDid,
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

    const providerDid = getProviderDidForUserId(user.id);
    const providerSession = await createProviderSession(providerDid, consumed.scopes);
    const providerToken = createProviderSessionToken(
      providerSession.id,
      providerSession.did,
      providerSession.scopes
    );

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_activate',
      outcome: 'success',
      actorUserId: user.id,
      targetUserId: user.id,
      statusCode: 200,
      metadata: {
        providerExternalId: consumed.providerExternalId,
        providerSessionId: providerSession.id,
        userSessionId: persistedSession.id,
        scopesCount: providerSession.scopes.length,
      },
    });

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

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_auth_callback_success',
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
