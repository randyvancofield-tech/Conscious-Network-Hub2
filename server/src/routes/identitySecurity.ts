import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { createProviderSessionToken } from '../auth/providerToken';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { resolveAuthTokenSecret } from '../requiredEnv';
import { localStore } from '../services/persistenceStore';
import { createProviderSession } from '../services/providerSessionStore';
import { recordAuditEvent } from '../services/auditTelemetry';

type IdentityChallengeRecord = {
  nonce: string;
  requestId: string;
  userId: string;
  did: string;
  address: string;
  chainId: number;
  message: string;
  issuedAt: Date;
  expiresAt: Date;
};

type IdentitySessionJwtPayload = {
  sub: string;
  address: string;
  chainId: number;
  did: string;
  legacyDid?: string | null;
  verifiedAt: string;
  iat?: number;
  exp?: number;
};

const router = Router();
const protectedRouter = Router();
protectedRouter.use(requireCanonicalIdentity);

const identityChallengeStore = new Map<string, IdentityChallengeRecord>();

const IDENTITY_SESSION_COOKIE = 'hcn_identity_session';
const DEFAULT_IDENTITY_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_IDENTITY_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const getPublicBaseUrl = (req: Request): string => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`;
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  const parsed: Record<string, string> = {};
  if (!cookieHeader) return parsed;
  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [rawName, ...rawValueParts] = segment.split('=');
    const name = String(rawName || '').trim();
    if (!name) continue;
    const value = rawValueParts.join('=').trim();
    parsed[name] = decodeURIComponent(value);
  }
  return parsed;
};

const isSecureRequest = (req: Request): boolean => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return forwardedProto === 'https' || req.secure;
};

const getIdentitySessionTtlSeconds = (): number => {
  const raw = Number(process.env.IDENTITY_SESSION_TTL_SECONDS || process.env.WALLET_SESSION_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_IDENTITY_SESSION_TTL_SECONDS;
  return Math.floor(raw);
};

const getIdentityChallengeTtlSeconds = (): number => {
  const raw = Number(
    process.env.IDENTITY_CHALLENGE_TTL_SECONDS || process.env.WALLET_CHALLENGE_TTL_SECONDS
  );
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_IDENTITY_CHALLENGE_TTL_SECONDS;
  return Math.floor(raw);
};

const getIdentitySessionSecret = (): string => {
  return (
    String(process.env.IDENTITY_SESSION_SECRET || '').trim() ||
    String(process.env.WALLET_SESSION_SECRET || '').trim() ||
    resolveAuthTokenSecret()
  );
};

const toDidPkh = (chainId: number, address: string): string =>
  `did:pkh:eip155:${Math.floor(chainId)}:${address.toLowerCase()}`;

const parseDidPkh = (
  did: string
): { chainId: number; address: string } | null => {
  const match = /^did:pkh:eip155:(\d+):(0x[a-f0-9]{40})$/i.exec(did.trim());
  if (!match) return null;
  const chainId = Number(match[1]);
  if (!Number.isFinite(chainId) || chainId <= 0) return null;
  try {
    return {
      chainId: Math.floor(chainId),
      address: ethers.getAddress(match[2]),
    };
  } catch {
    return null;
  }
};

const isLegacyNodeDid = (did: string): boolean => /^did:hcn:node_[a-z0-9._-]+$/i.test(did.trim());

const normalizeAddress = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return ethers.getAddress(raw);
  } catch {
    return null;
  }
};

const normalizePositiveChainId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const cleanupExpiredChallenges = (): void => {
  const now = Date.now();
  for (const [nonce, challenge] of identityChallengeStore.entries()) {
    if (challenge.expiresAt.getTime() <= now) {
      identityChallengeStore.delete(nonce);
    }
  }
};

const buildSiweMessage = (input: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAtIso: string;
  expiresAtIso: string;
  requestId: string;
  did: string;
}): string => {
  return [
    `${input.domain} wants you to sign in with your Ethereum account:`,
    input.address,
    '',
    'Sign in with Ethereum to establish a secure identity session for HCN.',
    '',
    `URI: ${input.uri}`,
    'Version: 1',
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAtIso}`,
    `Expiration Time: ${input.expiresAtIso}`,
    `Request ID: ${input.requestId}`,
    'Resources:',
    `- ${input.did}`,
  ].join('\n');
};

const extractSiweField = (message: string, fieldName: string): string | null => {
  const matcher = new RegExp(`^${fieldName}:\\s*(.+)$`, 'im').exec(message);
  if (!matcher) return null;
  const value = String(matcher[1] || '').trim();
  return value || null;
};

