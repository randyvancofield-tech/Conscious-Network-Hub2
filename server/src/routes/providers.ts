import { Router, Request, Response } from 'express';
import {
  AuthenticatedRequest,
  getAuthenticatedRole,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { getPrisma } from '../services/prismaClient';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import { isProviderAccessActive } from '../services/providerAccess';
import { normalizeProfileMedia } from '../services/profileNormalization';
import {
  absolutizeBackendUrl,
  buildBackendUploadObjectUrl,
  extractUploadObjectKeyFromUrl,
  getBackendPublicBaseUrl,
} from '../services/publicUrl';
import {
  getUploadObjectAccessMetadata,
  isUploadObjectPubliclyReadable,
} from '../services/uploadBlobStore';
import { hasTierAccess, TIER_VALUES } from '../tierPolicy';

const providersRouter = Router();
const userRequestsRouter = Router();
const providerRequestsRouter = Router();

const validRequestStatuses = new Set(['pending', 'accepted', 'scheduled', 'closed']);

const canAccessProviderMarketplace = (req: Request): boolean => {
  const role = getAuthenticatedRole(req);
  if (role === 'admin' || role === 'provider') return true;
  const authTier = (req as AuthenticatedRequest).authTier || null;
  return hasTierAccess(authTier, TIER_VALUES.ACCELERATED);
};

const enforceProviderMarketplaceAccess = (req: Request, res: Response): boolean => {
  if (canAccessProviderMarketplace(req)) return true;
  res.status(403).json({
    error: 'Provider marketplace access requires the Accelerated Tier.',
    code: 'TIER_ACCESS_REQUIRED',
    requiredTier: TIER_VALUES.ACCELERATED,
  });
  return false;
};

const getPublicBaseUrl = (req: Request): string => {
  return getBackendPublicBaseUrl(req);
};

const absolutizeUrl = (req: Request, value: unknown): string | null => {
  return absolutizeBackendUrl(req, typeof value === 'string' ? value : null) || null;
};

const canonicalUploadObjectUrl = (req: Request, objectKey?: string | null): string | null => {
  const resolvedObjectKey = extractUploadObjectKeyFromUrl(objectKey || null);
  if (!resolvedObjectKey) return null;
  const metadata = getUploadObjectAccessMetadata(resolvedObjectKey);
  if (!metadata) return null;
  if (metadata.access === 'public') {
    return buildBackendUploadObjectUrl(req, resolvedObjectKey, 'public');
  }
  if (metadata.access === 'private') {
    return buildBackendUploadObjectUrl(req, resolvedObjectKey, 'private');
  }
  if (metadata.access === 'legacy' && isUploadObjectPubliclyReadable(resolvedObjectKey)) {
    return buildBackendUploadObjectUrl(req, resolvedObjectKey, 'public');
  }
  return null;
};

const absolutizeUploadAwareUrl = (
  req: Request,
  value: unknown,
  objectKey?: unknown
): string | null => {
  const resolvedObjectKey =
    extractUploadObjectKeyFromUrl(typeof objectKey === 'string' ? objectKey : null) ||
    extractUploadObjectKeyFromUrl(typeof value === 'string' ? value : null);
  return canonicalUploadObjectUrl(req, resolvedObjectKey) || absolutizeUrl(req, value);
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
      url: absolutizeUploadAwareUrl(req, normalized.avatar.url, normalized.avatar.objectKey),
    },
    cover: {
      ...normalized.cover,
      url: absolutizeUploadAwareUrl(req, normalized.cover.url, normalized.cover.objectKey),
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
  avatarUrl: absolutizeUploadAwareUrl(req, user.avatarUrl, user.profileMedia?.avatar?.objectKey) || '',
  bannerUrl: absolutizeUploadAwareUrl(req, user.bannerUrl, user.profileMedia?.cover?.objectKey) || '',
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

providersRouter.get('/', requireCanonicalIdentity, async (req: Request, res: Response): Promise<void> => {
  if (!enforceProviderMarketplaceAccess(req, res)) return;

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

  if (!enforceProviderMarketplaceAccess(req, res)) return;

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
