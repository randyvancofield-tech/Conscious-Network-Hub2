import { Router, Request, Response } from 'express';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { localStore } from '../services/persistenceStore';
import { normalizeTier } from '../tierPolicy';

const publicRouter = Router();
const protectedRouter = Router();

// Tier pricing configuration
const TIER_PRICING: Record<string, { name: string; price: number }> = {
  'Free / Community Tier': { name: 'Free / Community Tier', price: 0 },
  'Guided Tier': { name: 'Guided Tier', price: 22 },
  'Accelerated Tier': { name: 'Accelerated Tier', price: 44 },
};

protectedRouter.use(requireCanonicalIdentity);

/**
 * POST /api/membership/select-tier
 * User selects a tier and initiates membership process
 */
protectedRouter.post('/select-tier', async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const { userId, tier } = req.body;

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
    const user = await localStore.getUserById(authUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or update membership
    const membership = await localStore.upsertMembership({
      userId: authUserId,
      tier,
      status: 'active',
      startDate: new Date(),
    });

    // Create payment history record
    const tierInfo = TIER_PRICING[tier];
    const payment = await localStore.createPayment({
      userId: authUserId,
      membershipId: membership.id,
      amount: tierInfo.price,
      tier,
      currency: 'USD',
      status: 'completed',
      paymentMethod: 'mock',
      description: `MVP Membership - ${tier} (Mock Payment)`,
    });

    // Update user tier and subscription status
    const updatedUser = await localStore.updateUser(authUserId, {
      tier,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found during membership update' });
    }

    return res.json({
      success: true,
      message: `Successfully selected ${tier}`,
      membership: {
        id: membership.id,
        tier: membership.tier,
        status: membership.status,
        startDate: membership.startDate,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
      user: {
        id: updatedUser.id,
        tier: normalizeTier(updatedUser.tier),
        subscriptionStatus: updatedUser.subscriptionStatus,
      },
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
protectedRouter.get('/status/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    if (!enforceAuthenticatedUserMatch(req, res, userId, 'params.userId')) {
      return;
    }

    const user = await localStore.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const memberships = await localStore.listMembershipsByUserId(userId, 1);
    const paymentHistory = await localStore.listPaymentsByUserId(userId, 5);

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
      membership: memberships[0] || null,
      paymentHistory,
      hasMembership: user.tier !== 'Free / Community Tier' || user.subscriptionStatus === 'active',
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
protectedRouter.post('/confirm-payment', async (req: Request, res: Response): Promise<any> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const { userId, tier } = req.body;

    if (!authUserId || !userId || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!enforceAuthenticatedUserMatch(req, res, userId, 'body.userId')) {
      return;
    }

    // Simulate 2-second processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create payment confirmation
    const tierInfo = TIER_PRICING[tier];
    if (!tierInfo) {
      return res.status(400).json({ error: 'Invalid tier selected' });
    }

    const membership = await localStore.getMembershipByUserId(authUserId);
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const payment = await localStore.createPayment({
      userId: authUserId,
      membershipId: membership.id,
      amount: tierInfo.price,
      tier,
      currency: 'USD',
      status: 'completed',
      paymentMethod: 'mock',
      description: `MVP Membership - ${tier} (Mock Payment)`,
    });

    return res.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        tier: payment.tier,
        createdAt: payment.createdAt,
      },
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
publicRouter.get('/tiers', (req: Request, res: Response): any => {
  const tiers = Object.values(TIER_PRICING);
  return res.json({ tiers });
});

const router = Router();
router.use(publicRouter);
router.use(protectedRouter);

export { publicRouter as membershipPublicRoutes, protectedRouter as membershipProtectedRoutes };
export default router;
