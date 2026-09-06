import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';
import { canReadMail, publicMail, MailRow, mailDestination, exportThread, deliverLifecycleCorrespondence } from '../services/mailboxStore';

const mockUsers = new Map<string, any>();
const mockRows: MailRow[] = [];
const mockCreate = jest.fn(async (input: any) => {
  const row: MailRow = { id: input.id || `message-${mockRows.length}`, threadId: input.metadata?.threadId,
    subject: input.subject, message: input.message, source: input.source,
    senderId: input.submitterUserId || null, senderName: input.submitterName || input.submitterUserId || 'HCN Administration',
    recipientId: input.metadata?.recipientUserId || 'administration', recipientName: 'Recipient',
    createdAt: new Date(), metadata: input.metadata, readAt: null };
  mockRows.push(row); return row;
});
const mockQuery = jest.fn(async (sql: any) => {
  if (sql.text.includes('WHERE c."id" =')) return mockRows.filter(r => r.id === sql.values[sql.values.length - 1]);
  if (sql.text.includes('WHERE c."threadId" =')) return mockRows.filter(r => r.threadId === sql.values[sql.values.length - 1]);
  return [...mockRows].reverse().slice(0, 51);
});
const mockExecute = jest.fn(async (sql: any) => {
  const [actor, read, id] = sql.values;
  const row = mockRows.find(r => r.id === id);
  if (row) row.metadata = { ...row.metadata, mailRead: { ...row.metadata?.mailRead, [actor]: read } };
  return 1;
});
const mockPersist = jest.fn(async () => ({ objectKey: 'private-storage-key' }));
const mockResolve = jest.fn(async () => ({ buffer: Buffer.from('private file'), mimeType: 'text/plain' }));
const mockDelete = jest.fn(async () => true);
jest.mock('../services/prismaClient', () => ({ getPrisma: () => ({
  $queryRaw: mockQuery, $executeRaw: mockExecute,
  user: {
    findUnique: jest.fn(async ({ where }: any) => mockUsers.get(where.id) || null),
    findMany: jest.fn(async () => Array.from(mockUsers.values()).map(({ id, name, email, role, providerApprovalStatus }) => ({ id, name, email, role, providerApprovalStatus }))),
  },
  notification: { update: jest.fn(async ({ where, data }: any) => {
    const row = mockRows.find(r => r.id === `notice:${where.id}`); if (row) row.readAt = data.readAt; return row;
  }) },
}) }));
jest.mock('../services/adminMessageStore', () => ({ createAdminMessage: (input: any) => mockCreate(input) }));
jest.mock('../services/uploadBlobStore', () => ({
  persistUploadObject: (...args: any[]) => (mockPersist as any)(...args),
  resolveUploadObjectByKey: (...args: any[]) => (mockResolve as any)(...args),
  deleteUploadObjectByKey: (...args: any[]) => (mockDelete as any)(...args),
}));
jest.mock('../services/persistenceStore', () => ({ localStore: { getUserById: async (id: string) => mockUsers.get(id) || null } }));
jest.mock('../services/userSessionStore', () => ({ getUserSessionById: jest.fn(async () => null), revokeUserSession: jest.fn() }));
jest.mock('../services/auditTelemetry', () => ({ recordAuditEvent: jest.fn() }));
const mailRouter = require('../routes/mail').default;
let server: http.Server;
let base: string;
const request = async (user: string | null, path: string, method = 'GET', body?: any) => {
  const headers: Record<string, string> = {};
  if (user) headers.Authorization = `Bearer ${createSessionToken(user).token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const result = await fetch(`${base}/api/mail${path}`, { method, headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const text = await result.text();
  return { status: result.status, headers: result.headers, text, body: result.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
};
const seed = (overrides: Partial<MailRow> = {}): MailRow => ({
  id: 'root', threadId: 'thread', subject: 'Application update', message: 'Please send your credential.',
  source: 'internal_mail', senderId: 'admin', senderName: 'Administrator', recipientId: 'applicant',
  recipientName: 'Applicant', createdAt: new Date('2026-09-06'), metadata: { applicantId: 'application', attachments: [], privateNotes: 'hidden' }, readAt: null, ...overrides,
});
beforeAll(async () => {
  process.env.NODE_ENV = 'test'; process.env.AUTH_TOKEN_SECRET = 'mailbox-local-test-only';
  process.env.ENFORCE_PERSISTED_USER_SESSIONS = 'false';
  const app = express(); app.use(express.json()); app.use('/api/mail', mailRouter);
  server = await new Promise<http.Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  jest.clearAllMocks(); mockRows.length = 0; mockUsers.clear();
  for (const role of ['admin', 'applicant', 'provider', 'user']) mockUsers.set(role, {
    id: role, name: role, email: `${role}@example.test`, role, tier: 'Free / Community Tier',
    providerApproved: role === 'provider', providerApprovalStatus: role === 'provider' ? 'approved' : null,
    providerRevokedAt: null, password: 'must-not-appear',
  });
});

describe('correspondence role and participant boundaries', () => {
  it.each(['applicant', 'provider', 'user'])('delivers admin → %s and permits reply only to administration', async role => {
    const sent = await request('admin', '/messages', 'POST', { recipientId: role, subject: 'Welcome', message: 'Your update' });
    expect(sent.status).toBe(201);
    const inbox = await request(role, '/messages');
    expect(inbox.body.messages).toHaveLength(1); expect(inbox.body.messages[0].sent).toBe(false);
    const reply = await request(role, '/messages', 'POST', { replyTo: sent.body.id, recipientId: 'user', subject: 'Welcome', message: 'Thank you' });
    expect(reply.status).toBe(201);
    expect(mockRows[1].recipientId).toBe('administration');
    expect(mockRows[1].threadId).toBe(mockRows[0].threadId);
    const adminInbox = await request('admin', '/messages');
    expect(adminInbox.body.messages.find((m: any) => m.id === reply.body.id).sent).toBe(false);
    const history = await request(role, `/messages/${reply.body.id}/thread`);
    expect(history.body.messages).toHaveLength(2);
    expect(history.body.messages.find((m: any) => m.id === reply.body.id).sent).toBe(true);
  });
  it.each(['applicant', 'provider', 'user'])('lets %s initiate to administration and denies peer mail', async role => {
    expect((await request(role, '/messages', 'POST', { subject: 'Question', message: 'Can you help?' })).status).toBe(201);
    expect((await request(role, '/messages', 'POST', { recipientId: 'provider', subject: 'Peer', message: 'Private' })).status).toBe(403);
  });
  it('denies unauthenticated mailbox access', async () => {
    expect((await request(null, '/messages')).status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('denies foreign read, reply, state changes and export', async () => {
    mockRows.push(seed());
    expect((await request('user', '/messages')).body.messages).toEqual([]);
    expect((await request('user', '/messages/root/thread')).status).toBe(404);
    expect((await request('user', '/messages/root/export')).status).toBe(404);
    expect((await request('user', '/messages/root/read', 'PATCH', { read: true })).status).toBe(404);
    expect((await request('user', '/messages', 'POST', { replyTo: 'root', subject: 'X', message: 'X' })).status).toBe(404);
    expect(mockExecute).not.toHaveBeenCalled();
  });
  it('preserves applicant history after approval and after provider revocation', async () => {
    mockRows.push(seed());
    const before = (await request('applicant', '/messages')).body.messages;
    Object.assign(mockUsers.get('applicant'), { role: 'provider', providerApproved: true, providerApprovalStatus: 'approved' });
    expect((await request('applicant', '/messages')).body.messages).toEqual(before);
    Object.assign(mockUsers.get('applicant'), { providerApproved: false, providerApprovalStatus: 'rejected', providerRevokedAt: new Date() });
    expect((await request('applicant', '/messages')).body.messages).toEqual(before);
  });
  it('keeps read states separate and uses an atomic JSON merge', async () => {
    mockRows.push(seed());
    expect((await request('applicant', '/messages/root/read', 'PATCH', { read: true })).status).toBe(200);
    expect((await request('applicant', '/messages')).body.messages[0].read).toBe(true);
    expect((await request('admin', '/messages')).body.messages[0].read).toBe(false);
    expect(mockExecute.mock.calls[0][0].text).toContain('jsonb_set');
    await request('applicant', '/messages/root/read', 'PATCH', { read: false });
    expect((await request('applicant', '/messages')).body.messages[0].read).toBe(false);
  });
  it('retains historical applicant notices and protects recipient read state from admin views', async () => {
    mockRows.push(seed({ id: 'notice:old', threadId: 'notice:old', source: 'lifecycle_notice', senderId: null }));
    await request('admin', '/messages/notice:old/read', 'PATCH', { read: true });
    expect(mockRows[0].readAt).toBeNull();
    await request('applicant', '/messages/notice:old/read', 'PATCH', { read: true });
    expect(mockRows[0].readAt).not.toBeNull();
  });
  it('does not bind anonymous contact email to any user mailbox', async () => {
    mockRows.push(seed({ senderId: null, recipientId: 'administration', source: 'contact_modal' }));
    expect((await request('applicant', '/messages')).body.messages).toEqual([]);
    expect((await request('admin', '/messages')).body.messages[0].canReply).toBe(false);
    await expect(mailDestination({ id: 'admin', role: 'admin' }, { replyTo: 'root' })).rejects.toMatchObject({ status: 400 });
  });
  it('limits nonadmin recipients and exposes no account secrets', async () => {
    expect((await request('applicant', '/recipients')).body.recipients.map((r: any) => r.id)).toEqual(['administration']);
    expect((await request('admin', '/recipients')).text).not.toContain('must-not-appear');
  });
  it('rejects forged identity and storage metadata fields', async () => {
    expect((await request('applicant', '/messages', 'POST', { subject: 'X', message: 'X', senderId: 'admin' })).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it('uses parameterized ownership filters and excludes duplicate linked notifications', async () => {
    await request('applicant', '/messages');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql.text).toContain('m."metadata"->>\'recipientUserId\'');
    expect(sql.text).toContain('n."userId" =');
    expect(sql.text).toContain("internalMessageId");
    expect(sql.values).toContain('applicant');
  });
  it('rejects malformed pagination and returns a cursor for older history', async () => {
    expect((await request('applicant', '/messages?cursor=invalid')).status).toBe(400);
    for (let i = 0; i < 51; i++) mockRows.push(seed({ id: `row-${i}` }));
    const page = await request('applicant', '/messages');
    expect(page.body.messages).toHaveLength(50); expect(page.body.nextCursor).toBeTruthy();
  });
});

describe('private attachments and portable correspondence', () => {
  it('uploads a private file, hides its key, and downloads only for participants', async () => {
    const data = new FormData(); data.set('subject', 'Document'); data.set('message', 'Please review.');
    data.append('attachments', new Blob(['hello'], { type: 'text/plain' }), 'document.txt');
    const sent = await request('applicant', '/messages', 'POST', data);
    expect(sent.status).toBe(201);
    expect(mockPersist).toHaveBeenCalledWith(expect.objectContaining({ userId: 'applicant', access: 'private', category: 'correspondence' }));
    const inbox = await request('admin', '/messages');
    expect(inbox.text).not.toContain('private-storage-key'); expect(inbox.text).not.toContain('objectKey');
    const id = inbox.body.messages[0].attachments[0].id;
    const download = await request('admin', `/messages/${sent.body.id}/attachments/${id}`);
    expect(download.status).toBe(200); expect(download.text).toBe('private file');
    expect(download.headers.get('content-disposition')).toContain('attachment;');
    expect(download.headers.get('x-content-type-options')).toBe('nosniff');
    mockResolve.mockClear();
    expect((await request('user', `/messages/${sent.body.id}/attachments/${id}`)).status).toBe(404);
    expect((await request('applicant', `/messages/${sent.body.id}/attachments/foreign-key`)).status).toBe(404);
    expect(mockResolve).not.toHaveBeenCalled();
  });
  it.each([
    ['active.html', 'text/html', '<script>alert(1)</script>'],
    ['fake.pdf', 'application/pdf', 'not a PDF'],
    ['fake.png', 'image/png', 'not an image'],
  ])('rejects unsupported or forged file %s before storage', async (name, type, content) => {
    const data = new FormData(); data.set('subject', 'File'); data.set('message', 'File');
    data.append('attachments', new Blob([content], { type }), name);
    expect((await request('user', '/messages', 'POST', data)).status).toBe(400);
    expect(mockPersist).not.toHaveBeenCalled();
  });
  it('cleans up stored attachments when persistence fails and reports failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('sensitive provider error'));
    const data = new FormData(); data.set('subject', 'File'); data.set('message', 'File');
    data.append('attachments', new Blob(['text'], { type: 'text/plain' }), 'a.txt');
    const result = await request('user', '/messages', 'POST', data);
    expect(result.status).toBe(503); expect(result.text).not.toContain('sensitive provider error');
    expect(mockDelete).toHaveBeenCalledWith('private-storage-key');
  });
  it('reconciles a lost write acknowledgement without deleting delivered attachments', async () => {
    mockCreate.mockImplementationOnce(async (input: any) => {
      mockRows.push(seed({ id: input.id, senderId: 'user', recipientId: 'administration', metadata: input.metadata }));
      throw new Error('lost acknowledgement');
    });
    const data = new FormData(); data.set('subject', 'Receipt check'); data.set('message', 'Document');
    data.append('attachments', new Blob(['text'], { type: 'text/plain' }), 'a.txt');
    const result = await request('user', '/messages', 'POST', data);
    expect(result.status).toBe(201);
    expect(result.body.id).toBe(mockRows[0].id);
    expect(mockDelete).not.toHaveBeenCalled();
  });
  it('exports readable thread text without internal metadata or storage keys', async () => {
    mockRows.push(seed());
    const exported = await request('applicant', '/messages/root/export');
    expect(exported.status).toBe(200); expect(exported.text).toContain('From: Administrator');
    expect(exported.text).toContain('Please send your credential.'); expect(exported.text).not.toContain('hidden');
    expect(exported.headers.get('cache-control')).toBe('no-store');
  });
  it('projects only public fields and denies foreign legacy records', () => {
    const row = seed({ metadata: { adminNotes: 'private', attachments: [{ id: 'a', name: 'a.txt', size: 1, mimeType: 'text/plain', objectKey: 'secret-key' }] } });
    const dto = publicMail(row, { id: 'applicant', role: 'applicant' });
    expect(JSON.stringify(dto)).not.toMatch(/private|secret-key|adminNotes/);
    expect(exportThread([dto])).toContain('a.txt (1 bytes)');
    expect(canReadMail({ id: 'user', role: 'provider' }, row)).toBe(false);
    expect(canReadMail({ id: 'applicant', role: 'provider' }, row)).toBe(true);
  });
  it('returns explicit lifecycle delivery failure without invalidating saved account changes', async () => {
    mockCreate.mockRejectedValueOnce(new Error('unavailable'));
    expect(await deliverLifecycleCorrespondence({ userId: 'applicant', applicantId: 'application', subject: 'Update', message: 'Update' })).toBeNull();
  });
});
