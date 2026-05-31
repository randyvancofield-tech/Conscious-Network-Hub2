import express from 'express';
import http from 'http';
import { createSessionToken } from '../auth';

const users = new Map<string, any>();
const reflections = new Map<string, any>();
const mockUploadMetadata = new Map<string, any>();
let nextReflectionId = 1;

const cloneReflection = (reflection: any): any => ({
  ...reflection,
  createdAt: new Date(reflection.createdAt),
  updatedAt: new Date(reflection.updatedAt),
});

const mockLocalStore = {
  async getUserById(id: string): Promise<any | null> {
    return users.get(id) || null;
  },

  async createReflection(input: any): Promise<any> {
    const now = new Date();
    const reflection = {
      id: `reflection-${nextReflectionId++}`,
      userId: input.userId,
      content: input.content || null,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      createdAt: now,
      updatedAt: now,
    };
    reflections.set(reflection.id, reflection);
    return cloneReflection(reflection);
  },

  async listReflectionsByUserId(userId: string): Promise<any[]> {
    return Array.from(reflections.values())
      .filter((reflection) => reflection.userId === userId)
      .map(cloneReflection);
  },

  async getReflectionById(reflectionId: string): Promise<any | null> {
    const reflection = reflections.get(reflectionId);
    return reflection ? cloneReflection(reflection) : null;
  },

  async updateReflection(reflectionId: string, updates: any): Promise<any | null> {
    const existing = reflections.get(reflectionId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    reflections.set(reflectionId, updated);
    return cloneReflection(updated);
  },

  async deleteReflection(reflectionId: string): Promise<any | null> {
    const existing = reflections.get(reflectionId);
    if (!existing) return null;
    reflections.delete(reflectionId);
    return cloneReflection(existing);
  },
};

const mockDeleteUploadObjectByKey = jest.fn(async () => true);

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/userSessionStore', () => ({
  getUserSessionById: jest.fn(async () => null),
  revokeUserSession: jest.fn(async () => undefined),
}));

jest.mock('../services/uploadBlobStore', () => ({
  deleteUploadObjectByKey: mockDeleteUploadObjectByKey,
  getUploadObjectAccessMetadata: jest.fn((objectKey: string) => mockUploadMetadata.get(objectKey) || null),
}));

const reflectionRoutes = require('../routes/reflection').default;

let server: http.Server | null = null;
let baseUrl = '';

const userToken = (userId: string): string => createSessionToken(userId).token;

const requestJson = async (options: {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

const createUser = (id: string): any => ({
  id,
  email: `${id}@example.com`,
  role: 'user',
  tier: 'Free / Community Tier',
  lockoutUntil: null,
});

const privateReflectionUrl = (objectKey: string): string => `/api/upload/object/${objectKey}`;

describe('reflection persistence and access control', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'reflection-route-test-secret';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/reflection', reflectionRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve reflection route test server address');
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
    users.clear();
    reflections.clear();
    mockUploadMetadata.clear();
    nextReflectionId = 1;
    mockDeleteUploadObjectByKey.mockClear();
    users.set('alice', createUser('alice'));
    users.set('bob', createUser('bob'));
    mockUploadMetadata.set('alice-private-reflection', {
      objectKey: 'alice-private-reflection',
      access: 'private',
      ownerUserId: 'alice',
      category: 'reflection',
    });
    mockUploadMetadata.set('bob-private-reflection', {
      objectKey: 'bob-private-reflection',
      access: 'private',
      ownerUserId: 'bob',
      category: 'reflection',
    });
    mockUploadMetadata.set('alice-public-avatar', {
      objectKey: 'alice-public-avatar',
      access: 'public',
      ownerUserId: 'alice',
      category: 'avatar',
    });
  });

  it('lets a user create, list, update, and delete their own private reflection', async () => {
    const created = await requestJson({
      method: 'POST',
      path: '/api/reflection',
      token: userToken('alice'),
      body: {
        userId: 'alice',
        content: 'Private launch reflection',
        fileUrl: privateReflectionUrl('alice-private-reflection'),
        fileType: 'document',
      },
    });

    expect(created.status).toBe(200);
    expect(created.body?.reflection?.userId).toBe('alice');

    const listed = await requestJson({
      method: 'GET',
      path: '/api/reflection/alice',
      token: userToken('alice'),
    });
    expect(listed.status).toBe(200);
    expect(listed.body?.reflections).toHaveLength(1);

    const reflectionId = String(created.body?.reflection?.id || '');
    const updated = await requestJson({
      method: 'PATCH',
      path: `/api/reflection/${reflectionId}`,
      token: userToken('alice'),
      body: { content: 'Updated private notes' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body?.reflection?.content).toBe('Updated private notes');

    const deleted = await requestJson({
      method: 'DELETE',
      path: `/api/reflection/${reflectionId}`,
      token: userToken('alice'),
    });
    expect(deleted.status).toBe(200);
    expect(mockDeleteUploadObjectByKey).toHaveBeenCalledWith('alice-private-reflection');
  });

  it('blocks cross-user reflection reads and mutations', async () => {
    const created = await requestJson({
      method: 'POST',
      path: '/api/reflection',
      token: userToken('alice'),
      body: {
        userId: 'alice',
        content: 'Alice owned',
        fileUrl: privateReflectionUrl('alice-private-reflection'),
        fileType: 'document',
      },
    });
    const reflectionId = String(created.body?.reflection?.id || '');

    const crossRead = await requestJson({
      method: 'GET',
      path: '/api/reflection/alice',
      token: userToken('bob'),
    });
    const crossPatch = await requestJson({
      method: 'PATCH',
      path: `/api/reflection/${reflectionId}`,
      token: userToken('bob'),
      body: { content: 'Bob edit' },
    });
    const crossDelete = await requestJson({
      method: 'DELETE',
      path: `/api/reflection/${reflectionId}`,
      token: userToken('bob'),
    });

    expect(crossRead.status).toBe(403);
    expect(crossPatch.status).toBe(403);
    expect(crossDelete.status).toBe(403);
  });

  it('rejects reflection records that reference public or other-user uploads', async () => {
    const publicUpload = await requestJson({
      method: 'POST',
      path: '/api/reflection',
      token: userToken('alice'),
      body: {
        userId: 'alice',
        content: 'Not private',
        fileUrl: privateReflectionUrl('alice-public-avatar'),
        fileType: 'document',
      },
    });
    const otherUserUpload = await requestJson({
      method: 'POST',
      path: '/api/reflection',
      token: userToken('alice'),
      body: {
        userId: 'alice',
        content: 'Wrong owner',
        fileUrl: privateReflectionUrl('bob-private-reflection'),
        fileType: 'document',
      },
    });

    expect(publicUpload.status).toBe(403);
    expect(otherUserUpload.status).toBe(403);
    expect(reflections.size).toBe(0);
  });
});
