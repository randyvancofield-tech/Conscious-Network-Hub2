import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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

/**
 * POST /api/reflection
 * Create a new reflection (with fileUrl and fileType)
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, content, fileUrl, fileType } = req.body;
    const prisma = getPrismaClient();
    if (!userId || !fileUrl || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const reflection = await prisma.reflection.create({
      data: { userId, content, fileUrl: absolutizeUrl(req, fileUrl)!, fileType }
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
    const prisma = getPrismaClient();
    const reflections = await prisma.reflection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    const normalized = reflections.map((reflection: any) => ({
      ...reflection,
      fileUrl: absolutizeUrl(req, reflection.fileUrl),
    }));
    res.json({ success: true, reflections: normalized });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

export default router;
