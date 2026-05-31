import React, { useState } from 'react';
import { BadgeDollarSign, ChevronRight, Home, Rocket, Shield } from 'lucide-react';
import careersLogo from '../src/assets/brand/conscious-careers-logo.png';

interface ConsciousCareersPageProps {
  onGoHome: () => void;
  onGrantApplication: () => void;
  onEntrepreneurshipSupport: () => void;
  embedded?: boolean;
}

const CAREERS_RETURN_PATH_ID = 'careers-grants';
const CAREERS_RETURN_INSIGHT =
  'Grant Application opens the Conscious Careers pathway for value-driven entrepreneurs seeking up to $12,000 in support.';

const ConsciousCareersPage: React.FC<ConsciousCareersPageProps> = ({
  onGoHome,
  onGrantApplication,
  onEntrepreneurshipSupport,
  embedded = false,
}) => {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div
      className={
        embedded
          ? 'relative z-10 w-full animate-in fade-in duration-700 text-slate-100'
          : 'relative z-10 min-h-[100dvh] animate-in fade-in duration-700 p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-12 xl:p-20'
      }
    >
      <svg
        className={`pointer-events-none absolute inset-0 z-0 hidden h-full w-full transition-opacity duration-500 lg:block ${
          hoveredPath ? 'opacity-100' : 'opacity-70'
        }`}
        viewBox="0 0 1200 760"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="careersPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="careersArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M2 2 L10 6 L2 10 Z" fill="#bfdbfe" />
          </marker>
        </defs>

        <path
          d="M600 40 C600 110 600 165 600 225"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeDasharray="10 18"
          markerEnd="url(#careersArrow)"
          filter="url(#careersPathGlow)"
        >
          <animate attributeName="stroke-dashoffset" from="70" to="0" dur="3s" repeatCount="indefinite" />
        </path>
        {[
          'M600 225 C430 290 300 380 215 565',
          'M600 225 C770 290 900 380 985 565',
        ].map((path) => (
          <path
            key={path}
            d={path}
            fill="none"
            stroke="#5eead4"
            strokeWidth="2"
            strokeDasharray="8 20"
            filter="url(#careersPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="90" to="0" dur="5s" repeatCount="indefinite" />
          </path>
        ))}
        <g className={hoveredPath === CAREERS_RETURN_PATH_ID ? 'opacity-100' : 'opacity-40'}>
          <path
            d="M1060 70 C920 92 800 132 700 184 C650 210 625 225 600 247"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="3"
            strokeDasharray="4 14"
            filter="url(#careersPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="80" to="0" dur="4s" repeatCount="indefinite" />
          </path>
        </g>
        <circle r="6" fill="#dbeafe" filter="url(#careersPathGlow)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M600 40 C600 110 600 165 600 225" />
        </circle>
        <circle r="4" fill="#99f6e4" filter="url(#careersPathGlow)">
          <animateMotion dur="5s" begin="0.6s" repeatCount="indefinite" path="M600 225 C430 290 300 380 215 565" />
        </circle>
        <circle r="4" fill="#c7d2fe" filter="url(#careersPathGlow)">
          <animateMotion dur="5s" begin="1s" repeatCount="indefinite" path="M600 225 C770 290 900 380 985 565" />
        </circle>
      </svg>

      {!embedded && (
        <button
          type="button"
          onClick={onGrantApplication}
          onMouseEnter={() => setHoveredPath(CAREERS_RETURN_PATH_ID)}
          onMouseLeave={() => setHoveredPath(null)}
          onFocus={() => setHoveredPath(CAREERS_RETURN_PATH_ID)}
          onBlur={() => setHoveredPath(null)}
          className={`fixed right-4 top-4 z-30 rounded-2xl border border-cyan-200/30 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl transition-all hover:bg-cyan-500/20 sm:right-8 sm:top-8 sm:px-5 ${
            hoveredPath === CAREERS_RETURN_PATH_ID
              ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
              : ''
          }`}
        >
          Grant Application
        </button>
      )}

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 pb-6 sm:space-y-10 sm:pb-10 md:space-y-12">
        <button onClick={onGoHome} className="flex items-center gap-2 sm:gap-3 text-slate-500 hover:text-white transition-colors group">
          <Home className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="font-bold uppercase tracking-[0.4em] text-[9px] sm:text-[10px]">Portal Entry</span>
        </button>

        <div className="text-center space-y-3 sm:space-y-4">
          <div className="mx-auto flex w-fit items-center justify-center rounded-3xl border border-emerald-100/20 bg-white/95 p-2 shadow-2xl shadow-blue-950/30">
            <img
              src={careersLogo}
              alt="Conscious Careers"
              className="h-20 w-20 rounded-2xl object-contain sm:h-24 sm:w-24 md:h-28 md:w-28"
            />
          </div>
          <p className="hidden text-[9px] font-black uppercase tracking-[0.6em] text-blue-300/70 lg:block">
            Start Here
          </p>
          <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl font-black text-white tracking-tighter leading-tight">Conscious Careers</h2>
          <p className="mx-auto max-w-3xl px-2 text-sm font-light leading-7 text-slate-400 sm:px-0 sm:text-base md:text-lg">
            Higher Conscious Network dba Conscious Careers supports faith-driven entrepreneurs building economic, mental, spiritual, and educational development.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-3">
            <div
              className="relative inline-flex"
              onMouseEnter={() => setHoveredPath(CAREERS_RETURN_PATH_ID)}
              onMouseLeave={() => setHoveredPath(null)}
              onFocus={() => setHoveredPath(CAREERS_RETURN_PATH_ID)}
              onBlur={() => setHoveredPath(null)}
            >
              <button
                onClick={onGrantApplication}
                className={`px-6 sm:px-8 py-3 bg-slate-950/80 hover:bg-cyan-500/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl border border-cyan-200/30 ${
                  hoveredPath === CAREERS_RETURN_PATH_ID
                    ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
                    : ''
                }`}
              >
                Open Grant Application
              </button>
              <div
                className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 origin-top rounded-2xl border border-cyan-200/20 bg-slate-950/55 p-4 text-left text-cyan-50 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition-all duration-300 lg:block ${
                  hoveredPath === CAREERS_RETURN_PATH_ID ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200/80">Insight</p>
                <p className="mt-2 text-xs leading-5 text-cyan-50">{CAREERS_RETURN_INSIGHT}</p>
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">
            Grant applicants must be current Conscious Network Hub users.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:gap-7 md:gap-8 lg:grid-cols-2">
          <button
            type="button"
            onClick={onGrantApplication}
            onMouseEnter={() => setHoveredPath('Grant Application')}
            onMouseLeave={() => setHoveredPath(null)}
            onFocus={() => setHoveredPath('Grant Application')}
            onBlur={() => setHoveredPath(null)}
            className="glass-panel group relative flex min-h-[22rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border-white/5 border-t-4 border-t-blue-500/20 p-5 text-left shadow-2xl transition-all duration-300 hover:border-blue-500/30 hover:scale-[1.02] hover:ring-2 hover:ring-blue-300/30 sm:min-h-[24rem] sm:rounded-[2.5rem] sm:p-8 lg:p-9 xl:p-10"
          >
            <div className="absolute top-0 right-0 p-4 text-blue-400 opacity-5 transition-opacity group-hover:opacity-10 sm:p-8">
              <Shield className="w-16 h-16 sm:w-24 sm:h-24" />
            </div>
            <div>
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-xl xl:text-2xl font-black text-white leading-tight uppercase tracking-tighter">Grant Application</h3>
                <span className="cnh-status-badge shrink-0 rounded-full bg-blue-500/20 px-3 py-1 text-[9px] font-black tracking-widest text-blue-300 sm:px-4 sm:py-1.5 sm:text-[10px]">
                  Up to $12K
                </span>
              </div>
              <p className="mb-6 text-blue-400/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] sm:mb-8">Conscious Careers Option</p>
              <div className="space-y-5">
                <BadgeDollarSign className="h-8 w-8 text-blue-300" />
                <p className="text-sm leading-7 text-slate-300">
                  Apply for entrepreneurial grant support rooted in stewardship, service, learning, and measurable community uplift.
                </p>
              </div>
            </div>
            <span className="cnh-action-label mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-xl transition-all group-hover:bg-blue-600 group-hover:border-blue-500/50 sm:mt-10 sm:rounded-2xl sm:py-5 sm:text-xs">
              Start Application <ChevronRight className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={onEntrepreneurshipSupport}
            onMouseEnter={() => setHoveredPath('Entrepreneurship Support')}
            onMouseLeave={() => setHoveredPath(null)}
            onFocus={() => setHoveredPath('Entrepreneurship Support')}
            onBlur={() => setHoveredPath(null)}
            className="glass-panel group relative flex min-h-[22rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border-white/5 border-t-4 border-t-teal-500/20 p-5 text-left opacity-90 shadow-2xl transition-all duration-300 hover:border-teal-500/30 hover:scale-[1.02] hover:ring-2 hover:ring-teal-300/30 sm:min-h-[24rem] sm:rounded-[2.5rem] sm:p-8 lg:p-9 xl:p-10"
          >
            <div className="absolute top-0 right-0 p-4 text-teal-400 opacity-5 sm:p-8">
              <Shield className="w-16 h-16 sm:w-24 sm:h-24" />
            </div>
            <div>
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-xl xl:text-2xl font-black text-white leading-tight uppercase tracking-tighter">Entrepreneurship Support</h3>
                <span className="cnh-status-badge shrink-0 rounded-full bg-teal-500/20 px-3 py-1 text-[9px] font-black tracking-widest text-teal-300 sm:px-4 sm:py-1.5 sm:text-[10px]">
                  Portal
                </span>
              </div>
              <p className="mb-6 text-blue-400/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] sm:mb-8">Conscious Careers Option</p>
              <div className="space-y-5">
                <Rocket className="h-8 w-8 text-teal-300" />
                <p className="text-sm leading-7 text-slate-300">
                  A guided pathway for readiness, alignment, regional entrepreneurship resources, and future external-resource opportunities.
                </p>
              </div>
            </div>
            <span className="cnh-action-label mt-7 flex w-full items-center justify-center rounded-xl border border-white/5 bg-white/5 py-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 shadow-xl transition-all group-hover:border-teal-500/40 group-hover:bg-teal-600/20 group-hover:text-white sm:mt-10 sm:rounded-2xl sm:py-5 sm:text-xs">
              Open Pathway Portal
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsciousCareersPage;
