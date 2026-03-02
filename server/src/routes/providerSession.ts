import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { ProviderAuthenticatedRequest, requireProviderSession } from '../providerMiddleware';
import { recordAuditEvent } from '../services/auditTelemetry';
import { revokeProviderSession } from '../services/providerSessionStore';
import { localStore, type LocalProviderInviteGroupRecord } from '../services/persistenceStore';

const router = Router();
router.use(requireProviderSession);

interface ProviderGroupMember {
  userId: string | null;
  username: string;
  displayName: string;
}

interface ProviderInviteGroup {
  id: string;
  name: string;
  members: ProviderGroupMember[];
  createdAt: string;
  updatedAt: string;
}

const MAX_GROUPS_PER_PROVIDER = 50;
const MAX_MEMBERS_PER_GROUP = 250;
const DIRECTORY_LOOKUP_LIMIT = 500;

const normalizeUsername = (value: unknown): string => {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
};

const normalizeGroupName = (value: unknown): string => {
  return String(value || '').trim().slice(0, 80);
};

const toRouteGroup = (record: LocalProviderInviteGroupRecord): ProviderInviteGroup => ({
  id: record.id,
  name: record.name,
  members: record.members.map((member) => ({
    userId: member.userId,
    username: member.username,
    displayName: member.displayName,
  })),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const readGroupsForProvider = async (providerDid: string): Promise<ProviderInviteGroup[]> => {
  const groups = await localStore.listProviderInviteGroupsByDid(
    providerDid,
    MAX_GROUPS_PER_PROVIDER
  );
  return groups.map(toRouteGroup);
};

const upsertProviderGroup = async (
  providerDid: string,
  group: ProviderInviteGroup
): Promise<ProviderInviteGroup> => {
  const saved = await localStore.upsertProviderInviteGroup({
    id: group.id,
    did: providerDid,
    name: group.name,
    members: group.members.map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
    })),
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt),
  });
  return toRouteGroup(saved);
};

const findDirectoryMember = async (username: string): Promise<ProviderGroupMember> => {
  const users = await localStore.listUsers(DIRECTORY_LOOKUP_LIMIT);
  const normalized = normalizeUsername(username);
  const match =
    users.find((user) => normalizeUsername(user.handle || '') === normalized) ||
    users.find((user) => normalizeUsername(user.name || '') === normalized);

  if (!match) {
    return {
      userId: null,
      username: normalized,
      displayName: normalized,
    };
  }

  return {
    userId: match.id,
    username: normalizeUsername(match.handle || match.name || normalized) || normalized,
    displayName: String(match.name || match.handle || normalized).trim() || normalized,
  };
};

/**
 * GET /api/provider/session/current
 * Returns current provider identity and session claims.
 */
router.get('/current', (req: Request, res: Response): void => {
  const providerReq = req as ProviderAuthenticatedRequest;
  res.json({
    success: true,
    did: providerReq.providerDid,
    sessionId: providerReq.providerSessionId,
    scopes: providerReq.providerScopes || [],
  });
});

/**
 * POST /api/provider/session/revoke
 * Revokes the currently authenticated provider session.
 */
router.post('/revoke', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const sessionId = providerReq.providerSessionId;
  if (!sessionId) {
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'deny',
      targetUserId: providerReq.providerDid || null,
      statusCode: 400,
      metadata: { reason: 'missing_provider_session_context' },
    });
    res.status(400).json({ error: 'Provider session not found on request context' });
    return;
  }

  try {
    await revokeProviderSession(sessionId);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'success',
      targetUserId: providerReq.providerDid || null,
      statusCode: 200,
      metadata: { sessionId },
    });
    res.json({ success: true, revokedSessionId: sessionId });
  } catch (error) {
    console.error('[ProviderAuth] failed to revoke provider session', error);
    recordAuditEvent(req, {
      domain: 'auth',
      action: 'provider_session_revoke',
      outcome: 'error',
      targetUserId: providerReq.providerDid || null,
      statusCode: 500,
      metadata: { reason: 'unexpected_error' },
    });
    res.status(500).json({ error: 'Failed to revoke provider session' });
  }
});

/**
 * GET /api/provider/session/groups
 * Returns provider-owned invite groups built from username-based members.
 */
router.get('/groups', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerDid) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  try {
    const groups = await readGroupsForProvider(providerDid);
    res.json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error('[ProviderGroups] failed to list groups', error);
    res.status(500).json({ error: 'Failed to load provider groups' });
  }
});

/**
 * POST /api/provider/session/groups
 * Body: { name: string }
 */
