import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
let prismaInstance: PrismaClient | null = null;

// Initialize Prisma Client lazily
function getPrismaClient() {
  if (!prismaInstance) {
    // Prisma v7 reads DATABASE_URL from environment automatically
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// Tier pricing configuration
const TIER_PRICING: Record<string, { name: string; price: number }> = {
  "Free / Community Tier": { name: "Free / Community Tier", price: 0 },
  "Guided Tier": { name: "Guided Tier", price: 22 },
  "Accelerated Tier": { name: "Accelerated Tier", price: 44 }
};

/**
 * POST /api/membership/select-tier
 * User selects a tier and initiates membership process
 */
router.post('/select-tier', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, tier } = req.body;
    const prisma = getPrismaClient();

    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing userId or tier' });
    }

    if (!TIER_PRICING[tier]) {
      return res.status(400).json({ error: 'Invalid tier selected' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or update membership
    const membership = await prisma.membership.upsert({
      where: { userId },
      update: {
        tier,
        status: 'active',
        startDate: new Date()
      },
      create: {
        userId,
        tier,
        status: 'active',
        startDate: new Date()
      }
    });

    // Create payment history record
    const tierInfo = TIER_PRICING[tier];
    const payment = await prisma.paymentHistory.create({
      data: {
        userId,
        membershipId: membership.id,
        amount: tierInfo.price,
        tier,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'mock',
        description: `MVP Membership - ${tier} (Mock Payment)`
      }
    });

    // Update user tier and subscription status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        tier,
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date()
      }
    });

    return res.json({
      success: true,
      message: `Successfully selected ${tier}`,
      membership: {
        id: membership.id,
        tier: membership.tier,
        status: membership.status,
        startDate: membership.startDate
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status
      },
      user: {
        id: updatedUser.id,
        tier: updatedUser.tier,
        subscriptionStatus: updatedUser.subscriptionStatus
      }
    });
  } catch (error) {
    console.error('Error selecting tier:', error);
    return res.status(500).json({ error: 'Failed to select tier' });
  }
});

/**
 * GET /api/membership/status/:userId
 * Get user's membership and subscription status
 */
router.get('/status/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate
      },
      membership: user.memberships[0] || null,
      paymentHistory: user.payments,
      hasMembership: user.tier !== "Free / Community Tier" || user.subscriptionStatus === 'active'
    });
  } catch (error) {
    console.error('Error fetching membership status:', error);
    return res.status(500).json({ error: 'Failed to fetch membership status' });
  }
});

/**
 * POST /api/membership/confirm-payment
 * Simulated payment confirmation endpoint for MVP
 */
router.post('/confirm-payment', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, tier } = req.body;
    const prisma = getPrismaClient();

    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Simulate 2-second processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create payment confirmation
    const tierInfo = TIER_PRICING[tier];
    const membership = await prisma.membership.findUnique({
      where: { userId }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const payment = await prisma.paymentHistory.create({
      data: {
        userId,
        membershipId: membership.id,
        amount: tierInfo.price,
        tier,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'mock',
        description: `Payment Confirmation - ${tier}`
      }
    });

    return res.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        tier: payment.tier,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

/**
 * GET /api/membership/tiers
 * Get all available membership tiers
 */
router.get('/tiers', (req: Request, res: Response): any => {
  const tiers = Object.values(TIER_PRICING);
  return res.json({ tiers });
});

export default router;
