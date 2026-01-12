
import React, { useState } from 'react';
import { 
  Search, Filter, Star, Globe, ShieldCheck, 
  MessageSquare, UserPlus, Info, ExternalLink,
  ChevronRight, Brain, Sparkles, Heart, Anchor
} from 'lucide-react';

interface ProviderProfile {
  id: string;
  name: string;
  category: 'Mental Wellness' | 'Religion' | 'Spiritual Leader' | 'Coach' | 'Cultural Enthusiast';
  nationality: string;
  flag: string;
  bio: string;
  specialty: string;
  rating: number;
  experience: string;
  image: string;
}

const PROVIDERS_DATA: ProviderProfile[] = [
  {
    id: 'p1',
    name: 'Dr. Amara Okafor',
    category: 'Mental Wellness',
    nationality: 'Nigerian',
    flag: '🇳🇬',
    specialty: 'Ancestral Trauma & Neural Resilience',
    bio: 'Specializing in the intersection of traditional West African healing practices and modern clinical psychology. Dr. Okafor helps nodes re-anchor after systemic displacement.',
    rating: 4.9,
    experience: '12 Cycles',
    image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'p2',
    name: 'Imam Kenji Tanaka',
    category: 'Religion',
    nationality: 'Japanese',
    flag: '🇯🇵',
    specialty: 'Zen-Islamic Synthesis & Digital Ethics',
    bio: 'A scholar of the "Silent Path," Imam Tanaka explores the philosophical alignment between Zen mindfulness and Islamic prayer in the age of decentralization.',
    rating: 4.8,
    experience: '20 Cycles',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'p3',
    name: 'Elena Rossi',
    category: 'Spiritual Leader',
    nationality: 'Italian',
    flag: '🇮🇹',
    specialty: 'Neo-Renaissance Mysticism',
    bio: 'Elena guides individuals through the "Internal Rebirth" protocol, utilizing high-frequency meditation and sacred geometric visualizations to align the sovereign self.',
    rating: 5.0,
    experience: '15 Cycles',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'p4',
    name: 'Sven Bergstrom',
    category: 'Coach',
    nationality: 'Swedish',
    flag: '🇸🇪',
    specialty: 'Bio-Hacking & Sovereign Performance',
    bio: 'Former Olympic consultant turned decentralized coach. Sven focuses on optimizing human hardware to withstand the cognitive demands of the Conscious Network.',
    rating: 4.7,
    experience: '8 Cycles',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'p5',
    name: 'Ximena Castillo',
    category: 'Cultural Enthusiast',
    nationality: 'Mexican',
    flag: '🇲🇽',
    specialty: 'Indigenous Wisdom & Digital Curation',
    bio: 'Curator of the "Voz del Sol" knowledge layer. Ximena works to preserve and translate Mayan mathematical philosophy into decentralized governing protocols.',
    rating: 4.9,
    experience: '10 Cycles',
    image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=400'
  }
];

const ProvidersMarket: React.FC = () => {
  const [filter, setFilter] = useState<string>('All');
  const categories = ['All', 'Mental Wellness', 'Religion', 'Spiritual Leader', 'Coach', 'Cultural Enthusiast'];

  const filteredProviders = filter === 'All' 
    ? PROVIDERS_DATA 
    : PROVIDERS_DATA.filter(p => p.category === filter);

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
                  <span className="text-[10px] font-black text-white">{provider.rating}</span>
                </div>
              </div>
              <div className="absolute bottom-4 left-6 flex items-center gap-2">
                <span className="text-2xl">{provider.flag}</span>
                <span className="text-[9px] font-black text-white/80 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                  {provider.nationality}
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
                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Active Cycles</p>
                    <p className="text-xs font-mono font-bold text-white">{provider.experience}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Verification</p>
                    <div className="flex items-center gap-1 justify-end">
                      <ShieldCheck className="w-3 h-3 text-teal-400" />
                      <span className="text-[8px] font-black text-teal-400 uppercase">NODE VALIDATED</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
                    <UserPlus className="w-3.5 h-3.5" /> Anchor Link
                  </button>
                  <button className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95">
                    <Info className="w-3.5 h-3.5" /> Deep Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Institutional Support Note */}
      <footer className="glass-panel p-10 rounded-[3rem] border-l-8 border-blue-600 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl mt-20">
        <div className="space-y-2">
          <h4 className="text-xl font-black text-white uppercase tracking-tighter">Become a Sovereign Provider</h4>
          <p className="text-slate-400 text-sm font-light max-w-xl">
            Are you a mission-driven specialist? Our provider-centric model ensures you retain 100% of your intellectual property and direct revenue while scaling through the Conscious Network layers.
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
    </div>
  );
};

export default ProvidersMarket;
