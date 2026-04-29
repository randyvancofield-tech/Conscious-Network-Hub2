import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';
import { ethers } from 'ethers';
import { createBridgeAuthToken } from '../auth';
import { recordAuditEvent } from '../services/auditTelemetry';
import { upsertBridgeProviderUser } from '../services/bridgeProviderUser';

const router = Router();

const BASE44_PROVIDER_VERIFY_MESSAGE = 'Verify provider access to Conscious Network Hub';
const bridgeAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bridge authentication rate limit exceeded. Retry later.' },
});

type BridgeRole = 'provider' | 'admin';

const normalizeRequiredString = (value: unknown): string => String(value || '').trim();

const normalizeEmail = (value: unknown): string =>
  normalizeRequiredString(value).toLowerCase();

const normalizeRole = (value: unknown): BridgeRole | null => {
  const normalized = normalizeRequiredString(value).toLowerCase();
  return normalized === 'provider' || normalized === 'admin' ? normalized : null;
};

const normalizeWalletAddress = (value: unknown): string | null => {
  const raw = normalizeRequiredString(value);
  if (!raw) return null;
  try {
    return ethers.getAddress(raw);
  } catch {
    return null;
  }
};

router.post('/bridge', bridgeAuthLimiter, async (req: Request, res: Response): Promise<void> => {
  const id = normalizeRequiredString(req.body?.id);
  const email = normalizeEmail(req.body?.email);
  const role = normalizeRole(req.body?.role);
  const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
  const signature = normalizeRequiredString(req.body?.signature);

  const deny = (
    statusCode: number,
    reason: string,
    metadata?: Record<string, unknown>
  ): void => {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'base44_bridge_auth',
      outcome: statusCode >= 500 ? 'error' : 'deny',
      statusCode,
      metadata: {
        reason,
        providerExternalId: id || null,
        role: role || normalizeRequiredString(req.body?.role) || null,
        ...metadata,
      },
    });
    res.status(statusCode).json({ error: reason });
  };

  if (!id || !email || !walletAddress || !signature) {
    deny(400, 'Missing required bridge fields');
    return;
  }

  if (!role) {
    deny(403, 'Invalid bridge role');
    return;
  }

  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.getAddress(
      ethers.verifyMessage(BASE44_PROVIDER_VERIFY_MESSAGE, signature)
    );
  } catch {
    deny(401, 'Invalid signature');
    return;
  }

  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    deny(401, 'Invalid signature');
    return;
  }

  try {
    const user = await upsertBridgeProviderUser({
      providerExternalId: id,
      email,
      role,
      walletDid: walletAddress,
    });

    if (!user) {
      deny(500, 'Failed to establish provider identity');
      return;
    }

    const token = createBridgeAuthToken({
      sub: id,
      userId: user.id,
      email,
      role,
      walletAddress,
    });

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'base44_bridge_auth',
      outcome: 'success',
      actorUserId: user.id,
      targetUserId: user.id,
      statusCode: 200,
      metadata: {
        providerExternalId: id,
        role,
      },
    });

    res.json({ token });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.message.includes('Bridge identity conflict')) {
      deny(409, 'Bridge identity conflict');
      return;
    }
    if (err.code === 'STORE_UNAVAILABLE') {
      deny(503, 'Profile service is currently unavailable');
      return;
    }

    console.error('[AUTH][BRIDGE][ERROR] Failed to complete Base44 bridge auth', error);
    deny(500, 'Failed to complete bridge authentication');
  }
});

export default router;
