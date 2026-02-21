import express from 'express';
import http from 'http';

type TwoFactorMethod = 'none' | 'phone' | 'wallet';

interface MockUser {
  id: string;
  email: string;
  name: string | null;
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
}

const users = new Map<string, MockUser>();
const postsByAuthor = new Map<string, any[]>();
const follows = new Set<string>();
const sessions = new Map<string, MockSession>();
const uploads = new Map<string, StoredUpload>();

let nextUserId = 1;
let nextPostId = 1;
let nextSessionId = 1;
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
  pendingPhoneOtpExpiresAt: cloneDate(user.pendingPhoneOtpExpiresAt),
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
  postsByAuthor.clear();
  follows.clear();
  sessions.clear();
  uploads.clear();
  nextUserId = 1;
  nextPostId = 1;
  nextSessionId = 1;
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

  async createUser(input: any): Promise<MockUser> {
    const email = String(input.email || '').trim().toLowerCase();
    const id = `user-${nextUserId++}`;
    const created = createMockUser(id, email, {
      name: input.name || 'Node',
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
      tier: input.tier || 'Free / Community Tier',
      phoneNumber: input.phoneNumber || null,
      twoFactorMethod: input.twoFactorMethod || 'none',
      walletDid: input.walletDid || null,
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
  uploads.set(objectKey, {
    buffer: Buffer.from(input.buffer),
    mimeType: String(input.mimeType || 'application/octet-stream'),
    sizeBytes: Buffer.from(input.buffer).length,
  });
  return {
    objectKey,
    storageProvider: 'postgres_large_object',
    publicPath: `/uploads/object/${objectKey}`,
    mimeType: String(input.mimeType || 'application/octet-stream'),
    sizeBytes: Buffer.from(input.buffer).length,
  };
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

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/socialStore', () => ({
  socialStore: mockSocialStore,
}));

jest.mock('../services/uploadBlobStore', () => ({
  persistUploadObject: persistUploadObjectMock,
  resolveUploadObjectByKey: resolveUploadObjectByKeyMock,
}));

jest.mock('../services/userSessionStore', () => ({
  createUserSession: createUserSessionMock,
  getUserSessionById: getUserSessionByIdMock,
  revokeUserSession: revokeUserSessionMock,
}));

jest.mock('../services/googleSheetsMirror', () => ({
  mirrorUserToGoogleSheets: jest.fn(async () => undefined),
}));

jest.mock('../services/providerSessionStore', () => ({
  getProviderSessionById: jest.fn(async () => null),
}));

const { requireCanonicalIdentity } = require('../middleware');
const { userPublicRoutes, userProtectedRoutes } = require('../routes/user');
const socialRoutes = require('../routes/social').default;
const { uploadPublicRoutes, uploadProtectedRoutes } = require('../routes/upload');

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
    app.use('/api/user', requireCanonicalIdentity, userProtectedRoutes);
    app.use('/api/social', requireCanonicalIdentity, socialRoutes);
    app.use('/api/upload', requireCanonicalIdentity, uploadProtectedRoutes);
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
    jest.clearAllMocks();
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
    expect(uploadUrl).toContain('/uploads/object/');
    expect(uploadObjectKey).toBeTruthy();

    const uploadedObjectResponse = await fetch(
      `${baseUrl}/uploads/object/${encodeURIComponent(uploadObjectKey)}`
    );
    expect(uploadedObjectResponse.status).toBe(200);
    expect(await uploadedObjectResponse.text()).toBe('durable-upload-content');

    const createPost = await requestJson({
      method: 'POST',
      path: '/api/social/posts',
      token: alphaToken,
      body: {
        text: 'Uploaded content attached',
        visibility: 'public',
        media: [
          {
            mediaType: 'file',
            url: uploadUrl,
            storageProvider: upload.body?.media?.storageProvider,
            objectKey: uploadObjectKey,
          },
        ],
      },
    });
    expect(createPost.status).toBe(200);
    const postId = String(createPost.body?.post?.id || '');
    expect(postId).toBeTruthy();

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

    const relogin = await requestJson({
      method: 'POST',
      path: '/api/user/signin',
      body: {
        email: 'alpha@example.com',
        password: strongPassword,
      },
    });
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
    expect(alphaProfileAfterRelogin.body?.posts?.[0]?.media?.[0]?.objectKey).toBe(uploadObjectKey);

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
});
