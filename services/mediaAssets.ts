import { backendAssetUrl } from './apiClient';

export interface MediaAssetLike {
  url?: unknown;
  storageProvider?: unknown;
  objectKey?: unknown;
  mimeType?: unknown;
  mediaType?: unknown;
}

export interface NormalizedMediaAsset {
  url: string | null;
  storageProvider: string | null;
  objectKey: string | null;
  mimeType: string | null;
  mediaType: string | null;
}

const trimString = (value: unknown): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
};

export const extractUploadObjectKey = (value: unknown): string | null => {
  const raw = trimString(value);
  if (!raw) return null;
  if (!raw.includes('/') && !raw.includes(':')) return raw;

  try {
    const parsed = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'http://localhost');
    const match = /^\/uploads\/object\/([^/?#]+)/i.exec(parsed.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

export const decodeUploadObjectKeyMimeType = (objectKey?: unknown): string | null => {
  const raw = trimString(objectKey);
  if (!raw) return null;

  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { mimeType?: unknown } | null;
    return trimString(parsed?.mimeType)?.toLowerCase() || null;
  } catch {
    return null;
  }
};

export const normalizeMediaAsset = (
  source?: MediaAssetLike | null,
  fallbackUrl?: unknown
): NormalizedMediaAsset => {
  const sourceUrl = trimString(source?.url);
  const fallback = trimString(fallbackUrl);
  const resolvedUrl = backendAssetUrl(sourceUrl || fallback || '') || null;
  const objectKey =
    trimString(source?.objectKey) ||
    extractUploadObjectKey(sourceUrl) ||
    extractUploadObjectKey(fallback) ||
    extractUploadObjectKey(resolvedUrl);

  return {
    url: resolvedUrl,
    storageProvider: trimString(source?.storageProvider),
    objectKey,
    mimeType: trimString(source?.mimeType)?.toLowerCase() || decodeUploadObjectKeyMimeType(objectKey),
    mediaType: trimString(source?.mediaType)?.toLowerCase() || null,
  };
};

export const isLikelyVideoUrl = (value: unknown): boolean =>
  /\.(mp4|webm|mov|m4v|ogg|avi)([?#].*)?$/i.test(String(value || '').trim());

export const isVideoMediaAsset = (asset?: MediaAssetLike | NormalizedMediaAsset | null): boolean => {
  const normalized = normalizeMediaAsset(asset);
  if (!normalized.url) return false;
  if (normalized.mimeType?.startsWith('video/')) return true;
  if (normalized.mediaType === 'video') return true;
  return isLikelyVideoUrl(normalized.url);
};

export const getProfileAvatarMedia = (profile: any): NormalizedMediaAsset =>
  normalizeMediaAsset(profile?.profileMedia?.avatar, profile?.avatarUrl);

export const getProfileCoverMedia = (profile: any): NormalizedMediaAsset =>
  normalizeMediaAsset(profile?.profileMedia?.cover, profile?.bannerUrl);

export const getProfileBackgroundMedia = (profile: any): NormalizedMediaAsset =>
  normalizeMediaAsset({ url: profile?.profileBackgroundVideo, mediaType: 'video' });

export const getProfileHeroMedia = (profile: any): NormalizedMediaAsset => {
  const cover = getProfileCoverMedia(profile);
  if (cover.url) return cover;
  return getProfileBackgroundMedia(profile);
};
