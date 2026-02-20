import { Request, Response, Router } from 'express';
import { ProviderAuthenticatedRequest, requireProviderSession } from '../providerMiddleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { revokeProviderSession } from '../services/providerSessionStore';

const router = Router();
router.use(requireProviderSession);

/**
 * GET /api/provider/session/current
 * Returns current provider identity and session claims.
 */
router.get('/current', (req: Request, res: Response): void => {
  const providerReq = req as ProviderAuthenticatedRequest;
  res.json({
    success: true,
    did: providerReq.providerDid,
    sessionId: providerReq.providerSessionId,
    scopes: providerReq.providerScopes || [],
  });
});

/**
 * POST /api/provider/session/revoke
 * Revokes the currently authenticated provider session.
 */
router.post('/revoke', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const sessionId = providerReq.providerSessionId;
  if (!sessionId) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'deny',
      targetUserId: providerReq.providerDid || null,
      statusCode: 400,
      metadata: { reason: 'missing_provider_session_context' },
    });
    res.status(400).json({ error: 'Provider session not found on request context' });
    return;
  }

  try {
    await revokeProviderSession(sessionId);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'success',
      targetUserId: providerReq.providerDid || null,
      statusCode: 200,
      metadata: { sessionId },
    });
    res.json({ success: true, revokedSessionId: sessionId });
  } catch (error) {
    console.error('[ProviderAuth] failed to revoke provider session', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'error',
      targetUserId: providerReq.providerDid || null,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Failed to revoke provider session' });
  }
});

export default router;
