import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from './prismaClient';
import { createAdminMessage } from './adminMessageStore';
import { revealSensitiveText } from './sensitiveDataPolicy';

export interface MailActor { id: string; role: string }
export const ADMIN_MAILBOX = 'administration';
const legacySources = ['provider_applicant_follow_up', 'ai_report_issue', 'provider_application_intake'];
export class MailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface MailAttachment { id: string; name: string; size: number; mimeType: string; objectKey: string }
export interface MailRow {
  id: string; threadId: string; subject: string; message: string; source: string;
  senderId: string | null; senderName: string; recipientId: string; recipientName: string;
  createdAt: Date; metadata: any; readAt: Date | null;
}
export const canReadMail = (actor: MailActor, row: MailRow): boolean => actor.role === 'admin' ||
  (row.source === 'lifecycle_notice' && row.recipientId === actor.id) ||
  (row.source === 'internal_mail' && (row.senderId === actor.id || row.recipientId === actor.id)) ||
  (legacySources.includes(row.source) && row.senderId === actor.id);
const participantFilter = (actor: MailActor) => actor.role === 'admin' ? Prisma.sql`TRUE` : Prisma.sql`
  ((m."source" = 'internal_mail' AND (m."submitterUserId" = ${actor.id} OR m."metadata"->>'recipientUserId' = ${actor.id}))
   OR (m."source" IN (${Prisma.join(legacySources)}) AND m."submitterUserId" = ${actor.id}))`;

