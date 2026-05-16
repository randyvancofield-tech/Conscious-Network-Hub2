import React, { useEffect } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import {
  getProfileAvatarMedia,
  getProfileBackgroundMedia,
  getProfileHeroMedia,
  isVideoMediaAsset,
  normalizeMediaAsset,
  type NormalizedMediaAsset,
} from '../services/mediaAssets';

export interface SocialProfileView {
  profile: any;
  posts: any[];
}

interface SocialProfileViewerProps {
  title: string;
  isOpen: boolean;
  loading: boolean;
  error: string;
  profileView: SocialProfileView | null;
  onClose: () => void;
  presentation?: 'modal' | 'inline';
}

const PROFILE_SCROLL_LOCK_CLASS = 'profile-viewer-scroll-lock';

const toRelativeTimestamp = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  const deltaMs = Date.now() - parsed.getTime();
  const deltaMinutes = Math.floor(deltaMs / (60 * 1000));
  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
};

const toDateLabel = (value: string | null | undefined): string => {
  const parsed = new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString();
};

const toInitials = (value: string): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'N';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const avatarFallbackUrl = (name: string): string =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Node')}&background=0f172a&color=38bdf8`;

const renderAvatarMedia = (media: NormalizedMediaAsset, name: string, className: string) => {
  if (media.url) {
    if (isVideoMediaAsset(media)) {
      return (
        <video
          src={media.url}
          className={className}
          muted
          loop
          autoPlay
          playsInline
        />
      );
    }
    return (
      <img
        src={media.url}
        className={className}
        alt={name}
        onError={(event) => {
          event.currentTarget.src = avatarFallbackUrl(name);
        }}
      />
    );
  }

  return (
    <div className={`${className} bg-slate-900 text-blue-300 text-xs font-black flex items-center justify-center`}>
      {toInitials(name)}
    </div>
  );
};

const renderWideMedia = (media: NormalizedMediaAsset, alt: string, className: string) => {
  if (!media.url) return null;
  if (isVideoMediaAsset(media)) {
    return (
      <video
        src={media.url}
        className={className}
        controls
        playsInline
      />
    );
  }
  return <img src={media.url} alt={alt} className={className} />;
};

