import express from 'express';
import http from 'http';
import { createAdminElevationToken, createSessionToken } from '../auth';

const mockUsers = new Map<string, any>();
const mockApplicants = new Map<string, any>();
const mockUploadMetadata = new Map<string, any>();
const mockUploadObjects = new Map<string, any>();

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return mockUsers.get(id) || null;
  },
  async listUsers(): Promise<any[]> {
    return Array.from(mockUsers.values());
  },
};

const mockGetProviderApplicantById = jest.fn(async (id: string) => mockApplicants.get(id) || null);
const mockListProviderApplicants = jest.fn(async () => Array.from(mockApplicants.values()));
const mockDeleteProviderApplicantById = jest.fn(async (id: string) => {
  const applicant = mockApplicants.get(id) || null;
  if (applicant) {
    mockApplicants.delete(id);
  }
  return applicant;
});
const mockResolveUploadObjectByKey = jest.fn(async (objectKey: string) =>
  mockUploadObjects.get(objectKey) || null
);
const mockGetUploadObjectAccessMetadata = jest.fn((objectKey: string) =>
  mockUploadMetadata.get(objectKey) || null
);
const mockDeleteUploadObjectByKey = jest.fn(async (objectKey: string) => {
  const existed = mockUploadObjects.delete(objectKey);
  mockUploadMetadata.delete(objectKey);
  return existed;
});

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/userSessionStore', () => ({
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

jest.mock('../services/providerApplicantStore', () => ({
  PROVIDER_APPLICANT_STATUSES: [
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'needs_more_info',
  ],
  deleteProviderApplicantById: mockDeleteProviderApplicantById,
  getProviderApplicantById: mockGetProviderApplicantById,
  listProviderApplicants: mockListProviderApplicants,
  updateProviderApplicantReview: jest.fn(async () => null),
}));

jest.mock('../services/uploadBlobStore', () => ({
  deleteUploadObjectByKey: mockDeleteUploadObjectByKey,
  getUploadObjectAccessMetadata: mockGetUploadObjectAccessMetadata,
  resolveUploadObjectByKey: mockResolveUploadObjectByKey,
}));

jest.mock('../services/applicantPortal', () => ({ listApplicantFollowUps: jest.fn(async () => []) }));

const adminRoutes = require('../routes/admin').default;

let server: http.Server | null = null;
let baseUrl = '';

const founderAdmin = {
  id: 'admin-1',
  email: 'higherconscious.network1@gmail.com',
  role: 'admin',
  tier: 'Accelerated Tier',
  providerApproved: false,
  providerApprovalStatus: null,
  providerRevokedAt: null,
};

const memberUser = {
  id: 'member-1',
  email: 'member@example.com',
  role: 'user',
  tier: 'free',
  providerApproved: false,
  providerApprovalStatus: null,
  providerRevokedAt: null,
};

const requestAdmin = async (options: {
  path: string;
  method?: 'GET' | 'DELETE';
  token?: string;
  elevationToken?: string;
  body?: Record<string, unknown>;
}): Promise<{
  status: number;
  headers: Headers;
  bodyText: string;
  bodyBuffer: Buffer;
}> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.elevationToken) headers['X-Admin-Elevation-Token'] = options.elevationToken;
  if (options.body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const bodyBuffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    headers: response.headers,
    bodyText: bodyBuffer.toString('utf8'),
    bodyBuffer,
  };
};

const requestDocument = requestAdmin;

