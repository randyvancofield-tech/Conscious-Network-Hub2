import {
  normalizeDateOfBirth,
  normalizeInterests,
  normalizeOptionalString,
  normalizePrivacySettings,
  normalizeProfileMedia,
} from './profileNormalization';

type UpdateUserInput = Parameters<(typeof import('./persistenceStore'))['localStore']['updateUser']>[1];

type ProfilePatchField =
  | 'name'
  | 'handle'
  | 'bio'
  | 'location'
  | 'dateOfBirth'
  | 'avatarUrl'
  | 'bannerUrl'
  | 'profileMedia'
  | 'interests'
  | 'twitterUrl'
  | 'githubUrl'
  | 'websiteUrl'
  | 'privacySettings'
  | 'profileBackgroundVideo';

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const USER_PROFILE_PATCH_FIELDS: readonly ProfilePatchField[] = [
  'name',
  'handle',
  'bio',
  'location',
  'dateOfBirth',
  'avatarUrl',
  'bannerUrl',
  'profileMedia',
  'interests',
  'twitterUrl',
  'githubUrl',
  'websiteUrl',
  'privacySettings',
  'profileBackgroundVideo',
];

export const SOCIAL_PROFILE_PATCH_FIELDS: readonly ProfilePatchField[] = [
  'name',
  'handle',
  'bio',
  'location',
  'dateOfBirth',
  'avatarUrl',
  'bannerUrl',
  'profileMedia',
  'interests',
  'privacySettings',
];

interface ParseProfilePatchOptions {
  allowedFields?: readonly ProfilePatchField[];
}

export const parseUserProfilePatch = (
  value: unknown,
  options?: ParseProfilePatchOptions
): { updates: UpdateUserInput; error: string | null } => {
  const body =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const allowed = new Set(options?.allowedFields || USER_PROFILE_PATCH_FIELDS);
  const updates: UpdateUserInput = {};

  if (allowed.has('name') && hasOwn(body, 'name')) {
    updates.name = normalizeOptionalString(body.name);
  }
  if (allowed.has('handle') && hasOwn(body, 'handle')) {
    updates.handle = normalizeOptionalString(body.handle);
  }
  if (allowed.has('bio') && hasOwn(body, 'bio')) {
    updates.bio = normalizeOptionalString(body.bio);
  }
  if (allowed.has('location') && hasOwn(body, 'location')) {
    updates.location = normalizeOptionalString(body.location);
  }
  if (allowed.has('dateOfBirth') && hasOwn(body, 'dateOfBirth')) {
    const parsedDateOfBirth = normalizeDateOfBirth(body.dateOfBirth);
    if (parsedDateOfBirth === 'invalid') {
      return {
        updates: {},
        error: 'dateOfBirth must be a valid date string',
      };
    }
    updates.dateOfBirth = parsedDateOfBirth;
  }

  const nextAvatarUrl =
    allowed.has('avatarUrl') && hasOwn(body, 'avatarUrl')
      ? normalizeOptionalString(body.avatarUrl)
      : undefined;
  if (nextAvatarUrl !== undefined) {
    updates.avatarUrl = nextAvatarUrl;
  }

  const nextBannerUrl =
    allowed.has('bannerUrl') && hasOwn(body, 'bannerUrl')
      ? normalizeOptionalString(body.bannerUrl)
      : undefined;
  if (nextBannerUrl !== undefined) {
    updates.bannerUrl = nextBannerUrl;
  }

  if (allowed.has('profileMedia') && hasOwn(body, 'profileMedia')) {
    updates.profileMedia = normalizeProfileMedia(
      body.profileMedia,
      nextAvatarUrl === undefined ? null : nextAvatarUrl,
      nextBannerUrl === undefined ? null : nextBannerUrl
    );
  }

  if (allowed.has('interests') && hasOwn(body, 'interests')) {
    updates.interests = normalizeInterests(body.interests);
  }
  if (allowed.has('twitterUrl') && hasOwn(body, 'twitterUrl')) {
    updates.twitterUrl = normalizeOptionalString(body.twitterUrl);
  }
  if (allowed.has('githubUrl') && hasOwn(body, 'githubUrl')) {
    updates.githubUrl = normalizeOptionalString(body.githubUrl);
  }
  if (allowed.has('websiteUrl') && hasOwn(body, 'websiteUrl')) {
    updates.websiteUrl = normalizeOptionalString(body.websiteUrl);
  }
  if (allowed.has('privacySettings') && hasOwn(body, 'privacySettings')) {
    updates.privacySettings = normalizePrivacySettings(body.privacySettings);
  }
  if (allowed.has('profileBackgroundVideo') && hasOwn(body, 'profileBackgroundVideo')) {
    updates.profileBackgroundVideo = normalizeOptionalString(body.profileBackgroundVideo);
  }

  return { updates, error: null };
};
