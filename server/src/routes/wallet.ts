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

type WalletChallengeRecord = {
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

type WalletSessionJwtPayload = {
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

const walletChallengeStore = new Map<string, WalletChallengeRecord>();
const signedRewardMarkers = new Set<string>();

const WALLET_SESSION_COOKIE = 'hcn_wallet_session';
const DEFAULT_WALLET_CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_WALLET_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_HCN_LEDGER_CHAIN_ID = 1;

const REWARD_ACTIVITY_CONFIG: Record<string, { amount: bigint; reputationPoints: bigint }> = {
  knowledge_contribution: { amount: 12n, reputationPoints: 3n },
  peer_support: { amount: 6n, reputationPoints: 2n },
  course_completion: { amount: 20n, reputationPoints: 5n },
};

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

const getWalletSessionTtlSeconds = (): number => {
  const raw = Number(process.env.WALLET_SESSION_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_WALLET_SESSION_TTL_SECONDS;
  return Math.floor(raw);
};

const getWalletChallengeTtlSeconds = (): number => {
  const raw = Number(process.env.WALLET_CHALLENGE_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_WALLET_CHALLENGE_TTL_SECONDS;
  return Math.floor(raw);
};

const getWalletSessionSecret = (): string => {
  return String(process.env.WALLET_SESSION_SECRET || '').trim() || resolveAuthTokenSecret();
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

const cleanupExpiredWalletChallenges = (): void => {
  const now = Date.now();
  for (const [nonce, challenge] of walletChallengeStore.entries()) {
    if (challenge.expiresAt.getTime() <= now) {
      walletChallengeStore.delete(nonce);
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
    'Sign in with Ethereum to link your HCN identity and establish a sovereign wallet session.',
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

const parseBytes32 = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return raw.toLowerCase();
};

const parseWalletSessionToken = (req: Request): WalletSessionJwtPayload | null => {
  const cookies = parseCookieHeader(String(req.headers.cookie || ''));
  const cookieToken = cookies[WALLET_SESSION_COOKIE];
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const token = cookieToken || bearerToken;
  if (!token) return null;
  try {
    return jwt.verify(token, getWalletSessionSecret(), {
      issuer: 'hcn-wallet',
      audience: 'hcn-wallet-session',
    }) as WalletSessionJwtPayload;
  } catch {
    return null;
  }
};

protectedRouter.post('/challenge', async (req: Request, res: Response): Promise<void> => {
  cleanupExpiredWalletChallenges();
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
      res.status(400).json({ error: 'Unsupported DID format for wallet verification' });
      return;
    }
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const requestId = crypto.randomUUID();
  const issuedAt = new Date();
  const ttlSeconds = getWalletChallengeTtlSeconds();
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
    uri: `${publicBaseUrl}/api/wallet/verify`,
    chainId,
    nonce,
    issuedAtIso: issuedAt.toISOString(),
    expiresAtIso: expiresAt.toISOString(),
    requestId,
    did,
  });

  walletChallengeStore.set(nonce, {
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
    action: 'wallet_challenge_create',
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
  cleanupExpiredWalletChallenges();
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

  const challenge = walletChallengeStore.get(nonce);
  if (!challenge) {
    res.status(410).json({ error: 'Wallet challenge not found or expired' });
    return;
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    walletChallengeStore.delete(nonce);
    res.status(410).json({ error: 'Wallet challenge expired' });
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
    res.status(401).json({ error: 'Invalid wallet signature' });
    return;
  }
  if (recoveredAddress.toLowerCase() !== challenge.address.toLowerCase()) {
    res.status(401).json({ error: 'Wallet signature does not match expected address' });
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
      res.status(400).json({ error: 'Provided DID does not match verified wallet identity' });
      return;
    }
  } else if (!isLegacyNodeDid(requestedDid)) {
    res.status(400).json({ error: 'Unsupported DID format for wallet binding' });
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
    'wallet:session',
  ]);
  const providerToken = createProviderSessionToken(
    providerSession.id,
    providerSession.did,
    providerSession.scopes
  );

  const verifiedAt = new Date();
  const walletSessionTtlSeconds = getWalletSessionTtlSeconds();
  const walletSessionExpiresAt = Math.floor(Date.now() / 1000) + walletSessionTtlSeconds;
  const walletJwtPayload: WalletSessionJwtPayload = {
    sub: authUserId,
    address: challenge.address,
    chainId: challenge.chainId,
    did: canonicalDid,
    legacyDid: isLegacyNodeDid(requestedDid) ? requestedDid : null,
    verifiedAt: verifiedAt.toISOString(),
  };
  const walletSessionToken = jwt.sign(walletJwtPayload, getWalletSessionSecret(), {
    algorithm: 'HS256',
    issuer: 'hcn-wallet',
    audience: 'hcn-wallet-session',
    expiresIn: walletSessionTtlSeconds,
  });

  const secureRequest = isSecureRequest(req);
  res.cookie(WALLET_SESSION_COOKIE, walletSessionToken, {
    httpOnly: true,
    secure: secureRequest,
    sameSite: secureRequest ? 'none' : 'lax',
    path: '/',
    maxAge: walletSessionTtlSeconds * 1000,
  });

  walletChallengeStore.delete(nonce);

  recordAuditEvent(req, {
    domain: 'auth',
    action: 'wallet_verify',
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
      walletSessionExpiresAt: new Date(walletSessionExpiresAt * 1000).toISOString(),
      providerToken: providerToken.token,
      providerTokenExpiresAt: providerToken.expiresAt,
    },
    walletSessionToken,
  });
});

router.get('/session', async (req: Request, res: Response): Promise<void> => {
  const payload = parseWalletSessionToken(req);
  if (!payload) {
    res.status(401).json({ error: 'No active wallet session' });
    return;
  }

  const user = await localStore.getUserById(payload.sub);
  if (!user) {
    res.status(404).json({ error: 'Wallet session user no longer exists' });
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
  res.clearCookie(WALLET_SESSION_COOKIE, {
    httpOnly: true,
    secure: secureRequest,
    sameSite: secureRequest ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
});

protectedRouter.post('/rewards/sign', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await localStore.getUserById(authUserId);
  if (!user || !user.walletDid) {
    res.status(400).json({ error: 'Wallet must be verified before requesting reward signatures' });
    return;
  }

  const did = String(user.walletDid || '').trim();
  const didPkh = parseDidPkh(did);
  if (!didPkh) {
    res.status(400).json({
      error: 'Wallet DID must be a did:pkh identity before signing rewards',
    });
    return;
  }

  const requestedWalletAddress = normalizeAddress(req.body?.walletAddress);
  if (
    requestedWalletAddress &&
    requestedWalletAddress.toLowerCase() !== didPkh.address.toLowerCase()
  ) {
    res.status(403).json({ error: 'walletAddress does not match verified wallet identity' });
    return;
  }
  const walletAddress = didPkh.address;

  const activityType = String(req.body?.activityType || '').trim().toLowerCase();
  const rewardConfig = REWARD_ACTIVITY_CONFIG[activityType];
  if (!rewardConfig) {
    res.status(400).json({
      error: `Unsupported activityType. Allowed: ${Object.keys(REWARD_ACTIVITY_CONFIG).join(', ')}`,
    });
    return;
  }

  const proofId = String(req.body?.proofId || '').trim();
  if (!proofId) {
    res.status(400).json({ error: 'proofId is required for reward signing' });
    return;
  }
  const marker = `${authUserId}:${activityType}:${proofId}`;
  if (signedRewardMarkers.has(marker)) {
    res.status(409).json({ error: 'Reward already signed for this activity proof' });
    return;
  }

  const txid =
    parseBytes32(req.body?.txid) ||
    ethers.keccak256(
      ethers.toUtf8Bytes(
        `${authUserId}:${activityType}:${proofId}:${Date.now().toString(10)}`
      )
    );

  const oraclePrivateKey = String(process.env.HCN_ORACLE_PRIVATE_KEY || '').trim();
  if (!oraclePrivateKey) {
    res.status(503).json({ error: 'HCN oracle signing key is not configured' });
    return;
  }

  const contractAddressRaw = String(process.env.HCN_LEDGER_CONTRACT_ADDRESS || '').trim();
  let contractAddress: string;
  try {
    contractAddress = ethers.getAddress(contractAddressRaw);
  } catch {
    res.status(503).json({
      error: 'HCN_LEDGER_CONTRACT_ADDRESS is missing or invalid in backend configuration',
    });
    return;
  }

  const configuredChainId = normalizePositiveChainId(process.env.HCN_LEDGER_CHAIN_ID);
  const chainId = configuredChainId || DEFAULT_HCN_LEDGER_CHAIN_ID;

  const claimDigest = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'bytes32', 'uint256', 'uint256'],
    [
      contractAddress,
      BigInt(chainId),
      walletAddress,
      txid,
      rewardConfig.amount,
      rewardConfig.reputationPoints,
    ]
  );

  const oracleWallet = new ethers.Wallet(oraclePrivateKey);
  const signature = await oracleWallet.signMessage(ethers.getBytes(claimDigest));
  signedRewardMarkers.add(marker);

  recordAuditEvent(req, {
    domain: 'auth',
    action: 'reward_signature_issue',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: {
      activityType,
      proofId,
      txid,
      walletAddress,
    },
  });

  res.json({
    success: true,
    reward: {
      txid,
      walletAddress,
      amount: rewardConfig.amount.toString(),
      reputationPoints: rewardConfig.reputationPoints.toString(),
      activityType,
      proofId,
      signature,
      oracleAddress: oracleWallet.address,
      contractAddress,
      chainId,
    },
  });
});

router.use(protectedRouter);

export default router;
