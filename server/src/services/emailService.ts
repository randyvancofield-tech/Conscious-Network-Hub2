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

  adminRecipient(): string {
    return resolveEmailConfig().adminRecipient;
  }

  async sendIssueReport(options: {
    userEmail?: string;
    title: string;
    description: string;
    category: string;
    priority?: string;
    analysis?: string;
  }): Promise<{ ok: boolean; [key: string]: any }> {
    const html = `
      <h2>New Platform Issue</h2>
      <p><strong>Title:</strong> ${this.escape(options.title)}</p>
      <p><strong>Category:</strong> ${this.escape(options.category)}</p>
      ${options.priority ? `<p><strong>Priority:</strong> ${this.escape(options.priority)}</p>` : ''}
      ${options.userEmail ? `<p><strong>User:</strong> ${this.escape(options.userEmail)}</p>` : ''}
      <hr/>
      <p>${this.escape(options.description).replace(/\n/g, '<br/>')}</p>
      ${options.analysis ? `<hr/><p><strong>AI Analysis:</strong><br/>${this.escape(options.analysis)}</p>` : ''}
      <hr/>
      <small>${new Date().toISOString()}</small>
    `;

    return this.send({
      to: this.adminRecipient(),
      subject: `[${options.category.toUpperCase()}] ${options.title}`,
      html,
      text: options.description,
    });
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return map[char];
    });
  }
}

export default new EmailService();
