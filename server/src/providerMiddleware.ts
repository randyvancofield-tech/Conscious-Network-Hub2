import { NextFunction, Request, Response } from 'express';
import { verifyProviderSessionToken } from './auth/providerToken';
import { getProviderSessionById } from './services/providerSessionStore';

export interface ProviderAuthenticatedRequest extends Request {
  providerDid?: string;
  providerSessionId?: string;
  providerScopes?: string[];
}

const denyProviderRequest = (res: Response, error: string): void => {
  res.status(401).json({ error });
};

export const requireProviderSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    denyProviderRequest(res, 'Provider authentication required');
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyProviderSessionToken(token);
  if (!payload) {
    denyProviderRequest(res, 'Invalid or expired provider session');
    return;
  }

  try {
    const session = await getProviderSessionById(payload.sessionId);
    if (!session) {
      denyProviderRequest(res, 'Provider session not found');
      return;
    }

    if (session.revokedAt) {
      denyProviderRequest(res, 'Provider session revoked');
      return;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      denyProviderRequest(res, 'Provider session expired');
      return;
    }

    if (session.did !== payload.did) {
      denyProviderRequest(res, 'Provider identity mismatch');
      return;
    }

    const providerReq = req as ProviderAuthenticatedRequest;
    providerReq.providerDid = session.did;
    providerReq.providerSessionId = session.id;
    providerReq.providerScopes = session.scopes;
    next();
  } catch (error) {
    console.error('[ProviderAuth] session verification failed', error);
    res.status(500).json({ error: 'Provider session verification failed' });
  }
};

export const requireProviderScope =
  (requiredScope: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const providerReq = req as ProviderAuthenticatedRequest;
    const scopes = providerReq.providerScopes || [];
    if (scopes.includes(requiredScope) || scopes.includes('provider:*')) {
      next();
      return;
    }

    res.status(403).json({ error: `Provider scope required: ${requiredScope}` });
  };

