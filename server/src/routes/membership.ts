import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { normalizeTier } from '../tierPolicy';

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
router.post('/select-tier', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const { userId, tier } = req.body;
    const prisma = getPrismaClient();

    if (!authUserId || !userId || !tier) {
      return res.status(400).json({ error: 'Missing userId or tier' });
    }

    if (!enforceAuthenticatedUserMatch(req, res, userId, 'body.userId')) {
      return;
    }

    if (!TIER_PRICING[tier]) {
      return res.status(400).json({ error: 'Invalid tier selected' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: authUserId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or update membership
    const membership = await prisma.membership.upsert({
      where: { userId: authUserId },
      update: {
        tier,
        status: 'active',
        startDate: new Date()
      },
      create: {
        userId: authUserId,
        tier,
        status: 'active',
        startDate: new Date()
      }
    });

    // Create payment history record
    const tierInfo = TIER_PRICING[tier];
    const payment = await prisma.paymentHistory.create({
      data: {
        userId: authUserId,
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
      where: { id: authUserId },
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
        tier: normalizeTier(updatedUser.tier),
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
router.get('/status/:userId', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, userId, 'params.userId')) {
      return;
    }

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
        tier: normalizeTier(user.tier),
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        createdAt: user.createdAt,
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
router.post('/confirm-payment', requireCanonicalIdentity, async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const { userId, tier } = req.body;
    const prisma = getPrismaClient();

    if (!authUserId || !userId || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!enforceAuthenticatedUserMatch(req, res, userId, 'body.userId')) {
      return;
    }

    // Simulate 2-second processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create payment confirmation
    const tierInfo = TIER_PRICING[tier];
    if (!tierInfo) {
      return res.status(400).json({ error: 'Invalid tier selected' });
    }
    const membership = await prisma.membership.findUnique({
      where: { userId: authUserId }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const payment = await prisma.paymentHistory.create({
      data: {
        userId: authUserId,
        membershipId: membership.id,
        amount: tierInfo.price,
        tier,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'mock',
        description: `MVP Membership - ${tier} (Mock Payment)`
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
