import { Router, Request, Response } from 'express';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { getPrisma } from '../services/prismaClient';

const providersRouter = Router();
const userRequestsRouter = Router();
const providerRequestsRouter = Router();

const validRequestStatuses = new Set(['pending', 'accepted', 'scheduled', 'closed']);

const toProviderResponse = (user: any) => ({
  id: user.id,
  name: user.name || user.email,
  email: user.email,
  role: user.role,
  providerExternalId: user.providerExternalId || null,
  handle: user.handle || null,
  bio: user.bio || '',
  location: user.location || '',
  avatarUrl: user.avatarUrl || '',
  bannerUrl: user.bannerUrl || '',
  interests: Array.isArray(user.interests) ? user.interests : [],
  websiteUrl: user.websiteUrl || '',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const toAnchorLinkRequestResponse = (request: any) => ({
  id: request.id,
  userId: request.userId,
  providerId: request.providerId,
  note: request.note || '',
  status: request.status,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  user: request.user ? toProviderResponse(request.user) : undefined,
  provider: request.provider ? toProviderResponse(request.provider) : undefined,
});

providersRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getPrisma() as any;
    const providers = await db.user.findMany({
      where: { role: 'provider' },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, providers: providers.map(toProviderResponse) });
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
    if (!provider || provider.role !== 'provider') {
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

    res.status(201).json({ success: true, request: toAnchorLinkRequestResponse(request) });
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
    res.json({ success: true, requests: requests.map(toAnchorLinkRequestResponse) });
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
    const provider = await db.user.findUnique({ where: { id: providerId } });
    if (!provider || provider.role !== 'provider') {
      res.status(403).json({ error: 'Provider role required' });
      return;
    }

    const requests = await db.anchorLinkRequest.findMany({
      where: { providerId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, requests: requests.map(toAnchorLinkRequestResponse) });
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
    res.json({ success: true, request: toAnchorLinkRequestResponse(request) });
  } catch (error) {
    console.error('[PROVIDERS][ERROR] Failed to update provider request', error);
    res.status(500).json({ error: 'Failed to update provider request' });
  }
});

export { providersRouter, userRequestsRouter, providerRequestsRouter };
