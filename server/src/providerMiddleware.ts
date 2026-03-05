import { NextFunction, Request, Response } from 'express';
import { verifyProviderSessionToken } from './auth/providerToken';
import { getProviderSessionById } from './services/providerSessionStore';
import { localStore } from './services/persistenceStore';

export interface ProviderAuthenticatedRequest extends Request {
  providerDid?: string;
  providerSessionId?: string;
  providerScopes?: string[];
  providerUserId?: string;
  providerRole?: 'provider' | 'admin';
}

const denyProviderRequest = (res: Response, error: string): void => {
  res.status(401).json({ error });
};

const PROVIDER_DID_PREFIX = 'provider:';

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

    const providerDid = String(session.did || '').trim();
    if (!providerDid.startsWith(PROVIDER_DID_PREFIX)) {
      denyProviderRequest(res, 'Provider session is not bridge-bound');
      return;
    }

    const providerUserId = providerDid.slice(PROVIDER_DID_PREFIX.length).trim();
    if (!providerUserId) {
      denyProviderRequest(res, 'Provider session missing canonical user binding');
      return;
    }

    const providerUser = await localStore.getUserById(providerUserId);
    if (!providerUser) {
      denyProviderRequest(res, 'Provider user not found');
      return;
    }

    const normalizedRole = String(providerUser.role || 'user').trim().toLowerCase();
    if (normalizedRole !== 'provider' && normalizedRole !== 'admin') {
      denyProviderRequest(res, 'Provider role required');
      return;
    }

    const providerReq = req as ProviderAuthenticatedRequest;
    providerReq.providerDid = providerDid;
    providerReq.providerSessionId = session.id;
    providerReq.providerScopes = session.scopes;
    providerReq.providerUserId = providerUserId;
    providerReq.providerRole = normalizedRole as 'provider' | 'admin';
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