router.post('/groups', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerDid) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  const name = normalizeGroupName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  try {
    const groups = await readGroupsForProvider(providerDid);
    if (groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      res.status(409).json({ error: 'Group with this name already exists' });
      return;
    }

    const now = new Date().toISOString();
    const created: ProviderInviteGroup = {
      id: `grp_${crypto.randomUUID()}`,
      name,
      members: [],
      createdAt: now,
      updatedAt: now,
    };

    const persisted = await upsertProviderGroup(providerDid, created);
    recordAuditEvent(req, {
      domain: 'social',
      action: 'provider_group_create',
      outcome: 'success',
      actorUserId: providerDid,
      targetUserId: providerDid,
      statusCode: 201,
      metadata: { groupId: persisted.id, name: persisted.name },
    });

    res.status(201).json({ success: true, group: persisted });
  } catch (error) {
    console.error('[ProviderGroups] failed to create group', error);
    res.status(500).json({ error: 'Failed to create provider group' });
  }
});

/**
 * POST /api/provider/session/groups/:groupId/members
 * Body: { username: string }
 */
router.post('/groups/:groupId/members', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerDid) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  const groupId = String(req.params.groupId || '').trim();
  const username = normalizeUsername(req.body?.username);
  if (!groupId || !username) {
    res.status(400).json({ error: 'Group id and username are required' });
    return;
  }

  try {
    const groups = await readGroupsForProvider(providerDid);
    const targetIndex = groups.findIndex((group) => group.id === groupId);
    if (targetIndex < 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const targetGroup = groups[targetIndex];
    if (targetGroup.members.length >= MAX_MEMBERS_PER_GROUP) {
      res.status(409).json({ error: 'Group member limit reached' });
      return;
    }

    const alreadyExists = targetGroup.members.some((member) => member.username === username);
    if (alreadyExists) {
      res.status(409).json({ error: 'Username already in group' });
      return;
    }

    const resolvedMember = await findDirectoryMember(username);
    const updatedGroup: ProviderInviteGroup = {
      ...targetGroup,
      members: [...targetGroup.members, resolvedMember],
      updatedAt: new Date().toISOString(),
    };

    const persisted = await upsertProviderGroup(providerDid, updatedGroup);
    recordAuditEvent(req, {
      domain: 'social',
      action: 'provider_group_member_add',
      outcome: 'success',
      actorUserId: providerDid,
      targetUserId: resolvedMember.userId || providerDid,
      statusCode: 201,
      metadata: {
        groupId: persisted.id,
        username: resolvedMember.username,
        resolvedUserId: resolvedMember.userId,
      },
    });

    res.status(201).json({ success: true, group: persisted });
  } catch (error) {
    console.error('[ProviderGroups] failed to add group member', error);
    res.status(500).json({ error: 'Failed to add member to provider group' });
  }
});

/**
 * DELETE /api/provider/session/groups/:groupId/members/:username
 */
router.delete('/groups/:groupId/members/:username', async (req: Request, res: Response): Promise<void> => {
  const providerReq = req as ProviderAuthenticatedRequest;
  const providerDid = String(providerReq.providerDid || '').trim();
  if (!providerDid) {
    res.status(400).json({ error: 'Missing provider identity context' });
    return;
  }

  const groupId = String(req.params.groupId || '').trim();
  const username = normalizeUsername(req.params.username);
  if (!groupId || !username) {
    res.status(400).json({ error: 'Group id and username are required' });
    return;
  }

  try {
    const groups = await readGroupsForProvider(providerDid);
    const targetIndex = groups.findIndex((group) => group.id === groupId);
    if (targetIndex < 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const targetGroup = groups[targetIndex];
    const nextMembers = targetGroup.members.filter((member) => member.username !== username);
    if (nextMembers.length === targetGroup.members.length) {
      res.status(404).json({ error: 'Member not found in group' });
      return;
    }

    const updatedGroup: ProviderInviteGroup = {
      ...targetGroup,
      members: nextMembers,
      updatedAt: new Date().toISOString(),
    };

    const persisted = await upsertProviderGroup(providerDid, updatedGroup);
    recordAuditEvent(req, {
      domain: 'social',
      action: 'provider_group_member_remove',
      outcome: 'success',
      actorUserId: providerDid,
      targetUserId: providerDid,
      statusCode: 200,
      metadata: { groupId: persisted.id, username },
    });

    res.json({ success: true, group: persisted });
  } catch (error) {
    console.error('[ProviderGroups] failed to remove group member', error);
    res.status(500).json({ error: 'Failed to remove member from provider group' });
  }
});

export default router;
