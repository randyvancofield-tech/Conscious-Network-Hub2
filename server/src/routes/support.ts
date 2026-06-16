import { Request, Response, Router } from 'express';
import { validateJsonBody } from '../validation/jsonSchema';
import { supportContactSchema } from '../validation/requestSchemas';
import { recordAuditEvent } from '../services/auditTelemetry';
import { createAdminMessage } from '../services/adminMessageStore';
import emailService from '../services/emailService';

const router = Router();

const normalizeText = (value: unknown, maxLength: number): string =>
  String(value || '').trim().slice(0, maxLength);

const normalizeEmail = (value: unknown): string =>
  normalizeText(value, 320).toLowerCase();

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return map[char];
  });

router.post(
  '/contact',
  validateJsonBody(supportContactSchema),
  async (req: Request, res: Response): Promise<void> => {
    const name = normalizeText(req.body?.name, 200);
    const email = normalizeEmail(req.body?.email);
    const subject = normalizeText(req.body?.subject || 'Platform contact request', 200);
    const message = normalizeText(req.body?.message, 5000);
    const route = normalizeText(req.body?.route, 512);
    const isExecutiveInquiry =
      route.includes('/conscious-careers/entrepreneurship-support#executive-inquiry') ||
      subject.toLowerCase().includes('high executive contact');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      recordAuditEvent(req, {
        domain: 'security',
        action: 'contact_submit',
        outcome: 'deny',
        statusCode: 400,
        metadata: { reason: 'invalid_email' },
      });
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }

    try {
      const emailConfigured = emailService.configured();
      const recipientEmail = emailService.adminRecipient();
      const adminMessage = await createAdminMessage({
        type: 'contact',
        subject: subject || `Contact request from ${name}`,
        message,
        priority: isExecutiveInquiry ? 'high' : 'normal',
        submitterName: name,
        submitterEmail: email,
        route: route || null,
        category: isExecutiveInquiry ? 'executive_inquiry' : 'contact',
        source: isExecutiveInquiry ? 'conscious_careers_executive_inquiry' : 'contact_modal',
        metadata: {
          delivery: 'admin_console',
          emailNotification: emailConfigured ? 'attempt_pending' : 'configuration_required',
          targetRecipient: recipientEmail,
          originalRoute: route || null,
          intakeType: isExecutiveInquiry ? 'high_executive_contact_general_inquiry' : 'contact',
        },
      });
      const emailResult = emailConfigured
        ? await emailService.send({
            to: recipientEmail,
            subject: `[CNH Support] ${subject || 'Platform contact request'}`,
            html: [
              '<h2>New CNH Support Request</h2>',
              `<p><strong>Ticket:</strong> ${escapeHtml(adminMessage.id)}</p>`,
              `<p><strong>Source:</strong> ${escapeHtml(isExecutiveInquiry ? 'Conscious Careers executive inquiry' : 'Contact modal')}</p>`,
              `<p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p>`,
              `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
              `<p><strong>Route:</strong> ${escapeHtml(route || 'Not provided')}</p>`,
              `<p><strong>Category:</strong> ${escapeHtml(isExecutiveInquiry ? 'executive_inquiry' : 'contact')}</p>`,
              '<hr/>',
              `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
              `<hr/><small>${new Date().toISOString()}</small>`,
            ].join(''),
            text: [
              `Ticket: ${adminMessage.id}`,
              `Source: ${isExecutiveInquiry ? 'Conscious Careers executive inquiry' : 'Contact modal'}`,
              `Name: ${name || 'Not provided'}`,
              `Email: ${email}`,
              `Route: ${route || 'Not provided'}`,
              `Message: ${message}`,
            ].join('\n'),
          })
        : { ok: true, skipped: true, reason: 'email_not_configured' };
      const emailStatus = emailConfigured
        ? emailResult.ok && !emailResult.skipped
          ? 'sent'
          : 'failed'
        : 'configuration-required';

      recordAuditEvent(req, {
        domain: 'security',
        action: 'contact_submit',
        outcome: 'success',
        statusCode: 200,
        metadata: {
          messageId: adminMessage.id,
          delivery: 'admin_console',
          emailStatus,
        },
      });

      res.json({
        success: true,
        ticketId: adminMessage.id,
        delivery: {
          internal: 'admin-console',
          email: emailStatus,
          recipient: recipientEmail,
        },
        emailConfigured,
        emailSent: emailStatus === 'sent',
      });
    } catch (error) {
      console.error('[Support] Failed to create admin inbox contact message', error);
      recordAuditEvent(req, {
        domain: 'security',
        action: 'contact_submit',
        outcome: 'error',
        statusCode: 500,
        metadata: {
          reason: 'admin_message_create_failed',
        },
      });
      res.status(500).json({ error: 'Contact request could not be recorded. Please try again later.' });
    }
  }
);

export default router;
