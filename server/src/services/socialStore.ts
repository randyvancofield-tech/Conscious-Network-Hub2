import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

export type SocialPostVisibility = 'public' | 'private';
export type SocialPostMediaType = 'image' | 'video' | 'file';

export interface SocialPostMediaInput {
  mediaType: SocialPostMediaType;
  url: string;
  storageProvider?: string | null;
  objectKey?: string | null;
}

export interface SocialPostMediaRecord {
  id: string;
  postId: string;
  mediaType: SocialPostMediaType;
  url: string;
  storageProvider: string | null;
  objectKey: string | null;
  createdAt: Date;
}

interface SocialPostMediaRow {
  id: string;
  postId: string;
  mediaType: SocialPostMediaType;
  url: string;
  storageProvider: string | null;
  objectKey: string | null;
  createdAt: string;
}

export interface SocialPostRecord {
  id: string;
  authorId: string;
  text: string;
  visibility: SocialPostVisibility;
  media: SocialPostMediaRecord[];
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SocialPostRow {
  id: string;
  authorId: string;
  text: string;
  visibility: SocialPostVisibility;
  media: SocialPostMediaRow[];
  createdAt: string;
  updatedAt: string;
}

interface SocialPostLikeRow {
  userId: string;
  postId: string;
  createdAt: string;
}

interface SocialFollowRow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

interface SocialStoreRow {
  version: number;
  posts: SocialPostRow[];
  postLikes: SocialPostLikeRow[];
  follows: SocialFollowRow[];
}

const STORE_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(STORE_DIR, 'social-store.json');
const STORE_TMP_FILE = path.join(STORE_DIR, 'social-store.tmp.json');
const STORE_BACKUP_FILE = path.join(STORE_DIR, 'social-store.backup.json');

const prisma = new PrismaClient();

const toStoreError = (message: string, cause?: unknown): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string; cause?: unknown };
  error.code = 'STORE_UNAVAILABLE';
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

const ensurePrisma = (): PrismaClient => {
  return prisma;
};

const nowIso = (): string => new Date().toISOString();

const createEmptyStore = (): SocialStoreRow => ({
  version: 1,
  posts: [],
  postLikes: [],
  follows: [],
});

const ensureStoreFile = (): void => {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
  }
};

const parseStore = (raw: string): SocialStoreRow => {
  if (!raw.trim()) return createEmptyStore();
  const parsed = JSON.parse(raw) as Partial<SocialStoreRow>;
  return {
    version: 1,
    posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    postLikes: Array.isArray(parsed.postLikes) ? parsed.postLikes : [],
    follows: Array.isArray(parsed.follows) ? parsed.follows : [],
  };
};

