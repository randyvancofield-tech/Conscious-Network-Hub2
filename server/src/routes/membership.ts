import type { Request, Response } from 'express';
import { Router } from 'express';
import Stripe from 'stripe';
import {
  enforceAuthenticatedUserMatch,
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { localStore } from '../services/persistenceStore';
import { normalizeTier, TIER_VALUES, type TierValue } from '../tierPolicy';

const publicRouter = Router();
const protectedRouter = Router();

type StripePriceEnvKey =
  | 'STRIPE_PRICE_FREE'
  | 'STRIPE_PRICE_GUIDED'
  | 'STRIPE_PRICE_ACCELERATED';

type TierPricing = {
  name: TierValue;
  price: number;
  stripePriceEnvKey: StripePriceEnvKey;
};

const TIER_PRICING: Record<TierValue, TierPricing> = {
  [TIER_VALUES.FREE]: {
    name: TIER_VALUES.FREE,
    price: 0,
    stripePriceEnvKey: 'STRIPE_PRICE_FREE',
  },
  [TIER_VALUES.GUIDED]: {
    name: TIER_VALUES.GUIDED,
    price: 22,
    stripePriceEnvKey: 'STRIPE_PRICE_GUIDED',
  },
  [TIER_VALUES.ACCELERATED]: {
    name: TIER_VALUES.ACCELERATED,
    price: 44,
    stripePriceEnvKey: 'STRIPE_PRICE_ACCELERATED',
  },
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

const STRIPE_UNAVAILABLE_RESPONSE = {
  error: 'Membership checkout is temporarily unavailable. Please retry shortly.',
  code: 'STRIPE_UNAVAILABLE',
  retryable: true,
} as const;

let stripeClient: Stripe | null | undefined;
const STRIPE_API_VERSION = '2025-04-30.basil' as unknown as Stripe.StripeConfig['apiVersion'];

const parseBooleanEnv = (name: string, fallback: boolean): boolean => {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
};

const getStripeClient = (): Stripe | null => {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
  return stripeClient;
};

const parseRequestedTier = (value: unknown): TierValue | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw === TIER_VALUES.FREE) return TIER_VALUES.FREE;
  if (raw === TIER_VALUES.GUIDED) return TIER_VALUES.GUIDED;
  if (raw === TIER_VALUES.ACCELERATED) return TIER_VALUES.ACCELERATED;
  return null;
};

const resolveStripePriceId = (tier: TierValue): string | null => {
  const envKey = TIER_PRICING[tier].stripePriceEnvKey;
  const priceId = String(process.env[envKey] || '').trim();
  return priceId || null;
};

