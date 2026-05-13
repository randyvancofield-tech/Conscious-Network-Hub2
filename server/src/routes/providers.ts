import { Router, Request, Response } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import { isProviderAccessActive } from '../services/providerAccess';
import { normalizeProfileMedia } from '../services/profileNormalization';

const providersRouter = Router();
const userRequestsRouter = Router();
const providerRequestsRouter = Router();

const validRequestStatuses = new Set(['pending', 'accepted', 'scheduled', 'closed']);

const getPublicBaseUrl = (req: Request): string => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`;
};

const absolutizeUrl = (req: Request, value: unknown): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${getPublicBaseUrl(req)}${path}`;
};

const absolutizeProfileMedia = (req: Request, user: any) => {
  const normalized = normalizeProfileMedia(
    user?.profileMedia,
    user?.avatarUrl || null,
    user?.bannerUrl || null
  );
  return {
    avatar: {
      ...normalized.avatar,
      url: absolutizeUrl(req, normalized.avatar.url),
    },
    cover: {
      ...normalized.cover,
      url: absolutizeUrl(req, normalized.cover.url),
    },
  };
};

const toProviderResponse = (req: Request, user: any) => ({
  id: user.id,
  name: user.name || (user.role === 'provider' ? 'Verified Provider' : 'Member'),
  role: user.role,
  handle: user.handle || null,
  bio: user.bio || '',
  location: user.location || '',
  avatarUrl: absolutizeUrl(req, user.avatarUrl) || '',
  bannerUrl: absolutizeUrl(req, user.bannerUrl) || '',
  profileMedia: absolutizeProfileMedia(req, user),
  profileBackgroundVideo: absolutizeUrl(req, user.profileBackgroundVideo) || '',
  interests: Array.isArray(user.interests) ? user.interests : [],
  websiteUrl: user.websiteUrl || '',
  twitterUrl: user.twitterUrl || '',
  githubUrl: user.githubUrl || '',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const toAnchorLinkRequestResponse = (req: Request, request: any) => ({
  id: request.id,
  userId: request.userId,
  providerId: request.providerId,
  note: request.note || '',
  status: request.status,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  user: request.user ? toProviderResponse(req, request.user) : undefined,
  provider: request.provider ? toProviderResponse(req, request.provider) : undefined,
});

providersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getPrisma() as any;
    const providers = await db.user.findMany({
      where: {
        role: 'provider',
        providerApproved: true,
        providerApprovalStatus: 'approved',
        providerRevokedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, providers: providers.map((provider: any) => toProviderResponse(req, provider)) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to list providers', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

providersRouter.post('/:id/request', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const providerId = String(req.params.id || '').trim();
  const note = String(req.body?.note || '').trim();

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!providerId) {
    res.status(400).json({ error: 'Provider id is required' });
    return;
  }

  if (userId === providerId) {
    res.status(400).json({ error: 'Users cannot request themselves as providers' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const provider = await db.user.findUnique({ where: { id: providerId } });
    if (
      !provider ||
      provider.role !== 'provider' ||
      provider.providerApproved !== true ||
      provider.providerApprovalStatus !== 'approved' ||
      provider.providerRevokedAt
    ) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const request = await db.anchorLinkRequest.create({
      data: {
        userId,
        providerId,
        note: note || null,
        status: 'pending',
      },
      include: { provider: true },
    });

    recordAuditEvent(req, {
      domain: 'social',
      action: 'provider_anchor_request_create',
      outcome: 'success',
      actorUserId: userId,
      targetUserId: providerId,
      statusCode: 201,
      metadata: {
        requestId: request.id,
        status: request.status,
      },
    });

    res.status(201).json({ success: true, request: toAnchorLinkRequestResponse(req, request) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to create anchor link request', error);
    res.status(500).json({ error: 'Failed to create provider request' });
  }
});

userRequestsRouter.get('/', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const requests = await db.anchorLinkRequest.findMany({
      where: { userId },
      include: { provider: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, requests: requests.map((request: any) => toAnchorLinkRequestResponse(req, request)) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to list user anchor link requests', error);
    res.status(500).json({ error: 'Failed to list requests' });
  }
});

providerRequestsRouter.get('/', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const providerId = getAuthenticatedUserId(req);
  if (!providerId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const provider = await localStore.getUserById(providerId);
    if (!isProviderAccessActive(provider)) {
      res.status(403).json({ error: 'Provider role required' });
      return;
    }

    const requests = await db.anchorLinkRequest.findMany({
      where: { providerId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, requests: requests.map((request: any) => toAnchorLinkRequestResponse(req, request)) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to list provider anchor link requests', error);
    res.status(500).json({ error: 'Failed to list provider requests' });
  }
});

providerRequestsRouter.patch('/:id', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  const providerId = getAuthenticatedUserId(req);
  const requestId = String(req.params.id || '').trim();
  const status = String(req.body?.status || '').trim().toLowerCase();

  if (!providerId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!validRequestStatuses.has(status)) {
    res.status(400).json({ error: 'Invalid request status' });
    return;
  }

  try {
    const db = getPrisma() as any;
    const provider = await localStore.getUserById(providerId);
    if (!isProviderAccessActive(provider)) {
      res.status(403).json({ error: 'Provider role required' });
      return;
    }

    const existing = await db.anchorLinkRequest.findUnique({ where: { id: requestId } });
    if (!existing || existing.providerId !== providerId) {
      res.status(404).json({ error: 'Provider request not found' });
      return;
    }

    const request = await db.anchorLinkRequest.update({
      where: { id: requestId },
      data: { status },
      include: { user: true, provider: true },
    });
    recordAuditEvent(req, {
      domain: 'social',
      action: 'provider_anchor_request_update',
      outcome: 'success',
      actorUserId: providerId,
      targetUserId: existing.userId,
      statusCode: 200,
      metadata: {
        requestId,
        status,
      },
    });
    res.json({ success: true, request: toAnchorLinkRequestResponse(req, request) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to update provider request', error);
    res.status(500).json({ error: 'Failed to update provider request' });
  }
});

export { providersRouter, userRequestsRouter, providerRequestsRouter };
