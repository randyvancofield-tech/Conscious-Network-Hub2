export type UserPrivacySettings = {
  profileVisibility: 'public' | 'private';
  showEmail: boolean;
  allowMessages: boolean;
  blockedUsers: string[];
};

export type UserMediaAsset = {
  url: string | null;
  storageProvider: string | null;
  objectKey: string | null;
};

export type UserProfileMedia = {
  avatar: UserMediaAsset;
  cover: UserMediaAsset;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const normalizeOptionalString = (value: unknown): string | null => {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeDateOfBirth = (value: unknown): Date | null | 'invalid' => {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'invalid';
  return parsed;
};

export const normalizeInterests = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
};

export const normalizePrivacySettings = (value: unknown): UserPrivacySettings => {
  const input = isObjectRecord(value) ? value : {};
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

const normalizeUserMediaAsset = (
  value: unknown,
  fallbackUrl: string | null
): UserMediaAsset => {
  const input = isObjectRecord(value) ? value : {};
  const rawUrl = String(input.url ?? '').trim();
  const rawStorageProvider = String(input.storageProvider ?? '').trim();
  const rawObjectKey = String(input.objectKey ?? '').trim();
  return {
    url: rawUrl || fallbackUrl || null,
    storageProvider: rawStorageProvider || null,
    objectKey: rawObjectKey || null,
  };
};

export const normalizeProfileMedia = (
  value: unknown,
  avatarFallback: string | null,
  coverFallback: string | null
): UserProfileMedia => {
  const input = isObjectRecord(value) ? value : {};
  return {
    avatar: normalizeUserMediaAsset(input.avatar, avatarFallback),
    cover: normalizeUserMediaAsset(input.cover, coverFallback),
  };
};
