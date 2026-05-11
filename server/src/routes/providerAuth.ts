import { Request, Response, Router } from 'express';
import { createProviderSessionToken } from '../auth/providerToken';
import {
  AuthenticatedRequest,
  getAuthenticatedRole,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { createProviderSession } from '../services/providerSessionStore';

const router = Router();

const NATIVE_PROVIDER_SCOPES = ['provider:read', 'provider:host'];

/**
 * POST /api/provider/auth/session
 * Creates a short-lived provider control session from the caller's canonical CNH auth session.
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

  try {
    const did = `provider:${actorUserId}`;
    const scopes = role === 'admin' ? ['provider:*'] : NATIVE_PROVIDER_SCOPES;
    const session = await createProviderSession(did, scopes);
    const token = createProviderSessionToken(session.id, session.did, session.scopes);
    const authReq = req as AuthenticatedRequest;

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_native_session_create',
      outcome: 'success',
      actorUserId,
      targetUserId: actorUserId,
      statusCode: 200,
      metadata: {
        providerSessionId: session.id,
        role,
        authSessionId: authReq.authSessionId || null,
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

export default router;