const resolveSuccessUrl = (): string => {
  const configured = String(process.env.STRIPE_SUCCESS_URL || '').trim();
  if (configured) return configured;

  const frontendBaseUrl = String(process.env.FRONTEND_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (frontendBaseUrl) {
    return `${frontendBaseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  }

  return 'http://localhost:3000/?checkout=success&session_id={CHECKOUT_SESSION_ID}';
};

const resolveCancelUrl = (): string => {
  const configured = String(process.env.STRIPE_CANCEL_URL || '').trim();
  if (configured) return configured;

  const frontendBaseUrl = String(process.env.FRONTEND_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (frontendBaseUrl) {
    return `${frontendBaseUrl}/?checkout=cancel`;
  }

  return 'http://localhost:3000/?checkout=cancel';
};

const toPaymentAmount = (
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  fallback: number
): number => {
  if (!Number.isFinite(amountMinor)) return fallback;
  const normalizedCurrency = String(currency || '').trim().toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Number(amountMinor);
  }
  return Number(amountMinor) / 100;
};

const toPublicTier = (user: any): TierValue | null => {
  const rawTier = String(user?.tier || '').trim();
  if (!rawTier) return null;

  const subscriptionStatus = String(user?.subscriptionStatus || '')
    .trim()
    .toLowerCase();
  if (subscriptionStatus !== 'active') {
    return null;
  }

  return normalizeTier(rawTier);
};

const toMembershipUserPayload = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || (user.email ? String(user.email).split('@')[0] : 'Node'),
  tier: toPublicTier(user),
  subscriptionStatus: user.subscriptionStatus,
  subscriptionStartDate: user.subscriptionStartDate,
  subscriptionEndDate: user.subscriptionEndDate,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const resolveTierFromPriceId = (priceId: string | null | undefined): TierValue | null => {
  const normalizedPriceId = String(priceId || '').trim();
  if (!normalizedPriceId) return null;

  const tiers: TierValue[] = [TIER_VALUES.FREE, TIER_VALUES.GUIDED, TIER_VALUES.ACCELERATED];
  for (const tier of tiers) {
    if (resolveStripePriceId(tier) === normalizedPriceId) {
      return tier;
    }
  }
  return null;
};

const buildSessionMarker = (checkoutSessionId: string): string =>
  `stripe_checkout_session:${checkoutSessionId}`;

const buildEventMarker = (eventId: string): string => `stripe_event:${eventId}`;

interface WebhookProcessingContext {
  userId: string;
  membershipId: string;
  tier: TierValue;
}

const webhookEventsInFlight = new Set<string>();

const hasProcessedWebhookEvent = async (eventId: string): Promise<boolean> => {
  const marker = buildEventMarker(eventId);
  return localStore.hasPaymentDescriptionMarker(marker);
};

const recordProcessedWebhookEvent = async (input: {
  eventId: string;
  eventType: string;
  context: WebhookProcessingContext;
}): Promise<void> => {
  const marker = buildEventMarker(input.eventId);
  const alreadyRecorded = await localStore.hasPaymentDescriptionMarker(marker);
  if (alreadyRecorded) {
    return;
  }

  await localStore.createPayment({
    userId: input.context.userId,
    membershipId: input.context.membershipId,
    amount: 0,
    tier: input.context.tier,
    currency: 'USD',
    status: 'completed',
    paymentMethod: 'stripe_webhook_event',
    description: `Stripe webhook processed ${input.eventType} (${marker})`,
  });
};

const toUnixDate = (value: unknown): Date | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return new Date(value * 1000);
};

const normalizeStripeStatus = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const toUserSubscriptionStatus = (stripeStatus: string): string => {
  if (stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'canceled') return 'cancelled';
  return stripeStatus || 'inactive';
};

const toMembershipStatus = (stripeStatus: string): string => {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') return 'cancelled';
  return stripeStatus || 'inactive';
};

const toNormalizedEmail = (value: unknown): string | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || null;
};

const resolveCustomerEmail = async (
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): Promise<string | null> => {
  if (!customer) return null;

  if (typeof customer !== 'string') {
    if ('deleted' in customer && customer.deleted) {
      return null;
    }
    return toNormalizedEmail((customer as Stripe.Customer).email);
  }

  try {
    const resolved = await stripe.customers.retrieve(customer);
    if ('deleted' in resolved && resolved.deleted) {
      return null;
    }
    return toNormalizedEmail((resolved as Stripe.Customer).email);
  } catch (error) {
    console.warn('[STRIPE][WEBHOOK] Failed to resolve customer email', {
      customerId: customer,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const resolvePriceIdFromSubscription = (subscription: Stripe.Subscription): string | null => {
  const firstItem = (subscription.items?.data?.[0] || null) as any;
  if (!firstItem) return null;
  const linePrice = firstItem.price;
  if (typeof linePrice === 'string') return linePrice;
  if (linePrice && typeof linePrice === 'object' && typeof linePrice.id === 'string') {
    return linePrice.id;
  }
  return null;
};

const resolveTierFromSubscription = (subscription: Stripe.Subscription): TierValue | null => {
  const metadataTier = parseRequestedTier(subscription.metadata?.tier);
  if (metadataTier) return metadataTier;
  return resolveTierFromPriceId(resolvePriceIdFromSubscription(subscription));
};

const resolvePriceIdFromInvoice = (invoice: Stripe.Invoice): string | null => {
  const firstLine = (invoice.lines?.data?.[0] || null) as any;
  if (!firstLine) return null;

  const linePrice = firstLine.price;
  if (typeof linePrice === 'string') return linePrice;
  if (linePrice && typeof linePrice === 'object' && typeof linePrice.id === 'string') {
    return linePrice.id;
  }

  const nestedPrice = firstLine?.pricing?.price_details?.price;
  if (typeof nestedPrice === 'string') return nestedPrice;

  return null;
};

const resolveTierFromInvoice = (invoice: Stripe.Invoice): TierValue | null => {
  const metadataTier = parseRequestedTier(invoice.metadata?.tier);
  if (metadataTier) return metadataTier;
  return resolveTierFromPriceId(resolvePriceIdFromInvoice(invoice));
};

const upsertMembershipState = async (input: {
  userId: string;
  tier: TierValue;
  status: string;
  startDate?: Date | null;
}): Promise<Awaited<ReturnType<typeof localStore.upsertMembership>>> => {
  const existing = await localStore.getMembershipByUserId(input.userId);
  const startDate = existing?.startDate || input.startDate || new Date();
  return localStore.upsertMembership({
    userId: input.userId,
    tier: input.tier,
    status: input.status,
    startDate,
  });
};

const resolveUserFromStripeHints = async (
  stripe: Stripe,
  hints: {
    userId?: string | null;
    email?: string | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  }
): Promise<{
  user: Awaited<ReturnType<typeof localStore.getUserById>> | null;
  userId: string | null;
}> => {
  const requestedUserId = String(hints.userId || '').trim();
  if (requestedUserId) {
    const userById = await localStore.getUserById(requestedUserId);
    if (userById) {
      return { user: userById, userId: userById.id };
    }
  }

  const directEmail = toNormalizedEmail(hints.email);
  if (directEmail) {
    const userByEmail = await localStore.getUserByEmail(directEmail);
    if (userByEmail) {
      return { user: userByEmail, userId: userByEmail.id };
    }
  }

  const customerEmail = await resolveCustomerEmail(stripe, hints.customer);
  if (customerEmail) {
    const userByCustomer = await localStore.getUserByEmail(customerEmail);
    if (userByCustomer) {
      return { user: userByCustomer, userId: userByCustomer.id };
    }
  }

  return { user: null, userId: null };
};

const ensurePaymentRecordedForEvent = async (input: {
  eventId: string;
  userId: string;
  membershipId: string;
  tier: TierValue;
  amountMinor: number | null | undefined;
  currency: string | null | undefined;
  status: 'completed' | 'failed';
  description: string;
}): Promise<void> => {
  const marker = buildEventMarker(input.eventId);
  const alreadyRecorded = await localStore.hasPaymentDescriptionMarker(marker);
  if (alreadyRecorded) {
    return;
  }

  const fallbackAmount = TIER_PRICING[input.tier].price;
  await localStore.createPayment({
    userId: input.userId,
    membershipId: input.membershipId,
    amount: toPaymentAmount(input.amountMinor ?? null, input.currency ?? null, fallbackAmount),
    tier: input.tier,
    currency: String(input.currency || 'USD').toUpperCase() || 'USD',
    status: input.status,
    paymentMethod: 'stripe',
    description: `${input.description} (${marker})`,
  });
};

const activateMembershipFromCheckout = async (input: {
  userId: string;
  tier: TierValue;
  checkoutSessionId: string;
  amountMinor: number | null;
  currency: string | null;
}): Promise<{
  membership: Awaited<ReturnType<typeof localStore.upsertMembership>>;
  user: NonNullable<Awaited<ReturnType<typeof localStore.updateUser>>>;
}> => {
  const membership = await upsertMembershipState({
    userId: input.userId,
    tier: input.tier,
    status: 'active',
    startDate: new Date(),
  });

  const marker = buildSessionMarker(input.checkoutSessionId);
  const paymentHistory = await localStore.listPaymentsByUserId(input.userId, 50);
  const paymentAlreadyRecorded = paymentHistory.some((entry) =>
    String(entry.description || '').includes(marker)
  );

  if (!paymentAlreadyRecorded) {
    const fallbackAmount = TIER_PRICING[input.tier].price;
    await localStore.createPayment({
      userId: input.userId,
      membershipId: membership.id,
      amount: toPaymentAmount(input.amountMinor, input.currency, fallbackAmount),
      tier: input.tier,
      currency: String(input.currency || 'USD').toUpperCase() || 'USD',
      status: 'completed',
      paymentMethod: 'stripe',
      description: `Stripe checkout completed for ${input.tier} (${marker})`,
    });
  }

  const updatedUser = await localStore.updateUser(input.userId, {
    tier: input.tier,
    subscriptionStatus: 'active',
    subscriptionStartDate: new Date(),
    subscriptionEndDate: null,
  });

  if (!updatedUser) {
    throw new Error('User not found during membership activation');
  }

  return {
    membership,
    user: updatedUser,
  };
};

const createCheckoutSessionForTier = async (input: {
  userId: string;
  email: string;
  tier: TierValue;
}): Promise<Stripe.Checkout.Session> => {
  const stripe = getStripeClient();
  if (!stripe) {
    const error = new Error('Stripe is not configured') as Error & { code?: string };
    error.code = 'STRIPE_UNAVAILABLE';
    throw error;
  }

  const stripePriceId = resolveStripePriceId(input.tier);
  if (!stripePriceId) {
    const error = new Error(`Missing Stripe price id for ${input.tier}`) as Error & {
      code?: string;
    };
    error.code = 'STRIPE_PRICE_NOT_CONFIGURED';
    throw error;
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: resolveSuccessUrl(),
    cancel_url: resolveCancelUrl(),
    client_reference_id: input.userId,
    customer_email: input.email,
    metadata: {
      userId: input.userId,
      tier: input.tier,
      stripeMode: String(process.env.STRIPE_MODE || '').trim() || 'unspecified',
    },
    automatic_tax: {
      enabled: parseBooleanEnv('STRIPE_AUTOMATIC_TAX', false),
    },
    allow_promotion_codes: parseBooleanEnv('STRIPE_ALLOW_PROMO_CODES', false),
  });
};

const startTierCheckout = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requestedBodyUserId = String(req.body?.userId || '').trim();
    if (
      requestedBodyUserId &&
      !enforceAuthenticatedUserMatch(req, res, requestedBodyUserId, 'body.userId')
    ) {
      return;
    }

    const tier = parseRequestedTier(req.body?.tier);
    if (!tier) {
      return res.status(400).json({ error: 'Invalid tier selected' });
    }

    const user = await localStore.getUserById(authUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const session = await createCheckoutSessionForTier({
      userId: authUserId,
      email: user.email,
      tier,
    });

    if (!session.url) {
      return res.status(502).json({ error: 'Stripe did not provide a checkout URL' });
    }

    return res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      tier,
    });
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'STRIPE_UNAVAILABLE' || code === 'STRIPE_PRICE_NOT_CONFIGURED') {
      return res.status(503).json(STRIPE_UNAVAILABLE_RESPONSE);
    }
    console.error('Error creating Stripe checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

const confirmStripeCheckoutSession = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json(STRIPE_UNAVAILABLE_RESPONSE);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });

    const sessionUserId = String(
      session.client_reference_id || session.metadata?.userId || ''
    ).trim();
    if (!sessionUserId || sessionUserId !== authUserId) {
      return res
        .status(403)
        .json({ error: 'Forbidden: checkout session does not match authenticated user' });
    }

    if (session.status !== 'complete') {
      return res.status(409).json({
        error: 'Checkout is not complete yet',
        sessionStatus: session.status,
      });
    }

    const paymentStatus = String(session.payment_status || '').trim().toLowerCase();
    if (paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
      return res.status(409).json({
        error: 'Checkout payment is not finalized',
        paymentStatus: session.payment_status,
      });
    }

    let tier = parseRequestedTier(session.metadata?.tier);
    if (!tier) {
      const firstLineItem = session.line_items?.data?.[0];
      const price = firstLineItem?.price;
      const priceId =
        typeof price === 'string'
          ? price
          : price && typeof price === 'object'
          ? price.id
          : null;
      tier = resolveTierFromPriceId(priceId);
    }

    if (!tier) {
      return res.status(422).json({
        error: 'Unable to resolve membership tier from checkout session',
      });
    }

    const activated = await activateMembershipFromCheckout({
      userId: authUserId,
      tier,
      checkoutSessionId: session.id,
      amountMinor: session.amount_total ?? null,
      currency: session.currency ?? null,
    });

    return res.json({
      success: true,
      message: 'Membership activated successfully',
      membership: {
        id: activated.membership.id,
        tier: activated.membership.tier,
        status: activated.membership.status,
        startDate: activated.membership.startDate,
      },
      user: toMembershipUserPayload(activated.user),
      checkout: {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
      },
    });
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    if (stripeError?.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: stripeError.message || 'Invalid checkout session' });
    }
    console.error('Error confirming Stripe checkout session:', error);
    return res.status(500).json({ error: 'Failed to confirm checkout session' });
  }
};

const handleCheckoutSessionWebhookEvent = async (
  session: Stripe.Checkout.Session
): Promise<WebhookProcessingContext | null> => {
  const paymentStatus = String(session.payment_status || '').trim().toLowerCase();
  const isPaymentFinalized = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
  if (session.status !== 'complete' || !isPaymentFinalized) {
    return null;
  }

  const userId = String(session.client_reference_id || session.metadata?.userId || '').trim();
  const tier = parseRequestedTier(session.metadata?.tier);
  if (!userId || !tier) {
    console.warn('[STRIPE][WEBHOOK] Missing user or tier metadata for checkout session', {
      sessionId: session.id,
    });
    return null;
  }

  const activated = await activateMembershipFromCheckout({
    userId,
    tier,
    checkoutSessionId: session.id,
    amountMinor: session.amount_total ?? null,
    currency: session.currency ?? null,
  });

  return {
    userId,
    membershipId: activated.membership.id,
    tier,
  };
};

const resolveSubscriptionFromInvoice = async (
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<Stripe.Subscription | null> => {
  const subscriptionValue = (invoice as any).subscription;
  const subscriptionId =
    typeof subscriptionValue === 'string'
      ? subscriptionValue
      : subscriptionValue &&
        typeof subscriptionValue === 'object' &&
        typeof subscriptionValue.id === 'string'
      ? subscriptionValue.id
      : '';
  if (!subscriptionId) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.warn('[STRIPE][WEBHOOK] Failed to retrieve subscription from invoice', {
      invoiceId: invoice.id,
      subscriptionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const handleSubscriptionUpdatedWebhookEvent = async (
  stripe: Stripe,
  eventId: string,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingContext | null> => {
  const requestedUserId = String(subscription.metadata?.userId || '').trim();
  const resolved = await resolveUserFromStripeHints(stripe, {
    userId: requestedUserId,
    customer: subscription.customer,
  });
  if (!resolved.user || !resolved.userId) {
    console.warn('[STRIPE][WEBHOOK] Unable to resolve user for customer.subscription.updated', {
      eventId,
      subscriptionId: subscription.id,
      requestedUserId,
    });
    return null;
  }

  const stripeStatus = normalizeStripeStatus(subscription.status);
  const tier =
    resolveTierFromSubscription(subscription) ||
    parseRequestedTier(resolved.user.tier) ||
    TIER_VALUES.FREE;
  const periodStart = toUnixDate((subscription as any).current_period_start);
  const periodEnd = toUnixDate((subscription as any).current_period_end);

  const membership = await upsertMembershipState({
    userId: resolved.userId,
    tier,
    status: toMembershipStatus(stripeStatus),
    startDate: periodStart,
  });

  const updatedUser = await localStore.updateUser(resolved.userId, {
    tier,
    subscriptionStatus: toUserSubscriptionStatus(stripeStatus),
    subscriptionStartDate: periodStart || resolved.user.subscriptionStartDate || new Date(),
    subscriptionEndDate: periodEnd ?? resolved.user.subscriptionEndDate ?? null,
  });
  if (!updatedUser) {
    throw new Error('User not found while syncing subscription.updated');
  }

  console.info('[STRIPE][WEBHOOK] customer.subscription.updated processed', {
    eventId,
    userId: resolved.userId,
    tier,
    subscriptionStatus: updatedUser.subscriptionStatus,
    membershipStatus: membership.status,
  });

  return {
    userId: resolved.userId,
    membershipId: membership.id,
    tier,
  };
};

const handleSubscriptionDeletedWebhookEvent = async (
  stripe: Stripe,
  eventId: string,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingContext | null> => {
  const requestedUserId = String(subscription.metadata?.userId || '').trim();
  const resolved = await resolveUserFromStripeHints(stripe, {
    userId: requestedUserId,
    customer: subscription.customer,
  });
  if (!resolved.user || !resolved.userId) {
    console.warn('[STRIPE][WEBHOOK] Unable to resolve user for customer.subscription.deleted', {
      eventId,
      subscriptionId: subscription.id,
      requestedUserId,
    });
    return null;
  }

  const periodEnd = toUnixDate((subscription as any).current_period_end) || new Date();

  const membership = await upsertMembershipState({
    userId: resolved.userId,
    tier: TIER_VALUES.FREE,
    status: 'cancelled',
    startDate: resolved.user.subscriptionStartDate || new Date(),
  });

  const updatedUser = await localStore.updateUser(resolved.userId, {
    tier: TIER_VALUES.FREE,
    subscriptionStatus: 'cancelled',
    subscriptionEndDate: periodEnd,
  });
  if (!updatedUser) {
    throw new Error('User not found while syncing subscription.deleted');
  }

  console.info('[STRIPE][WEBHOOK] customer.subscription.deleted processed', {
    eventId,
    userId: resolved.userId,
    tier: updatedUser.tier,
    subscriptionStatus: updatedUser.subscriptionStatus,
    membershipStatus: membership.status,
  });

  return {
    userId: resolved.userId,
    membershipId: membership.id,
    tier: TIER_VALUES.FREE,
  };
};

const handleInvoicePaymentSucceededWebhookEvent = async (
  stripe: Stripe,
  eventId: string,
  invoice: Stripe.Invoice
): Promise<WebhookProcessingContext | null> => {
  const subscription = await resolveSubscriptionFromInvoice(stripe, invoice);
  const requestedUserId =
    String(subscription?.metadata?.userId || '').trim() ||
    String(invoice.metadata?.userId || '').trim();

  const resolved = await resolveUserFromStripeHints(stripe, {
    userId: requestedUserId,
    email: toNormalizedEmail((invoice as any).customer_email),
    customer: subscription?.customer || invoice.customer,
  });
  if (!resolved.user || !resolved.userId) {
    console.warn('[STRIPE][WEBHOOK] Unable to resolve user for invoice.payment_succeeded', {
      eventId,
      invoiceId: invoice.id,
      requestedUserId,
    });
    return null;
  }

  const tier =
    (subscription ? resolveTierFromSubscription(subscription) : null) ||
    resolveTierFromInvoice(invoice) ||
    parseRequestedTier(resolved.user.tier) ||
    TIER_VALUES.FREE;
  const periodStart = subscription
    ? toUnixDate((subscription as any).current_period_start)
    : toUnixDate((invoice as any).period_start);
  const periodEnd = subscription
    ? toUnixDate((subscription as any).current_period_end)
    : toUnixDate((invoice as any).period_end);

  const membership = await upsertMembershipState({
    userId: resolved.userId,
    tier,
    status: 'active',
    startDate: periodStart,
  });

  const updatedUser = await localStore.updateUser(resolved.userId, {
    tier,
    subscriptionStatus: 'active',
    subscriptionStartDate: periodStart || resolved.user.subscriptionStartDate || new Date(),
    subscriptionEndDate: periodEnd ?? resolved.user.subscriptionEndDate ?? null,
  });
  if (!updatedUser) {
    throw new Error('User not found while syncing invoice.payment_succeeded');
  }

  await ensurePaymentRecordedForEvent({
    eventId,
    userId: resolved.userId,
    membershipId: membership.id,
    tier,
    amountMinor: (invoice.amount_paid ?? invoice.amount_due ?? null) as number | null,
    currency: invoice.currency ?? null,
    status: 'completed',
    description: `Stripe invoice payment succeeded for ${tier}`,
  });

  console.info('[STRIPE][WEBHOOK] invoice.payment_succeeded processed', {
    eventId,
    userId: resolved.userId,
    tier,
    invoiceId: invoice.id,
  });

  return {
    userId: resolved.userId,
    membershipId: membership.id,
    tier,
  };
};

const handleInvoicePaymentFailedWebhookEvent = async (
  stripe: Stripe,
  eventId: string,
  invoice: Stripe.Invoice
): Promise<WebhookProcessingContext | null> => {
  const subscription = await resolveSubscriptionFromInvoice(stripe, invoice);
  const requestedUserId =
    String(subscription?.metadata?.userId || '').trim() ||
    String(invoice.metadata?.userId || '').trim();

  const resolved = await resolveUserFromStripeHints(stripe, {
    userId: requestedUserId,
    email: toNormalizedEmail((invoice as any).customer_email),
    customer: subscription?.customer || invoice.customer,
  });
  if (!resolved.user || !resolved.userId) {
    console.warn('[STRIPE][WEBHOOK] Unable to resolve user for invoice.payment_failed', {
      eventId,
      invoiceId: invoice.id,
      requestedUserId,
    });
    return null;
  }

  const tier =
    (subscription ? resolveTierFromSubscription(subscription) : null) ||
    resolveTierFromInvoice(invoice) ||
    parseRequestedTier(resolved.user.tier) ||
    TIER_VALUES.FREE;
  const periodStart = subscription
    ? toUnixDate((subscription as any).current_period_start)
    : toUnixDate((invoice as any).period_start);
  const periodEnd = subscription
    ? toUnixDate((subscription as any).current_period_end)
    : toUnixDate((invoice as any).period_end);

  const membership = await upsertMembershipState({
    userId: resolved.userId,
    tier,
    status: 'past_due',
    startDate: periodStart,
  });

  const updatedUser = await localStore.updateUser(resolved.userId, {
    tier,
    subscriptionStatus: 'past_due',
    subscriptionEndDate: periodEnd ?? resolved.user.subscriptionEndDate ?? null,
  });
  if (!updatedUser) {
    throw new Error('User not found while syncing invoice.payment_failed');
  }

  await ensurePaymentRecordedForEvent({
    eventId,
    userId: resolved.userId,
    membershipId: membership.id,
    tier,
    amountMinor: (invoice.amount_due ?? invoice.amount_remaining ?? null) as number | null,
    currency: invoice.currency ?? null,
    status: 'failed',
    description: `Stripe invoice payment failed for ${tier}; flagged for downgrade grace review`,
  });

  console.warn('[STRIPE][WEBHOOK] invoice.payment_failed processed', {
    eventId,
    userId: resolved.userId,
    tier,
    invoiceId: invoice.id,
    subscriptionStatus: updatedUser.subscriptionStatus,
    action: 'grace_review_required',
  });

  return {
    userId: resolved.userId,
    membershipId: membership.id,
    tier,
  };
};

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const stripe = getStripeClient();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!stripe || !webhookSecret) {
    res.status(503).json(STRIPE_UNAVAILABLE_RESPONSE);
    return;
  }

  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed';
    console.error('Stripe webhook verification failed:', message);
    res.status(400).json({ error: 'Invalid Stripe webhook signature' });
    return;
  }

  console.info('[STRIPE][WEBHOOK] Event received', {
    eventId: event.id,
    eventType: event.type,
  });

  if (webhookEventsInFlight.has(event.id)) {
    console.info('[STRIPE][WEBHOOK] Duplicate event ignored (in-flight)', {
      eventId: event.id,
      eventType: event.type,
    });
    res.json({
      received: true,
      eventType: event.type,
      duplicate: true,
      reason: 'in_flight',
    });
    return;
  }

  if (await hasProcessedWebhookEvent(event.id)) {
    console.info('[STRIPE][WEBHOOK] Duplicate event ignored (already processed)', {
      eventId: event.id,
      eventType: event.type,
    });
    res.json({
      received: true,
      eventType: event.type,
      duplicate: true,
      reason: 'already_processed',
    });
    return;
  }

  webhookEventsInFlight.add(event.id);

  try {
    let context: WebhookProcessingContext | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        context = await handleCheckoutSessionWebhookEvent(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        context = await handleSubscriptionUpdatedWebhookEvent(
          stripe,
          event.id,
          event.data.object as Stripe.Subscription
        );
        break;
      case 'customer.subscription.deleted':
        context = await handleSubscriptionDeletedWebhookEvent(
          stripe,
          event.id,
          event.data.object as Stripe.Subscription
        );
        break;
      case 'invoice.payment_succeeded':
        context = await handleInvoicePaymentSucceededWebhookEvent(
          stripe,
          event.id,
          event.data.object as Stripe.Invoice
        );
        break;
      case 'invoice.payment_failed':
        context = await handleInvoicePaymentFailedWebhookEvent(
          stripe,
          event.id,
          event.data.object as Stripe.Invoice
        );
        break;
      default:
        console.info('[STRIPE][WEBHOOK] Event ignored', {
          eventId: event.id,
          eventType: event.type,
        });
        break;
    }

    if (context) {
      await recordProcessedWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        context,
      });
    }

    res.json({
      received: true,
      eventType: event.type,
    });
  } catch (error) {
    console.error('Stripe webhook processing failed:', {
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to process Stripe webhook' });
  } finally {
    webhookEventsInFlight.delete(event.id);
  }
};

protectedRouter.use(requireCanonicalIdentity);

/**
 * POST /api/membership/stripe/create-checkout-session
 * Create a Stripe Checkout session for the authenticated user's selected tier.
 */
protectedRouter.post('/stripe/create-checkout-session', startTierCheckout);

/**
 * POST /api/membership/stripe/confirm-session
 * Confirm Stripe checkout completion and activate membership in persistence store.
 */
protectedRouter.post('/stripe/confirm-session', confirmStripeCheckoutSession);

/**
 * Backward-compatible alias for payment confirmation.
 */
protectedRouter.post('/confirm-payment', confirmStripeCheckoutSession);

/**
 * GET /api/membership/status/:userId
 * Get user's membership and subscription status.
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
        tier: toPublicTier(user),
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        createdAt: user.createdAt,
      },
      membership: memberships[0] || null,
      paymentHistory,
      hasMembership: Boolean(toPublicTier(user)),
    });
  } catch (error) {
    console.error('Error fetching membership status:', error);
    return res.status(500).json({ error: 'Failed to fetch membership status' });
  }
});

/**
 * GET /api/membership/tiers
 * Return available membership tiers.
 */
publicRouter.get('/tiers', (_req: Request, res: Response) => {
  const tiers = Object.values(TIER_PRICING).map((entry) => ({
    name: entry.name,
    price: entry.price,
  }));
  return res.json({ tiers });
});

const router = Router();
router.use(publicRouter);
router.use(protectedRouter);

export { publicRouter as membershipPublicRoutes, protectedRouter as membershipProtectedRoutes };
export default router;
