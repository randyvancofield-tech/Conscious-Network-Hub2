type SmsResult = {
  ok: boolean;
  skipped?: boolean;
  provider?: string;
  error?: string;
};

const isProduction = (): boolean => String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const trimEnv = (name: string): string => String(process.env[name] || '').trim();

class SmsService {
  private twilioAccountSid = trimEnv('TWILIO_ACCOUNT_SID');
  private twilioAuthToken = trimEnv('TWILIO_AUTH_TOKEN');
  private twilioFromNumber = trimEnv('TWILIO_FROM_NUMBER');

  isConfigured(): boolean {
    return Boolean(this.twilioAccountSid && this.twilioAuthToken && this.twilioFromNumber);
  }

  async sendSecurityCode(input: {
    to: string;
    code: string;
    purpose: 'signin' | 'enrollment';
  }): Promise<SmsResult> {
    if (!this.isConfigured()) {
      if (!isProduction()) {
        console.log('[SmsService] Skipped SMS delivery in dev mode', {
          to: input.to.replace(/\d(?=\d{4})/g, '*'),
          code: input.code,
          purpose: input.purpose,
        });
        return { ok: true, skipped: true, provider: 'dev-log' };
      }
      return { ok: false, error: 'SMS delivery is not configured' };
    }

    const body =
      input.purpose === 'signin'
        ? `Your Conscious Network Hub sign-in code is ${input.code}. It expires in 10 minutes.`
        : `Your Conscious Network Hub verification code is ${input.code}. It expires in 10 minutes.`;

    const params = new URLSearchParams({
      To: input.to,
      From: this.twilioFromNumber,
      Body: body,
    });

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
          this.twilioAccountSid
        )}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.twilioAccountSid}:${this.twilioAuthToken}`
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[SmsService] Twilio send failed', {
          status: response.status,
          body: errorText.slice(0, 500),
        });
        return { ok: false, provider: 'twilio', error: 'SMS provider rejected the message' };
      }

      return { ok: true, provider: 'twilio' };
    } catch (error) {
      console.error('[SmsService] SMS send failed', error);
      return { ok: false, provider: 'twilio', error: 'SMS delivery failed' };
    }
  }
}

export default new SmsService();

