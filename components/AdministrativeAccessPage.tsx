import React, { useState } from 'react';
import { ChevronRight, Home, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

interface AdministrativeAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
}

const ADMIN_ACCESS_PATH_ID = 'admin-sign-in';
const ADMIN_ACCESS_INSIGHT =
  'Administrative Access opens the founder and operations workspace for platform oversight.';

const AdministrativeAccessPage: React.FC<AdministrativeAccessPageProps> = ({
  onGoHome,
  onSignIn,
}) => {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const isSignInFocused = hoveredPath === ADMIN_ACCESS_PATH_ID;

  return (
    <div className="relative z-10 min-h-[100dvh] animate-in fade-in duration-700 p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-10 xl:p-14">
      <svg
        className={`pointer-events-none absolute inset-0 z-0 hidden h-full w-full transition-opacity duration-500 lg:block ${
          hoveredPath ? 'opacity-100' : 'opacity-70'
        }`}
        viewBox="0 0 1200 760"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="adminAccessPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="adminAccessArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M2 2 L10 6 L2 10 Z" fill="#fde68a" />
          </marker>
        </defs>

        <path
          d="M600 40 C600 120 600 195 600 285"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeDasharray="10 18"
          markerEnd="url(#adminAccessArrow)"
          filter="url(#adminAccessPathGlow)"
        >
          <animate attributeName="stroke-dashoffset" from="70" to="0" dur="3s" repeatCount="indefinite" />
        </path>
        <path
          d="M600 285 C500 365 500 455 600 565 C700 455 700 365 600 285"
          fill="none"
          stroke="#67e8f9"
          strokeWidth="2"
          strokeDasharray="8 20"
          filter="url(#adminAccessPathGlow)"
        >
          <animate attributeName="stroke-dashoffset" from="90" to="0" dur="5s" repeatCount="indefinite" />
        </path>
        <g className={isSignInFocused ? 'opacity-100' : 'opacity-40'}>
          <path
            d="M1060 70 C920 92 800 132 700 184 C650 210 625 238 600 285"
            fill="none"
            stroke="#fde68a"
            strokeWidth="3"
            strokeDasharray="4 14"
            filter="url(#adminAccessPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="80" to="0" dur="4s" repeatCount="indefinite" />
          </path>
        </g>
        <circle r="6" fill="#fef3c7" filter="url(#adminAccessPathGlow)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M600 40 C600 120 600 195 600 285" />
        </circle>
        <circle r="4" fill="#67e8f9" filter="url(#adminAccessPathGlow)">
          <animateMotion dur="5s" begin="0.6s" repeatCount="indefinite" path="M600 285 C500 365 500 455 600 565 C700 455 700 365 600 285" />
        </circle>
      </svg>

      <button
        type="button"
        onClick={onSignIn}
        onMouseEnter={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
        onMouseLeave={() => setHoveredPath(null)}
        onFocus={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
        onBlur={() => setHoveredPath(null)}
        className={`fixed right-4 top-4 z-30 rounded-2xl border border-amber-200/30 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-amber-950/30 backdrop-blur-xl transition-all hover:bg-amber-500/20 sm:right-8 sm:top-8 sm:px-5 ${
          isSignInFocused ? 'animate-pulse ring-2 ring-amber-200/40 shadow-amber-400/30' : ''
        }`}
      >
        Admin Sign In
      </button>

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 pb-6 sm:space-y-10 sm:pb-10 md:space-y-12">
        <button onClick={onGoHome} className="flex items-center gap-2 text-slate-500 transition-colors hover:text-white sm:gap-3">
          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.4em] sm:text-[10px]">Portal Entry</span>
        </button>

        <div className="space-y-3 text-center sm:space-y-4">
          <p className="hidden text-[9px] font-black uppercase tracking-[0.6em] text-amber-200/70 lg:block">
            Founder Operations
          </p>
          <h2 className="text-2xl font-black tracking-tighter text-white xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
            Administrative Access
          </h2>
          <p className="mx-auto max-w-3xl px-2 text-sm font-light leading-7 text-slate-400 sm:px-0 sm:text-base md:text-lg">
            Secure founder and administrator entry for platform oversight, provider operations, and command-center controls.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 sm:gap-4">
            <div
              className="relative inline-flex"
              onMouseEnter={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
              onMouseLeave={() => setHoveredPath(null)}
              onFocus={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
              onBlur={() => setHoveredPath(null)}
            >
              <button
                type="button"
                onClick={onSignIn}
                className={`rounded-xl border border-amber-200/30 bg-slate-950/80 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-amber-500/20 sm:px-8 sm:text-xs ${
                  isSignInFocused ? 'animate-pulse ring-2 ring-amber-200/40 shadow-amber-400/30' : ''
                }`}
              >
                Administrator Sign In
              </button>
              <div
                className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 origin-top rounded-2xl border border-amber-200/20 bg-slate-950/55 p-4 text-left text-amber-50 shadow-2xl shadow-amber-950/30 backdrop-blur-xl transition-all duration-300 lg:block ${
                  isSignInFocused ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-100/80">Insight</p>
                <p className="mt-2 text-xs leading-5 text-amber-50">{ADMIN_ACCESS_INSIGHT}</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 sm:text-xs">
            Administrative access is separate from member and provider sign-in.
          </p>
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:gap-7 md:gap-8">
          <button
            type="button"
            onClick={onSignIn}
            onMouseEnter={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
            onMouseLeave={() => setHoveredPath(null)}
            onFocus={() => setHoveredPath(ADMIN_ACCESS_PATH_ID)}
            onBlur={() => setHoveredPath(null)}
            className="glass-panel group relative flex min-h-[25rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border-white/5 border-t-4 border-t-amber-400/30 p-5 text-left shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-amber-300/30 hover:ring-2 hover:ring-amber-200/30 sm:min-h-[27rem] sm:rounded-[2.5rem] sm:p-8 md:p-10"
          >
            <div className="absolute right-0 top-0 p-4 text-amber-300 opacity-5 transition-opacity group-hover:opacity-10 sm:p-8">
              <ShieldCheck className="h-16 w-16 sm:h-24 sm:w-24" />
            </div>
            <div>
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-xl font-black uppercase leading-tight tracking-tighter text-white sm:text-2xl">
                  Administrator Portal
                </h3>
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[9px] font-black tracking-widest text-amber-100 sm:px-4 sm:py-1.5 sm:text-[10px]">
                  Admin
                </span>
              </div>
              <p className="mb-6 text-[8px] font-black uppercase tracking-[0.3em] text-amber-200/60 sm:mb-8 sm:text-[9px]">
                Administrative Option
              </p>

              <div className="space-y-5 sm:space-y-6">
                <div>
                  <h4 className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Access Level</h4>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-white sm:text-xs">
                    <LockKeyhole className="h-4 w-4 shrink-0 text-amber-200" />
                    Founder and administrator sign-in only.
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Destination</h4>
                  <div className="flex items-start gap-3 text-[10px] font-light italic text-slate-400 sm:text-[11px]">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    <p>Administrative access lands in provider operations and platform oversight controls.</p>
                  </div>
                </div>
              </div>
            </div>
            <span className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-xl transition-all group-hover:border-amber-300/40 group-hover:bg-amber-500/20 sm:mt-10 sm:rounded-2xl sm:py-5 sm:text-xs">
              Continue To Admin Sign In <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeAccessPage;
