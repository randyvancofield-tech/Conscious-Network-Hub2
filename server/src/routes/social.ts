import { Request, Response, Router } from 'express';
import {
  getAuthenticatedUserId,
  requireCanonicalIdentity,
} from '../middleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { localStore } from '../services/persistenceStore';
import {
  canViewProfileByPrivacy,
  resolvePrivacyBlockState,
} from '../services/privacyGuard';
import { normalizePrivacySettings } from '../services/profileNormalization';
import {
  SocialPostMediaInput,
  SocialPostVisibility,
  socialStore,
} from '../services/socialStore';
import {
  parseUserProfilePatch,
  SOCIAL_PROFILE_PATCH_FIELDS,
} from '../services/userProfilePatch';
import { validateJsonBody } from '../validation/jsonSchema';
import {
  socialCreatePostSchema,
  socialFollowRequestSchema,
  socialProfilePatchSchema,
} from '../validation/requestSchemas';

const router = Router();
router.use(requireCanonicalIdentity);

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
  const blockState = resolvePrivacyBlockState(authUserId, viewerPrivacy, userId, targetPrivacy);
  if (blockState.blockedEitherWay) {
    return res.status(403).json({ error: 'Profile is unavailable' });
  }

  const isOwner = userId === authUserId;
  const isFollowing = isOwner ? false : await socialStore.isFollowing(authUserId, userId);
  if (
    !canViewProfileByPrivacy({
      viewerUserId: authUserId,
      targetUserId: userId,
      targetPrivacy,
      isFollowing,
    })
  ) {
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
      blockedEitherWay: blockState.blockedEitherWay,
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
router.post('/profile', validateJsonBody(socialProfilePatchSchema), async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'profile_patch',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }
  const parsedPatch = parseUserProfilePatch(req.body, {
    allowedFields: SOCIAL_PROFILE_PATCH_FIELDS,
  });
  if (parsedPatch.error) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'profile_patch',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'invalid_patch_payload' },
    });
    return res.status(400).json({ error: parsedPatch.error });
  }

  const updated = await localStore.updateUser(authUserId, parsedPatch.updates);

  if (!updated) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'profile_patch',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 404,
      metadata: { reason: 'user_not_found' },
    });
    return res.status(404).json({ error: 'User not found' });
  }

  recordAuditEvent(req, {
    domain: 'social',
    action: 'profile_patch',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId: authUserId,
    statusCode: 200,
    metadata: { fieldsUpdated: Object.keys(parsedPatch.updates) },
  });

  return res.json({
    success: true,
    profile: toPublicProfile(updated, authUserId),
  });
});

/**
 * POST /api/social/posts
 * Create a new social post.
 */
router.post('/posts', validateJsonBody(socialCreatePostSchema), async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_create',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const text = String(req.body?.text || '').trim();
  const visibility = normalizePostVisibility(req.body?.visibility);
  const media = normalizePostMedia(req.body?.media);

  if (!text && media.length === 0) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_create',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_text_and_media' },
    });
    return res.status(400).json({ error: 'Post requires text or media' });
  }

  try {
    const post = await socialStore.createPost({
      authorId: authUserId,
      text,
      visibility,
      media,
    });
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_create',
      outcome: 'success',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 200,
      metadata: {
        visibility,
        hasText: Boolean(text),
        mediaCount: media.length,
      },
    });
    return res.json({ success: true, post });
  } catch (error) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_create',
      outcome: 'error',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 500,
      metadata: { reason: 'store_error' },
    });
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
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_like_toggle',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const postId = String(req.params.postId || '').trim();
  if (!postId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_like_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_post_id' },
    });
    return res.status(400).json({ error: 'postId is required' });
  }

  try {
    const likeState = await socialStore.toggleLike(postId, authUserId);
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_like_toggle',
      outcome: 'success',
      actorUserId: authUserId,
      targetUserId: postId,
      statusCode: 200,
      metadata: {
        liked: likeState.liked,
        likeCount: likeState.likeCount,
      },
    });
    return res.json({
      success: true,
      postId,
      ...likeState,
    });
  } catch (error) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'post_like_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId: postId,
      statusCode: 404,
      metadata: { reason: 'post_not_found' },
    });
    return res.status(404).json({
      error: error instanceof Error ? error.message : 'Failed to update like state',
    });
  }
});

/**
 * POST /api/social/users/:targetUserId/follow
 * Follow or unfollow another user.
 */
router.post('/users/:targetUserId/follow', validateJsonBody(socialFollowRequestSchema), async (req: Request, res: Response): Promise<any> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      statusCode: 401,
      metadata: { reason: 'missing_authentication' },
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetUserId = String(req.params.targetUserId || '').trim();
  if (!targetUserId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      statusCode: 400,
      metadata: { reason: 'missing_target_user_id' },
    });
    return res.status(400).json({ error: 'targetUserId is required' });
  }
  if (targetUserId === authUserId) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId,
      statusCode: 400,
      metadata: { reason: 'cannot_follow_self' },
    });
    return res.status(400).json({ error: 'Users cannot follow themselves' });
  }

  const [viewerUser, targetUser] = await Promise.all([
    localStore.getUserById(authUserId),
    localStore.getUserById(targetUserId),
  ]);
  if (!viewerUser) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId,
      statusCode: 401,
      metadata: { reason: 'viewer_session_invalid' },
    });
    return res.status(401).json({ error: 'Viewer session is invalid' });
  }
  if (!targetUser) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId,
      statusCode: 404,
      metadata: { reason: 'target_user_not_found' },
    });
    return res.status(404).json({ error: 'Target user not found' });
  }

  const viewerPrivacy = normalizePrivacySettings(viewerUser.privacySettings);
  const targetPrivacy = normalizePrivacySettings(targetUser.privacySettings);
  const blockState = resolvePrivacyBlockState(
    authUserId,
    viewerPrivacy,
    targetUserId,
    targetPrivacy
  );
  if (blockState.blockedEitherWay) {
    recordAuditEvent(req, {
      domain: 'social',
      action: 'follow_toggle',
      outcome: 'deny',
      actorUserId: authUserId,
      targetUserId,
      statusCode: 403,
      metadata: { reason: 'blocked_relationship' },
    });
    return res.status(403).json({ error: 'Follow relationship not allowed' });
  }

  const requestedFollow = req.body?.follow;
  const follow =
    typeof requestedFollow === 'boolean'
      ? requestedFollow
      : !(await socialStore.isFollowing(authUserId, targetUserId));
  const result = await socialStore.setFollow(authUserId, targetUserId, follow);

  recordAuditEvent(req, {
    domain: 'social',
    action: 'follow_toggle',
    outcome: 'success',
    actorUserId: authUserId,
    targetUserId,
    statusCode: 200,
    metadata: { following: result.following },
  });

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
    const blockState = resolvePrivacyBlockState(
      authUserId,
      viewerPrivacy,
      post.authorId,
      authorPrivacy
    );
    if (blockState.blockedEitherWay) return false;

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
