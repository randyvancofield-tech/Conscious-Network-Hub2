const ORIGINAL_ENV = { ...process.env };

const setProductionBaseline = () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_TOKEN_SECRET = 'phase4r-required-env-secret';
  process.env.SENSITIVE_DATA_KEY = 'phase4r-sensitive-key';
  process.env.AUTH_PERSISTENCE_BACKEND = 'shared_db';
  process.env.DATABASE_URL = 'postgresql://user:password@ep-test-pooler.neon.tech/app?sslmode=require';
  process.env.DATABASE_POOL_MODE = 'session';
  process.env.STRIPE_SECRET_KEY = 'sk_live_phase4r';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_phase4r';
  process.env.STRIPE_PRICE_FREE = 'price_1TR1ErE9ozmNlTR0peEA7Ska';
  process.env.STRIPE_PRICE_GUIDED = 'price_1TR1HpE9ozmNlTR0To2XvmuW';
  process.env.STRIPE_PRICE_ACCELERATED = 'price_1TR1JTE9ozmNlTR090ftqnGn';
  process.env.STRIPE_MODE = 'live';
  process.env.STRIPE_SUCCESS_URL = 'https://conscious-network.org/membership/success';
  process.env.STRIPE_CANCEL_URL = 'https://conscious-network.org/membership/cancel';
  process.env.FRONTEND_BASE_URL = 'https://conscious-network.org';
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASSWORD;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
};

describe('Phase 4R email environment policy', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    setProductionBaseline();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('allows production startup when email delivery is disabled', () => {
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    process.env.REQUIRE_EMAIL_DELIVERY = 'false';

    const { validateRequiredEnv, isEmailDeliveryEnabled } = require('../requiredEnv');

    expect(() => validateRequiredEnv()).not.toThrow();
    expect(isEmailDeliveryEnabled()).toBe(false);
  });

  it('requires Gmail or SMTP config when email delivery is explicitly enabled', () => {
    process.env.EMAIL_DELIVERY_ENABLED = 'true';

    const { validateRequiredEnv } = require('../requiredEnv');

    expect(() => validateRequiredEnv()).toThrow(/Email delivery is enabled\/required/);
  });
});
