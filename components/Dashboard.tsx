
import React, { useState, useEffect, RefObject } from 'react';
import { Search, Bell, ShieldCheck, TrendingUp, Users, ExternalLink, PlayCircle, BookOpen, Layers, Globe, Plus, Target, Rocket, BarChart3, HeartHandshake } from 'lucide-react';
import { CORE_COMPONENTS } from '../constants';
import EthicalAIInsight from './EthicalAIInsight';
import { UserProfile, Course } from '../types';

interface DashboardProps {
  user?: UserProfile | null;
  onEnroll?: (course: Course) => void;
  insightRef?: RefObject<HTMLDivElement>;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onEnroll, insightRef }) => {
  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Welcome Hero - Ethical AI Insight */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2" id="latest-wisdom" ref={insightRef}>
          <EthicalAIInsight userEmail={user?.email} userId={user?.id || user?.email} />
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
