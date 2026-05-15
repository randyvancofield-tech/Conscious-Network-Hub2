import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { ethers } from 'ethers';
import { createSessionToken } from '../auth';
import { createProviderSessionToken } from '../auth/providerToken';
import {
  AuthenticatedRequest,
  getAuthenticatedRole,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { getProviderAccessDenyReason, isProviderAccessActive } from '../services/providerAccess';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore, type LocalUserRecord } from '../services/persistenceStore';
import {
  PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS,
  PROVIDER_CRM_SOLE_ADMIN_EMAIL,
  getConfiguredProviderCrmAdminWalletAddress,
  isProviderCrmAdminPasswordFallbackEnabled,
  isProviderCrmSoleAdmin,
  maskProviderCrmAdminWalletAddress,
} from '../services/providerCrm';
import { createProviderSession } from '../services/providerSessionStore';
import { createUserSession } from '../services/userSessionStore';

const router = Router();

const NATIVE_PROVIDER_SCOPES = ['provider:read', 'provider:host'];
const SIWE_VERSION = '1';
const DEFAULT_WALLET_CHALLENGE_TTL_SECONDS = 5 * 60;
const PROVIDER_WALLET_STATEMENT =
  'Sign in to Conscious Network Hub Provider Access. This gasless signature verifies your approved provider wallet and does not authorize a blockchain transaction.';
const ADMIN_WALLET_STATEMENT =
  'Sign in to Conscious Network Hub Administrative Access. This gasless signature verifies the founder administrator wallet and does not authorize a blockchain transaction.';

interface ProviderSiweFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

const providerDidForUser = (userId: string): string => `provider:${userId}`;

const normalizeWalletAddress = (value: unknown): string | null => {
  try {
    const normalized = ethers.getAddress(String(value || '').trim());
    return normalized || null;
  } catch {
    return null;
  }
};

const getWalletChallengeTtlMs = (): number => {
  const raw = Number(process.env.PROVIDER_WALLET_CHALLENGE_TTL_SECONDS);
  const seconds =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 30 * 60) : DEFAULT_WALLET_CHALLENGE_TTL_SECONDS;
  return seconds * 1000;
};

const getProviderWalletChainId = (): number => {
  const raw = Number(process.env.PROVIDER_WALLET_CHAIN_ID || process.env.PROVIDER_MANAGER_CHAIN_ID || 1);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
};

const resolveProviderWalletUri = (req: Request): string => {
  const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (origin) return `${origin}/provider/sign-in`;
  const configured = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return `${configured}/provider/sign-in`;
  const host = String(req.headers.host || '').trim() || 'localhost';
  const protocol = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https'
    ? 'https'
    : 'http';
  return `${protocol}://${host}/provider/sign-in`;
};

const resolveAdminWalletUri = (req: Request): string => {
  const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (origin) return `${origin}/administrative/sign-in`;
  const configured = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return `${configured}/administrative/sign-in`;
  const host = String(req.headers.host || '').trim() || 'localhost';
  const protocol = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https'
    ? 'https'
    : 'http';
  return `${protocol}://${host}/administrative/sign-in`;
};

const domainFromUri = (uri: string): string => {
  try {
    return new URL(uri).host;
  } catch {
    return 'conscious-network.org';
  }
};

const buildProviderSiweMessage = (fields: ProviderSiweFields): string =>
  [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    '',
    fields.statement,
    '',
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
  ].join('\n');

const parseProviderSiweMessage = (message: string): Partial<ProviderSiweFields> => {
  const lines = String(message || '').split(/\r?\n/);
  const domainLine = lines[0] || '';
  const domain = domainLine.endsWith(' wants you to sign in with your Ethereum account:')
    ? domainLine.replace(' wants you to sign in with your Ethereum account:', '')
    : '';
  const address = String(lines[1] || '').trim();
  const fields: Partial<ProviderSiweFields> = {
    domain,
    address,
  };

  for (const line of lines) {
    const match = /^(URI|Version|Chain ID|Nonce|Issued At|Expiration Time):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'URI') fields.uri = value;
    if (key === 'Version') fields.version = value;
    if (key === 'Chain ID') fields.chainId = Number(value);
    if (key === 'Nonce') fields.nonce = value;
    if (key === 'Issued At') fields.issuedAt = value;
    if (key === 'Expiration Time') fields.expirationTime = value;
  }

  return fields;
};