const readZipEntries = (archive: Buffer): Map<string, Buffer> => {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const filenameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    expect(compressionMethod).toBe(0);

    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + filenameLength;
    const dataStart = filenameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const filename = archive.subarray(filenameStart, filenameEnd).toString('utf8');
    entries.set(filename, archive.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
};

const adminToken = (): string => createSessionToken(founderAdmin.id).token;
const adminElevationToken = (): string => createAdminElevationToken(founderAdmin.id).token;

const registerDefaultApplicant = (overrides: Record<string, unknown> = {}): void => {
  mockApplicants.set('applicant-1', {
    id: 'applicant-1',
    userId: 'applicant-user-1',
    email: 'applicant@example.com',
    firstName: 'Randy',
    lastName: 'Cofield',
    providerCategory: 'wellness',
    status: 'submitted',
    resumeFile: {
      originalName: 'Randy Resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
      storageProvider: 'postgres_large_object',
      objectKey: 'resume-key',
      url: 'https://example.invalid/api/upload/object/client-supplied-url-must-not-be-used',
    },
    coverLetterFile: {
      originalName: 'Cover Letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 12,
      storageProvider: 'postgres_large_object',
      objectKey: 'cover-key',
      url: 'https://example.invalid/api/upload/object/wrong-cover-key',
    },
    ...overrides,
  });

  mockUploadMetadata.set('resume-key', {
    objectKey: 'resume-key',
    storageProvider: 'postgres_large_object',
    access: 'private',
    ownerUserId: 'applicant-user-1',
    category: 'provider-application',
    isLegacy: false,
  });
  mockUploadMetadata.set('cover-key', {
    objectKey: 'cover-key',
    storageProvider: 'postgres_large_object',
    access: 'private',
    ownerUserId: 'applicant-user-1',
    category: 'provider-application',
    isLegacy: false,
  });

  mockUploadObjects.set('resume-key', {
    buffer: Buffer.from('%PDF applicant resume'),
    mimeType: 'application/pdf',
    originalName: 'upload.bin',
    sizeBytes: 21,
  });
  mockUploadObjects.set('cover-key', {
    buffer: Buffer.from('docx bytes'),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    originalName: 'upload.bin',
    sizeBytes: 10,
  });
};

describe('admin provider applicant document access', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'admin-provider-applicant-document-test-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve admin provider applicant document test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  beforeEach(() => {
    mockUsers.clear();
    mockApplicants.clear();
    mockUploadMetadata.clear();
    mockUploadObjects.clear();
    mockGetProviderApplicantById.mockClear();
    mockListProviderApplicants.mockClear();
    mockDeleteProviderApplicantById.mockClear();
    mockResolveUploadObjectByKey.mockClear();
    mockGetUploadObjectAccessMetadata.mockClear();
    mockDeleteUploadObjectByKey.mockClear();
    mockUsers.set(founderAdmin.id, founderAdmin);
    mockUsers.set(memberUser.id, memberUser);
    registerDefaultApplicant();
  });

  it('requires canonical admin authorization', async () => {
    const unauthenticated = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
    });
    expect(unauthenticated.status).toBe(401);

    const member = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
      token: createSessionToken(memberUser.id).token,
      elevationToken: createAdminElevationToken(memberUser.id).token,
    });
    expect(member.status).toBe(403);
  });

  it('requires active admin elevation', async () => {
    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
      token: adminToken(),
    });

    expect(response.status).toBe(403);
    expect(response.bodyText).toContain('Admin elevation required');
  });

  it('rejects invalid document types', async () => {
    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/transcript?disposition=attachment',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(400);
    expect(response.bodyText).toContain('Invalid provider applicant document type');
  });

  it('returns 404 when the requested applicant document is missing', async () => {
    registerDefaultApplicant({ coverLetterFile: null });

    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/cover-letter?disposition=attachment',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(404);
    expect(response.bodyText).toContain('Provider applicant document not found');
  });

  it('rejects upload objects that do not belong to the applicant', async () => {
    mockUploadMetadata.set('resume-key', {
      objectKey: 'resume-key',
      storageProvider: 'postgres_large_object',
      access: 'private',
      ownerUserId: 'other-user',
      category: 'provider-application',
      isLegacy: false,
    });

    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(404);
    expect(mockResolveUploadObjectByKey).not.toHaveBeenCalled();
  });

  it('rejects upload objects outside the provider-application context', async () => {
    mockUploadMetadata.set('resume-key', {
      objectKey: 'resume-key',
      storageProvider: 'postgres_large_object',
      access: 'private',
      ownerUserId: 'applicant-user-1',
      category: 'social',
      isLegacy: false,
    });

    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(404);
    expect(mockResolveUploadObjectByKey).not.toHaveBeenCalled();
  });

  it('serves attachments with the stored MIME type and sanitized original filename', async () => {
    registerDefaultApplicant({
      resumeFile: {
        originalName: 'Randy "Resume".pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        storageProvider: 'postgres_large_object',
        objectKey: 'resume-key',
        url: 'https://example.invalid/api/upload/object/wrong-key',
      },
    });

    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=attachment',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/pdf');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('filename="Randy _Resume_.pdf"');
    expect(response.bodyBuffer.toString('utf8')).toBe('%PDF applicant resume');
    expect(mockResolveUploadObjectByKey).toHaveBeenCalledWith('resume-key');
    expect(mockResolveUploadObjectByKey).not.toHaveBeenCalledWith('wrong-key');
  });

  it('permits inline PDF preview', async () => {
    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/resume?disposition=inline',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('inline');
    expect(response.bodyBuffer.toString('utf8')).toBe('%PDF applicant resume');
  });

  it('forces DOCX cover letters to download even when inline is requested', async () => {
    const response = await requestDocument({
      path: '/api/admin/provider-applicants/applicant-1/documents/cover-letter?disposition=inline',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('filename="Cover Letter.docx"');
    expect(response.bodyBuffer.toString('utf8')).toBe('docx bytes');
  });

  it('does not expose private upload object keys or URLs in applicant API responses', async () => {
    const listResponse = await requestAdmin({
      path: '/api/admin/provider-applicants',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });
    const detailResponse = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(listResponse.bodyText).not.toContain('resume-key');
    expect(listResponse.bodyText).not.toContain('cover-key');
    expect(listResponse.bodyText).not.toContain('example.invalid');
    expect(detailResponse.bodyText).not.toContain('resume-key');
    expect(detailResponse.bodyText).not.toContain('cover-key');
    expect(detailResponse.bodyText).not.toContain('example.invalid');

    const parsed = JSON.parse(detailResponse.bodyText) as { applicant: any };
    expect(parsed.applicant.resumeFile).toEqual({
      originalName: 'Randy Resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
      storageProvider: 'postgres_large_object',
    });
    expect(parsed.applicant.coverLetterFile).toEqual({
      originalName: 'Cover Letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 12,
      storageProvider: 'postgres_large_object',
    });
  });

  it('requires active admin elevation for provider submission export', async () => {
    const response = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1/export',
      token: adminToken(),
    });

    expect(response.status).toBe(403);
    expect(response.bodyText).toContain('Admin elevation required');
  });

  it('exports submission data and uploaded documents in a private zip attachment', async () => {
    const response = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1/export',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/zip');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('filename="randy-cofield-provider-submission.zip"');

    const entries = readZipEntries(response.bodyBuffer);
    expect(Array.from(entries.keys()).sort()).toEqual([
      'documents/cover-letter/Cover Letter.docx',
      'documents/resume/Randy Resume.pdf',
      'submission.json',
      'submission.txt',
    ]);
    expect(entries.get('documents/resume/Randy Resume.pdf')?.toString('utf8')).toBe(
      '%PDF applicant resume'
    );
    expect(entries.get('documents/cover-letter/Cover Letter.docx')?.toString('utf8')).toBe(
      'docx bytes'
    );

    const submissionJson = JSON.parse(String(entries.get('submission.json') || '{}')) as any;
    expect(submissionJson.submission.id).toBe('applicant-1');
    expect(submissionJson.documents).toContainEqual(
      expect.objectContaining({
        type: 'resume',
        originalName: 'Randy Resume.pdf',
      })
    );
    expect(JSON.stringify(submissionJson)).not.toContain('resume-key');
    expect(JSON.stringify(submissionJson)).not.toContain('example.invalid');
  });

  it('does not export when a required document reference is missing', async () => {
    registerDefaultApplicant({ resumeFile: null });

    const response = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1/export',
      token: adminToken(),
      elevationToken: adminElevationToken(),
    });

    expect(response.status).toBe(409);
    expect(response.bodyText).toContain(
      'Provider applicant export cannot be created until document references are valid'
    );
    expect(mockResolveUploadObjectByKey).not.toHaveBeenCalled();
  });

  it('requires deliberate confirmation before deleting a provider submission', async () => {
    const response = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1',
      method: 'DELETE',
      token: adminToken(),
      elevationToken: adminElevationToken(),
      body: { confirm: 'DELETE' },
    });

    expect(response.status).toBe(400);
    expect(response.bodyText).toContain('DELETE PROVIDER SUBMISSION');
    expect(mockDeleteProviderApplicantById).not.toHaveBeenCalled();
    expect(mockApplicants.has('applicant-1')).toBe(true);
  });

  it('deletes a confirmed provider submission and its applicant-owned documents', async () => {
    const response = await requestAdmin({
      path: '/api/admin/provider-applicants/applicant-1',
      method: 'DELETE',
      token: adminToken(),
      elevationToken: adminElevationToken(),
      body: { confirm: 'DELETE PROVIDER SUBMISSION' },
    });

    expect(response.status).toBe(200);
    expect(mockDeleteUploadObjectByKey).toHaveBeenCalledWith('resume-key');
    expect(mockDeleteUploadObjectByKey).toHaveBeenCalledWith('cover-key');
    expect(mockDeleteProviderApplicantById).toHaveBeenCalledWith('applicant-1');
    expect(mockApplicants.has('applicant-1')).toBe(false);
    expect(mockUploadObjects.has('resume-key')).toBe(false);
    expect(mockUploadObjects.has('cover-key')).toBe(false);

    const parsed = JSON.parse(response.bodyText) as any;
    expect(parsed.deletedApplicantId).toBe('applicant-1');
    expect(parsed.deletedDocuments).toEqual([
      { documentType: 'resume', originalName: 'Randy Resume.pdf', deleted: true },
      { documentType: 'cover-letter', originalName: 'Cover Letter.docx', deleted: true },
    ]);
  });
});
