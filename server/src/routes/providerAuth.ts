import { Request, Response, Router } from 'express';
import { createProviderSessionToken } from '../auth/providerToken';
import { recordAuditEvent } from '../services/auditTelemetry';
import {
  buildDidFromPublicKey,
  isDidBoundToPublicKey,
  isDidFormatSupported,
  verifyDidChallengeSignature,
} from '../services/providerDid';
import {
  createProviderChallenge,
  createProviderSession,
  getProviderChallengeById,
  markProviderChallengeUsed,
} from '../services/providerSessionStore';

const router = Router();

const sanitizeScopes = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return ['provider:read'];
  const scopes = raw
    .filter((scope): scope is string => typeof scope === 'string')
    .map((scope) => scope.trim().toLowerCase())
    .filter((scope) => /^provider:[a-z0-9:*_-]+$/.test(scope))
    .slice(0, 12);

  return scopes.length > 0 ? scopes : ['provider:read'];
};

/**
 * POST /api/provider/auth/challenge
 * Body: { did: string }
 */
router.post('/challenge', async (req: Request, res: Response): Promise<void> => {
  try {
    const did = String(req.body?.did || '').trim();
    if (!did) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_challenge_create',
        outcome: 'deny',
        statusCode: 400,
        metadata: { reason: 'missing_did' },
      });
      res.status(400).json({ error: 'Missing did' });
      return;
    }

    if (!isDidFormatSupported(did)) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_challenge_create',
        outcome: 'deny',
        statusCode: 400,
        metadata: { reason: 'unsupported_did_format' },
      });
      res.status(400).json({
        error: 'Unsupported DID format. Expected did:hcn:ed25519:<fingerprint>.',
      });
      return;
    }

    const challenge = await createProviderChallenge(did);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_challenge_create',
      outcome: 'success',
      targetUserId: did,
      statusCode: 200,
    });
    res.json({
      success: true,
      did: challenge.did,
      challengeId: challenge.id,
      statement: challenge.statement,
      expiresAt: challenge.expiresAt,
      algorithm: 'ed25519',
    });
  } catch (error) {
    console.error('[ProviderAuth] challenge generation failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_challenge_create',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Failed to create provider challenge' });
  }
});

/**
 * POST /api/provider/auth/verify
 * Body: { challengeId, did, publicKeyPem, signature, scopes? }
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const challengeId = String(req.body?.challengeId || '').trim();
    const did = String(req.body?.did || '').trim();
    const publicKeyPem = String(req.body?.publicKeyPem || '').trim();
    const signature = String(req.body?.signature || '').trim();

    if (!challengeId || !did || !publicKeyPem || !signature) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did || null,
        statusCode: 400,
        metadata: { reason: 'missing_required_fields' },
      });
      res.status(400).json({
        error: 'Missing required fields: challengeId, did, publicKeyPem, signature',
      });
      return;
    }

    const challenge = await getProviderChallengeById(challengeId);
    if (!challenge) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 404,
        metadata: { reason: 'challenge_not_found' },
      });
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.did !== did) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 403,
        metadata: { reason: 'challenge_did_mismatch' },
      });
      res.status(403).json({ error: 'Challenge DID mismatch' });
      return;
    }

    if (challenge.usedAt) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 409,
        metadata: { reason: 'challenge_already_used' },
      });
      res.status(409).json({ error: 'Challenge already used' });
      return;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 410,
        metadata: { reason: 'challenge_expired' },
      });
      res.status(410).json({ error: 'Challenge expired' });
      return;
    }

    if (!isDidBoundToPublicKey(did, publicKeyPem)) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 403,
        metadata: { reason: 'did_public_key_mismatch' },
      });
      res.status(403).json({
        error: 'DID does not match supplied publicKeyPem fingerprint',
      });
      return;
    }

    const signatureValid = verifyDidChallengeSignature(challenge.statement, signature, publicKeyPem);
    if (!signatureValid) {
      recordAuditEvent(req, {
        domain: 'auth',
        action: 'provider_verify',
        outcome: 'deny',
        targetUserId: did,
        statusCode: 401,
        metadata: { reason: 'invalid_signature' },
      });
      res.status(401).json({ error: 'Invalid challenge signature' });
      return;
    }

    await markProviderChallengeUsed(challenge.id);

    const scopes = sanitizeScopes(req.body?.scopes);
    const session = await createProviderSession(did, scopes);
    const token = createProviderSessionToken(session.id, session.did, session.scopes);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_verify',
      outcome: 'success',
      targetUserId: did,
      statusCode: 200,
      metadata: {
        sessionId: session.id,
        scopesCount: session.scopes.length,
      },
    });

    res.json({
      success: true,
      token: token.token,
      expiresAt: token.expiresAt,
      session: {
        id: session.id,
        did: session.did,
        scopes: session.scopes,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('[ProviderAuth] verification failed', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_verify',
      outcome: 'error',
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Provider verification failed' });
  }
});

/**
 * POST /api/provider/auth/derive-did
 * Body: { publicKeyPem }
 */
router.post('/derive-did', (req: Request, res: Response): void => {
  const publicKeyPem = String(req.body?.publicKeyPem || '').trim();
  if (!publicKeyPem) {
    res.status(400).json({ error: 'Missing publicKeyPem' });
    return;
  }

  try {
    res.json({
      did: buildDidFromPublicKey(publicKeyPem),
      method: 'did:hcn:ed25519',
    });
  } catch {
    res.status(400).json({ error: 'Invalid public key format' });
  }
});

export default router;
