import { Router, Request, Response } from 'express';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { localStore } from '../services/persistenceStore';
import { deleteUploadObjectByKey } from '../services/uploadBlobStore';

const router = Router();
router.use(requireCanonicalIdentity);

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
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

function extractUploadObjectKey(fileUrl?: string | null): string | null {
  const value = String(fileUrl || '').trim();
  if (!value) return null;
  try {
    const parsed = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(value.startsWith('/') ? value : `/${value}`, 'http://localhost');
    const match = /^\/uploads\/object\/([^/?#]+)/i.exec(parsed.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/reflection
 * Create a new reflection (with fileUrl and fileType)
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const { userId, content, fileUrl, fileType } = req.body;

    if (!authUserId || !userId || !fileUrl || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!enforceAuthenticatedUserMatch(req, res, userId, 'body.userId')) {
      return;
    }

    const reflection = await localStore.createReflection({
      userId: authUserId,
      content,
      fileUrl: absolutizeUrl(req, fileUrl)!,
      fileType,
    });

    res.json({ success: true, reflection });
  } catch (error) {
    console.error('Error creating reflection:', error);
    res.status(500).json({ error: 'Failed to create reflection' });
  }
});

/**
 * GET /api/reflection/:userId
 * Get all reflections for a user
 */
router.get('/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, userId, 'params.userId')) {
      return;
    }

    const reflections = await localStore.listReflectionsByUserId(userId);
    const normalized = reflections.map((reflection) => ({
      ...reflection,
      fileUrl: absolutizeUrl(req, reflection.fileUrl),
    }));
    res.json({ success: true, reflections: normalized });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

/**
 * PATCH /api/reflection/:reflectionId
 * Update reflection content for the owning user.
 */
router.patch('/:reflectionId', async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const reflectionId = String(req.params.reflectionId || '').trim();
    if (!authUserId || !reflectionId) {
      return res.status(400).json({ error: 'Missing required identifiers' });
    }

    const existing = await localStore.getReflectionById(reflectionId);
    if (!existing) {
      return res.status(404).json({ error: 'Reflection not found' });
    }
    if (existing.userId !== authUserId) {
      return res.status(403).json({ error: 'Not authorized to edit this reflection' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'content')) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const updated = await localStore.updateReflection(reflectionId, {
      content:
        req.body?.content === null || req.body?.content === undefined
          ? null
          : String(req.body.content),
    });
    if (!updated) {
      return res.status(404).json({ error: 'Reflection not found after update' });
    }

    return res.json({
      success: true,
      reflection: {
        ...updated,
        fileUrl: absolutizeUrl(req, updated.fileUrl),
      },
    });
  } catch (error) {
    console.error('Error updating reflection:', error);
    return res.status(500).json({ error: 'Failed to update reflection' });
  }
});

/**
 * DELETE /api/reflection/:reflectionId
 * Delete reflection and associated uploaded media for the owning user.
 */
router.delete('/:reflectionId', async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const reflectionId = String(req.params.reflectionId || '').trim();
    if (!authUserId || !reflectionId) {
      return res.status(400).json({ error: 'Missing required identifiers' });
    }

    const existing = await localStore.getReflectionById(reflectionId);
    if (!existing) {
      return res.status(404).json({ error: 'Reflection not found' });
    }
    if (existing.userId !== authUserId) {
      return res.status(403).json({ error: 'Not authorized to delete this reflection' });
    }

    const deleted = await localStore.deleteReflection(reflectionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Reflection not found after delete' });
    }

    const objectKey = extractUploadObjectKey(deleted.fileUrl);
    if (objectKey) {
      try {
        await deleteUploadObjectByKey(objectKey);
      } catch (cleanupError) {
        console.error('[REFLECTION] Failed to clean up upload blob', cleanupError);
      }
    }

    return res.json({ success: true, reflectionId });
  } catch (error) {
    console.error('Error deleting reflection:', error);
    return res.status(500).json({ error: 'Failed to delete reflection' });
  }
});

export default router;