// The administrative mailbox is shared by canonical administrators. Email addresses are
// display data only: an anonymous submission never grants mailbox access to that address.
const correspondence = (actor: MailActor) => Prisma.sql`
  SELECT m."id", COALESCE(m."metadata"->>'threadId', m."id") AS "threadId",
    m."subject", m."message", m."source", m."submitterUserId" AS "senderId",
    COALESCE(u."name", m."submitterName", 'Visitor') AS "senderName",
    COALESCE(m."metadata"->>'recipientUserId', 'administration') AS "recipientId",
    COALESCE(r."name", 'HCN Administration') AS "recipientName",
    m."createdAt", m."metadata", NULL::timestamptz AS "readAt"
  FROM "AdminMessage" m LEFT JOIN "User" u ON u."id" = m."submitterUserId"
  LEFT JOIN "User" r ON r."id" = m."metadata"->>'recipientUserId'
  WHERE ${participantFilter(actor)}
  UNION ALL
  SELECT 'notice:' || n."id", 'notice:' || n."id", n."title", n."body", 'lifecycle_notice',
    NULL, 'HCN Administration', n."userId", COALESCE(u."name", 'HCN user'),
    n."createdAt", NULL::jsonb, n."readAt"
  FROM "Notification" n LEFT JOIN "User" u ON u."id" = n."userId"
  WHERE n."type" IN ('provider_application_submitted', 'provider_application_status', 'provider_application_approved')
    AND COALESCE(n."metadata"->>'internalMessageId', '') = ''
    AND ${actor.role === 'admin' ? Prisma.sql`TRUE` : Prisma.sql`n."userId" = ${actor.id}`}
`;
export const publicMail = (row: MailRow, actor: MailActor) => ({
  id: row.id, threadId: row.threadId, subject: row.subject,
  message: ['internal_mail', 'provider_applicant_follow_up'].includes(row.source)
    ? revealSensitiveText('providerApplicant.followUp', row.message) || '' : row.message,
  sender: { id: row.senderId, name: row.senderName },
  recipient: { id: row.recipientId, name: row.recipientName },
  createdAt: new Date(row.createdAt).toISOString(),
  sent: row.senderId === actor.id || (actor.role === 'admin' && row.recipientId !== ADMIN_MAILBOX),
  read: row.source === 'lifecycle_notice' ? !!row.readAt : !!row.metadata?.mailRead?.[actor.id],
  canReply: row.recipientId !== ADMIN_MAILBOX || !!row.senderId,
  attachments: ((row.metadata?.attachments || []) as MailAttachment[])
    .map(({ id, name, size, mimeType }) => ({ id, name, size, mimeType })),
});
export async function listMail(actor: MailActor, cursor?: string) {
  let after = Prisma.empty;
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (typeof parsed.id !== 'string' || !Number.isFinite(Date.parse(parsed.date))) throw new Error();
      after = Prisma.sql`WHERE (c."createdAt", c."id") < (${new Date(parsed.date)}, ${parsed.id})`;
    } catch { throw new MailError(400, 'Invalid mailbox cursor'); }
  }
  const rows = await getPrisma().$queryRaw<MailRow[]>(Prisma.sql`
    SELECT * FROM (${correspondence(actor)}) c ${after} ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 51`);
  const page = rows.slice(0, 50);
  const last = page[page.length - 1];
  return { messages: page.filter(row => canReadMail(actor, row)).map(row => publicMail(row, actor)), nextCursor: rows.length > 50
    ? Buffer.from(JSON.stringify({ date: new Date(last.createdAt).toISOString(), id: last.id })).toString('base64url') : null };
}
export async function getMail(actor: MailActor, id: string): Promise<MailRow> {
  const rows = await getPrisma().$queryRaw<MailRow[]>(Prisma.sql`
    SELECT * FROM (${correspondence(actor)}) c WHERE c."id" = ${id} LIMIT 1`);
  if (!rows[0] || !canReadMail(actor, rows[0])) throw new MailError(404, 'Correspondence not found');
  return rows[0];
}
export async function getMailThread(actor: MailActor, id: string) {
  const root = await getMail(actor, id);
  const rows = await getPrisma().$queryRaw<MailRow[]>(Prisma.sql`
    SELECT * FROM (${correspondence(actor)}) c WHERE c."threadId" = ${root.threadId}
    ORDER BY c."createdAt", c."id" LIMIT 1001`);
  if (rows.length > 1000) throw new MailError(413, 'This thread exceeds the download limit. Contact administration for an archive.');
  return rows.filter(row => canReadMail(actor, row)).map(row => publicMail(row, actor));
}
export async function markMailRead(actor: MailActor, id: string, read: boolean) {
  const row = await getMail(actor, id);
  if (row.source === 'lifecycle_notice') {
    // A shared admin view must not mark the applicant's notification read.
    if (row.recipientId === actor.id) await getPrisma().notification.update({
      where: { id: id.slice(7) }, data: { readAt: read ? new Date() : null },
    });
  } else {
    // Atomic per-identity JSON update avoids lost read state when participants act concurrently.
    await getPrisma().$executeRaw(Prisma.sql`UPDATE "AdminMessage" SET "metadata" =
      jsonb_set(COALESCE("metadata", '{}'::jsonb), '{mailRead}',
        COALESCE("metadata"->'mailRead', '{}'::jsonb) || jsonb_build_object(${actor.id}::text, ${read}::boolean)),
      "updatedAt" = now() WHERE "id" = ${id}`);
  }
}
export async function mailRecipients(actor: MailActor, search: string) {
  if (actor.role !== 'admin') return [{ id: ADMIN_MAILBOX, name: 'HCN Administration', role: 'admin', providerApprovalStatus: null }];
  return getPrisma().user.findMany({
    where: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] },
    select: { id: true, name: true, email: true, role: true, providerApprovalStatus: true },
    take: 50, orderBy: { name: 'asc' },
  });
}
export async function mailDestination(actor: MailActor, input: { recipientId?: string; replyTo?: string }) {
  if (input.replyTo) {
    const parent = await getMail(actor, input.replyTo);
    const recipientId = actor.role === 'admin'
      ? parent.recipientId === ADMIN_MAILBOX ? parent.senderId : parent.recipientId
      : ADMIN_MAILBOX;
    if (!recipientId) throw new MailError(400, 'This visitor has no authenticated mailbox. Use your established contact process.');
    return { recipientId, threadId: parent.threadId, subject: parent.subject, applicantId: parent.metadata?.applicantId as string | undefined };
  }
  const recipientId = input.recipientId || ADMIN_MAILBOX;
  if (actor.role !== 'admin' && recipientId !== ADMIN_MAILBOX) throw new MailError(403, 'Correspondence is available with HCN Administration.');
  if (recipientId !== ADMIN_MAILBOX) {
    const user = await getPrisma().user.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!user) throw new MailError(404, 'Recipient not found');
  }
  return { recipientId, threadId: `thread_${crypto.randomUUID()}`, subject: '', applicantId: undefined };
}
export async function deliverMail(actor: MailActor, destination: Awaited<ReturnType<typeof mailDestination>>,
  input: { subject: string; message: string; attachments: MailAttachment[] }, id?: string) {
  return createAdminMessage({ id, type: 'general', source: 'internal_mail', subject: destination.subject || input.subject,
    message: input.message, submitterUserId: actor.id,
    metadata: { mailVersion: 1, threadId: destination.threadId, recipientUserId: destination.recipientId,
      attachments: input.attachments, mailRead: { [actor.id]: true }, applicantId: destination.applicantId || null },
  });
}
export function exportThread(messages: ReturnType<typeof publicMail>[]) {
  return 'Higher Conscious Network — Correspondence\n\n' + messages.map(m =>
    `Subject: ${m.subject}\nFrom: ${m.sender.name}\nTo: ${m.recipient.name}\nDate: ${m.createdAt}\nReference: ${m.id}\n\n${m.message}\n\nAttachments: ${m.attachments.map(a => `${a.name} (${a.size} bytes)`).join(', ') || 'None'}\n`
  ).join('\n--------------------\n\n');
}

// A status update must never be reported as failed after its account/application changes
// have committed. Return delivery explicitly so administration can retry correspondence.
export async function deliverLifecycleCorrespondence(input: {
  userId: string; actorUserId?: string | null; subject: string; message: string; applicantId: string;
}): Promise<string | null> {
  try {
    const result = await createAdminMessage({ type: 'provider', source: 'internal_mail',
      subject: input.subject, message: input.message, submitterUserId: input.actorUserId,
      submitterName: 'HCN Administration', metadata: { mailVersion: 1,
        recipientUserId: input.userId, applicantId: input.applicantId,
        threadId: `application_${input.applicantId}`, attachments: [] },
    });
    return result.id;
  } catch {
    console.error('[MAIL] Lifecycle correspondence persistence failed; administrative resend required.');
    return null;
  }
}
