import { Request, Response, Router } from 'express';
import { validateJsonBody } from '../validation/jsonSchema';
import { supportContactSchema } from '../validation/requestSchemas';
import { recordAuditEvent } from '../services/auditTelemetry';
import { createAdminMessage } from '../services/adminMessageStore';

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
      const adminMessage = await createAdminMessage({
        type: 'contact',
        subject: subject || `Contact request from ${name}`,
        message,
        submitterName: name,
        submitterEmail: email,
        route: route || null,
        category: 'contact',
        source: 'contact_modal',
        metadata: {
          delivery: 'admin_console',
          originalRoute: route || null,
        },
      });

      recordAuditEvent(req, {
        domain: 'security',
        action: 'contact_submit',
        outcome: 'success',
        statusCode: 200,
        metadata: {
          messageId: adminMessage.id,
          delivery: 'admin_console',
        },
      });

      res.json({
        success: true,
        ticketId: adminMessage.id,
        delivery: 'admin-console',
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
