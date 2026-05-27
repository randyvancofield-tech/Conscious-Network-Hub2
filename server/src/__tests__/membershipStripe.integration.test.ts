import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';
import {
  handleStripeWebhook,
  membershipProtectedRoutes,
} from '../routes/membership';

const mockCheckoutSessionRetrieve = jest.fn();
const mockConstructWebhookEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionRetrieve,
      },
    },
    webhooks: {
      constructEvent: mockConstructWebhookEvent,
    },
  }));
});

type MockUser = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const users = new Map<string, MockUser>();
const memberships = new Map<string, any>();
const payments: any[] = [];

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  subscriptionStartDate: user.subscriptionStartDate
    ? new Date(user.subscriptionStartDate.getTime())
    : null,
  subscriptionEndDate: user.subscriptionEndDate
    ? new Date(user.subscriptionEndDate.getTime())
    : null,
  createdAt: new Date(user.createdAt.getTime()),
  updatedAt: new Date(user.updatedAt.getTime()),
});

const createMockUser = (id: string, email: string): MockUser => {
  const now = new Date();
  return {
    id,
    email,
    name: 'Stripe Member',
    tier: '',
    subscriptionStatus: 'inactive',
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    createdAt: now,
    updatedAt: now,
  };
};

const mockLocalStore = {
  async getUserById(id: string): Promise<MockUser | null> {
    const user = users.get(id);
    return user ? cloneUser(user) : null;
  },

  async getUserByEmail(email: string): Promise<MockUser | null> {
    const target = email.trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email.toLowerCase() === target) return cloneUser(user);
    }
    return null;
  },

  async updateUser(id: string, updates: Partial<MockUser>): Promise<MockUser | null> {
    const existing = users.get(id);
    if (!existing) return null;
    const next = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    users.set(id, next);
    return cloneUser(next);
  },

  async upsertMembership(input: any): Promise<any> {
    const existing = memberships.get(input.userId);
    const now = new Date();
    const membership = {
      id: existing?.id || `membership-${input.userId}`,
      userId: input.userId,
      tier: input.tier,
      status: input.status,
      startDate: existing?.startDate || input.startDate || now,
      endDate: input.endDate || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    memberships.set(input.userId, membership);
    return { ...membership };
  },

  async getMembershipByUserId(userId: string): Promise<any | null> {
    const membership = memberships.get(userId);
    return membership ? { ...membership } : null;
  },

  async listMembershipsByUserId(userId: string): Promise<any[]> {
    const membership = memberships.get(userId);
    return membership ? [{ ...membership }] : [];
  },

  async createPayment(input: any): Promise<any> {
    const payment = {
      id: `payment-${payments.length + 1}`,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    payments.push(payment);
    return { ...payment };
  },

  async listPaymentsByUserId(userId: string): Promise<any[]> {
    return payments.filter((payment) => payment.userId === userId).map((payment) => ({ ...payment }));
  },

  async hasPaymentDescriptionMarker(marker: string): Promise<boolean> {
    return payments.some((payment) => String(payment.description || '').includes(marker));
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: {
    getUserById: (id: string) => mockLocalStore.getUserById(id),
    getUserByEmail: (email: string) => mockLocalStore.getUserByEmail(email),
    updateUser: (id: string, updates: Partial<MockUser>) =>
      mockLocalStore.updateUser(id, updates),
    upsertMembership: (input: any) => mockLocalStore.upsertMembership(input),
    getMembershipByUserId: (userId: string) => mockLocalStore.getMembershipByUserId(userId),
    listMembershipsByUserId: (userId: string) =>
      mockLocalStore.listMembershipsByUserId(userId),
    createPayment: (input: any) => mockLocalStore.createPayment(input),
    listPaymentsByUserId: (userId: string) => mockLocalStore.listPaymentsByUserId(userId),
    hasPaymentDescriptionMarker: (marker: string) =>
      mockLocalStore.hasPaymentDescriptionMarker(marker),
  },
}));

