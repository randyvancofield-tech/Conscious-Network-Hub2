import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { validateJsonBody } from '../validation/jsonSchema';
import { supportContactSchema } from '../validation/requestSchemas';
import emailService from '../services/emailService';
import { recordAuditEvent } from '../services/auditTelemetry';

const router = Router();

const normalizeText = (value: unknown, maxLength: number): string =>
  String(value || '').trim().slice(0, maxLength);

const normalizeEmail = (value: unknown): string =>
  normalizeText(value, 320).toLowerCase();

router.post(
  '/contact',
  validateJsonBody(supportContactSchema),
  async (req: Request, res: Response): Promise<void> => {
    const name = normalizeText(req.body?.name, 200);
    const email = normalizeEmail(req.body?.email);
    const subject = normalizeText(req.body?.subject || 'Platform contact request', 200);
    const message = normalizeText(req.body?.message, 5000);
    const route = normalizeText(req.body?.route, 512);
    const ticketId = `contact_${crypto.randomUUID()}`;

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

    const result = await emailService.sendIssueReport({
      userEmail: email,
      title: subject || `Contact request from ${name}`,
      description: [
        `Ticket: ${ticketId}`,
        `Name: ${name}`,
        `Email: ${email}`,
        route ? `Route: ${route}` : '',
        '',
        message,
      ]
        .filter(Boolean)
        .join('\n'),
      category: 'contact',
      priority: 'normal',
    });

    recordAuditEvent(req, {
      domain: 'security',
      action: 'contact_submit',
      outcome: result.ok ? 'success' : 'error',
      statusCode: result.ok ? 200 : 502,
      metadata: {
        ticketId,
        emailDeliveryConfigured: emailService.configured(),
        emailSkipped: result.skipped === true,
      },
    });

    if (!result.ok) {
      res.status(502).json({ error: 'Contact request could not be delivered. Please try again later.' });
      return;
    }

    res.json({
      success: true,
      ticketId,
      delivery: result.skipped === true ? 'accepted-dev-mode' : 'sent',
    });
  }
);

export default router;
