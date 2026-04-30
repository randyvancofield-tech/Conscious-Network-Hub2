import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';
import { recordAuditEvent } from '../services/auditTelemetry';

const router = Router();

const legacyBridgeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bridge authentication rate limit exceeded. Retry later.' },
});

router.post('/bridge', legacyBridgeLimiter, (req: Request, res: Response): void => {
  recordAuditEvent(req, {
    domain: 'auth',
    action: 'base44_bridge_auth_legacy',
    outcome: 'deny',
    statusCode: 410,
    metadata: {
      reason: 'legacy_bridge_disabled',
      canonicalEndpoint: '/api/bridge/provider/issue-launch-code',
    },
  });

  res.status(410).json({
    error: 'Legacy provider bridge disabled. Use the launch-code provider bridge.',
    canonicalEndpoint: '/api/bridge/provider/issue-launch-code',
    callbackPattern: '/auth/callback?launchCode=<code>',
  });
});

export default router;
