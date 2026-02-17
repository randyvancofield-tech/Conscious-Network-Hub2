import { Request, Response, Router } from 'express';
import { createProviderSessionToken } from '../auth/providerToken';
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
      res.status(400).json({ error: 'Missing did' });
      return;
    }

    if (!isDidFormatSupported(did)) {
      res.status(400).json({
        error: 'Unsupported DID format. Expected did:hcn:ed25519:<fingerprint>.',
      });
      return;
    }

    const challenge = await createProviderChallenge(did);
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
      res.status(400).json({
        error: 'Missing required fields: challengeId, did, publicKeyPem, signature',
      });
      return;
    }

    const challenge = await getProviderChallengeById(challengeId);
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.did !== did) {
      res.status(403).json({ error: 'Challenge DID mismatch' });
      return;
    }

    if (challenge.usedAt) {
      res.status(409).json({ error: 'Challenge already used' });
      return;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      res.status(410).json({ error: 'Challenge expired' });
      return;
    }

    if (!isDidBoundToPublicKey(did, publicKeyPem)) {
      res.status(403).json({
        error: 'DID does not match supplied publicKeyPem fingerprint',
      });
      return;
    }

    const signatureValid = verifyDidChallengeSignature(challenge.statement, signature, publicKeyPem);
    if (!signatureValid) {
      res.status(401).json({ error: 'Invalid challenge signature' });
      return;
    }

    await markProviderChallengeUsed(challenge.id);

    const scopes = sanitizeScopes(req.body?.scopes);
    const session = await createProviderSession(did, scopes);
    const token = createProviderSessionToken(session.id, session.did, session.scopes);

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

