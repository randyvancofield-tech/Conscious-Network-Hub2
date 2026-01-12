
import React, { useState, useEffect } from 'react';
import { Search, Bell, ShieldCheck, TrendingUp, Users, ExternalLink, PlayCircle, BookOpen, Layers, Globe, Plus, Target, Rocket, BarChart3, HeartHandshake } from 'lucide-react';
import { CORE_COMPONENTS } from '../constants';
// Fixed: Changed getEthicalAIAdvice to getWisdomSearch as getEthicalAIAdvice is not exported from geminiService
import { getWisdomSearch, GroundingChunk } from '../services/geminiService';
import { UserProfile, Course } from '../types';

interface DashboardProps {
  user?: UserProfile | null;
  onEnroll?: (course: Course) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onEnroll }) => {
  const [aiMessage, setAiMessage] = useState<string>("Initializing secure connection to Ethical AI node...");
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialAi = async () => {
      // Fixed: Using getWisdomSearch which is the correct exported function for grounding/search
      const { text, groundingChunks } = await getWisdomSearch("Briefly mention a recent positive development in decentralized ethics for the Conscious Network Hub.");
      setAiMessage(text || "Welcome to the future of learning.");
      setSources(groundingChunks || []);
      setLoading(false);
    };
    fetchInitialAi();
  }, []);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Welcome Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group shadow-2xl border-blue-500/10">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
             <ShieldCheck className="w-48 h-48 text-blue-400" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tighter uppercase leading-none">PROTOCOL ACTIVE, <span className="text-blue-400">{user?.name || 'SOVEREIGN'}</span></h1>
            <p className="text-blue-200/60 mb-8 text-lg max-w-2xl leading-relaxed font-light">
              Your decentralized identity node is secure. Accessing {user?.tier || 'Explore'} level knowledge layers.
            </p>
            
            <div className="bg-blue-900/20 border border-blue-500/10 p-6 rounded-[1.5rem] shadow-inner backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400">Ethical AI Insight</span>
              </div>
              <p className="text-slate-200 italic leading-relaxed text-base font-light">
                {loading ? "Decrypting mission data..." : aiMessage}
              </p>
              
              {!loading && sources.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="text-[9px] text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em] font-black mr-2"><Globe className="w-3 h-3" /> Grounded In:</span>
                  {sources.map((s, idx) => s.web && (
                    <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-xl transition-all border border-blue-500/10 hover:border-blue-400/50 uppercase font-black tracking-widest">
                      {s.web.title} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col justify-between border-blue-500/10 shadow-2xl">
          <div>
            <h3 className="text-sm font-black mb-8 flex items-center gap-3 uppercase tracking-widest">
              <TrendingUp className="text-teal-400 w-5 h-5" /> Network Integrity
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Active Nodes', value: '14,202' },
                { label: 'Sovereign Providers', value: '842' },
                { label: 'Reputation Score', value: `${user?.reputationScore || 100} PTS` }
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                  <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">{stat.label}</span>
                  <span className="text-white font-mono text-base font-bold">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="mt-8 w-full py-4 bg-gradient-to-r from-blue-600/10 to-blue-600/20 hover:from-blue-600/30 hover:to-blue-600/40 border border-blue-500/30 text-blue-100 rounded-xl font-black transition-all shadow-xl text-[10px] uppercase tracking-[0.3em]">
            Manage Reputation
          </button>
        </div>
      </section>

      {/* Strategic Protocol */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <Target className="w-7 h-7 text-blue-400" />
          <h2 className="text-xl font-black text-white tracking-widest uppercase">STRATEGIC PROTOCOL</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-10 rounded-[2.5rem] border-l-4 border-blue-500 shadow-2xl">
            <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-6">MISSION STATEMENT</h3>
            <p className="text-lg font-light text-slate-300 leading-relaxed italic opacity-80">
              "Higher Conscious Network exists to empower individuals, providers, and institutions with ethical technology that restores autonomy, protects identity, and creates equitable economic opportunity through a community-centered decentralized social learning infrastructure."
            </p>
          </div>
          <div className="glass-panel p-10 rounded-[2.5rem] border-l-4 border-teal-500 shadow-2xl">
            <h3 className="text-[9px] font-black text-teal-400 uppercase tracking-[0.4em] mb-6">VISION STATEMENT</h3>
            <p className="text-lg font-light text-slate-300 leading-relaxed italic opacity-80">
              "We envision a global, community-centered ecosystem where data ownership, economic mobility, and values-aligned human development are accessible to all—especially those historically excluded from the digital and economic landscape."
            </p>
          </div>
        </div>

        {/* Conscious Careers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 glass-panel p-10 rounded-[2.5rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <Rocket className="w-7 h-7 text-orange-400" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Conscious Careers: Entrepreneurship</h3>
            </div>
            <p className="text-slate-400 leading-relaxed text-base font-light">
              Designed to help individuals and providers pursue business ownership. Through partnerships like Entrepreneurs Resource, members gain access to franchising and business matching. A dedicated 5% revenue savings fund provides grants to engaged participants, supported by SBDCs to promote long-term success.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <h4 className="font-black text-white text-xs uppercase tracking-widest mb-3 flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blue-400" /> Minority Empowerment</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Equipping mission-driven providers with secure, outcomes-based revenue models and IP protection.</p>
              </div>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <h4 className="font-black text-white text-xs uppercase tracking-widest mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-teal-400" /> Community Resilience</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Scaling minority entrepreneurship to build sustainable digital businesses without algorithmic suppression.</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[2.5rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <BarChart3 className="w-7 h-7 text-purple-400" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Impact KPIs</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Provider income growth",
                "Minority provider retention",
                "Well-being improvements",
                "Grant distribution totals",
                "Entrepreneurship placements"
              ].map((kpi, i) => (
                <li key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border border-white/5 group hover:bg-white/10 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 group-hover:scale-150 transition-transform"></div>
                  {kpi}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Ecosystem Layers */}
      <section>
        <h2 className="text-xl font-black mb-8 flex items-center gap-3 uppercase tracking-widest">
          <Layers className="text-blue-400 w-7 h-7" /> Ecosystem Components
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CORE_COMPONENTS.map((comp, idx) => (
            <div key={idx} className="glass-panel p-8 rounded-[2rem] border-t-2 border-blue-500/20 hover:bg-blue-900/10 transition-all cursor-pointer group shadow-2xl hover:-translate-y-2">
              <div className="bg-blue-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                {comp.icon}
              </div>
              <h4 className="text-sm font-black mb-3 text-white uppercase tracking-tight leading-tight">{comp.title}</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed font-light">{comp.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
