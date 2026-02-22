import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from './auth';
import { getUserSessionById } from './services/userSessionStore';
import { hasTierAccess, TierValue } from './tierPolicy';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
  authSessionId?: string;
  authTier?: string;
}

/**
 * Input validation middleware
 */
export function validateChatInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { message, conversationId, context } = req.body;

  // Validate message exists and is a string
  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid input: message is required and must be a string',
    });
    return;
  }

  // Validate message length (prevent excessively long inputs)
  if (message.length === 0 || message.length > 5000) {
    res.status(400).json({
      error: 'Invalid input: message must be between 1 and 5000 characters',
    });
    return;
  }

  // Validate conversationId if provided
  if (conversationId && typeof conversationId !== 'string') {
    res.status(400).json({
      error: 'Invalid input: conversationId must be a string',
    });
    return;
  }

  // Validate context if provided
  if (context && typeof context !== 'object') {
    res.status(400).json({
      error: 'Invalid input: context must be an object',
    });
    return;
  }

  // Sanitize message (basic XSS prevention)
  (req.body as any).message = sanitizeInput(message);

  next();
}

function getRequestIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function logIdentityValidationFailure(
  req: Request,
  reason: string,
  metadata?: Record<string, unknown>
): void {
  console.warn('[AUTH][DENY]', JSON.stringify({
    timestamp: new Date().toISOString(),
    reason,
    method: req.method,
    path: req.path,
    ip: getRequestIp(req),
    origin: req.headers.origin || null,
    userAgent: req.headers['user-agent'] || null,
    ...metadata,
  }));
}

export function requireCanonicalIdentity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return (async (): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logIdentityValidationFailure(req, 'missing_or_invalid_authorization_header');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload = verifySessionToken(token);
    if (!payload) {
      logIdentityValidationFailure(req, 'invalid_or_expired_session_token');
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    const enforcePersistedUserSessions =
      nodeEnv !== 'test' &&
      String(process.env.ENFORCE_PERSISTED_USER_SESSIONS || 'true').trim().toLowerCase() !==
        'false';
    if (enforcePersistedUserSessions && !payload.sessionId) {
      logIdentityValidationFailure(req, 'session_id_missing');
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    if (payload.sessionId) {
      const persistedSession = await getUserSessionById(payload.sessionId);
      if (!persistedSession) {
        logIdentityValidationFailure(req, 'session_not_found', {
          userId: payload.userId,
          sessionId: payload.sessionId,
        });
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      if (
        persistedSession.userId !== payload.userId ||
        persistedSession.revokedAt ||
        persistedSession.expiresAt.getTime() <= Date.now()
      ) {
        logIdentityValidationFailure(req, 'session_invalid', {
          userId: payload.userId,
          sessionId: payload.sessionId,
        });
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      authReq.authSessionId = persistedSession.id;
    }

    authReq.authUserId = payload.userId;
    next();
  })().catch((error) => {
    console.error('[AUTH][ERROR] Failed to validate canonical identity', error);
    res.status(500).json({ error: 'Failed to validate session' });
  });
}

export const getAuthenticatedUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.authUserId || null;
};

export const getAuthenticatedSessionId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.authSessionId || null;
};

export const enforceAuthenticatedUserMatch = (
  req: Request,
  res: Response,
  userIdToMatch: string | null | undefined,
  sourceLabel: string
): boolean => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId || !userIdToMatch || authUserId !== userIdToMatch) {
    logIdentityValidationFailure(req, 'canonical_user_mismatch', {
      authUserId,
      userIdToMatch,
      sourceLabel,
    });
    res.status(403).json({ error: 'Forbidden: canonical user mismatch' });
    return false;
  }
  return true;
};

export const enforceTierAccess = (
  req: Request,
  res: Response,
  minimumTier: TierValue
): boolean => {
  const authReq = req as AuthenticatedRequest;
  if (!hasTierAccess(authReq.authTier, minimumTier)) {
    logIdentityValidationFailure(req, 'tier_access_denied', {
      authTier: authReq.authTier || null,
      minimumTier,
    });
    res.status(403).json({ error: `Tier access denied. Requires ${minimumTier}` });
    return false;
  }
  return true;
};

/**
 * Basic input sanitization to prevent XSS
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

/**
 * Health check endpoint
 */
export function healthCheck(_req: Request, res: Response): void {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