const requestJson = async (input: {
  baseUrl: string;
  method: string;
  path: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}) => {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method,
    headers: {
      ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      ...(input.headers || {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

const makeSession = (input: {
  id: string;
  userId: string;
  tier: string;
  paymentStatus: 'paid' | 'no_payment_required';
  amountTotal: number;
}) => ({
  id: input.id,
  status: 'complete',
  payment_status: input.paymentStatus,
  client_reference_id: input.userId,
  metadata: {
    userId: input.userId,
    tier: input.tier,
  },
  amount_total: input.amountTotal,
  currency: 'usd',
  line_items: {
    data: [
      {
        price: {
          id:
            input.tier === 'Guided Tier'
              ? 'price_guided'
              : input.tier === 'Accelerated Tier'
              ? 'price_accelerated'
              : 'price_free',
        },
      },
    ],
  },
});

describe('Stripe membership persistence', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'membership-stripe-test-auth-secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_membership';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_membership';
    process.env.STRIPE_PRICE_FREE = 'price_free';
    process.env.STRIPE_PRICE_GUIDED = 'price_guided';
    process.env.STRIPE_PRICE_ACCELERATED = 'price_accelerated';

    const app = express();
    app.post(
      '/api/membership/stripe/webhook',
      express.raw({ type: 'application/json' }),
      handleStripeWebhook
    );
    app.use(express.json());
    app.use('/api/membership', membershipProtectedRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    users.clear();
    memberships.clear();
    payments.length = 0;
    mockCheckoutSessionRetrieve.mockReset();
    mockConstructWebhookEvent.mockReset();
  });

  it.each([
    ['Free / Community Tier', 'no_payment_required', 0],
    ['Guided Tier', 'paid', 2200],
    ['Accelerated Tier', 'paid', 4400],
  ] as const)(
    'confirm-session persists active %s membership idempotently',
    async (tier, paymentStatus, amountTotal) => {
      const user = createMockUser(`user-${tier}`, `${tier.replace(/\W+/g, '.')}@example.com`);
      users.set(user.id, user);
      const token = createSessionToken(user.id).token;
      const session = makeSession({
        id: `cs_${tier.replace(/\W+/g, '_')}`,
        userId: user.id,
        tier,
        paymentStatus,
        amountTotal,
      });
      mockCheckoutSessionRetrieve.mockResolvedValue(session);

      const first = await requestJson({
        baseUrl,
        method: 'POST',
        path: '/api/membership/stripe/confirm-session',
        token,
        body: { sessionId: session.id },
      });
      const startDate = users.get(user.id)?.subscriptionStartDate?.getTime();
      const second = await requestJson({
        baseUrl,
        method: 'POST',
        path: '/api/membership/stripe/confirm-session',
        token,
        body: { sessionId: session.id },
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(users.get(user.id)?.tier).toBe(tier);
      expect(users.get(user.id)?.subscriptionStatus).toBe('active');
      expect(users.get(user.id)?.subscriptionStartDate?.getTime()).toBe(startDate);
      expect(memberships.get(user.id)?.tier).toBe(tier);
      expect(memberships.get(user.id)?.status).toBe('active');
      expect(payments.filter((payment) => payment.userId === user.id)).toHaveLength(1);
    }
  );

  it('rejects checkout confirmation when Stripe price and metadata tier disagree', async () => {
    const user = createMockUser('mismatch-user', 'mismatch@example.com');
    users.set(user.id, user);
    const token = createSessionToken(user.id).token;
    const session = makeSession({
      id: 'cs_mismatch',
      userId: user.id,
      tier: 'Accelerated Tier',
      paymentStatus: 'paid',
      amountTotal: 4400,
    }) as any;
    session.line_items.data[0].price.id = 'price_guided';
    mockCheckoutSessionRetrieve.mockResolvedValue(session);

    const response = await requestJson({
      baseUrl,
      method: 'POST',
      path: '/api/membership/stripe/confirm-session',
      token,
      body: { sessionId: session.id },
    });

    expect(response.status).toBe(422);
    expect(response.body?.error).toBe('Checkout session tier does not match its Stripe price');
    expect(memberships.has(user.id)).toBe(false);
    expect(payments.filter((payment) => payment.userId === user.id)).toHaveLength(0);
  });

  it('webhook checkout.session.completed persists active membership and ignores duplicate events', async () => {
    const user = createMockUser('webhook-user', 'webhook@example.com');
    users.set(user.id, user);
    const session = makeSession({
      id: 'cs_webhook',
      userId: user.id,
      tier: 'Guided Tier',
      paymentStatus: 'paid',
      amountTotal: 2200,
    });
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_checkout_completed',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const first = await requestJson({
      baseUrl,
      method: 'POST',
      path: '/api/membership/stripe/webhook',
      body: { id: 'evt_checkout_completed' },
      headers: { 'stripe-signature': 'test-signature' },
    });
    const second = await requestJson({
      baseUrl,
      method: 'POST',
      path: '/api/membership/stripe/webhook',
      body: { id: 'evt_checkout_completed' },
      headers: { 'stripe-signature': 'test-signature' },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body?.duplicate).toBe(true);
    expect(users.get(user.id)?.tier).toBe('Guided Tier');
    expect(users.get(user.id)?.subscriptionStatus).toBe('active');
    expect(memberships.get(user.id)?.status).toBe('active');
    expect(payments.filter((payment) => payment.userId === user.id)).toHaveLength(2);
  });

  it('webhook checkout.session.completed ignores mismatched tier and price metadata', async () => {
    const user = createMockUser('webhook-mismatch-user', 'webhook-mismatch@example.com');
    users.set(user.id, user);
    const session = makeSession({
      id: 'cs_webhook_mismatch',
      userId: user.id,
      tier: 'Accelerated Tier',
      paymentStatus: 'paid',
      amountTotal: 4400,
    }) as any;
    session.line_items.data[0].price.id = 'price_guided';
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_checkout_mismatch',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const response = await requestJson({
      baseUrl,
      method: 'POST',
      path: '/api/membership/stripe/webhook',
      body: { id: 'evt_checkout_mismatch' },
      headers: { 'stripe-signature': 'test-signature' },
    });

    expect(response.status).toBe(200);
    expect(memberships.has(user.id)).toBe(false);
    expect(payments.filter((payment) => payment.userId === user.id)).toHaveLength(0);
  });
});
