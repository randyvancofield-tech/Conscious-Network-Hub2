import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Star, ShieldCheck,
  UserPlus, Info,
  ChevronRight, Brain, ArrowLeft
} from 'lucide-react';
import { getAuthToken } from '../services/sessionService';
import { api } from '../services/apiClient';
import {
  getProfileAvatarMedia,
  getProfileHeroMedia,
  isVideoMediaAsset,
  normalizeMediaAsset,
  type NormalizedMediaAsset,
} from '../services/mediaAssets';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';
import VisualRenderBoundary from './ui/VisualRenderBoundary';

interface ProviderProfile {
  id: string;
  name: string;
  category: string;
  location: string;
  bio: string;
  specialty: string;
  rating: number | null;
  experience: string;
  image: string;
  services?: string[];
  verificationStatus?: 'review_pending' | 'verified';
  accessMode?: 'request' | 'invite_only';
  imageMedia: NormalizedMediaAsset;
  heroMedia: NormalizedMediaAsset;
}

interface ProvidersMarketProps {
  providerId?: string;
  onOpenProvider?: (id: string) => void;
  onBackToList?: () => void;
  onApplyAsProvider?: () => void;
  onSignInRequired?: () => void;
}

const normalizeProvider = (rawProvider: any): ProviderProfile => {
  const interests = Array.isArray(rawProvider?.interests) ? rawProvider.interests.filter(Boolean) : [];
  const category = interests[0] ? String(interests[0]) : 'Verified Provider';
  const fallbackImage = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=400';
  const avatarMedia = getProfileAvatarMedia(rawProvider);
  const heroMedia = getProfileHeroMedia(rawProvider);
  const imageMedia = avatarMedia.url ? avatarMedia : heroMedia.url ? heroMedia : normalizeMediaAsset({ url: fallbackImage });

  return {
    id: String(rawProvider?.id || ''),
    name: String(rawProvider?.name || rawProvider?.email || 'Verified Provider'),
    category,
    location: rawProvider?.location ? String(rawProvider.location) : 'Global',
    specialty: interests.length > 1 ? String(interests.slice(0, 2).join(' / ')) : category,
    bio: String(rawProvider?.bio || 'This provider has been verified through the CNH review process and has not published a full profile yet.'),
    rating: 0,
    experience: 'Verified',
    image: imageMedia.url || fallbackImage,
    imageMedia,
    heroMedia: heroMedia.url ? heroMedia : imageMedia,
    services: Array.isArray(rawProvider?.services) ? rawProvider.services.map(String) : [],
    verificationStatus: 'verified',
    accessMode: 'request',
  };
};

const renderProviderMedia = (
  media: NormalizedMediaAsset,
  alt: string,
  className: string,
  controls = false
) => {
  if (isVideoMediaAsset(media)) {
    return (
      <video
        src={media.url || ''}
        className={className}
        muted={!controls}
        loop
        autoPlay={!controls}
        controls={controls}
        playsInline
      />
    );
  }
  return <img src={media.url || ''} alt={alt} className={className} />;
};

