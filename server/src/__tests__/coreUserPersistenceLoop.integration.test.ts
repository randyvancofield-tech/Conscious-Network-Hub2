import express from 'express';
import http from 'http';
import { createSessionToken, hashPassword } from '../auth';

jest.setTimeout(30_000);

type TwoFactorMethod = 'none' | 'phone' | 'wallet';

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'applicant' | 'provider' | 'admin';
  handle: string | null;
  bio: string | null;
  location: string | null;
  dateOfBirth: Date | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  profileMedia: {
    avatar: { url: string | null; storageProvider: string | null; objectKey: string | null };
    cover: { url: string | null; storageProvider: string | null; objectKey: string | null };
  };
  interests: string[];
  twitterUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  privacySettings: {
    profileVisibility: 'public' | 'private';
    showEmail: boolean;
    allowMessages: boolean;
    blockedUsers: string[];
  };
  password: string;
  passwordFingerprint: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash: string | null;
  emailVerificationExpiresAt: Date | null;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  profileBackgroundVideo: string | null;
  phoneNumber: string | null;
  twoFactorMethod: TwoFactorMethod;
  walletDid: string | null;
  pendingPhoneOtpHash: string | null;
  pendingPhoneOtpExpiresAt: Date | null;
  pendingPhoneOtpAttempts: number;
  initialTwoFactorRequiredAt: Date | null;
  initialTwoFactorCompletedAt: Date | null;
  providerApproved: boolean;
  providerApprovalStatus: string | null;
  providerRevokedAt: Date | null;
  providerAccessUpdatedAt: Date | null;
  failedSignInAttempts: number;
  lockoutUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockSession {
  id: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface StoredUpload {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  access: 'public' | 'private';
  ownerUserId: string;
  category: string;
}

const users = new Map<string, MockUser>();
const memberships = new Map<string, any>();
const payments: any[] = [];
const postsByAuthor = new Map<string, any[]>();
const follows = new Set<string>();
const sessions = new Map<string, MockSession>();
const uploads = new Map<string, StoredUpload>();

let nextUserId = 1;
let nextPostId = 1;
let nextSessionId = 1;
let nextProviderSessionId = 1;
let nextUploadId = 1;

const followKey = (followerId: string, followingId: string): string => `${followerId}:${followingId}`;

const cloneDate = (value: Date | null): Date | null => (value ? new Date(value.getTime()) : null);

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  dateOfBirth: cloneDate(user.dateOfBirth),
  profileMedia: {
    avatar: { ...user.profileMedia.avatar },
    cover: { ...user.profileMedia.cover },
  },
  interests: [...user.interests],
  privacySettings: {
    ...user.privacySettings,
    blockedUsers: [...user.privacySettings.blockedUsers],
  },
  subscriptionStartDate: cloneDate(user.subscriptionStartDate),
  subscriptionEndDate: cloneDate(user.subscriptionEndDate),
  emailVerificationExpiresAt: cloneDate(user.emailVerificationExpiresAt),
  pendingPhoneOtpExpiresAt: cloneDate(user.pendingPhoneOtpExpiresAt),
  initialTwoFactorRequiredAt: cloneDate(user.initialTwoFactorRequiredAt),
  initialTwoFactorCompletedAt: cloneDate(user.initialTwoFactorCompletedAt),
  providerRevokedAt: cloneDate(user.providerRevokedAt),
  providerAccessUpdatedAt: cloneDate(user.providerAccessUpdatedAt),
  lockoutUntil: cloneDate(user.lockoutUntil),
  createdAt: new Date(user.createdAt.getTime()),
  updatedAt: new Date(user.updatedAt.getTime()),
});

const cloneSession = (session: MockSession): MockSession => ({
  ...session,
  issuedAt: new Date(session.issuedAt.getTime()),
  expiresAt: new Date(session.expiresAt.getTime()),
  revokedAt: cloneDate(session.revokedAt),
});

