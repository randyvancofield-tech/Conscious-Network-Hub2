import { localStore, type LocalUserRecord } from './persistenceStore';
import { revokeProviderSessionsByDid } from './providerSessionStore';

const PROVIDER_DID_PREFIX = 'provider:';
const USER_SESSION_DID_PREFIX = 'user:';
const APPROVED_STATUS = 'approved';

const normalizeStatus = (value: unknown): string | null => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
};

const normalizeRole = (value: unknown): string =>
  String(value || 'user').trim().toLowerCase();

export const getProviderDidForUserId = (userId: string): string =>
  `${PROVIDER_DID_PREFIX}${String(userId || '').trim()}`;

export const getUserSessionDidForUserId = (userId: string): string =>
  `${USER_SESSION_DID_PREFIX}${String(userId || '').trim()}`;

export const isProviderAccessActive = (user: LocalUserRecord | null | undefined): boolean => {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (role === 'admin') return true;
  if (role !== 'provider') return false;
  return (
    user.providerApproved === true &&
    normalizeStatus(user.providerApprovalStatus) === APPROVED_STATUS &&
    !user.providerRevokedAt
  );
};

export const getProviderAccessDenyReason = (
  user: LocalUserRecord | null | undefined
): string => {
  if (!user) return 'provider_user_not_found';
  const role = normalizeRole(user.role);
  if (role !== 'provider' && role !== 'admin') return 'provider_role_required';
  if (role === 'admin') return '';
  if (user.providerRevokedAt) return 'provider_access_revoked';
  if (user.providerApproved !== true) return 'provider_not_approved';
  if (normalizeStatus(user.providerApprovalStatus) !== APPROVED_STATUS) {
    return 'provider_approval_status_not_approved';
  }
  return '';
};

export const markProviderAccessApproved = async (
  userId: string
): Promise<LocalUserRecord | null> => {
  const now = new Date();
  return localStore.updateUser(userId, {
    providerApprovalStatus: APPROVED_STATUS,
    providerApproved: true,
    providerRevokedAt: null,
    providerAccessUpdatedAt: now,
  });
};

export const revokeProviderAccessForUser = async (
  user: LocalUserRecord,
  input?: {
    approvalStatus?: string | null;
  }
): Promise<{
  user: LocalUserRecord;
  providerSessionsRevoked: number;
  userSessionsRevoked: number;
}> => {
  const now = new Date();
  const approvalStatus = normalizeStatus(input?.approvalStatus) || 'revoked';
  const updated = await localStore.updateUser(user.id, {
    providerApprovalStatus: approvalStatus,
    providerApproved: false,
    providerRevokedAt: now,
    providerAccessUpdatedAt: now,
  });

  const providerSessionsRevoked = await revokeProviderSessionsByDid(getProviderDidForUserId(user.id));
  const userSessionsRevoked = await revokeProviderSessionsByDid(getUserSessionDidForUserId(user.id));

  return {
    user: updated || user,
    providerSessionsRevoked,
    userSessionsRevoked,
  };
};
