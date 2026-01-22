import nodemailer, { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string;
  private isConfigured = false;

  constructor() {
    this.fromEmail =
      process.env.EMAIL_FROM || 'noreply@consciousnetworkhub.com';

    try {
      // Preferred: Gmail / service auth
      if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        this.transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
        this.isConfigured = true;
        console.log('[EmailService] Gmail transport configured');
        return;
      }

      // Secondary: SMTP
      if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: process.env.SMTP_SECURE === 'true',
          auth:
            process.env.SMTP_USER && process.env.SMTP_PASSWORD
              ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASSWORD,
                }
              : undefined,
        });
        this.isConfigured = true;
        console.log('[EmailService] SMTP transport configured');
        return;
      }

      // Dev fallback (NO sending, NO crashing)
      console.log('[EmailService] No email config — safe dev mode');
    } catch (err) {
      console.error('[EmailService] Transport init failed:', err);
      this.transporter = null;
      this.isConfigured = false;
    }
  }

  /**
   * Send email — ALWAYS resolves, NEVER throws, NEVER hangs
   */
  async send(options: EmailOptions): Promise<{ ok: boolean; [key: string]: any }> {
    if (!this.isConfigured || !this.transporter) {
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
      console.error('[EmailService.send] Send failed:', error);
      return { ok: false, error: 'Email send failed' };
    }
  }

  /**
   * Send Issue / Ticket
   */
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
      to: 'higherconscious.network1@gmail.com',
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

