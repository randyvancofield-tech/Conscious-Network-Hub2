import { Request, Response, Router } from 'express';
import {
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { localStore } from '../services/persistenceStore';
import {
  SocialPostMediaInput,
  SocialPostVisibility,
  socialStore,
} from '../services/socialStore';

const router = Router();
router.use(requireCanonicalIdentity);

type PrivacySettings = {
  profileVisibility: 'public' | 'private';
  showEmail: boolean;
  allowMessages: boolean;
  blockedUsers: string[];
};

const normalizePrivacySettings = (value: unknown): PrivacySettings => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const visibility =
    String(input.profileVisibility || '').trim().toLowerCase() === 'private'
      ? 'private'
      : 'public';
  const blockedUsers = Array.isArray(input.blockedUsers)
    ? input.blockedUsers
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 500)
    : [];
  return {
    profileVisibility: visibility,
    showEmail: Boolean(input.showEmail),
    allowMessages: input.allowMessages === undefined ? true : Boolean(input.allowMessages),
    blockedUsers: [...new Set(blockedUsers)],
  };
};

const normalizePostVisibility = (value: unknown): SocialPostVisibility =>
  String(value || '').trim().toLowerCase() === 'private' ? 'private' : 'public';

const normalizePostMedia = (value: unknown): SocialPostMediaInput[] => {
  if (!Array.isArray(value)) return [];
  const normalized: SocialPostMediaInput[] = [];
  for (const entry of value) {
    const input = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
    if (!input) continue;
    const mediaTypeRaw = String(input.mediaType || '').trim().toLowerCase();
    const mediaType =
      mediaTypeRaw === 'video' ? 'video' : mediaTypeRaw === 'file' ? 'file' : 'image';
    const url = String(input.url || '').trim();
    if (!url) continue;
    normalized.push({
      mediaType,
      url,
      storageProvider: String(input.storageProvider || '').trim() || null,
      objectKey: String(input.objectKey || '').trim() || null,
    });
    if (normalized.length >= 8) break;
  }
  return normalized;
};

const toPublicProfile = (user: any, viewerId: string) => {
  const privacy = normalizePrivacySettings(user.privacySettings);
  const isOwner = user.id === viewerId;
  return {
    id: user.id,
    name: user.name || 'Node',
    handle: user.handle || null,
    email: privacy.showEmail || isOwner ? user.email : null,
    bio: user.bio || null,
    location: user.location || null,
    dateOfBirth: user.dateOfBirth || null,
    avatarUrl: user.avatarUrl || null,
    bannerUrl: user.bannerUrl || null,
    profileMedia: user.profileMedia || null,
    interests: Array.isArray(user.interests) ? user.interests : [],
    privacySettings: privacy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * GET /api/social/profile/:userId
 * Return public profile and recent posts.
 */
router.get('/profile/:userId', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = String(req.params.userId || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const [targetUser, viewerUser] = await Promise.all([
    localStore.getUserById(userId),
    localStore.getUserById(authUserId),
  ]);
  if (!targetUser) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  if (!viewerUser) {
    return res.status(401).json({ error: 'Viewer session is invalid' });
  }

  const targetPrivacy = normalizePrivacySettings(targetUser.privacySettings);
  const viewerPrivacy = normalizePrivacySettings(viewerUser.privacySettings);
  const blockedEitherWay =
    targetPrivacy.blockedUsers.includes(authUserId) ||
    viewerPrivacy.blockedUsers.includes(userId);
  if (blockedEitherWay) {
    return res.status(403).json({ error: 'Profile is unavailable' });
  }

  const isOwner = userId === authUserId;
  const isFollowing = isOwner ? false : await socialStore.isFollowing(authUserId, userId);
  if (targetPrivacy.profileVisibility === 'private' && !isOwner && !isFollowing) {
    return res.status(403).json({ error: 'Profile is private' });
  }

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
  const cursorPostId = String(req.query.cursor || '').trim() || undefined;
  const posts = await socialStore.listPostsByAuthor({
    authorId: userId,
    limit,
    cursorPostId,
  });
  const visiblePosts = posts.filter(
    (post) => post.visibility === 'public' || post.authorId === authUserId || isFollowing || isOwner
  );
  const enrichedPosts = visiblePosts.map((post) => ({
    ...post,
    authorName: targetUser.name || 'Node',
    authorAvatarUrl: targetUser.avatarUrl || null,
  }));

  return res.json({
    success: true,
    profile: toPublicProfile(targetUser, authUserId),
    relationship: {
      isFollowing,
      blockedEitherWay,
      visibility: targetPrivacy.profileVisibility,
    },
    posts: enrichedPosts,
    nextCursor:
      enrichedPosts.length === limit ? enrichedPosts[enrichedPosts.length - 1]?.id || null : null,
  });
});

/**
 * POST /api/social/profile
 * Update authenticated user's social profile fields.
 */
router.post('/profile', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const body = req.body || {};
  let nextDateOfBirth: Date | null | undefined = undefined;
  if (body.dateOfBirth !== undefined) {
    const raw = String(body.dateOfBirth || '').trim();
    if (!raw) {
      nextDateOfBirth = null;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'dateOfBirth must be a valid date string' });
      }
      nextDateOfBirth = parsed;
    }
  }

  const updated = await localStore.updateUser(authUserId, {
    name: body.name !== undefined ? String(body.name || '').trim() || null : undefined,
    handle: body.handle !== undefined ? String(body.handle || '').trim() || null : undefined,
    bio: body.bio !== undefined ? String(body.bio || '').trim() || null : undefined,
    location: body.location !== undefined ? String(body.location || '').trim() || null : undefined,
    dateOfBirth: nextDateOfBirth,
    avatarUrl: body.avatarUrl !== undefined ? String(body.avatarUrl || '').trim() || null : undefined,
    bannerUrl: body.bannerUrl !== undefined ? String(body.bannerUrl || '').trim() || null : undefined,
    profileMedia: body.profileMedia !== undefined ? body.profileMedia : undefined,
    interests: body.interests,
    privacySettings:
      body.privacySettings !== undefined ? normalizePrivacySettings(body.privacySettings) : undefined,
  });

  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    success: true,
    profile: toPublicProfile(updated, authUserId),
  });
});

