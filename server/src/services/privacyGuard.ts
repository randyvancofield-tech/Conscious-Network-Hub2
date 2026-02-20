import type { UserPrivacySettings } from './profileNormalization';

export interface PrivacyBlockState {
  viewerBlocksTarget: boolean;
  targetBlocksViewer: boolean;
  blockedEitherWay: boolean;
}

export const resolvePrivacyBlockState = (
  viewerUserId: string,
  viewerPrivacy: UserPrivacySettings,
  targetUserId: string,
  targetPrivacy: UserPrivacySettings
): PrivacyBlockState => {
  const viewerBlocksTarget = viewerPrivacy.blockedUsers.includes(targetUserId);
  const targetBlocksViewer = targetPrivacy.blockedUsers.includes(viewerUserId);
  return {
    viewerBlocksTarget,
    targetBlocksViewer,
    blockedEitherWay: viewerBlocksTarget || targetBlocksViewer,
  };
};

export const canViewProfileByPrivacy = (options: {
  viewerUserId: string;
  targetUserId: string;
  targetPrivacy: UserPrivacySettings;
  isFollowing: boolean;
}): boolean => {
  if (options.viewerUserId === options.targetUserId) return true;
  if (options.targetPrivacy.profileVisibility === 'public') return true;
  return options.isFollowing;
};