const resolveApprovedProviderByWallet = async (
  actorUserId: string,
  walletAddress: string
): Promise<{ user: LocalUserRecord | null; reason: string | null }> => {
  const matched = await localStore.findUserByWalletAddress(walletAddress);
  if (!matched) return { user: null, reason: 'provider_wallet_not_registered' };
  if (matched.id !== actorUserId) return { user: null, reason: 'provider_wallet_mismatch' };
  if (!isProviderAccessActive(matched)) {
    return { user: null, reason: getProviderAccessDenyReason(matched) || 'provider_not_active' };
  }
  return { user: matched, reason: null };
};

const getSoleProviderCrmAdminUser = async (): Promise<LocalUserRecord | null> => {
  const user = await localStore.getUserByEmail(PROVIDER_CRM_SOLE_ADMIN_EMAIL);
  return isProviderCrmSoleAdmin(user) ? user : null;
};

const toAdminAuthUserPayload = (user: LocalUserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.name || 'CNH Provider CRM Administrator',
  role: 'admin',
  handle: user.handle || null,
  bio: user.bio || null,
  location: user.location || null,
  dateOfBirth: user.dateOfBirth || null,
  avatarUrl: user.avatarUrl || null,
  bannerUrl: user.bannerUrl || null,
  profileMedia: user.profileMedia,
  interests: Array.isArray(user.interests) ? user.interests : [],
  twitterUrl: user.twitterUrl || null,
  githubUrl: user.githubUrl || null,
  websiteUrl: user.websiteUrl || null,
  privacySettings: user.privacySettings,
  tier: user.tier || 'Accelerated Tier',
  membershipStatus: user.membershipStatus || null,
  subscriptionStatus: user.subscriptionStatus || null,
  hasActiveMembership: true,
  membershipStartDate: user.subscriptionStartDate || null,
  membershipEndDate: user.subscriptionEndDate || null,
  emailVerified: user.emailVerified === true,
  providerApproved: user.providerApproved === true,
  providerApprovalStatus: user.providerApprovalStatus || null,
  providerRevokedAt: user.providerRevokedAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const createNativeProviderSessionPayload = async (
  req: Request,
  actorUserId: string,
  role: string
) => {
  const did = providerDidForUser(actorUserId);
  const scopes = role === 'admin' ? ['provider:*'] : NATIVE_PROVIDER_SCOPES;
  const session = await createProviderSession(did, scopes);
  const token = createProviderSessionToken(session.id, session.did, session.scopes);
  const authReq = req as AuthenticatedRequest;

  return {
    token,
    session,
    did,
    scopes,
    authSessionId: authReq.authSessionId || null,
  };
};

/**
 * POST /api/provider/auth/session
 * Creates a short-lived provider control session from the caller's canonical CNH auth session.
 * Approved providers must use the wallet verification entry boundary before this session is issued.
 */
router.post('/session', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);

  if (!actorUserId || (role !== 'provider' && role !== 'admin')) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_native_session_create',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: { reason: 'provider_or_admin_role_required', role },
    });
    res.status(403).json({ error: 'Approved provider access is required' });
    return;
  }

  if (role === 'provider') {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_native_session_create',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: { reason: 'provider_wallet_verification_required', role },
    });
    res.status(403).json({
      error: 'Provider wallet verification is required before provider tools unlock',
      code: 'PROVIDER_WALLET_VERIFICATION_REQUIRED',
    });
    return;
  }

  try {
    const providerSession = await createNativeProviderSessionPayload(req, actorUserId, role);

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_native_session_create',
      outcome: 'success',
      actorUserId,
      targetUserId: actorUserId,
      statusCode: 200,
      metadata: {
        providerSessionId: providerSession.session.id,
        role,
        authSessionId: providerSession.authSessionId,
        scopesCount: providerSession.session.scopes.length,
      },
    });

    res.json({
      success: true,
      token: providerSession.token.token,
      expiresAt: providerSession.token.expiresAt,
      session: {
        id: providerSession.session.id,
        did: providerSession.session.did,
        scopes: providerSession.session.scopes,
        issuedAt: providerSession.session.issuedAt,
        expiresAt: providerSession.session.expiresAt,
      },
    });
  } catch (error) {
    console.error('[ProviderAuth] native provider session failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_native_session_create',
      outcome: 'error',
      actorUserId,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Provider session could not be initialized' });
  }
});

