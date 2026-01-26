import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
let prismaInstance: PrismaClient | null = null;

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
      data: { userId, content, fileUrl, fileType }
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
    res.json({ success: true, reflections });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

export default router;
