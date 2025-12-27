
import React, { useState, useEffect } from 'react';
import { Search, Bell, ShieldCheck, TrendingUp, Users, ExternalLink, PlayCircle, BookOpen, Layers, Globe, Plus, Target, Rocket, BarChart3, HeartHandshake } from 'lucide-react';
import { CORE_COMPONENTS } from '../constants';
import { getEthicalAIAdvice, GroundingChunk } from '../services/geminiService';
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
      const { text, groundingChunks } = await getEthicalAIAdvice("Briefly mention a recent positive development in decentralized ethics for the Conscious Network Hub.");
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
        <div className="lg:col-span-2 glass-panel p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl border-blue-500/10">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
             <ShieldCheck className="w-48 h-48 text-blue-400" />
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">Protocol Active, {user?.name || 'Sovereign'}</h1>
            <p className="text-blue-200/70 mb-8 text-xl max-w-2xl leading-relaxed font-light">
              Your decentralized identity node is secure. Accessing {user?.tier || 'Explore'} level knowledge layers.
            </p>
            
            <div className="bg-blue-900/30 border border-blue-500/20 p-6 rounded-[2rem] shadow-inner backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Ethical AI Insight</span>
              </div>
              <p className="text-slate-200 italic leading-relaxed text-lg">
                {loading ? "Decrypting mission data..." : aiMessage}
              </p>
              
              {!loading && sources.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em] font-bold mr-2"><Globe className="w-3.5 h-3.5" /> Grounded In:</span>
                  {sources.map((s, idx) => s.web && (
                    <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-xl transition-all border border-blue-500/20 hover:border-blue-400/50">
                      {s.web.title} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-10 rounded-[3rem] flex flex-col justify-between border-blue-500/10 shadow-2xl">
          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="text-teal-400 w-6 h-6" /> Network Integrity
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Active Nodes', value: '14,202' },
                { label: 'Sovereign Providers', value: '842' },
                { label: 'Reputation Score', value: `${user?.reputationScore || 100} PTS` }
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</span>
                  <span className="text-white font-mono text-lg font-bold">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="mt-8 w-full py-5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 text-sm uppercase tracking-widest">
            Manage Reputation
          </button>
        </div>
      </section>

      {/* Mission & Vision Strategic Protocol */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <Target className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Strategic Protocol</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-10 rounded-[3.5rem] border-l-8 border-blue-500 shadow-2xl">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-[0.3em] mb-4">Mission Statement</h3>
            <p className="text-xl font-light text-slate-200 leading-relaxed italic">
              "Higher Conscious Network exists to empower individuals, providers, and institutions with ethical technology that restores autonomy, protects identity, and creates equitable economic opportunity through a community-centered decentralized social learning infrastructure."
            </p>
          </div>
          <div className="glass-panel p-10 rounded-[3.5rem] border-l-8 border-teal-500 shadow-2xl">
            <h3 className="text-sm font-bold text-teal-400 uppercase tracking-[0.3em] mb-4">Vision Statement</h3>
            <p className="text-xl font-light text-slate-200 leading-relaxed italic">
              "We envision a global, community-centered ecosystem where data ownership, economic mobility, and values-aligned human development are accessible to all—especially those historically excluded from the digital and economic landscape."
            </p>
          </div>
        </div>

        {/* Conscious Careers & Impact */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <Rocket className="w-8 h-8 text-orange-400" />
              <h3 className="text-2xl font-bold text-white">Conscious Careers: Entrepreneurship Pathways</h3>
            </div>
            <p className="text-slate-400 leading-relaxed text-lg">
              Designed to help individuals and providers pursue business ownership. Through partnerships like Entrepreneurs Resource, members gain access to franchising and business matching. A dedicated 5% revenue savings fund provides grants to engaged participants, supported by SBDCs to promote long-term success.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blue-400" /> Minority Empowerment</h4>
                <p className="text-xs text-slate-500">Equipping mission-driven providers with secure, outcomes-based revenue models and IP protection.</p>
              </div>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-teal-400" /> Community Resilience</h4>
                <p className="text-xs text-slate-500">Scaling minority entrepreneurship to build sustainable digital businesses without algorithmic suppression.</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <BarChart3 className="w-8 h-8 text-purple-400" />
              <h3 className="text-2xl font-bold text-white">Impact KPIs</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Provider income growth",
                "Minority provider retention",
                "Well-being improvements",
                "Grant distribution totals",
                "Entrepreneurship placements"
              ].map((kpi, i) => (
                <li key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl text-sm font-bold text-slate-300 border border-white/5 group hover:bg-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-purple-500 group-hover:scale-150 transition-transform"></div>
                  {kpi}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Ecosystem Layers */}
      <section>
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <Layers className="text-blue-400 w-8 h-8" /> Ecosystem Components
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CORE_COMPONENTS.map((comp, idx) => (
            <div key={idx} className="glass-panel p-8 rounded-[2.5rem] border-t-4 border-blue-500/30 hover:bg-blue-900/10 transition-all cursor-pointer group shadow-2xl hover:-translate-y-2">
              <div className="bg-blue-500/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                {comp.icon}
              </div>
              <h4 className="text-xl font-bold mb-3 text-white">{comp.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{comp.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
