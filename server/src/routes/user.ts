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
 * POST /api/user/create
 * Create a new user profile
 */
router.post('/create', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name, ...rest } = req.body;
    const prisma = getPrismaClient();

    if (!email || !name) {
      return res.status(400).json({ error: 'Missing required fields: email or name' });
    }

    // Create user profile
    const user = await prisma.user.create({
      data: {
        email,
        name,
        ...rest
      }
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Error creating user profile:', error);
    return res.status(500).json({ error: 'Failed to create user profile' });
  }
});

export default router;
