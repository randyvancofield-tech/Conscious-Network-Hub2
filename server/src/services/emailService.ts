import nodemailer, { Transporter } from 'nodemailer';
import { resolveEmailConfig, emailFailureDiagnostics, PRODUCTION_EMAIL_ADDRESS } from './emailConfig';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail = PRODUCTION_EMAIL_ADDRESS;
  private isConfigured = false;
  private initialized = false;

  private initializeTransport(): void {
    if (this.initialized) return;
    this.initialized = true;
    const config = resolveEmailConfig();
    this.fromEmail = config.from;
    if (!config.enabled) {
      console.info('[EmailService] Outbound delivery disabled');
      return;
    }
    if (!config.valid) {
      console.error('[EmailService] Invalid outbound Gmail configuration', { failureClass: 'configuration' });
      return;
    }
    try {
      this.transporter = nodemailer.createTransport(config.transport);
      this.isConfigured = true;
      console.info('[EmailService] Gmail transport configured; authentication is verified on send');
    } catch (error) {
      console.error('[EmailService] Transport initialization failed', emailFailureDiagnostics(error));
      this.transporter = null;
      this.isConfigured = false;
    }
  }

  async send(options: EmailOptions): Promise<{ ok: boolean; [key: string]: any }> {
    this.initializeTransport();
    if (!this.isConfigured || !this.transporter) {
      if (resolveEmailConfig().enabled) return { ok: false, error: 'Email configuration invalid' };
      console.log('[EmailService.send] Skipped (not configured)');
      return { ok: true, skipped: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log('[EmailService.send] Email sent:', info.messageId);
      return { ok: true, messageId: info.messageId };
    } catch (error) {
      console.error('[EmailService.send] Delivery failed', emailFailureDiagnostics(error));
      return { ok: false, error: 'Email send failed' };
    }
  }

  configured(): boolean {
    this.initializeTransport();
    return this.isConfigured;
  }

}

export default new EmailService();
