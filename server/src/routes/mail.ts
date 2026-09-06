import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getAuthenticatedRole, getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { persistUploadObject, deleteUploadObjectByKey, resolveUploadObjectByKey } from '../services/uploadBlobStore';
import { MailActor, MailAttachment, MailError, listMail, getMail, getMailThread, markMailRead,
  mailRecipients, mailDestination, deliverMail, exportThread } from '../services/mailboxStore';

const router = Router();
router.use(requireCanonicalIdentity);
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const actorFor = (req: Request): MailActor => ({ id: getAuthenticatedUserId(req)!, role: getAuthenticatedRole(req) });
const handler = (action: string, fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
      recordAuditEvent(req, { domain: 'profile', action: `mail_${action}`, outcome: 'success', actorUserId: getAuthenticatedUserId(req) });
    } catch (error) {
      const status = error instanceof MailError ? error.status : 503;
      recordAuditEvent(req, { domain: 'profile', action: `mail_${action}`, outcome: status < 500 ? 'deny' : 'error',
        actorUserId: getAuthenticatedUserId(req), statusCode: status });
      // Never log body, filenames, attachment keys, or database error/configuration text.
      res.status(status).json({ error: error instanceof MailError ? error.message : 'Correspondence is temporarily unavailable. Please try again.' });
    }
  };
const uploads = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 4, fieldSize: 32000, parts: 7 } }).array('attachments', 3);
export function validateMailAttachment(file: Express.Multer.File) {
  const name = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').slice(-120) || 'attachment';
  const ext = name.split('.').pop()?.toLowerCase();
  const b = file.buffer;
  const valid = (ext === 'pdf' && file.mimetype === 'application/pdf' && b.subarray(0, 5).toString() === '%PDF-') ||
    (ext === 'png' && file.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (['jpg', 'jpeg'].includes(ext || '') && file.mimetype === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
    (ext === 'txt' && file.mimetype === 'text/plain' && !b.includes(0) && !b.toString('utf8').includes('\uFFFD'));
  if (!valid || !b.length || b.length > 5 * 1024 * 1024) throw new MailError(400, 'Attach PDF, PNG, JPEG, or UTF-8 text files, up to 5 MB each.');
  return name;
}
router.get('/recipients', handler('recipients', async (req, res) => {
  res.json({ recipients: await mailRecipients(actorFor(req), String(req.query.search || '').slice(0, 200)) });
}));
router.get('/messages', handler('list', async (req, res) => {
  res.json(await listMail(actorFor(req), typeof req.query.cursor === 'string' ? req.query.cursor : undefined));
}));
router.get('/messages/:id/thread', handler('read', async (req, res) => {
  res.json({ messages: await getMailThread(actorFor(req), req.params.id) });
}));
router.patch('/messages/:id/read', handler('read_state', async (req, res) => {
  if (typeof req.body?.read !== 'boolean') throw new MailError(400, 'A read state is required');
  await markMailRead(actorFor(req), req.params.id, req.body.read);
  res.json({ success: true });
}));
router.get('/messages/:id/export', handler('export', async (req, res) => {
  const messages = await getMailThread(actorFor(req), req.params.id);
  res.setHeader('Content-Disposition', 'attachment; filename="HCN-correspondence.txt"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('text/plain').send(exportThread(messages));
}));
router.get('/messages/:id/attachments/:attachmentId', handler('attachment_download', async (req, res) => {
  const message = await getMail(actorFor(req), req.params.id);
  const attachment = (message.metadata?.attachments as MailAttachment[] | undefined)?.find(a => a.id === req.params.attachmentId);
  if (!attachment) throw new MailError(404, 'Attachment not found');
  const object = await resolveUploadObjectByKey(attachment.objectKey);
  if (!object) throw new MailError(404, 'Attachment not found');
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.type('application/octet-stream').send(object.buffer);
}));
router.post('/messages', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }),
  (req: Request, res: Response, next: NextFunction) => uploads(req, res, err => {
    if (err) { res.status(400).json({ error: 'Use up to three attachments, 5 MB each, and a message up to 8,000 characters.' }); return; }
    next();
  }), handler('send', async (req, res) => {
    const actor = actorFor(req);
    const allowed = ['subject', 'message', 'recipientId', 'replyTo'];
    if (Object.keys(req.body || {}).some(key => !allowed.includes(key))) throw new MailError(400, 'Unsupported correspondence field');
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    if (!message || message.length > 8000 || !subject || subject.length > 240) throw new MailError(400, 'A subject (up to 240 characters) and message (up to 8,000 characters) are required.');
    const destination = await mailDestination(actor, { recipientId: String(req.body.recipientId || ''), replyTo: String(req.body.replyTo || '') });
    const files = (req.files || []) as Express.Multer.File[];
    const names = files.map(validateMailAttachment);
    const attachments: MailAttachment[] = [];
    const messageId = `adminmsg_${crypto.randomUUID()}`;
    let writeStarted = false;
    try {
      for (const [index, file] of files.entries()) {
        const object = await persistUploadObject({ userId: actor.id, originalName: names[index], buffer: file.buffer,
          mimeType: file.mimetype, access: 'private', category: 'correspondence' });
        attachments.push({ id: crypto.randomUUID(), objectKey: object.objectKey, name: names[index], size: file.size, mimeType: file.mimetype });
      }
      writeStarted = true;
      const result = await deliverMail(actor, destination, { subject, message, attachments }, messageId);
      res.status(201).json({ success: true, id: result.id });
    } catch (error) {
      if (writeStarted) {
        try {
          // A lost database acknowledgement must not delete a delivered attachment.
          await getMail(actor, messageId);
          res.status(201).json({ success: true, id: messageId });
          return;
        } catch (lookupError) {
          if (!(lookupError instanceof MailError && lookupError.status === 404)) {
            console.error('[MAIL] Delivery receipt uncertain; attachment cleanup deferred.');
            throw error;
          }
        }
      }
      await Promise.allSettled(attachments.map(a => deleteUploadObjectByKey(a.objectKey)));
      throw error;
    }
  }));
export default router;