const createMockUser = (id: string, email: string, overrides: Partial<MockUser> = {}): MockUser => {
  const now = new Date();
  const base: MockUser = {
    id,
    email,
    name: 'Node',
    role: 'user',
    handle: null,
    bio: null,
    location: null,
    dateOfBirth: null,
    avatarUrl: null,
    bannerUrl: null,
    profileMedia: {
      avatar: { url: null, storageProvider: null, objectKey: null },
      cover: { url: null, storageProvider: null, objectKey: null },
    },
    interests: [],
    twitterUrl: null,
    githubUrl: null,
    websiteUrl: null,
    privacySettings: {
      profileVisibility: 'public',
      showEmail: false,
      allowMessages: true,
      blockedUsers: [],
    },
    password: '',
    passwordFingerprint: null,
    emailVerified: false,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    tier: 'Free / Community Tier',
    subscriptionStatus: 'inactive',
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    profileBackgroundVideo: null,
    phoneNumber: null,
    twoFactorMethod: 'none',
    walletDid: null,
    pendingPhoneOtpHash: null,
    pendingPhoneOtpExpiresAt: null,
    pendingPhoneOtpAttempts: 0,
    initialTwoFactorRequiredAt: null,
    initialTwoFactorCompletedAt: null,
    providerApproved: false,
    providerApprovalStatus: null,
    providerRevokedAt: null,
    providerAccessUpdatedAt: null,
    failedSignInAttempts: 0,
    lockoutUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  return cloneUser({
    ...base,
    ...overrides,
    id,
    email,
  });
};

const resetState = (): void => {
  users.clear();
  memberships.clear();
  payments.length = 0;
  postsByAuthor.clear();
  follows.clear();
  sessions.clear();
  uploads.clear();
  nextUserId = 1;
  nextPostId = 1;
  nextSessionId = 1;
  nextProviderSessionId = 1;
  nextUploadId = 1;
};

const mockLocalStore = {
  async getUserByEmail(email: string): Promise<MockUser | null> {
    const target = email.trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email.toLowerCase() === target) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async getUserById(id: string): Promise<MockUser | null> {
    const found = users.get(id);
    return found ? cloneUser(found) : null;
  },

  async listUsers(limit = 250): Promise<MockUser[]> {
    return Array.from(users.values())
      .slice(0, limit)
      .map(cloneUser);
  },

  async findUserByPasswordFingerprint(passwordFingerprint: string): Promise<MockUser | null> {
    for (const user of users.values()) {
      if (user.passwordFingerprint && user.passwordFingerprint === passwordFingerprint) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async findUserByEmailVerificationTokenHash(tokenHash: string): Promise<MockUser | null> {
    const normalized = String(tokenHash || '').trim();
    if (!normalized) return null;
    for (const user of users.values()) {
      if (user.emailVerificationTokenHash === normalized) {
        return cloneUser(user);
      }
    }
    return null;
  },

  async createUser(input: any): Promise<MockUser> {
    const email = String(input.email || '').trim().toLowerCase();
    const id = `user-${nextUserId++}`;
    const created = createMockUser(id, email, {
      name: input.name || 'Node',
      role: input.role || 'user',
      handle: input.handle || null,
      bio: input.bio || null,
      location: input.location || null,
      dateOfBirth: input.dateOfBirth || null,
      avatarUrl: input.avatarUrl || null,
      bannerUrl: input.bannerUrl || null,
      profileMedia: input.profileMedia || {
        avatar: { url: input.avatarUrl || null, storageProvider: null, objectKey: null },
        cover: { url: input.bannerUrl || null, storageProvider: null, objectKey: null },
      },
      password: input.password || '',
      passwordFingerprint: input.passwordFingerprint || null,
      emailVerified: input.emailVerified === true,
      emailVerificationTokenHash: input.emailVerificationTokenHash || null,
      emailVerificationExpiresAt: input.emailVerificationExpiresAt || null,
      tier: input.tier !== undefined ? input.tier : 'Free / Community Tier',
      phoneNumber: input.phoneNumber || null,
      twoFactorMethod: input.twoFactorMethod || 'none',
      walletDid: input.walletDid || null,
      initialTwoFactorRequiredAt: input.initialTwoFactorRequiredAt || null,
      initialTwoFactorCompletedAt: input.initialTwoFactorCompletedAt || null,
      providerApproved: input.providerApproved === true,
      providerApprovalStatus: input.providerApprovalStatus || null,
      providerRevokedAt: input.providerRevokedAt || null,
      providerAccessUpdatedAt: input.providerAccessUpdatedAt || null,
    });
    users.set(id, created);
    return cloneUser(created);
  },

  async updateUser(id: string, updates: any): Promise<MockUser | null> {
    const existing = users.get(id);
    if (!existing) return null;

    const next: MockUser = {
      ...existing,
      ...updates,
      profileMedia: updates.profileMedia
        ? {
            avatar: { ...updates.profileMedia.avatar },
            cover: { ...updates.profileMedia.cover },
          }
        : existing.profileMedia,
      interests: Array.isArray(updates.interests) ? [...updates.interests] : existing.interests,
      privacySettings: updates.privacySettings
        ? {
            ...updates.privacySettings,
            blockedUsers: Array.isArray(updates.privacySettings.blockedUsers)
              ? [...updates.privacySettings.blockedUsers]
              : [],
          }
        : existing.privacySettings,
      updatedAt: new Date(),
    };

    users.set(id, next);
    return cloneUser(next);
  },

  async getDiagnostics(): Promise<any> {
    return { generatedAt: new Date().toISOString() };
  },

  async upsertMembership(input: any): Promise<any> {
    const existing = memberships.get(input.userId);
    const now = new Date();
    const next = {
      id: existing?.id || `membership-${input.userId}`,
      userId: input.userId,
      tier: input.tier,
      status: input.status,
      startDate: input.startDate || existing?.startDate || now,
      endDate: input.endDate || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    memberships.set(input.userId, next);
    return { ...next };
  },

  async getMembershipByUserId(userId: string): Promise<any | null> {
    const membership = memberships.get(userId);
    return membership ? { ...membership } : null;
  },

  async listMembershipsByUserId(userId: string): Promise<any[]> {
    const membership = memberships.get(userId);
    return membership ? [{ ...membership }] : [];
  },

  async createPayment(input: any): Promise<any> {
    const payment = {
      id: `payment-${payments.length + 1}`,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    payments.push(payment);
    return { ...payment };
  },

  async listPaymentsByUserId(userId: string): Promise<any[]> {
    return payments.filter((payment) => payment.userId === userId).map((payment) => ({ ...payment }));
  },

  async hasPaymentDescriptionMarker(marker: string): Promise<boolean> {
    return payments.some((payment) => String(payment.description || '').includes(marker));
  },
};

const mockSocialStore = {
  async createPost(input: any): Promise<any> {
    const id = `post-${nextPostId++}`;
    const post = {
      id,
      authorId: input.authorId,
      text: String(input.text || ''),
      visibility: input.visibility || 'public',
      media: Array.isArray(input.media) ? input.media : [],
      likeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const existing = postsByAuthor.get(post.authorId) || [];
    postsByAuthor.set(post.authorId, [post, ...existing]);
    return post;
  },

  async getPostById(postId: string): Promise<any | null> {
    const found = Array.from(postsByAuthor.values())
      .flat()
      .find((post) => post.id === postId);
    return found || null;
  },

  async listPosts(options: { limit?: number }): Promise<any[]> {
    const limit = Number(options.limit) || 20;
    return Array.from(postsByAuthor.values())
      .flat()
      .slice(0, limit);
  },

  async listPostsByAuthor(options: { authorId: string; limit?: number }): Promise<any[]> {
    const limit = Number(options.limit) || 20;
    return (postsByAuthor.get(options.authorId) || []).slice(0, limit);
  },

  async toggleLike(postId: string, _userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const exists = Array.from(postsByAuthor.values())
      .flat()
      .some((post) => post.id === postId);
    if (!exists) {
      throw new Error('Post not found');
    }
    return { liked: true, likeCount: 1 };
  },

  async setFollow(
    followerId: string,
    followingId: string,
    follow: boolean
  ): Promise<{ following: boolean }> {
    const key = followKey(followerId, followingId);
    if (follow) {
      follows.add(key);
    } else {
      follows.delete(key);
    }
    return { following: follow };
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return follows.has(followKey(followerId, followingId));
  },

  async listFollowingIds(followerId: string): Promise<string[]> {
    return Array.from(follows)
      .filter((entry) => entry.startsWith(`${followerId}:`))
      .map((entry) => entry.split(':')[1]);
  },
};

const persistUploadObjectMock = jest.fn(async (input: any) => {
  const objectKey = `upload-${nextUploadId++}`;
  const access = input.access === 'public' ? 'public' : 'private';
  uploads.set(objectKey, {
    buffer: Buffer.from(input.buffer),
    mimeType: String(input.mimeType || 'application/octet-stream'),
    sizeBytes: Buffer.from(input.buffer).length,
    access,
    ownerUserId: String(input.userId || ''),
    category: String(input.category || ''),
  });
  return {
    objectKey,
    storageProvider: 'postgres_large_object',
    publicPath: `${access === 'public' ? '/uploads/object' : '/api/upload/object'}/${objectKey}`,
    mimeType: String(input.mimeType || 'application/octet-stream'),
    sizeBytes: Buffer.from(input.buffer).length,
    access,
    category: String(input.category || '') || null,
  };
});

const getUploadObjectAccessMetadataMock = jest.fn((objectKey: string) => {
  const found = uploads.get(objectKey);
  if (!found) return null;
  return {
    objectKey,
    storageProvider: 'postgres_large_object',
    access: found.access,
    ownerUserId: found.ownerUserId || null,
    category: found.category || null,
    isLegacy: false,
  };
});

const isUploadObjectPubliclyReadableMock = jest.fn((objectKey: string) => {
  const found = uploads.get(objectKey);
  return found?.access === 'public';
});

const resolveUploadObjectByKeyMock = jest.fn(async (objectKey: string) => {
  const found = uploads.get(objectKey);
  if (!found) return null;
  return {
    buffer: Buffer.from(found.buffer),
    mimeType: found.mimeType,
    sizeBytes: found.sizeBytes,
  };
});

const createUserSessionMock = jest.fn(async (userId: string) => {
  const now = new Date();
  const session: MockSession = {
    id: `session-${nextSessionId++}`,
    userId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60),
    revokedAt: null,
  };
  sessions.set(session.id, session);
  return cloneSession(session);
});

const getUserSessionByIdMock = jest.fn(async (sessionId: string) => {
  const found = sessions.get(sessionId);
  return found ? cloneSession(found) : null;
});

const revokeUserSessionMock = jest.fn(async (sessionId: string) => {
  const existing = sessions.get(sessionId);
  if (!existing) return;
  sessions.set(sessionId, {
    ...existing,
    revokedAt: new Date(),
  });
});

const createProviderSessionMock = jest.fn(async (did: string, scopes: string[]) => {
  const now = new Date();
  return {
    id: `provider-session-${nextProviderSessionId++}`,
    did,
    scopes,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60),
    revokedAt: null,
  };
});

const mockIsOpenAIConfigured = jest.fn(() => false);
const mockChatWithOpenAI = jest.fn(async () => 'Ethical AI test response');
const mockGetVertexAIService = jest.fn(() => {
  throw new Error('Vertex not configured');
});
const mockPrismaDb = {
  $executeRaw: jest.fn(async () => 1),
  $queryRaw: jest.fn(async () => []),
  course: {
    findMany: jest.fn(async () => []),
  },
  user: {
    findMany: jest.fn(async () => []),
    findUnique: jest.fn(async () => null),
  },
};

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/prismaClient', () => ({
  getPrisma: jest.fn(() => mockPrismaDb),
  disconnectPrisma: jest.fn(async () => undefined),
}));

jest.mock('../services/socialStore', () => ({
  socialStore: mockSocialStore,
}));

jest.mock('../services/uploadBlobStore', () => ({
  persistUploadObject: persistUploadObjectMock,
  resolveUploadObjectByKey: resolveUploadObjectByKeyMock,
  getUploadObjectAccessMetadata: getUploadObjectAccessMetadataMock,
  isUploadObjectPubliclyReadable: isUploadObjectPubliclyReadableMock,
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: createUserSessionMock,
  getUserSessionById: getUserSessionByIdMock,
  revokeUserSession: revokeUserSessionMock,
}));

jest.mock('../services/googleSheetsMirror', () => ({
  mirrorUserToGoogleSheets: jest.fn(async () => undefined),
}));

jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    send: jest.fn(async () => ({ ok: true, skipped: true })),
    configured: jest.fn(() => false),
  },
}));

