// Outbound mail only. These credentials are never application-login credentials.
export const PRODUCTION_EMAIL_ADDRESS = 'higherconscious.network1@gmail.com';
const text = (key: string) => String(process.env[key] || '').trim();
const flag = (key: string): boolean | undefined => {
  const value = text(key).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  return undefined;
};
export const isEmailDeliveryEnabled = () => flag('EMAIL_DELIVERY_ENABLED') ?? flag('REQUIRE_EMAIL_DELIVERY') ?? false;
export const isEmailDeliveryRequired = () => flag('REQUIRE_EMAIL_DELIVERY') === true || isEmailDeliveryEnabled();
export const resolveEmailConfig = () => {
  const service = text('EMAIL_SERVICE').toLowerCase() || 'gmail';
  const user = text('EMAIL_USER');
  const enabled = isEmailDeliveryEnabled();
  const gmail = service === 'gmail';
  const valid = gmail && user === PRODUCTION_EMAIL_ADDRESS && Boolean(text('EMAIL_PASSWORD')) &&
    !(flag('REQUIRE_EMAIL_DELIVERY') === true && !enabled);
  return {
    enabled, valid, service: 'gmail' as const,
    from: PRODUCTION_EMAIL_ADDRESS,
    adminRecipient: text('ADMIN_NOTIFICATION_EMAIL') || PRODUCTION_EMAIL_ADDRESS,
    transport: {
      service: 'gmail', auth: { user, pass: process.env.EMAIL_PASSWORD || '' },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
      logger: false, debug: false,
    },
  };
};
export const hasEmailDeliveryConfig = () => resolveEmailConfig().valid;

// Only fixed labels/numeric SMTP status are safe to log; never raw messages/responses/commands.
export const emailFailureDiagnostics = (error: unknown) => {
  const input = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const knownCodes = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS', 'ENOTFOUND', 'ETLS', 'ESOCKET', 'EENVELOPE', 'EMESSAGE'];
  const code = knownCodes.includes(String(input.code)) ? String(input.code) : 'UNKNOWN';
  const responseCode = typeof input.responseCode === 'number' && Number.isInteger(input.responseCode) && input.responseCode >= 400 && input.responseCode <= 599 ? input.responseCode : null;
  const failureClass = code === 'EAUTH' ? 'authentication' :
    ['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS', 'ENOTFOUND'].includes(code) ? 'connection' :
    ['ETLS', 'ESOCKET'].includes(code) ? 'tls_or_socket' :
    responseCode !== null || ['EENVELOPE', 'EMESSAGE'].includes(code) ? 'delivery_rejected' : 'unknown';
  return { failureClass, code, responseCode };
};
