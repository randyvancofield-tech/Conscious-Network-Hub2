import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createSessionToken, hashPassword } from '../auth';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  logIdentityValidationFailure,
  requireCanonicalIdentity,
} from '../middleware';
import { mirrorUserToGoogleSheets } from '../services/googleSheetsMirror';
import { normalizeTier } from '../tierPolicy';

const router = Router();
let prismaInstance: PrismaClient | null = null;

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`;
}

function absolutizeUrl(req: Request, url?: string | null): string | null | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${getPublicBaseUrl(req)}${path}`;
}

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

const toIdentityName = (email: string): string =>
  email.split('@')[0]?.trim() || 'Node';

const toPublicUser = (req: Request, user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || toIdentityName(user.email),
  tier: normalizeTier(user.tier),
  subscriptionStatus: user.subscriptionStatus,
  subscriptionStartDate: user.subscriptionStartDate,
  subscriptionEndDate: user.subscriptionEndDate,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  profileBackgroundVideo: absolutizeUrl(req, user.profileBackgroundVideo),
});

/**
 * POST /api/user/signin
 * Authenticate an existing user with canonical backend identity.
 */
router.post('/signin', async (req: Request, res: Response): Promise<any> => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const providedHash = hashPassword(password);
    const passwordMatches = providedHash === user.password || password === user.password;
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Opportunistic migration for legacy plain-text records.
    if (password === user.password && providedHash !== user.password) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: providedHash },
      });
    }

    const session = createSessionToken(user.id);
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: toPublicUser(req, user),
    });
  } catch (error) {
    console.error('Error signing in user:', error);
    return res.status(500).json({ error: 'Failed to sign in user' });
  }
});

/**
 * POST /api/user/create
 * Create a new canonical user profile in the database.
 */
router.post('/create', async (req: Request, res: Response): Promise<any> => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const requestedName = String(req.body?.name || '').trim();
    const prisma = getPrismaClient();

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email or password' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const name = requestedName || toIdentityName(email);
    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
        tier: normalizeTier(req.body?.tier),
      },
    });

    // Persistence verification before granting hub access.
    const persisted = await prisma.user.findUnique({ where: { id: user.id } });
    if (!persisted) {
      return res
        .status(500)
        .json({ error: 'User persistence verification failed after database write' });
    }

    await mirrorUserToGoogleSheets({
      userId: persisted.id,
      email: persisted.email,
      name: persisted.name || toIdentityName(persisted.email),
      tier: persisted.tier,
      createdAt: persisted.createdAt.toISOString(),
    });

    const session = createSessionToken(persisted.id);

    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      persistenceVerified: true,
      user: toPublicUser(req, persisted),
    });
  } catch (error) {
    const prismaError = error as { code?: string } | null;
    if (prismaError?.code === 'P2002') {
      return res.status(409).json({ error: 'A profile with this email already exists' });
    }
    console.error('Error creating user profile:', error);
    return res.status(500).json({ error: 'Failed to create user profile' });
  }
});

/**
 * GET /api/user/current
 * Return canonical authenticated user identity.
 */
router.get('/current', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      logIdentityValidationFailure(req, 'missing_auth_user_after_identity_middleware');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: authUserId } });
    if (!user) {
      logIdentityValidationFailure(req, 'authenticated_user_not_found', { authUserId });
      return res.status(401).json({ error: 'Invalid session user' });
    }

    return res.json({
      success: true,
      user: toPublicUser(req, user),
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

/**
 * GET /api/user/reconcile/:id
 * Reconciliation endpoint for canonical identity/tier/created timestamp.
 */
router.get('/reconcile/:id', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const requestedId = req.params.id;
    if (!enforceAuthenticatedUserMatch(req, res, requestedId, 'params.id')) {
      return;
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: requestedId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      canonicalUserId: user.id,
      tier: normalizeTier(user.tier),
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error reconciling user:', error);
    return res.status(500).json({ error: 'Failed to reconcile user' });
  }
});

/**
 * GET /api/user/directory
 * Basic directory for authenticated hub users.
 */
router.get('/directory', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: {
        id: true,
        name: true,
        tier: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      users: users.map((u: { id: string; name: string | null; tier: string; createdAt: Date }) => ({
        id: u.id,
        name: u.name || 'Node',
        tier: normalizeTier(u.tier),
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error loading user directory:', error);
    return res.status(500).json({ error: 'Failed to load user directory' });
  }
});

/**
 * PUT /api/user/:id
 * Edit user profile (including background video).
 * Requires canonical identity match with user ID.
 */
router.put('/:id', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, id, 'params.id')) {
      return;
    }

    const prisma = getPrismaClient();
    const updateData = req.body || {};

    // Only allow profile-safe fields that exist in current Prisma model.
    const allowedFields = ['name', 'profileBackgroundVideo'];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) data[key] = updateData[key];
    }

    // Database write first, then return canonical record.
    await prisma.user.update({
      where: { id },
      data,
    });
    const persisted = await prisma.user.findUnique({ where: { id } });
    if (!persisted) {
      return res.status(404).json({ error: 'User not found after update' });
    }

    return res.json({
      success: true,
      user: toPublicUser(req, persisted),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

export default router;
