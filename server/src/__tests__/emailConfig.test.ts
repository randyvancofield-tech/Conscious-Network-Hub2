import { resolveEmailConfig, emailFailureDiagnostics, isEmailDeliveryRequired } from '../services/emailConfig';
const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });
it('uses one sender and recipient policy, ignoring old aliases', () => {
  process.env.EMAIL_USER = 'higherconscious.network1@gmail.com';
  process.env.EMAIL_PASSWORD = 'unit-test-placeholder';
  process.env.EMAIL_SERVICE = 'gmail';
  process.env.EMAIL_DELIVERY_ENABLED = 'true';
  process.env.EMAIL_FROM = 'noreply@example.com';
  process.env.SUPPORT_EMAIL_TO = 'old@example.com';
  delete process.env.ADMIN_NOTIFICATION_EMAIL;
  const config = resolveEmailConfig();
  expect(config.valid).toBe(true);
  expect(config.from).toBe('higherconscious.network1@gmail.com');
  expect(config.adminRecipient).toBe(config.from);
  expect(config.transport.connectionTimeout).toBe(15000);
});
it('rejects required-but-disabled delivery', () => {
  process.env.EMAIL_DELIVERY_ENABLED = 'false'; process.env.REQUIRE_EMAIL_DELIVERY = 'true';
  expect(isEmailDeliveryRequired()).toBe(true);
  expect(resolveEmailConfig().valid).toBe(false);
});
it('rejects a domain mailbox as Gmail identity', () => {
  process.env.EMAIL_USER = 'guidance@higherconscious.network';
  expect(resolveEmailConfig().valid).toBe(false);
});
it.each([['EAUTH', 'authentication'], ['ETIMEDOUT', 'connection'], ['ETLS', 'tls_or_socket'], ['EENVELOPE', 'delivery_rejected']])('classifies %s without logging raw values', (code, failureClass) => {
  expect(emailFailureDiagnostics({ code, responseCode: 535, message: 'private', response: 'private', command: 'private', auth: 'private' }))
    .toEqual({ code, failureClass, responseCode: 535 });
});
it('does not echo attacker-controlled diagnostic fields', () => {
  expect(emailFailureDiagnostics({ code: 'private', responseCode: 'private' }))
    .toEqual({ code: 'UNKNOWN', failureClass: 'unknown', responseCode: null });
});
