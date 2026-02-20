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

const users = new Map<string, MockUser>();
const follows = new Set<string>();
const likes = new Set<string>();
const postsByAuthor = new Map<string, any[]>();

const followKey = (followerId: string, followingId: string): string => `${followerId}:${followingId}`;
const likeKey = (postId: string, userId: string): string => `${postId}:${userId}`;

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

const toUserArray = (): MockUser[] => Array.from(users.values()).map(cloneUser);

const createMockUser = (
  id: string,
  email: string,
  overrides: Partial<MockUser> = {}
): MockUser => {
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
    password: 'scrypt$test$hash',
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

  return {
    ...base,
    ...overrides,
    profileMedia: overrides.profileMedia
      ? {
          avatar: { ...overrides.profileMedia.avatar },
          cover: { ...overrides.profileMedia.cover },
        }
      : base.profileMedia,
    interests: overrides.interests ? [...overrides.interests] : base.interests,
    privacySettings: overrides.privacySettings
      ? {
          ...overrides.privacySettings,
          blockedUsers: [...overrides.privacySettings.blockedUsers],
        }
      : base.privacySettings,
    createdAt: overrides.createdAt ? new Date(overrides.createdAt.getTime()) : now,
    updatedAt: overrides.updatedAt ? new Date(overrides.updatedAt.getTime()) : now,
  };
};

