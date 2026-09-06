jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
jest.mock('../requiredEnv', () => ({ isEmailDeliveryEnabled: jest.fn(() => true) }));

describe('email sender configuration', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    for (const key of ['EMAIL_FROM', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_SERVICE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']) delete process.env[key];
  });
  afterEach(() => { process.env = { ...originalEnv }; jest.restoreAllMocks(); });
  const setup = () => {
    const mailer = require('nodemailer').default;
    const sendMail = jest.fn(async () => ({ messageId: 'test-message' }));
    mailer.createTransport.mockReturnValue({ sendMail });
    return { mailer, sendMail, service: require('../services/emailService').default };
  };
  const message = { to: 'recipient@example.com', subject: 'Test', html: '<p>Test</p>' };

  it('uses the authenticated Gmail account despite a stale domain sender override', async () => {
    process.env.EMAIL_USER = 'higherconscious.network1@gmail.com';
    process.env.EMAIL_PASSWORD = 'unit-test-placeholder';
    process.env.EMAIL_FROM = 'guidance@higherconscious.network';
    const { service, sendMail } = setup();
    expect((await service.send(message)).skipped).toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'higherconscious.network1@gmail.com' }));
  });
  it('preserves explicit From for a separately configured SMTP service', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'; process.env.SMTP_PORT = '465';
    process.env.EMAIL_FROM = 'sender@example.com';
    const { service, sendMail } = setup();
    await service.send(message);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'sender@example.com' }));
  });
  it('skips without credentials and does not queue a message', async () => {
    const { service, mailer } = setup();
    expect(await service.send(message)).toEqual({ ok: true, skipped: true });
    expect(mailer.createTransport).not.toHaveBeenCalled();
  });
  it('keeps delivery disabled even when configuration is present', async () => {
    process.env.EMAIL_USER = 'higherconscious.network1@gmail.com'; process.env.EMAIL_PASSWORD = 'unit-test-placeholder';
    require('../requiredEnv').isEmailDeliveryEnabled.mockReturnValue(false);
    const { service, mailer } = setup();
    expect(await service.send(message)).toEqual({ ok: true, skipped: true });
    expect(mailer.createTransport).not.toHaveBeenCalled();
  });
  it('does not log raw transport failures', async () => {
    process.env.EMAIL_USER = 'higherconscious.network1@gmail.com'; process.env.EMAIL_PASSWORD = 'unit-test-placeholder';
    const { service, sendMail } = setup();
    sendMail.mockRejectedValueOnce(new Error('private transport details') as never);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await service.send(message)).ok).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private transport details');
  });
});
