import jwt from 'jsonwebtoken';
import { resolveAuthTokenSecret } from '../requiredEnv';

export interface IdentitySessionPayload {
  sub: string;
  address: string;
  chainId: number;
  did: string;
  legacyDid?: string | null;
  verifiedAt: string;
  iat?: number;
  exp?: number;
}

const getIdentitySessionSecret = (): string => {
  return (
    String(process.env.IDENTITY_SESSION_SECRET || '').trim() ||
    String(process.env.WALLET_SESSION_SECRET || '').trim() ||
    resolveAuthTokenSecret()
  );
};

export const verifyIdentitySessionToken = (token: string): IdentitySessionPayload | null => {
  const raw = String(token || '').trim();
  if (!raw) return null;

  try {
    const payload = jwt.verify(raw, getIdentitySessionSecret(), {
      issuer: 'hcn-identity',
      audience: 'hcn-identity-session',
    }) as Partial<IdentitySessionPayload>;

    const sub = String(payload.sub || '').trim();
    const address = String(payload.address || '').trim();
    const did = String(payload.did || '').trim();
    const chainId = Number(payload.chainId);
    const verifiedAt = String(payload.verifiedAt || '').trim();
    if (!sub || !address || !did || !Number.isFinite(chainId) || !verifiedAt) {
      return null;
    }

    return {
      sub,
      address,
      did,
      chainId: Math.floor(chainId),
      legacyDid: payload.legacyDid || null,
      verifiedAt,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
};