const mockLocalStore = {
  async getUserByEmail(email: string): Promise<MockUser | null> {
    const lowered = email.trim().toLowerCase();
    const found = toUserArray().find((user) => user.email.toLowerCase() === lowered);
    return found ? cloneUser(found) : null;
  },
  async getUserById(id: string): Promise<MockUser | null> {
    const user = users.get(id);
    return user ? cloneUser(user) : null;
  },
  async listUsers(limit = 250): Promise<MockUser[]> {
    return toUserArray().slice(0, limit);
  },
  async findUserByPasswordFingerprint(passwordFingerprint: string): Promise<MockUser | null> {
    const found = toUserArray().find((user) => user.passwordFingerprint === passwordFingerprint);
    return found ? cloneUser(found) : null;
  },
  async createUser(input: any): Promise<MockUser> {
    const id = `user-${users.size + 1}`;
    const created = createMockUser(id, String(input.email || '').trim().toLowerCase(), {
      name: input.name || 'Node',
      password: input.password || '',
      passwordFingerprint: input.passwordFingerprint || null,
      tier: input.tier || 'Free / Community Tier',
      location: input.location || null,
      dateOfBirth: input.dateOfBirth || null,
      avatarUrl: input.avatarUrl || null,
      bannerUrl: input.bannerUrl || null,
      profileMedia: input.profileMedia || {
        avatar: { url: input.avatarUrl || null, storageProvider: null, objectKey: null },
        cover: { url: input.bannerUrl || null, storageProvider: null, objectKey: null },
      },
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
    const id = `post-${Date.now()}-${Math.random()}`;
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
    const all = Array.from(postsByAuthor.values()).flat();
    const found = all.find((post) => post.id === postId);
    return found || null;
  },
  async listPosts(options: { limit?: number; cursorPostId?: string }): Promise<any[]> {
    const limit = Number(options.limit) || 20;
    return Array.from(postsByAuthor.values()).flat().slice(0, limit);
  },
  async listPostsByAuthor(options: { authorId: string; limit?: number }): Promise<any[]> {
    const limit = Number(options.limit) || 20;
    return (postsByAuthor.get(options.authorId) || []).slice(0, limit);
  },
  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const key = likeKey(postId, userId);
    let liked = false;
    if (likes.has(key)) {
      likes.delete(key);
    } else {
      likes.add(key);
      liked = true;
    }
    const likeCount = Array.from(likes).filter((entry) => entry.startsWith(`${postId}:`)).length;
    return { liked, likeCount };
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

jest.mock('../services/persistenceStore', () => ({
  localStore: mockLocalStore,
}));

jest.mock('../services/socialStore', () => ({
  socialStore: mockSocialStore,
}));

jest.mock('../services/googleSheetsMirror', () => ({
  mirrorUserToGoogleSheets: jest.fn(async () => undefined),
}));

jest.mock('../services/providerSessionStore', () => ({
  getProviderSessionById: jest.fn(async () => null),
}));

const { createSessionToken } = require('../auth');
const { requireCanonicalIdentity } = require('../middleware');
const { userPublicRoutes, userProtectedRoutes } = require('../routes/user');
const socialRoutes = require('../routes/social').default;

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

const tokenFor = (userId: string): string => createSessionToken(userId).token;

const resetState = (): void => {
  users.clear();
  follows.clear();
  likes.clear();
  postsByAuthor.clear();
};

describe('Phase 4 integration boundaries', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_TOKEN_SECRET = 'phase4-test-auth-secret';
    process.env.SENSITIVE_DATA_KEY = 'phase4-sensitive-key';
    process.env.AUDIT_LOG_STDOUT_ONLY = 'true';

    const app = express();
    app.use(express.json());
    app.use('/api/user', userPublicRoutes);
    app.use('/api/user', requireCanonicalIdentity, userProtectedRoutes);
    app.use('/api/social', requireCanonicalIdentity, socialRoutes);

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
    users.set('viewer', createMockUser('viewer', 'viewer@example.com', { name: 'Viewer' }));
    users.set('target', createMockUser('target', 'target@example.com', { name: 'Target' }));
  });

  it('enforces privacy block boundaries in social profile access', async () => {
    const targetToken = tokenFor('target');
    const viewerToken = tokenFor('viewer');

    const blockResponse = await requestJson({
      method: 'POST',
      path: '/api/user/privacy/block/viewer',
      token: targetToken,
    });
    expect(blockResponse.status).toBe(200);

    const blockedProfileResponse = await requestJson({
      method: 'GET',
      path: '/api/social/profile/target',
      token: viewerToken,
    });
    expect(blockedProfileResponse.status).toBe(403);
    expect(blockedProfileResponse.body?.error).toBe('Profile is unavailable');
  });

  it('enforces private profile visibility until follow is granted', async () => {
    const viewerToken = tokenFor('viewer');
    const targetToken = tokenFor('target');

    const privacyUpdate = await requestJson({
      method: 'PUT',
      path: '/api/user/privacy',
      token: targetToken,
      body: {
        privacySettings: {
          profileVisibility: 'private',
          showEmail: false,
          allowMessages: true,
          blockedUsers: [],
        },
      },
    });
    expect(privacyUpdate.status).toBe(200);

    const beforeFollow = await requestJson({
      method: 'GET',
      path: '/api/social/profile/target',
      token: viewerToken,
    });
    expect(beforeFollow.status).toBe(403);
    expect(beforeFollow.body?.error).toBe('Profile is private');

    const followResult = await requestJson({
      method: 'POST',
      path: '/api/social/users/target/follow',
      token: viewerToken,
      body: { follow: true },
    });
    expect(followResult.status).toBe(200);
    expect(followResult.body?.following).toBe(true);

    const afterFollow = await requestJson({
      method: 'GET',
      path: '/api/social/profile/target',
      token: viewerToken,
    });
    expect(afterFollow.status).toBe(200);
    expect(afterFollow.body?.profile?.id).toBe('target');
  });

  it('prevents follow while blocked and allows follow after unblock', async () => {
    const targetToken = tokenFor('target');
    const viewerToken = tokenFor('viewer');

    const blockResponse = await requestJson({
      method: 'POST',
      path: '/api/user/privacy/block/viewer',
      token: targetToken,
    });
    expect(blockResponse.status).toBe(200);

    const deniedFollow = await requestJson({
      method: 'POST',
      path: '/api/social/users/target/follow',
      token: viewerToken,
      body: { follow: true },
    });
    expect(deniedFollow.status).toBe(403);
    expect(deniedFollow.body?.error).toBe('Follow relationship not allowed');

    const unblockResponse = await requestJson({
      method: 'DELETE',
      path: '/api/user/privacy/block/viewer',
      token: targetToken,
    });
    expect(unblockResponse.status).toBe(200);

    const allowedFollow = await requestJson({
      method: 'POST',
      path: '/api/social/users/target/follow',
      token: viewerToken,
      body: { follow: true },
    });
    expect(allowedFollow.status).toBe(200);
    expect(allowedFollow.body?.following).toBe(true);
  });

  it('returns masked wallet DID from security endpoint', async () => {
    const current = users.get('viewer');
    if (!current) {
      throw new Error('Missing seeded viewer user');
    }
    current.walletDid = 'did:hcn:ed25519:abcdefghijklmnopqrstuvwxyz123456';
    users.set('viewer', current);

    const securityResponse = await requestJson({
      method: 'GET',
      path: '/api/user/security',
      token: tokenFor('viewer'),
    });
    expect(securityResponse.status).toBe(200);
    expect(securityResponse.body?.security?.walletDid).not.toBe(current.walletDid);
    expect(String(securityResponse.body?.security?.walletDid || '')).toContain('...');
  });
});