/**
 * POST /api/social/posts
 * Create a new social post.
 */
router.post('/posts', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const text = String(req.body?.text || '').trim();
  const visibility = normalizePostVisibility(req.body?.visibility);
  const media = normalizePostMedia(req.body?.media);

  if (!text && media.length === 0) {
    return res.status(400).json({ error: 'Post requires text or media' });
  }

  try {
    const post = await socialStore.createPost({
      authorId: authUserId,
      text,
      visibility,
      media,
    });
    return res.json({ success: true, post });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create post',
    });
  }
});

/**
 * POST /api/social/posts/:postId/like
 * Toggle like/unlike for the authenticated user.
 */
router.post('/posts/:postId/like', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const postId = String(req.params.postId || '').trim();
  if (!postId) {
    return res.status(400).json({ error: 'postId is required' });
  }

  try {
    const likeState = await socialStore.toggleLike(postId, authUserId);
    return res.json({
      success: true,
      postId,
      ...likeState,
    });
  } catch (error) {
    return res.status(404).json({
      error: error instanceof Error ? error.message : 'Failed to update like state',
    });
  }
});

/**
 * POST /api/social/users/:targetUserId/follow
 * Follow or unfollow another user.
 */
router.post('/users/:targetUserId/follow', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetUserId = String(req.params.targetUserId || '').trim();
  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }
  if (targetUserId === authUserId) {
    return res.status(400).json({ error: 'Users cannot follow themselves' });
  }

  const [viewerUser, targetUser] = await Promise.all([
    localStore.getUserById(authUserId),
    localStore.getUserById(targetUserId),
  ]);
  if (!viewerUser) {
    return res.status(401).json({ error: 'Viewer session is invalid' });
  }
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found' });
  }

  const viewerPrivacy = normalizePrivacySettings(viewerUser.privacySettings);
  const targetPrivacy = normalizePrivacySettings(targetUser.privacySettings);
  if (
    viewerPrivacy.blockedUsers.includes(targetUserId) ||
    targetPrivacy.blockedUsers.includes(authUserId)
  ) {
    return res.status(403).json({ error: 'Follow relationship not allowed' });
  }

  const requestedFollow = req.body?.follow;
  const follow =
    typeof requestedFollow === 'boolean'
      ? requestedFollow
      : !(await socialStore.isFollowing(authUserId, targetUserId));
  const result = await socialStore.setFollow(authUserId, targetUserId, follow);

  return res.json({
    success: true,
    targetUserId,
    ...result,
  });
});

/**
 * GET /api/social/newsfeed
 * Return a filtered newsfeed for the authenticated user.
 */
router.get('/newsfeed', async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const viewerUser = await localStore.getUserById(authUserId);
  if (!viewerUser) {
    return res.status(401).json({ error: 'Viewer session is invalid' });
  }

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
  const cursorPostId = String(req.query.cursor || '').trim() || undefined;

  const [followingIds, allUsers, candidatePosts] = await Promise.all([
    socialStore.listFollowingIds(authUserId),
    localStore.listUsers(500),
    socialStore.listPosts({
      limit: Math.max(limit * 5, 100),
      cursorPostId,
    }),
  ]);

  const viewerPrivacy = normalizePrivacySettings(viewerUser.privacySettings);
  const usersById = new Map(allUsers.map((user) => [user.id, user]));
  const followingSet = new Set(followingIds);

  const visiblePosts = candidatePosts.filter((post) => {
    const author = usersById.get(post.authorId);
    if (!author) return false;

    const authorPrivacy = normalizePrivacySettings(author.privacySettings);
    const blockedEitherWay =
      viewerPrivacy.blockedUsers.includes(post.authorId) ||
      authorPrivacy.blockedUsers.includes(authUserId);
    if (blockedEitherWay) return false;

    if (post.visibility === 'private') {
      return post.authorId === authUserId || followingSet.has(post.authorId);
    }

    return true;
  });

  const paged = visiblePosts.slice(0, limit);
  const enrichedPosts = paged.map((post) => {
    const author = usersById.get(post.authorId);
    return {
      ...post,
      authorName: author?.name || 'Node',
      authorAvatarUrl: author?.avatarUrl || null,
    };
  });
  return res.json({
    success: true,
    posts: enrichedPosts,
    nextCursor: enrichedPosts.length === limit ? enrichedPosts[enrichedPosts.length - 1]?.id || null : null,
  });
});

export default router;