jest.mock('../services/providerSessionStore', () => ({
  createProviderSession: createProviderSessionMock,
  getProviderSessionById: jest.fn(async () => null),
}));

jest.mock('../services/openAiService', () => ({
  isOpenAIConfigured: mockIsOpenAIConfigured,
  chatWithOpenAI: mockChatWithOpenAI,
}));

jest.mock('../services/vertexAiService', () => ({
  getVertexAIService: mockGetVertexAIService,
}));

const { userPublicRoutes, userProtectedRoutes } = require('../routes/user');
const socialRoutes = require('../routes/social').default;
const { uploadPublicRoutes, uploadProtectedRoutes } = require('../routes/upload');
const aiRoutes = require('../routes/ai').default;
const providerAuthRoutes = require('../routes/providerAuth').default;

let server: http.Server | null = null;
let baseUrl = '';

const requestJson = async (options: {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

const requestMemberSignIn = async (email: string, password: string): Promise<{ status: number; body: any }> => {
  return requestJson({
    method: 'POST',
    path: '/api/user/signin',
    body: {
      email,
      password,
    },
  });
};

const requestMultipart = async (options: {
  method: string;
  path: string;
  token?: string;
  form: FormData;
}): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.form,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
};

describe('Core user persistence loop', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'core-loop-test-auth-secret';
    process.env.SENSITIVE_DATA_KEY = 'core-loop-sensitive-key';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';
    process.env.PUBLIC_BASE_URL = '';

    const app = express();
    app.use(express.json());
    app.use('/api/user', userPublicRoutes);
    app.use('/api/user', userProtectedRoutes);
    app.use('/api/social', socialRoutes);
    app.use('/api/upload', uploadProtectedRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/provider/auth', providerAuthRoutes);
    app.use('/uploads', uploadPublicRoutes);

    server = await new Promise<http.Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server address');
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
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    resetState();
    delete process.env.ENABLE_USER_2FA;
    delete process.env.ENABLE_PASSWORD_RESET;
    jest.clearAllMocks();
    mockIsOpenAIConfigured.mockReturnValue(false);
    mockChatWithOpenAI.mockResolvedValue('Ethical AI test response');
    mockGetVertexAIService.mockImplementation(() => {
      throw new Error('Vertex not configured');
    });
  });

  it('persists profile and uploaded content across logout/login and enforces block boundaries', async () => {
    const strongPassword = 'StrongPass#1234';

    const createAlpha = await requestJson({
      method: 'POST',
      path: '/api/user/create',
      body: {
        email: 'alpha@example.com',
        password: strongPassword,
        name: 'Alpha',
      },
    });
    expect(createAlpha.status).toBe(200);
    const alphaToken = String(createAlpha.body?.token || '');
    const alphaId = String(createAlpha.body?.user?.id || '');
    expect(alphaToken.length).toBeGreaterThan(20);
    expect(alphaId).toBeTruthy();
    expect(createAlpha.body?.user?.initialTwoFactorRequired).toBe(false);
    expect(createAlpha.body?.emailVerification).toBeUndefined();

    const privacyBeforeMembership = await requestJson({
      method: 'GET',
      path: '/api/user/privacy',
      token: alphaToken,
    });
    expect(privacyBeforeMembership.status).toBe(200);

    const createBeta = await requestJson({
      method: 'POST',
      path: '/api/user/create',
      body: {
        email: 'beta@example.com',
        password: 'AnotherPass#5678',
        name: 'Beta',
      },
    });
    expect(createBeta.status).toBe(200);
    const betaToken = String(createBeta.body?.token || '');
    const betaId = String(createBeta.body?.user?.id || '');
    expect(betaId).toBeTruthy();

    const profileUpdate = await requestJson({
      method: 'POST',
      path: '/api/social/profile',
      token: alphaToken,
      body: {
        name: 'Alpha Persisted',
        bio: 'This profile should persist after re-login.',
        location: 'Austin, TX',
      },
    });
    expect(profileUpdate.status).toBe(200);
    expect(profileUpdate.body?.profile?.name).toBe('Alpha Persisted');
    expect(profileUpdate.body?.profile?.bio).toBe('This profile should persist after re-login.');

    const form = new FormData();
    form.set(
      'file',
      new Blob(['durable-upload-content'], { type: 'text/plain' }),
      'durability.txt'
    );
    const upload = await requestMultipart({
      method: 'POST',
      path: '/api/upload/reflection',
      token: alphaToken,
      form,
    });
    expect(upload.status).toBe(200);
    expect(upload.body?.media?.storageProvider).toBe('postgres_large_object');
    const uploadUrl = String(upload.body?.fileUrl || '');
    const uploadObjectKey = String(upload.body?.media?.objectKey || '');
    expect(uploadUrl).toContain('/api/upload/object/');
    expect(uploadObjectKey).toBeTruthy();

    const publicReflectionResponse = await fetch(
      `${baseUrl}/uploads/object/${encodeURIComponent(uploadObjectKey)}`
    );
    expect(publicReflectionResponse.status).toBe(404);

    const unauthenticatedReflectionResponse = await fetch(
      `${baseUrl}/api/upload/object/${encodeURIComponent(uploadObjectKey)}`
    );
    expect(unauthenticatedReflectionResponse.status).toBe(401);

    const otherUserReflectionResponse = await fetch(
      `${baseUrl}/api/upload/object/${encodeURIComponent(uploadObjectKey)}`,
      { headers: { Authorization: `Bearer ${betaToken}` } }
    );
    expect(otherUserReflectionResponse.status).toBe(404);

    const privateReflectionResponse = await fetch(
      `${baseUrl}/api/upload/object/${encodeURIComponent(uploadObjectKey)}`,
      { headers: { Authorization: `Bearer ${alphaToken}` } }
    );
    expect(privateReflectionResponse.status).toBe(200);
    expect(await privateReflectionResponse.text()).toBe('durable-upload-content');

    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    );
    const socialForm = new FormData();
    socialForm.set(
      'file',
      new Blob([pngBytes], { type: 'image/png' }),
      'social.png'
    );
    const socialUpload = await requestMultipart({
      method: 'POST',
      path: '/api/upload/social',
      token: alphaToken,
      form: socialForm,
    });
    expect(socialUpload.status).toBe(200);
    const socialUploadUrl = String(socialUpload.body?.fileUrl || '');
    const socialUploadObjectKey = String(socialUpload.body?.media?.objectKey || '');
    expect(socialUploadUrl).toContain('/uploads/object/');

    const publicSocialResponse = await fetch(
      `${baseUrl}/uploads/object/${encodeURIComponent(socialUploadObjectKey)}`
    );
    expect(publicSocialResponse.status).toBe(200);
    expect(publicSocialResponse.headers.get('content-type')).toContain('image/png');
    expect(Buffer.from(await publicSocialResponse.arrayBuffer()).equals(pngBytes)).toBe(true);

    const staleFrontendProtectedSocialUrl =
      `https://conscious-network.org/api/upload/object/${encodeURIComponent(socialUploadObjectKey)}`;
    const expectedCanonicalSocialUrl =
      `${baseUrl}/uploads/object/${encodeURIComponent(socialUploadObjectKey)}`;

    const createPost = await requestJson({
      method: 'POST',
      path: '/api/social/posts',
      token: alphaToken,
      body: {
        text: 'Uploaded content attached',
        visibility: 'public',
        media: [
          {
            mediaType: 'image',
            url: staleFrontendProtectedSocialUrl,
            storageProvider: socialUpload.body?.media?.storageProvider,
            objectKey: socialUploadObjectKey,
          },
        ],
      },
    });
    expect(createPost.status).toBe(200);
    const postId = String(createPost.body?.post?.id || '');
    expect(postId).toBeTruthy();
    expect(createPost.body?.post?.media?.[0]?.url).toBe(expectedCanonicalSocialUrl);
    expect(createPost.body?.post?.media?.[0]?.url).not.toContain('conscious-network.org/uploads/object/');
    expect(createPost.body?.post?.media?.[0]?.url).not.toContain('/api/upload/object/');

    const logout = await requestJson({
      method: 'POST',
      path: '/api/user/logout',
      token: alphaToken,
    });
    expect(logout.status).toBe(200);
    expect(logout.body?.sessionRevoked).toBe(true);

    const currentWithOldToken = await requestJson({
      method: 'GET',
      path: '/api/user/current',
      token: alphaToken,
    });
    expect(currentWithOldToken.status).toBe(401);

    const relogin = await requestMemberSignIn('alpha@example.com', strongPassword);
    expect(relogin.status).toBe(200);
    const alphaTokenAfterLogin = String(relogin.body?.token || '');
    expect(alphaTokenAfterLogin.length).toBeGreaterThan(20);

    const currentAfterRelogin = await requestJson({
      method: 'GET',
      path: '/api/user/current',
      token: alphaTokenAfterLogin,
    });
    expect(currentAfterRelogin.status).toBe(200);
    expect(currentAfterRelogin.body?.user?.name).toBe('Alpha Persisted');
    expect(currentAfterRelogin.body?.user?.bio).toBe('This profile should persist after re-login.');

    const alphaProfileAfterRelogin = await requestJson({
      method: 'GET',
      path: `/api/social/profile/${alphaId}`,
      token: alphaTokenAfterLogin,
    });
    expect(alphaProfileAfterRelogin.status).toBe(200);
    expect(alphaProfileAfterRelogin.body?.posts?.length).toBeGreaterThan(0);
    expect(alphaProfileAfterRelogin.body?.posts?.[0]?.id).toBe(postId);
    expect(alphaProfileAfterRelogin.body?.posts?.[0]?.media?.[0]?.objectKey).toBe(socialUploadObjectKey);
    expect(alphaProfileAfterRelogin.body?.posts?.[0]?.media?.[0]?.url).toBe(expectedCanonicalSocialUrl);

    const deepLinkedPost = await requestJson({
      method: 'GET',
      path: `/api/social/posts/${postId}`,
      token: alphaTokenAfterLogin,
    });
    expect(deepLinkedPost.status).toBe(200);
    expect(deepLinkedPost.body?.post?.id).toBe(postId);
    expect(deepLinkedPost.body?.post?.media?.[0]?.objectKey).toBe(socialUploadObjectKey);
    expect(deepLinkedPost.body?.post?.media?.[0]?.url).toBe(expectedCanonicalSocialUrl);

    const betaBlocksAlpha = await requestJson({
      method: 'POST',
      path: `/api/user/privacy/block/${alphaId}`,
      token: betaToken,
    });
    expect(betaBlocksAlpha.status).toBe(200);

    const deniedFollow = await requestJson({
      method: 'POST',
      path: `/api/social/users/${betaId}/follow`,
      token: alphaTokenAfterLogin,
      body: { follow: true },
    });
    expect(deniedFollow.status).toBe(403);
    expect(deniedFollow.body?.error).toBe('Follow relationship not allowed');

    const deniedProfileView = await requestJson({
      method: 'GET',
      path: `/api/social/profile/${betaId}`,
      token: alphaTokenAfterLogin,
    });
    expect(deniedProfileView.status).toBe(403);
    expect(deniedProfileView.body?.error).toBe('Profile is unavailable');
  });

  it('registers and signs in a member without phoneNumber or email verification', async () => {
    const password = 'Qx#93Lm!T2vA';
    const create = await requestJson({
      method: 'POST',
      path: '/api/user/create',
      body: {
        email: 'email-verify@example.com',
        password,
        name: 'Email Verify',
      },
    });

    expect(create.status).toBe(200);
    expect(create.body?.emailVerification).toBeUndefined();
    expect(create.body?.user?.initialTwoFactorRequired).toBe(false);
    expect(create.body?.user?.emailVerified).toBe(false);

    const signin = await requestMemberSignIn('email-verify@example.com', password);
    expect(signin.status).toBe(200);
    expect(signin.body?.success).toBe(true);
    expect(signin.body?.user?.initialTwoFactorRequired).toBe(false);
    expect(signin.body?.user?.emailVerified).toBe(false);
  });

  it('requires provider wallet verification before native provider controls unlock', async () => {
    const password = 'ProviderPass#1234';
    const provider = createMockUser('approved-provider', 'provider@example.com', {
      role: 'provider',
      password: hashPassword(password),
      providerApproved: true,
      providerApprovalStatus: 'approved',
      providerRevokedAt: null,
    });
    users.set(provider.id, provider);

    const signin = await requestMemberSignIn(provider.email, password);
    expect(signin.status).toBe(200);
    expect(signin.body?.success).toBe(true);
    expect(signin.body?.user?.role).toBe('provider');

    const providerSession = await requestJson({
      method: 'POST',
      path: '/api/provider/auth/session',
      token: String(signin.body?.token || ''),
      body: {},
    });

    expect(providerSession.status).toBe(403);
    expect(providerSession.body?.code).toBe('PROVIDER_WALLET_VERIFICATION_REQUIRED');
    expect(createProviderSessionMock).not.toHaveBeenCalled();
  });

  it('does not block existing users with null legacy verification fields', async () => {
    const password = 'ExistingPass#1234';
    const existing = createMockUser('existing-user', 'existing@example.com', {
      password: hashPassword(password),
      initialTwoFactorRequiredAt: null,
      initialTwoFactorCompletedAt: null,
    });
    users.set(existing.id, existing);

    const signin = await requestMemberSignIn(existing.email, password);
    expect(signin.status).toBe(200);
    expect(signin.body?.user?.initialTwoFactorRequired).toBe(false);

    const privacy = await requestJson({
      method: 'GET',
      path: '/api/user/privacy',
      token: String(signin.body?.token || ''),
    });
    expect(privacy.status).toBe(200);
  });

  it('reconciles active membership records into current user payload and sign-in routing state', async () => {
    const password = 'MemberPass#1234';
    const existing = createMockUser('member-user', 'member@example.com', {
      password: hashPassword(password),
      tier: '',
      subscriptionStatus: 'inactive',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
    });
    users.set(existing.id, existing);

    const membershipStart = new Date(Date.now() - 60_000);
    memberships.set(existing.id, {
      id: 'membership-member-user',
      userId: existing.id,
      tier: 'Guided Tier',
      status: 'active',
      startDate: membershipStart,
      endDate: null,
      createdAt: membershipStart,
      updatedAt: membershipStart,
    });

    const signin = await requestMemberSignIn(existing.email, password);

    expect(signin.status).toBe(200);
    expect(signin.body?.user?.tier).toBe('Guided Tier');
    expect(signin.body?.user?.subscriptionStatus).toBe('active');
    expect(signin.body?.user?.membershipStatus).toBe('active');
    expect(signin.body?.user?.hasActiveMembership).toBe(true);

    const projected = users.get(existing.id);
    expect(projected?.tier).toBe('Guided Tier');
    expect(projected?.subscriptionStatus).toBe('active');

    const current = await requestJson({
      method: 'GET',
      path: '/api/user/current',
      token: String(signin.body?.token || ''),
    });

    expect(current.status).toBe(200);
    expect(current.body?.user?.tier).toBe('Guided Tier');
    expect(current.body?.user?.hasActiveMembership).toBe(true);
  });

  it('does not trust stale active user projection without a canonical membership row', async () => {
    const password = 'MemberPass#1234';
    const existing = createMockUser('stale-member-user', 'stale-member@example.com', {
      password: hashPassword(password),
      tier: 'Accelerated Tier',
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(Date.now() - 60_000),
      subscriptionEndDate: null,
    });
    users.set(existing.id, existing);

    const signin = await requestMemberSignIn(existing.email, password);

    expect(signin.status).toBe(200);
    expect(signin.body?.user?.tier).toBe(null);
    expect(signin.body?.user?.subscriptionStatus).toBe('inactive');
    expect(signin.body?.user?.membershipStatus).toBe(null);
    expect(signin.body?.user?.hasActiveMembership).toBe(false);

    const projected = users.get(existing.id);
    expect(projected?.tier).toBe('');
    expect(projected?.subscriptionStatus).toBe('inactive');
    expect(projected?.subscriptionStartDate).toBe(null);
    expect(projected?.subscriptionEndDate).toBe(null);
  });

  it('allows free users with legacy verification fields to call Ethical AI Insight', async () => {
    const user = createMockUser('free-ai-user', 'free-ai@example.com', {
      tier: 'Free / Community Tier',
      initialTwoFactorRequiredAt: new Date(Date.now() - 1000),
      initialTwoFactorCompletedAt: new Date(),
    });
    users.set(user.id, user);
    mockIsOpenAIConfigured.mockReturnValue(true);
    mockChatWithOpenAI.mockResolvedValue('Free tier AI response');

    const token = createSessionToken(user.id).token;
    const ai = await requestJson({
      method: 'POST',
      path: '/api/ai/chat',
      token,
      body: {
        message: 'Can free members use Ethical AI Insight?',
        context: { category: 'platform', userId: user.id },
        conversationHistory: [],
      },
    });

    expect(ai.status).toBe(200);
    expect(ai.body?.provider).toBe('openai');
    expect(ai.body?.reply).toBe('Free tier AI response');
  });

  it('does not block Ethical AI Insight when legacy initial verification fields are incomplete', async () => {
    const user = createMockUser('pending-ai-user', 'pending-ai@example.com', {
      tier: 'Free / Community Tier',
      initialTwoFactorRequiredAt: new Date(),
      initialTwoFactorCompletedAt: null,
    });
    users.set(user.id, user);
    mockIsOpenAIConfigured.mockReturnValue(true);

    const token = createSessionToken(user.id).token;
    const ai = await requestJson({
      method: 'POST',
      path: '/api/ai/wisdom',
      token,
      body: { refreshNonce: 'test' },
    });

    expect(ai.status).toBe(200);
    expect(ai.body?.provider).toBe('openai');
  });

  it('falls back to the local safety provider when no external AI provider is configured', async () => {
    const user = createMockUser('local-ai-provider-user', 'local-ai-provider@example.com', {
      tier: 'Free / Community Tier',
      initialTwoFactorRequiredAt: new Date(Date.now() - 1000),
      initialTwoFactorCompletedAt: new Date(),
    });
    users.set(user.id, user);
    mockIsOpenAIConfigured.mockReturnValue(false);

    const token = createSessionToken(user.id).token;
    const ai = await requestJson({
      method: 'POST',
      path: '/api/ai/wisdom',
      token,
      body: { refreshNonce: 'test' },
    });

    expect(ai.status).toBe(200);
    expect(ai.body?.provider).toBe('local');
    expect(ai.body?.reply || ai.body?.wisdom).toContain('Conscious Network Hub');
    expect(ai.body?.reply || ai.body?.wisdom).not.toContain('backend');
    expect(ai.body?.reply || ai.body?.wisdom).not.toContain('configure');
  });

  it('returns actionable auth recovery when profile persists but session setup fails', async () => {
    createUserSessionMock.mockRejectedValueOnce(new Error('session-create-failed'));
    const password = 'Qx#93Lm!T2vA';

    const create = await requestJson({
      method: 'POST',
      path: '/api/user/create',
      body: {
        email: 'recoverable@example.com',
        password,
        name: 'Recoverable',
      },
    });

    expect(create.status).toBe(503);
    expect(create.body?.code).toBe('PROFILE_SESSION_ESTABLISH_FAILED');

    const persisted = await mockLocalStore.getUserByEmail('recoverable@example.com');
    expect(persisted?.id).toBeTruthy();

    const signin = await requestMemberSignIn('recoverable@example.com', password);

    expect(signin.status).toBe(200);
    expect(String(signin.body?.token || '').length).toBeGreaterThan(20);
  });
});