const ProvidersMarketContent: React.FC<ProvidersMarketProps> = ({
  providerId,
  onOpenProvider,
  onBackToList,
  onApplyAsProvider,
  onSignInRequired,
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<ProviderProfile | null>(null);
  const [connectionNote, setConnectionNote] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  const providerRecords: ProviderProfile[] = providers;

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(providerRecords.map((provider) => provider.category))).sort()],
    [providerRecords]
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);

    const loadProviders = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await api<any>('/providers', { signal: controller.signal });
        if (isMounted) {
          setProviders(Array.isArray(data.providers) ? data.providers.map(normalizeProvider) : []);
        }
      } catch (error) {
        if (isMounted) {
          setProviders([]);
          setLoadError(
            error instanceof DOMException && error.name === 'AbortError'
              ? 'Provider directory is temporarily unavailable'
              : error instanceof Error
                ? error.message
                : 'Unable to load providers'
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProviders();
    return () => {
      isMounted = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProviders = providerRecords.filter((provider) => {
    const matchesCategory = filter === 'All' || provider.category === filter;
    const matchesSearch =
      normalizedQuery.length === 0 ||
      provider.name.toLowerCase().includes(normalizedQuery) ||
      provider.specialty.toLowerCase().includes(normalizedQuery) ||
      provider.bio.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesSearch;
  });

  const submitAnchorLinkRequest = async () => {
    if (!connectionTarget || !connectionNote.trim()) return;
    if (!getAuthToken()) {
      setConnectionStatus('Sign in or create a CNH profile before sending provider requests.');
      return;
    }

    try {
      await api(`/providers/${connectionTarget.id}/request`, {
        method: 'POST',
        body: { note: connectionNote.trim() },
      });
      setConnectionStatus('Request sent. Provider will review it in their secure queue.');
      setConnectionNote('');
      setTimeout(() => {
        setConnectionTarget(null);
        setConnectionStatus('');
      }, 1200);
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Unable to send provider request');
    }
  };

  const routeProvider = providerId
    ? providerRecords.find((provider) => provider.id === providerId) || null
    : null;

  if (providerId && isLoading) {
    return (
      <PageShell>
        <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border-white/10 text-center text-slate-300">
          Loading verified provider...
        </div>
      </PageShell>
    );
  }

  if (providerId && loadError) {
    return (
      <PageShell>
        <EmptyState
          title="Provider records unavailable"
          description={`${loadError}. Verified provider details will appear when the directory is available.`}
          action={
            <ActionButton type="button" onClick={onBackToList} icon={<ArrowLeft className="w-4 h-4" />}>
              Providers
            </ActionButton>
          }
        />
      </PageShell>
    );
  }

  if (providerId && !routeProvider) {
    return (
      <PageShell>
        <EmptyState
          title="Provider not found"
          description="No verified provider matches the requested link."
          action={
            <ActionButton type="button" onClick={onBackToList} icon={<ArrowLeft className="w-4 h-4" />}>
              Providers
            </ActionButton>
          }
        />
      </PageShell>
    );
  }

  if (routeProvider) {
    return (
      <PageShell>
        <ActionButton type="button" variant="ghost" onClick={onBackToList} icon={<ArrowLeft className="w-4 h-4" />}>
          Providers
        </ActionButton>
        <PageHeader
          eyebrow={routeProvider.category}
          title={routeProvider.name}
          description={routeProvider.bio}
          actions={
            <ActionButton
              type="button"
              onClick={() => {
                setConnectionTarget(routeProvider);
                setConnectionStatus('');
                setConnectionNote('');
              }}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Request Access
            </ActionButton>
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SurfacePanel className="overflow-hidden p-0">
            {renderProviderMedia(routeProvider.heroMedia, routeProvider.name, 'h-72 w-full object-cover', true)}
            <div className="space-y-5 p-6 sm:p-8">
              <h2 className="text-xl font-black uppercase text-white">Provider Profile</h2>
              <p className="text-sm leading-6 text-slate-400">{routeProvider.bio}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['Location', routeProvider.location],
                  ['Specialty', routeProvider.specialty],
                  ['Status', routeProvider.experience],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel className="space-y-5">
            <h2 className="text-lg font-black uppercase text-white">Access Structure</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verification</p>
              <p className="mt-1 text-sm font-bold text-white">
                {routeProvider.verificationStatus === 'verified' ? 'CNH verified' : 'CNH review pending'}
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Services</p>
              {(routeProvider.services?.length ? routeProvider.services : ['Provider service records connect here']).map((service) => (
                <div key={service} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                  {service}
                </div>
              ))}
            </div>
          </SurfacePanel>
        </div>

        {connectionTarget && (
          <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center overflow-y-auto custom-scrollbar">
            <div className="glass-panel w-full max-w-xl my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar rounded-[2rem] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in duration-300">
              <h4 className="text-2xl font-black text-white tracking-tight">Access Request</h4>
              <p className="text-sm text-slate-400">
                Send an introductory message to <span className="cnh-person-name text-white font-bold">{connectionTarget.name}</span>.
              </p>
              <textarea
                value={connectionNote}
                onChange={(e) => setConnectionNote(e.target.value)}
                className="w-full min-h-[130px] bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="Share your intent, goals, and preferred session focus..."
              />
              {connectionStatus && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] font-black uppercase tracking-widest">
                  <span className="cnh-profile-field">{connectionStatus}</span>
                </div>
              )}
              {!getAuthToken() && onSignInRequired && (
                <button
                  type="button"
                  onClick={onSignInRequired}
                  className="w-full rounded-xl border border-blue-300/20 bg-blue-600/15 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-blue-100 transition hover:bg-blue-600/25"
                >
                  Sign In Or Create Profile
                </button>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setConnectionTarget(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAnchorLinkRequest}
                  disabled={!connectionNote.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-32">
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-tight">Providers Market</h2>
            <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.4em]">Sovereign Talent Exchange</p>
          </div>
          <div className="relative group max-w-md w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Filter by name, skill, or node ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium placeholder:tracking-wider uppercase"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-4 overflow-x-auto pb-2 custom-scrollbar scrollable-x">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`cnh-status-badge px-4 py-2.5 sm:px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                filter === cat
                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {isLoading && (
        <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border-white/10 text-center text-slate-300">
          Loading verified providers...
        </div>
      )}

      {!isLoading && loadError && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-500/20 bg-amber-500/5">
          <h3 className="text-sm font-black text-white uppercase tracking-tight">Live providers unavailable</h3>
          <p className="text-sm text-slate-400 mt-2">
            {loadError}. Provider listings are hidden until verified provider records are reachable.
          </p>
        </div>
      )}

      {!isLoading && filteredProviders.length === 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border-white/10 text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">No verified providers available</h3>
          <p className="text-sm text-slate-400 mt-2">CNH-approved provider accounts will appear here once their user role is set to provider.</p>
        </div>
      )}

      {!isLoading && filteredProviders.length > 0 && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3 2xl:gap-8">
          {filteredProviders.map((provider) => (
            <div key={provider.id} className="glass-panel group flex min-w-0 flex-col overflow-hidden rounded-[2rem] border-white/5 shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-blue-500/30 2xl:rounded-[2.5rem]">
              <div className="relative h-44 overflow-hidden sm:h-48">
                {renderProviderMedia(
                  provider.imageMedia,
                  provider.name,
                  'w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s] ease-out'
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-[10px] font-black text-white">{provider.rating || 'New'}</span>
                  </div>
                </div>
                <div className="absolute bottom-4 left-6">
                  <span className="text-[9px] font-black text-white/80 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                    {provider.location}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 min-w-0 flex-col space-y-6 p-5 sm:p-7">
                <div className="space-y-1">
                  <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.3em]">{provider.category}</p>
                  <h3 className="cnh-card-title text-[clamp(1.25rem,1.9vw,1.75rem)] font-black uppercase leading-tight tracking-tight text-white">{provider.name}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-slate-500">
                    <Brain className="w-4 h-4 shrink-0 text-blue-500" />
                    <span className="cnh-action-label text-[10px] font-bold uppercase tracking-widest">{provider.specialty}</span>
                  </div>
                  <p className="cnh-user-content text-sm text-slate-400 leading-relaxed font-light line-clamp-3">
                    {provider.bio}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 mt-auto space-y-6">
                  <div className="flex flex-col gap-4 xs:flex-row xs:items-start xs:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Status</p>
                      <p className="break-words text-xs font-mono font-bold text-white">{provider.experience}</p>
                    </div>
                    <div className="min-w-0 space-y-1 xs:text-right">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Verification</p>
                      <div className="flex items-center gap-1 xs:justify-end">
                        <ShieldCheck className="w-3 h-3 shrink-0 text-teal-400" />
                        <span className="cnh-status-badge text-[8px] font-black text-teal-400 uppercase">CNH Validated</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                    <button
                      onClick={() => {
                        setConnectionTarget(provider);
                        setConnectionStatus('');
                        setConnectionNote('');
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" /> <span className="cnh-action-label">Anchor Link</span>
                    </button>
                    <button
                      onClick={() => {
                        if (onOpenProvider) {
                          onOpenProvider(provider.id);
                        } else {
                          setSelectedProvider(provider);
                        }
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      <Info className="w-3.5 h-3.5 shrink-0" /> <span className="cnh-action-label">Deep Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="glass-panel p-6 lg:p-8 rounded-2xl border-l-4 border-blue-600 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl mt-12">
        <div className="space-y-2">
          <h4 className="text-xl font-black text-white uppercase tracking-tighter">Apply To Become A CNH Provider</h4>
          <p className="text-slate-400 text-sm font-light max-w-xl">
            New applicants use the provider application. Returning applicants use Provider Access to check status, and approved providers sign in through Provider Access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onApplyAsProvider) {
              onApplyAsProvider();
              return;
            }
            window.location.assign('/provider-access');
          }}
          className="w-full justify-center px-6 py-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:shadow-blue-500/20 transition-all flex items-center gap-2 group sm:w-auto"
        >
          <span className="cnh-action-label">Apply To Become A Provider</span> <ChevronRight className="w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform" />
        </button>
      </footer>

      {selectedProvider && (
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center overflow-y-auto custom-scrollbar">
          <div className="glass-panel w-full max-w-3xl my-4 max-h-[calc(100dvh-2rem)] rounded-[2.5rem] border border-white/10 overflow-y-auto custom-scrollbar shadow-2xl animate-in zoom-in duration-300">
            <div className="relative h-64">
              {renderProviderMedia(selectedProvider.heroMedia, selectedProvider.name, 'w-full h-full object-cover', true)}
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/30 to-transparent" />
              <button
                onClick={() => setSelectedProvider(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{selectedProvider.category}</p>
                <h4 className="cnh-person-name text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 leading-tight">{selectedProvider.name}</h4>
              </div>
            </div>
            <div className="p-6 sm:p-8 space-y-6">
              <p className="cnh-user-content text-sm text-slate-300 leading-relaxed">{selectedProvider.bio}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Specialty</p>
                  <p className="cnh-profile-field text-white text-sm mt-1">{selectedProvider.specialty}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Status</p>
                  <p className="cnh-profile-field text-white text-sm mt-1">{selectedProvider.experience}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Verification</p>
                  <p className="text-white text-sm mt-1">CNH</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setConnectionTarget(selectedProvider);
                    setSelectedProvider(null);
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Request Anchor Link
                </button>
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {connectionTarget && (
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center overflow-y-auto custom-scrollbar">
          <div className="glass-panel w-full max-w-xl my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar rounded-[2rem] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in duration-300">
            <h4 className="text-2xl font-black text-white tracking-tight">Anchor Link Request</h4>
            <p className="text-sm text-slate-400">
              Send an introductory message to <span className="cnh-person-name text-white font-bold">{connectionTarget.name}</span>.
            </p>
            <textarea
              value={connectionNote}
              onChange={(e) => setConnectionNote(e.target.value)}
              className="w-full min-h-[130px] bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Share your intent, goals, and preferred session focus..."
            />
            {connectionStatus && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] font-black uppercase tracking-widest">
                <span className="cnh-profile-field">{connectionStatus}</span>
              </div>
            )}
            {!getAuthToken() && onSignInRequired && (
              <button
                type="button"
                onClick={onSignInRequired}
                className="w-full rounded-xl border border-blue-300/20 bg-blue-600/15 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-blue-100 transition hover:bg-blue-600/25"
              >
                Sign In Or Create Profile
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConnectionTarget(null)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAnchorLinkRequest}
                disabled={!connectionNote.trim()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProvidersMarket: React.FC<ProvidersMarketProps> = (props) => (
  <VisualRenderBoundary moduleName="ProvidersMarketProfileModals" fallbackTitle="Provider profile tools could not render.">
    <ProvidersMarketContent {...props} />
  </VisualRenderBoundary>
);

export default ProvidersMarket;