const extractSiweAddress = (message: string): string | null => {
  const matcher = /wants you to sign in with your Ethereum account:\s*\n(0x[a-fA-F0-9]{40})/.exec(
    message
  );
  if (!matcher) return null;
  return normalizeAddress(matcher[1]);
};

const parseIdentitySessionToken = (req: Request): IdentitySessionJwtPayload | null => {
  const cookies = parseCookieHeader(String(req.headers.cookie || ''));
  const cookieToken = cookies[IDENTITY_SESSION_COOKIE];
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const rawSession = cookieToken || bearerToken;
  if (!rawSession) return null;
  try {
    return jwt.verify(rawSession, getIdentitySessionSecret(), {
      issuer: 'hcn-identity',
      audience: 'hcn-identity-session',
    }) as IdentitySessionJwtPayload;
  } catch {
    return null;
  }
};

protectedRouter.post('/challenge', async (req: Request, res: Response): Promise<void> => {
  cleanupExpiredChallenges();
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const address = normalizeAddress(req.body?.address);
  const chainId = normalizePositiveChainId(req.body?.chainId);
  const requestedDid = String(req.body?.did || '').trim();
  if (!address || !chainId) {
    res.status(400).json({ error: 'address and chainId are required' });
    return;
  }

  if (requestedDid) {
    const didPkh = parseDidPkh(requestedDid);
    if (didPkh) {
      if (didPkh.chainId !== chainId || didPkh.address.toLowerCase() !== address.toLowerCase()) {
        res.status(400).json({ error: 'Provided did:pkh does not match address/chainId' });
        return;
      }
    } else if (!isLegacyNodeDid(requestedDid)) {
      res.status(400).json({ error: 'Unsupported DID format for identity verification' });
      return;
    }
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const requestId = crypto.randomUUID();
  const issuedAt = new Date();
  const ttlSeconds = getIdentityChallengeTtlSeconds();
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
  const publicBaseUrl = getPublicBaseUrl(req);
  const domain = (() => {
    try {
      return new URL(publicBaseUrl).host;
    } catch {
      return req.get('host') || 'localhost';
    }
  })();
  const did = requestedDid || toDidPkh(chainId, address);
  const message = buildSiweMessage({
    domain,
    address,
    uri: `${publicBaseUrl}/api/identity-security/verify`,
    chainId,
    nonce,
    issuedAtIso: issuedAt.toISOString(),
    expiresAtIso: expiresAt.toISOString(),
    requestId,
    did,
  });

  identityChallengeStore.set(nonce, {
    nonce,
    requestId,
    userId: authUserId,
    did,
    address,
    chainId,
    message,
    issuedAt,
    expiresAt,
  });

  recordAuditEvent(req, {
    domain: 'auth',
    action: 'identity_challenge_create',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: {
      did,
      chainId,
      nonceHash: crypto.createHash('sha256').update(nonce).digest('hex').slice(0, 16),
    },
  });

  res.json({
    success: true,
    challenge: {
      message,
      nonce,
      requestId,
      did,
      chainId,
      address,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });
});

protectedRouter.post('/verify', async (req: Request, res: Response): Promise<void> => {
  cleanupExpiredChallenges();
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const message = String(req.body?.message || '').trim();
  const signature = String(req.body?.signature || '').trim();
  const providedAddress = normalizeAddress(req.body?.address);
  const providedChainId = normalizePositiveChainId(req.body?.chainId);
  const providedDid = String(req.body?.did || '').trim();
  const providedRequestId = String(req.body?.requestId || '').trim();
  if (!message || !signature || !providedAddress || !providedChainId) {
    res.status(400).json({ error: 'message, signature, address, chainId are required' });
    return;
  }

  const nonce = extractSiweField(message, 'Nonce');
  if (!nonce) {
    res.status(400).json({ error: 'SIWE message is missing nonce' });
    return;
  }

  const challenge = identityChallengeStore.get(nonce);
  if (!challenge) {
    res.status(410).json({ error: 'Identity challenge not found or expired' });
    return;
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    identityChallengeStore.delete(nonce);
    res.status(410).json({ error: 'Identity challenge expired' });
    return;
  }

  if (challenge.userId !== authUserId) {
    res.status(403).json({ error: 'Challenge belongs to a different user session' });
    return;
  }

  if (message !== challenge.message) {
    res.status(400).json({ error: 'Challenge message mismatch' });
    return;
  }

  if (providedRequestId && providedRequestId !== challenge.requestId) {
    res.status(400).json({ error: 'requestId mismatch' });
    return;
  }

  const messageAddress = extractSiweAddress(message);
  if (!messageAddress || messageAddress.toLowerCase() !== challenge.address.toLowerCase()) {
    res.status(400).json({ error: 'Address mismatch inside SIWE message' });
    return;
  }

  const messageChainId = normalizePositiveChainId(extractSiweField(message, 'Chain ID'));
  if (!messageChainId || messageChainId !== challenge.chainId) {
    res.status(400).json({ error: 'Chain ID mismatch inside SIWE message' });
    return;
  }

  if (providedAddress.toLowerCase() !== challenge.address.toLowerCase()) {
    res.status(400).json({ error: 'Provided address does not match challenge' });
    return;
  }
  if (providedChainId !== challenge.chainId) {
    res.status(400).json({ error: 'Provided chainId does not match challenge' });
    return;
  }

  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.getAddress(ethers.verifyMessage(message, signature));
  } catch {
    res.status(401).json({ error: 'Invalid address signature' });
    return;
  }
  if (recoveredAddress.toLowerCase() !== challenge.address.toLowerCase()) {
    res.status(401).json({ error: 'Address signature does not match expected address' });
    return;
  }

  const canonicalDid = toDidPkh(challenge.chainId, challenge.address);
  const requestedDid = providedDid || challenge.did;
  const requestedDidPkh = parseDidPkh(requestedDid);
  if (requestedDidPkh) {
    if (
      requestedDidPkh.chainId !== challenge.chainId ||
      requestedDidPkh.address.toLowerCase() !== challenge.address.toLowerCase()
    ) {
      res.status(400).json({ error: 'Provided DID does not match verified address identity' });
      return;
    }
  } else if (!isLegacyNodeDid(requestedDid)) {
    res.status(400).json({ error: 'Unsupported DID format for identity binding' });
    return;
  }

  const updatedUser = await localStore.updateUser(authUserId, {
    walletDid: canonicalDid,
  });
  if (!updatedUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const providerSession = await createProviderSession(canonicalDid, [
    'provider:read',
    'identity:session',
  ]);
  const providerToken = createProviderSessionToken(
    providerSession.id,
    providerSession.did,
    providerSession.scopes
  );

  const verifiedAt = new Date();
  const identitySessionTtlSeconds = getIdentitySessionTtlSeconds();
  const identitySessionExpiresAt = Math.floor(Date.now() / 1000) + identitySessionTtlSeconds;
  const identityJwtPayload: IdentitySessionJwtPayload = {
    sub: authUserId,
    address: challenge.address,
    chainId: challenge.chainId,
    did: canonicalDid,
    legacyDid: isLegacyNodeDid(requestedDid) ? requestedDid : null,
    verifiedAt: verifiedAt.toISOString(),
  };
  const identitySessionToken = jwt.sign(identityJwtPayload, getIdentitySessionSecret(), {
    algorithm: 'HS256',
    issuer: 'hcn-identity',
    audience: 'hcn-identity-session',
    expiresIn: identitySessionTtlSeconds,
  });

  const secureRequest = isSecureRequest(req);
  res.cookie(IDENTITY_SESSION_COOKIE, identitySessionToken, {
    httpOnly: true,
    secure: secureRequest,
    sameSite: secureRequest ? 'none' : 'lax',
    path: '/',
    maxAge: identitySessionTtlSeconds * 1000,
  });

  identityChallengeStore.delete(nonce);

  recordAuditEvent(req, {
    domain: 'auth',
    action: 'identity_verify',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: {
      did: canonicalDid,
      chainId: challenge.chainId,
    },
  });

  res.json({
    success: true,
    session: {
      did: canonicalDid,
      legacyDid: isLegacyNodeDid(requestedDid) ? requestedDid : null,
      address: challenge.address,
      chainId: challenge.chainId,
      verifiedAt: verifiedAt.toISOString(),
      identitySessionExpiresAt: new Date(identitySessionExpiresAt * 1000).toISOString(),
      providerToken: providerToken.token,
      providerTokenExpiresAt: providerToken.expiresAt,
    },
    identitySessionToken,
  });
});

router.get('/session', async (req: Request, res: Response): Promise<void> => {
  const payload = parseIdentitySessionToken(req);
  if (!payload) {
    res.status(401).json({ error: 'No active identity session' });
    return;
  }

  const user = await localStore.getUserById(payload.sub);
  if (!user) {
    res.status(404).json({ error: 'Identity session user no longer exists' });
    return;
  }

  res.json({
    success: true,
    session: {
      userId: payload.sub,
      did: payload.did,
      legacyDid: payload.legacyDid || null,
      address: payload.address,
      chainId: payload.chainId,
      verifiedAt: payload.verifiedAt,
    },
  });
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const secureRequest = isSecureRequest(req);
  res.clearCookie(IDENTITY_SESSION_COOKIE, {
    httpOnly: true,
    secure: secureRequest,
    sameSite: secureRequest ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
});

router.use(protectedRouter);

export default router;