/**
 * GET /api/provider/auth/admin/wallet/status
 * Reports Administrative Access wallet readiness without exposing private material.
 */
router.get('/admin/wallet/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const configuredWalletAddress = getConfiguredProviderCrmAdminWalletAddress();
    const adminUser = await getSoleProviderCrmAdminUser();
    res.json({
      success: true,
      adminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
      walletConfigured: Boolean(configuredWalletAddress),
      walletAddressMasked: maskProviderCrmAdminWalletAddress(configuredWalletAddress),
      adminAccountReady: Boolean(adminUser),
      passwordFallbackEnabled: isProviderCrmAdminPasswordFallbackEnabled(),
    });
  } catch (error) {
    console.error('[ProviderAuth] admin wallet status failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_status',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({
      success: false,
      error: 'Administrative Access readiness could not be checked',
    });
  }
});

/**
 * POST /api/provider/auth/admin/wallet/nonce
 * Issues a short-lived SIWE-style challenge for the configured founder/admin wallet.
 */
router.post('/admin/wallet/nonce', async (req: Request, res: Response): Promise<void> => {
  const configuredWalletAddress = getConfiguredProviderCrmAdminWalletAddress();
  if (!configuredWalletAddress) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_nonce',
      outcome: 'deny',
      statusCode: 503,
      metadata: { reason: 'admin_wallet_not_configured', envKeys: PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS },
    });
    res.status(503).json({
      error: 'Administrative wallet verification is not configured',
      code: 'ADMIN_WALLET_NOT_CONFIGURED',
    });
    return;
  }

  const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
  if (!walletAddress) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_nonce',
      outcome: 'deny',
      statusCode: 400,
      metadata: { reason: 'invalid_wallet_address' },
    });
    res.status(400).json({ error: 'Valid walletAddress is required' });
    return;
  }

  if (walletAddress !== configuredWalletAddress) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_nonce',
      outcome: 'deny',
      statusCode: 403,
      metadata: { reason: 'admin_wallet_mismatch' },
    });
    res.status(403).json({
      error: 'This wallet is not configured for Administrative Access',
      code: 'ADMIN_WALLET_MISMATCH',
    });
    return;
  }

  try {
    const adminUser = await getSoleProviderCrmAdminUser();
    if (!adminUser) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_nonce',
        outcome: 'deny',
        statusCode: 403,
        metadata: {
          reason: 'sole_admin_user_not_ready',
          requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
        },
      });
      res.status(403).json({
        error: 'Administrative wallet cannot be used until the sole administrator account is active',
        code: 'ADMIN_ACCOUNT_NOT_READY',
      });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + getWalletChallengeTtlMs());
    const uri = resolveAdminWalletUri(req);
    const fields: ProviderSiweFields = {
      domain: domainFromUri(uri),
      address: walletAddress,
      statement: ADMIN_WALLET_STATEMENT,
      uri,
      version: SIWE_VERSION,
      chainId: getProviderWalletChainId(),
      nonce: crypto.randomBytes(16).toString('hex'),
      issuedAt: now.toISOString(),
      expirationTime: expiresAt.toISOString(),
    };
    const message = buildProviderSiweMessage(fields);
    const challengeId = crypto.randomUUID();

    await localStore.createProviderChallenge({
      id: challengeId,
      did: providerDidForUser(adminUser.id),
      nonce: fields.nonce,
      statement: message,
      expiresAt,
      createdAt: now,
    });

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_nonce',
      outcome: 'success',
      actorUserId: adminUser.id,
      targetUserId: adminUser.id,
      statusCode: 200,
      metadata: { challengeId, chainId: fields.chainId },
    });

    res.json({
      success: true,
      challengeId,
      ...fields,
    });
  } catch (error) {
    console.error('[ProviderAuth] admin wallet nonce failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_nonce',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Administrative wallet challenge could not be created' });
  }
});

