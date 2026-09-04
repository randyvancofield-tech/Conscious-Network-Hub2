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
const mockResolveUploadObjectByKey = jest.fn(async (objectKey: string) =>
  mockUploadObjects.get(objectKey) || null
);
const mockGetUploadObjectAccessMetadata = jest.fn((objectKey: string) =>
  mockUploadMetadata.get(objectKey) || null
);

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
  getProviderApplicantById: mockGetProviderApplicantById,
  listProviderApplicants: jest.fn(async () => []),
  updateProviderApplicantReview: jest.fn(async () => null),
}));

jest.mock('../services/uploadBlobStore', () => ({
  deleteUploadObjectByKey: jest.fn(async () => false),
  getUploadObjectAccessMetadata: mockGetUploadObjectAccessMetadata,
  resolveUploadObjectByKey: mockResolveUploadObjectByKey,
}));

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

const requestDocument = async (options: {
  path: string;
  token?: string;
  elevationToken?: string;
}): Promise<{
  status: number;
  headers: Headers;
  bodyText: string;
  bodyBuffer: Buffer;
}> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.elevationToken) headers['X-Admin-Elevation-Token'] = options.elevationToken;

  const response = await fetch(`${baseUrl}${options.path}`, {
    method: 'GET',
    headers,
  });
  const bodyBuffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    headers: response.headers,
    bodyText: bodyBuffer.toString('utf8'),
    bodyBuffer,
  };
};

const adminToken = (): string => createSessionToken(founderAdmin.id).token;
const adminElevationToken = (): string => createAdminElevationToken(founderAdmin.id).token;

const registerDefaultApplicant = (overrides: Record<string, unknown> = {}): void => {
  mockApplicants.set('applicant-1', {
    id: 'applicant-1',
    userId: 'applicant-user-1',
    email: 'applicant@example.com',
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
    mockResolveUploadObjectByKey.mockClear();
    mockGetUploadObjectAccessMetadata.mockClear();
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
});
