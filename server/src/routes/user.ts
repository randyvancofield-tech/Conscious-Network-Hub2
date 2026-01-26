/**
 * PUT /api/user/:id
 * Edit user profile (including background video)
 */
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const prisma = getPrismaClient();
    const updateData = req.body;

    // Only allow certain fields to be updated
    const allowedFields = ['name', 'bio', 'avatarUrl', 'bannerUrl', 'profileBackgroundVideo', 'interests', 'twitterUrl', 'githubUrl', 'websiteUrl', 'privacySettings'];
    const data: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) data[key] = updateData[key];
    }

    const user = await prisma.user.update({
      where: { id },
      data
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});
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