/**
 * POST /api/provider/auth/admin/wallet/verify
 * Consumes an admin wallet challenge and creates both canonical and provider-admin sessions.
 */
router.post('/admin/wallet/verify', async (req: Request, res: Response): Promise<void> => {
  const configuredWalletAddress = getConfiguredProviderCrmAdminWalletAddress();
  if (!configuredWalletAddress) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_verify',
      outcome: 'deny',
      statusCode: 503,
      metadata: { reason: 'admin_wallet_not_configured', envKeys: PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS },
    });
    res.status(503).json({
      error: 'Administrative wallet verification is not configured',
      code: 'ADMIN_WALLET_NOT_CONFIGURED',
    });
    return;
  }

  const challengeId = String(req.body?.challengeId || '').trim();
  const message = String(req.body?.message || '');
  const signature = String(req.body?.signature || '').trim();
  const submittedWalletAddress = normalizeWalletAddress(req.body?.walletAddress);
  if (!challengeId || !message || !signature) {
    res.status(400).json({ error: 'challengeId, message, and signature are required' });
    return;
  }

  try {
    const adminUser = await getSoleProviderCrmAdminUser();
    if (!adminUser) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        statusCode: 403,
        metadata: {
          reason: 'sole_admin_user_not_ready',
          requiredAdminEmail: PROVIDER_CRM_SOLE_ADMIN_EMAIL,
        },
      });
      res.status(403).json({
        error: 'Administrative wallet cannot be used until the sole administrator account is active',
        code: 'ADMIN_ACCOUNT_NOT_READY',
      });
      return;
    }

    const challenge = await localStore.getProviderChallengeById(challengeId);
    if (!challenge) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 401,
        metadata: { reason: 'challenge_not_found' },
      });
      res.status(401).json({ error: 'Administrative wallet challenge is invalid' });
      return;
    }

    if (challenge.did !== providerDidForUser(adminUser.id)) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 403,
        metadata: { reason: 'challenge_actor_mismatch', challengeId },
      });
      res.status(403).json({ error: 'Administrative wallet challenge does not belong to the configured admin' });
      return;
    }

    if (challenge.usedAt) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 409,
        metadata: { reason: 'challenge_replayed', challengeId },
      });
      res.status(409).json({ error: 'Administrative wallet challenge has already been used' });
      return;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 401,
        metadata: { reason: 'challenge_expired', challengeId },
      });
      res.status(401).json({ error: 'Administrative wallet challenge expired' });
      return;
    }

    if (message !== challenge.statement) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 400,
        metadata: { reason: 'message_mismatch', challengeId },
      });
      res.status(400).json({ error: 'Administrative wallet message does not match the challenge' });
      return;
    }

    const parsed = parseProviderSiweMessage(message);
    const messageWalletAddress = normalizeWalletAddress(parsed.address);
    if (!messageWalletAddress || parsed.nonce !== challenge.nonce) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 400,
        metadata: { reason: 'invalid_siwe_message', challengeId },
      });
      res.status(400).json({ error: 'Administrative wallet message is invalid' });
      return;
    }

    if (
      messageWalletAddress !== configuredWalletAddress ||
      (submittedWalletAddress && submittedWalletAddress !== messageWalletAddress)
    ) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 403,
        metadata: { reason: 'admin_wallet_mismatch', challengeId },
      });
      res.status(403).json({ error: 'Signed wallet does not match configured Administrative Access wallet' });
      return;
    }

    let recoveredAddress: string | null = null;
    try {
      recoveredAddress = normalizeWalletAddress(ethers.verifyMessage(message, signature));
    } catch {
      recoveredAddress = null;
    }
    if (!recoveredAddress || recoveredAddress !== messageWalletAddress) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 401,
        metadata: { reason: 'invalid_signature', challengeId },
      });
      res.status(401).json({ error: 'Administrative wallet signature is invalid' });
      return;
    }

    const consumed = await localStore.consumeProviderChallenge(challengeId);
    if (!consumed) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'admin_wallet_verify',
        outcome: 'deny',
        actorUserId: adminUser.id,
        statusCode: 409,
        metadata: { reason: 'challenge_replayed', challengeId },
      });
      res.status(409).json({ error: 'Administrative wallet challenge has already been used' });
      return;
    }

    const persistedSession = await createUserSession(adminUser.id);
    const authSession = createSessionToken(adminUser.id, {
      sessionId: persistedSession.id,
      expiresAt: persistedSession.expiresAt.getTime(),
    });
    const providerSession = await createNativeProviderSessionPayload(req, adminUser.id, 'admin');

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_verify',
      outcome: 'success',
      actorUserId: adminUser.id,
      targetUserId: adminUser.id,
      statusCode: 200,
      metadata: {
        challengeId,
        authSessionId: persistedSession.id,
        providerSessionId: providerSession.session.id,
        scopesCount: providerSession.session.scopes.length,
      },
    });

    res.json({
      success: true,
      walletVerified: true,
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: toAdminAuthUserPayload(adminUser),
      providerControl: {
        token: providerSession.token.token,
        expiresAt: providerSession.token.expiresAt,
        session: {
          id: providerSession.session.id,
          did: providerSession.session.did,
          scopes: providerSession.session.scopes,
          issuedAt: providerSession.session.issuedAt,
          expiresAt: providerSession.session.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error('[ProviderAuth] admin wallet verification failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'admin_wallet_verify',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Administrative wallet verification failed' });
  }
});