const loadStore = (): SocialStoreRow => {
  ensureStoreFile();
  try {
    return parseStore(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (primaryError) {
    if (!fs.existsSync(STORE_BACKUP_FILE)) {
      throw toStoreError('[SOCIAL][FATAL] Social store is unreadable', primaryError);
    }
    try {
      const restored = parseStore(fs.readFileSync(STORE_BACKUP_FILE, 'utf8'));
      fs.copyFileSync(STORE_BACKUP_FILE, STORE_FILE);
      return restored;
    } catch (backupError) {
      throw toStoreError('[SOCIAL][FATAL] Social store and backup are unreadable', backupError);
    }
  }
};

const saveStore = (store: SocialStoreRow): void => {
  ensureStoreFile();
  try {
    fs.writeFileSync(STORE_TMP_FILE, JSON.stringify(store, null, 2), 'utf8');
    if (fs.existsSync(STORE_FILE)) {
      fs.copyFileSync(STORE_FILE, STORE_BACKUP_FILE);
      fs.rmSync(STORE_FILE, { force: true });
    }
    fs.renameSync(STORE_TMP_FILE, STORE_FILE);
  } catch (error) {
    throw toStoreError('[SOCIAL][FATAL] Failed to persist social store', error);
  }
};

const normalizeVisibility = (value: unknown): SocialPostVisibility =>
  String(value || '').trim().toLowerCase() === 'private' ? 'private' : 'public';

const normalizeMediaType = (value: unknown): SocialPostMediaType =>
  String(value || '').trim().toLowerCase() === 'video'
    ? 'video'
    : String(value || '').trim().toLowerCase() === 'file'
    ? 'file'
    : 'image';

const normalizeMediaInput = (value: unknown): SocialPostMediaInput[] => {
  if (!Array.isArray(value)) return [];
  const normalized: SocialPostMediaInput[] = [];
  for (const entry of value) {
    const input = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
    if (!input) continue;
    const url = String(input.url || '').trim();
    if (!url) continue;
    normalized.push({
      mediaType: normalizeMediaType(input.mediaType),
      url,
      storageProvider: String(input.storageProvider || '').trim() || null,
      objectKey: String(input.objectKey || '').trim() || null,
    });
    if (normalized.length >= 8) break;
  }
  return normalized;
};

const mapRowMediaToRecord = (
  media: unknown,
  postId: string,
  fallbackCreatedAtIso: string
): SocialPostMediaRecord[] => {
  if (!Array.isArray(media)) return [];
  const mapped: SocialPostMediaRecord[] = [];
  for (let index = 0; index < media.length; index += 1) {
    const entry =
      media[index] && typeof media[index] === 'object'
        ? (media[index] as Record<string, unknown>)
        : null;
    if (!entry) continue;

    const url = String(entry.url || '').trim();
    if (!url) continue;

    const id = String(entry.id || '').trim() || `${postId}-media-${index + 1}`;
    const mediaPostId = String(entry.postId || '').trim() || postId;
    const createdAtRaw = String(entry.createdAt || '').trim();
    mapped.push({
      id,
      postId: mediaPostId,
      mediaType: normalizeMediaType(entry.mediaType),
      url,
      storageProvider: String(entry.storageProvider || '').trim() || null,
      objectKey: String(entry.objectKey || '').trim() || null,
      createdAt: new Date(createdAtRaw || fallbackCreatedAtIso),
    });
  }
  return mapped;
};

const mapRowToRecord = (
  row: SocialPostRow,
  likes: SocialPostLikeRow[]
): SocialPostRecord => ({
  id: row.id,
  authorId: row.authorId,
  text: row.text,
  visibility: normalizeVisibility(row.visibility),
  media: mapRowMediaToRecord(row.media, row.id, row.createdAt),
  likeCount: likes.filter((like) => like.postId === row.id).length,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

const mapPrismaPostToRecord = (post: any): SocialPostRecord => ({
  id: post.id,
  authorId: post.authorId,
  text: post.text || '',
  visibility: normalizeVisibility(post.visibility),
  media: (Array.isArray(post.media) ? post.media : []).map((media: any) => ({
    id: media.id,
    postId: media.postId || post.id,
    mediaType: normalizeMediaType(media.mediaType),
    url: media.url,
    storageProvider: media.storageProvider || null,
    objectKey: media.objectKey || null,
    createdAt: media.createdAt instanceof Date ? media.createdAt : new Date(media.createdAt),
  })),
  likeCount: Number(post?._count?.likes || 0),
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

const sortPostsDesc = (posts: SocialPostRow[]): SocialPostRow[] =>
  posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const applyCursor = (rows: SocialPostRow[], cursorPostId?: string): SocialPostRow[] => {
  if (!cursorPostId) return rows;
  const index = rows.findIndex((row) => row.id === cursorPostId);
  if (index < 0) return rows;
  return rows.slice(index + 1);
};

export const socialStore = {
  async createPost(input: {
    authorId: string;
    text?: string;
    visibility?: SocialPostVisibility;
    media?: unknown;
  }): Promise<SocialPostRecord> {
    const text = String(input.text || '').trim().slice(0, 5000);
    const visibility = normalizeVisibility(input.visibility);
    const media = normalizeMediaInput(input.media);

    if (!text && media.length === 0) {
      throw new Error('Post requires text or media');
    }

    try {
      const db = ensurePrisma() as any;
      const created = await db.socialPost.create({
        data: {
          id: crypto.randomUUID(),
          authorId: input.authorId,
          text,
          visibility,
          media: {
            create: media.map((entry) => ({
              id: crypto.randomUUID(),
              mediaType: normalizeMediaType(entry.mediaType),
              url: entry.url,
              storageProvider: entry.storageProvider || null,
              objectKey: entry.objectKey || null,
            })),
          },
        },
        include: {
          media: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
      });
      return mapPrismaPostToRecord(created);
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to create post', error);
    }
  },

  async getPostById(postId: string): Promise<SocialPostRecord | null> {
    try {
      const db = ensurePrisma() as any;
      const post = await db.socialPost.findUnique({
        where: { id: postId },
        include: {
          media: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
      });
      return post ? mapPrismaPostToRecord(post) : null;
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to fetch post', error);
    }
  },

  async listPosts(options: {
    limit?: number;
    cursorPostId?: string;
  }): Promise<SocialPostRecord[]> {
    const limit = Math.max(1, Math.min(Number(options.limit) || 20, 200));

    try {
      const db = ensurePrisma() as any;
      const posts = await db.socialPost.findMany({
        ...(options.cursorPostId
          ? {
              cursor: { id: options.cursorPostId },
              skip: 1,
            }
          : {}),
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          media: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
      });
      return posts.map(mapPrismaPostToRecord);
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to list posts', error);
    }
  },

  async listPostsByAuthor(options: {
    authorId: string;
    limit?: number;
    cursorPostId?: string;
  }): Promise<SocialPostRecord[]> {
    const limit = Math.max(1, Math.min(Number(options.limit) || 20, 200));

    try {
      const db = ensurePrisma() as any;
      const posts = await db.socialPost.findMany({
        where: { authorId: options.authorId },
        ...(options.cursorPostId
          ? {
              cursor: { id: options.cursorPostId },
              skip: 1,
            }
          : {}),
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          media: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
      });
      return posts.map(mapPrismaPostToRecord);
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to list author posts', error);
    }
  },

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    try {
      const db = ensurePrisma() as any;
      const existing = await db.socialPostLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
      let liked = false;
      if (existing) {
        await db.socialPostLike.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
      } else {
        await db.socialPostLike.create({
          data: {
            userId,
            postId,
          },
        });
        liked = true;
      }
      const likeCount = await db.socialPostLike.count({
        where: { postId },
      });
      return { liked, likeCount };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Post not found');
      }
      throw toStoreError('[SOCIAL][FATAL] Failed to toggle post like', error);
    }
  },

  async setFollow(
    followerId: string,
    followingId: string,
    follow: boolean
  ): Promise<{ following: boolean }> {
    if (followerId === followingId) {
      throw new Error('Users cannot follow themselves');
    }

    try {
      const db = ensurePrisma() as any;
      if (follow) {
        await db.socialFollow.upsert({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
          update: {},
          create: {
            followerId,
            followingId,
          },
        });
      } else {
        await db.socialFollow.deleteMany({
          where: {
            followerId,
            followingId,
          },
        });
      }
      return { following: follow };
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to update follow relationship', error);
    }
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const db = ensurePrisma() as any;
      const row = await db.socialFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      return Boolean(row);
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to check follow state', error);
    }
  },

  async listFollowingIds(followerId: string): Promise<string[]> {
    try {
      const db = ensurePrisma() as any;
      const rows = await db.socialFollow.findMany({
        where: { followerId },
        select: { followingId: true },
      });
      return rows.map((row: any) => row.followingId);
    } catch (error) {
      throw toStoreError('[SOCIAL][FATAL] Failed to list following ids', error);
    }
  },
};
