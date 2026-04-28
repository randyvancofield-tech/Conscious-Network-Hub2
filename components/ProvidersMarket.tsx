import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Star, ShieldCheck,
  UserPlus, Info,
  ChevronRight, Brain
} from 'lucide-react';
import { getAuthToken } from '../services/sessionService';
import { api } from '../services/apiClient';

interface ProviderProfile {
  id: string;
  name: string;
  category: string;
  location: string;
  bio: string;
  specialty: string;
  rating: number;
  experience: string;
  image: string;
}

const normalizeProvider = (rawProvider: any): ProviderProfile => {
  const interests = Array.isArray(rawProvider?.interests) ? rawProvider.interests.filter(Boolean) : [];
  const category = interests[0] ? String(interests[0]) : 'Verified Provider';

  return {
    id: String(rawProvider?.id || ''),
    name: String(rawProvider?.name || rawProvider?.email || 'Verified Provider'),
    category,
    location: rawProvider?.location ? String(rawProvider.location) : 'Global',
    specialty: interests.length > 1 ? String(interests.slice(0, 2).join(' / ')) : category,
    bio: String(rawProvider?.bio || 'This provider has been verified through Base44 and has not published a full profile yet.'),
    rating: 0,
    experience: 'Verified',
    image: String(rawProvider?.avatarUrl || rawProvider?.bannerUrl || 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=400'),
  };
};

const ProvidersMarket: React.FC = () => {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<ProviderProfile | null>(null);
  const [connectionNote, setConnectionNote] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(providers.map((provider) => provider.category))).sort()],
    [providers]
  );

  useEffect(() => {
    let isMounted = true;

    const loadProviders = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await api<any>('/providers', { auth: false });
        if (isMounted) {
          setProviders(Array.isArray(data.providers) ? data.providers.map(normalizeProvider) : []);
        }
      } catch (error) {
        if (isMounted) {
          setProviders([]);
          setLoadError(error instanceof Error ? error.message : 'Unable to load providers');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProviders();
    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProviders = providers.filter((provider) => {
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
      setConnectionStatus('Sign in is required before sending provider requests.');
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

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-32">
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Providers Market</h2>
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

        <div className="flex flex-wrap gap-3 pt-4 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
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
        <div className="glass-panel p-10 rounded-[2rem] border-white/10 text-center text-slate-300">
          Loading verified providers...
        </div>
      )}

      {!isLoading && loadError && (
        <div className="glass-panel p-10 rounded-[2rem] border-red-500/20 bg-red-500/5 text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Providers unavailable</h3>
          <p className="text-sm text-slate-400 mt-2">{loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && filteredProviders.length === 0 && (
        <div className="glass-panel p-10 rounded-[2rem] border-white/10 text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">No verified providers available</h3>
          <p className="text-sm text-slate-400 mt-2">Base44-verified provider accounts will appear here once their user role is set to provider.</p>
        </div>
      )}

      {!isLoading && !loadError && filteredProviders.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredProviders.map((provider) => (
            <div key={provider.id} className="glass-panel group rounded-[2.5rem] overflow-hidden flex flex-col border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2 shadow-2xl">
              <div className="h-48 relative overflow-hidden">
                <img
                  src={provider.image}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s] ease-out"
                  alt={provider.name}
                />
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

              <div className="p-8 space-y-6 flex-1 flex flex-col">
                <div className="space-y-1">
                  <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.3em]">{provider.category}</p>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{provider.name}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Brain className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{provider.specialty}</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed font-light line-clamp-3">
                    {provider.bio}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 mt-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Status</p>
                      <p className="text-xs font-mono font-bold text-white">{provider.experience}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Verification</p>
                      <div className="flex items-center gap-1 justify-end">
                        <ShieldCheck className="w-3 h-3 text-teal-400" />
                        <span className="text-[8px] font-black text-teal-400 uppercase">Base44 Validated</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setConnectionTarget(provider);
                        setConnectionStatus('');
                        setConnectionNote('');
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Anchor Link
                    </button>
                    <button
                      onClick={() => setSelectedProvider(provider)}
                      className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      <Info className="w-3.5 h-3.5" /> Deep Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="glass-panel p-10 rounded-[3rem] border-l-8 border-blue-600 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl mt-20">
        <div className="space-y-2">
          <h4 className="text-xl font-black text-white uppercase tracking-tighter">Become a Sovereign Provider</h4>
          <p className="text-slate-400 text-sm font-light max-w-xl">
            Provider authority is issued through Base44 verification. Approved provider users appear in this market automatically.
          </p>
        </div>
        <a
          href="https://www.higherconscious.network/contact-us"
          target="_blank"
          rel="noopener noreferrer"
          className="px-10 py-5 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:shadow-blue-500/20 transition-all flex items-center gap-2 group whitespace-nowrap"
        >
          Apply as Node <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </footer>

      {selectedProvider && (
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-3xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="relative h-64">
              <img src={selectedProvider.image} alt={selectedProvider.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/30 to-transparent" />
              <button
                onClick={() => setSelectedProvider(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{selectedProvider.category}</p>
                <h4 className="text-3xl font-black text-white tracking-tight mt-1">{selectedProvider.name}</h4>
              </div>
            </div>
            <div className="p-6 sm:p-8 space-y-6">
              <p className="text-sm text-slate-300 leading-relaxed">{selectedProvider.bio}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Specialty</p>
                  <p className="text-white text-sm mt-1">{selectedProvider.specialty}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Status</p>
                  <p className="text-white text-sm mt-1">{selectedProvider.experience}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Verification</p>
                  <p className="text-white text-sm mt-1">Base44</p>
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
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-xl rounded-[2rem] border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in duration-300">
            <h4 className="text-2xl font-black text-white tracking-tight">Anchor Link Request</h4>
            <p className="text-sm text-slate-400">
              Send an introductory message to <span className="text-white font-bold">{connectionTarget.name}</span>.
            </p>
            <textarea
              value={connectionNote}
              onChange={(e) => setConnectionNote(e.target.value)}
              className="w-full min-h-[130px] bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Share your intent, goals, and preferred session focus..."
            />
            {connectionStatus && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] font-black uppercase tracking-widest">
                {connectionStatus}
              </div>
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

export default ProvidersMarket;