/**
 * POST /api/provider/auth/wallet/nonce
 * Issues a short-lived SIWE-style provider wallet challenge after provider email/password sign-in.
 */
router.post('/wallet/nonce', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);
  if (!actorUserId || role !== 'provider') {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_nonce',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: { reason: 'provider_role_required', role },
    });
    res.status(403).json({ error: 'Approved provider access is required' });
    return;
  }

  const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
  if (!walletAddress) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_nonce',
      outcome: 'deny',
      actorUserId,
      statusCode: 400,
      metadata: { reason: 'invalid_wallet_address' },
    });
    res.status(400).json({ error: 'Valid walletAddress is required' });
    return;
  }

  try {
    const match = await resolveApprovedProviderByWallet(actorUserId, walletAddress);
    if (!match.user) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_nonce',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: { reason: match.reason || 'provider_wallet_not_approved' },
      });
      res.status(403).json({
        error: 'This wallet is not approved for the signed-in provider account',
        code: 'PROVIDER_WALLET_NOT_APPROVED',
      });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + getWalletChallengeTtlMs());
    const uri = resolveProviderWalletUri(req);
    const fields: ProviderSiweFields = {
      domain: domainFromUri(uri),
      address: walletAddress,
      statement: PROVIDER_WALLET_STATEMENT,
      uri,
      version: SIWE_VERSION,
      chainId: getProviderWalletChainId(),
      nonce: crypto.randomBytes(16).toString('hex'),
      issuedAt: now.toISOString(),
      expirationTime: expiresAt.toISOString(),
    };
    const message = buildProviderSiweMessage(fields);
    const challengeId = crypto.randomUUID();

    await localStore.createProviderChallenge({
      id: challengeId,
      did: providerDidForUser(actorUserId),
      nonce: fields.nonce,
      statement: message,
      expiresAt,
      createdAt: now,
    });

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_nonce',
      outcome: 'success',
      actorUserId,
      targetUserId: actorUserId,
      statusCode: 200,
      metadata: { challengeId, chainId: fields.chainId },
    });

    res.json({
      success: true,
      challengeId,
      ...fields,
    });
  } catch (error) {
    console.error('[ProviderAuth] provider wallet nonce failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_nonce',
      outcome: 'error',
      actorUserId,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Provider wallet challenge could not be created' });
  }
});

/**
 * POST /api/provider/auth/wallet/verify
 * Consumes a provider SIWE-style challenge and creates the native provider session.
 */