const SocialProfileViewer: React.FC<SocialProfileViewerProps> = ({
  title,
  isOpen,
  loading,
  error,
  profileView,
  onClose,
  presentation = 'modal',
}) => {
  useEffect(() => {
    if (!isOpen || presentation !== 'modal') return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add(PROFILE_SCROLL_LOCK_CLASS);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.classList.remove(PROFILE_SCROLL_LOCK_CLASS);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, presentation]);

  if (!isOpen) return null;

  const profileName = profileView?.profile?.name || 'Node';
  const heroMedia = profileView ? getProfileHeroMedia(profileView.profile) : normalizeMediaAsset(null);
  const avatarMedia = profileView ? getProfileAvatarMedia(profileView.profile) : normalizeMediaAsset(null);
  const backgroundMedia = profileView ? getProfileBackgroundMedia(profileView.profile) : normalizeMediaAsset(null);
  const shouldShowBackgroundMedia = Boolean(backgroundMedia.url && backgroundMedia.url !== heroMedia.url);
  const publicLinks = profileView
    ? [
        profileView.profile?.twitterUrl,
        profileView.profile?.githubUrl,
        profileView.profile?.websiteUrl,
      ].filter((value) => String(value || '').trim().length > 0)
    : [];
  const isInline = presentation === 'inline';

  return (
    <div
      className={
        isInline
          ? 'w-full'
          : 'fixed inset-0 z-[190] flex items-stretch justify-center overflow-hidden bg-[#05070a]/95 p-0 backdrop-blur-xl lg:p-6'
      }
      role={isInline ? 'region' : 'dialog'}
      aria-modal={isInline ? undefined : true}
      aria-label={title}
    >
      <div
        className={
          isInline
            ? 'glass-panel flex w-full flex-col overflow-visible rounded-[1.5rem] border-white/10 bg-black/35 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300'
            : 'glass-panel flex h-full w-full flex-col overflow-hidden border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300 lg:max-w-6xl lg:rounded-[1.5rem]'
        }
      >
        <header className="shrink-0 border-b border-white/10 bg-black/35 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Public Identity</p>
              <h4 className="mt-1 truncate text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h4>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close profile"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div
          className={
            isInline
              ? 'overflow-visible px-4 py-5 sm:px-6 lg:px-8 lg:py-8'
              : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar scrollable px-4 py-5 sm:px-6 lg:px-8 lg:py-8'
          }
        >
          {loading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 shadow-xl">
                <span className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  Loading profile...
                </span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
              {error}
            </div>
          )}

          {profileView && !loading && (
            <div className="mx-auto max-w-5xl space-y-6 pb-8">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <div className="relative h-52 bg-gradient-to-r from-blue-950/60 to-teal-950/25 sm:h-64 lg:h-72">
                  {heroMedia.url && renderWideMedia(heroMedia, profileName, 'h-full w-full object-cover')}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/15 to-transparent" />
                </div>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6 lg:p-8">
                  <div className="-mt-14 shrink-0 sm:-mt-16">
                    {renderAvatarMedia(
                      avatarMedia,
                      profileName,
                      'h-24 w-24 rounded-2xl border-4 border-[#05070a] object-cover shadow-2xl sm:h-28 sm:w-28'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="break-words text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {profileName}
                    </h5>
                    <p className="mt-1 break-all text-[11px] font-black uppercase tracking-widest text-blue-300">
                      @{profileView.profile?.handle || 'node'}
                    </p>
                  </div>
                </div>
              </section>

              {shouldShowBackgroundMedia && (
                <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  {renderWideMedia(backgroundMedia, `${profileName} background`, 'h-52 w-full object-cover bg-black sm:h-64')}
                </section>
              )}

              <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Location</p>
                  <p className="mt-1 break-words text-sm text-slate-200">{profileView.profile?.location || 'Not specified'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Joined</p>
                  <p className="mt-1 text-sm text-slate-200">{toDateLabel(profileView.profile?.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Posts</p>
                  <p className="mt-1 text-sm text-slate-200">{profileView.posts.length} public posts</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bio</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                    {profileView.profile?.bio || 'No biography provided yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Links</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {publicLinks.map((link) => (
                      <a
                        key={String(link)}
                        href={String(link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-600/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-600/20"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="break-all">{String(link)}</span>
                      </a>
                    ))}
                    {publicLinks.length === 0 && (
                      <p className="text-sm text-slate-400">No public links.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Social Posts ({profileView.posts.length})
                </h6>
                {profileView.posts.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                    No public posts available.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profileView.posts.map((post) => (
                      <article key={post.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {toRelativeTimestamp(String(post.createdAt || ''))}
                          </p>
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-widest text-slate-400">
                            {String(post.visibility || 'public')}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
                          {String(post.text || '').trim() || 'Media post'}
                        </p>
                        {Array.isArray(post.media) && post.media.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {post.media.map((entry: any) => {
                              const mediaAsset = normalizeMediaAsset(entry, entry?.url);
                              const mediaUrl = mediaAsset.url;
                              if (!mediaUrl) return null;
                              const mediaType = String(entry?.mediaType || '').toLowerCase();
                              if (mediaType === 'video' || isVideoMediaAsset(mediaAsset)) {
                                return (
                                  <video
                                    key={String(entry?.id || mediaUrl)}
                                    src={mediaUrl}
                                    className="w-full rounded-xl border border-white/10 bg-black"
                                    controls
                                    playsInline
                                  />
                                );
                              }
                              return (
                                <img
                                  key={String(entry?.id || mediaUrl)}
                                  src={mediaUrl}
                                  alt="Post media"
                                  className="w-full rounded-xl border border-white/10 object-cover"
                                />
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialProfileViewer;