router.post('/wallet/verify', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const actorUserId = getAuthenticatedUserId(req);
  const role = getAuthenticatedRole(req);
  if (!actorUserId || role !== 'provider') {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_verify',
      outcome: 'deny',
      actorUserId,
      statusCode: 403,
      metadata: { reason: 'provider_role_required', role },
    });
    res.status(403).json({ error: 'Approved provider access is required' });
    return;
  }

  const challengeId = String(req.body?.challengeId || '').trim();
  const message = String(req.body?.message || '');
  const signature = String(req.body?.signature || '').trim();
  const submittedWalletAddress = normalizeWalletAddress(req.body?.walletAddress);
  if (!challengeId || !message || !signature) {
    res.status(400).json({ error: 'challengeId, message, and signature are required' });
    return;
  }

  try {
    const challenge = await localStore.getProviderChallengeById(challengeId);
    if (!challenge) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 401,
        metadata: { reason: 'challenge_not_found' },
      });
      res.status(401).json({ error: 'Wallet verification challenge is invalid' });
      return;
    }

    if (challenge.did !== providerDidForUser(actorUserId)) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: { reason: 'challenge_actor_mismatch', challengeId },
      });
      res.status(403).json({ error: 'Wallet verification challenge does not belong to this provider' });
      return;
    }

    if (challenge.usedAt) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 409,
        metadata: { reason: 'challenge_replayed', challengeId },
      });
      res.status(409).json({ error: 'Wallet verification challenge has already been used' });
      return;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 401,
        metadata: { reason: 'challenge_expired', challengeId },
      });
      res.status(401).json({ error: 'Wallet verification challenge expired' });
      return;
    }

    if (message !== challenge.statement) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 400,
        metadata: { reason: 'message_mismatch', challengeId },
      });
      res.status(400).json({ error: 'Wallet verification message does not match the challenge' });
      return;
    }

    const parsed = parseProviderSiweMessage(message);
    const messageWalletAddress = normalizeWalletAddress(parsed.address);
    if (!messageWalletAddress || parsed.nonce !== challenge.nonce) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 400,
        metadata: { reason: 'invalid_siwe_message', challengeId },
      });
      res.status(400).json({ error: 'Wallet verification message is invalid' });
      return;
    }

    if (submittedWalletAddress && submittedWalletAddress !== messageWalletAddress) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 400,
        metadata: { reason: 'submitted_wallet_mismatch', challengeId },
      });
      res.status(400).json({ error: 'Submitted wallet does not match signed message' });
      return;
    }

    let recoveredAddress: string | null = null;
    try {
      recoveredAddress = normalizeWalletAddress(ethers.verifyMessage(message, signature));
    } catch {
      recoveredAddress = null;
    }
    if (!recoveredAddress || recoveredAddress !== messageWalletAddress) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 401,
        metadata: { reason: 'invalid_signature', challengeId },
      });
      res.status(401).json({ error: 'Wallet signature is invalid' });
      return;
    }

    const match = await resolveApprovedProviderByWallet(actorUserId, messageWalletAddress);
    if (!match.user) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 403,
        metadata: { reason: match.reason || 'provider_wallet_not_approved', challengeId },
      });
      res.status(403).json({
        error: 'This wallet is not approved for the signed-in provider account',
        code: 'PROVIDER_WALLET_NOT_APPROVED',
      });
      return;
    }

    const consumed = await localStore.consumeProviderChallenge(challengeId);
    if (!consumed) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_wallet_verify',
        outcome: 'deny',
        actorUserId,
        statusCode: 409,
        metadata: { reason: 'challenge_replayed', challengeId },
      });
      res.status(409).json({ error: 'Wallet verification challenge has already been used' });
      return;
    }

    const providerSession = await createNativeProviderSessionPayload(req, actorUserId, role);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_verify',
      outcome: 'success',
      actorUserId,
      targetUserId: actorUserId,
      statusCode: 200,
      metadata: {
        challengeId,
        providerSessionId: providerSession.session.id,
        authSessionId: providerSession.authSessionId,
        scopesCount: providerSession.session.scopes.length,
      },
    });

    res.json({
      success: true,
      walletVerified: true,
      token: providerSession.token.token,
      expiresAt: providerSession.token.expiresAt,
      session: {
        id: providerSession.session.id,
        did: providerSession.session.did,
        scopes: providerSession.session.scopes,
        issuedAt: providerSession.session.issuedAt,
        expiresAt: providerSession.session.expiresAt,
      },
    });
  } catch (error) {
    console.error('[ProviderAuth] provider wallet verification failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_wallet_verify',
      outcome: 'error',
      actorUserId,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Provider wallet verification failed' });
  }
});

export default router;
