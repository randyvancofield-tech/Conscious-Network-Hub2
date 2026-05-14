import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, FileText, Home, KeyRound, Shield, WalletCards, X } from 'lucide-react';

type PathwayClickKey = 'signin' | 'apply' | 'applicant';

interface ProviderAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
  onApply: () => void;
  onApplicantSignIn: () => void;
}

const PROVIDER_RETURN_PATH_ID = 'provider-return';
const PROVIDER_MOBILE_STEPS = ['Start', 'Provider', 'Applicant', 'Candidate'];
const PROVIDER_RETURN_INSIGHT = 'Approved providers and admins resume the Provider Portal and Business Command Center.';

const providerPathways: Array<{
  name: string;
  label: string;
  description: string;
  access: string;
  ideal: string;
  actionLabel: string;
  insight: string;
  color: 'blue' | 'teal' | 'indigo';
  icon: typeof WalletCards;
  onClickKey: PathwayClickKey;
}> = [
  {
    name: 'Provider Portal',
    label: 'Approved',
    description: 'Approved Provider Sign In for verified CNH providers entering the provider command center.',
    access: 'Approved Provider Sign In to Provider Portal.',
    ideal: 'Verified providers ready to manage services, sessions, and provider operations.',
    actionLabel: 'Enter Provider Portal',
    insight: 'Approved provider signin opens the Provider Portal for verified CNH providers.',
    color: 'blue',
    icon: WalletCards,
    onClickKey: 'signin',
  },
  {
    name: 'Applicant Portal',
    label: 'Apply',
    description: 'Apply to Join as a Conscious Network Hub provider and submit your review materials.',
    access: 'Apply to Join opens the Applicant Portal.',
    ideal: 'New provider applicants beginning credential, service, and alignment review.',
    actionLabel: 'Apply to Join',
    insight: 'New applicants start in the Applicant Portal before provider approval is granted.',
    color: 'teal',
    icon: FileText,
    onClickKey: 'apply',
  },
  {
    name: 'Candidate Portal',
    label: 'Returning',
    description: 'Applicant Sign In for returning candidates who need application status and next steps.',
    access: 'Applicant Sign In opens the Candidate Portal.',
    ideal: 'Returning candidates checking review progress, materials, and interview status.',
    actionLabel: 'Enter Candidate Portal',
    insight: 'Returning applicants use the Candidate Portal while their provider review is in progress.',
    color: 'indigo',
    icon: KeyRound,
    onClickKey: 'applicant',
  },
];

const providerPathColorClasses = {
  blue: {
    cardBorder: 'hover:border-blue-500/30 border-t-blue-500/20',
    icon: 'text-blue-400',
    price: 'bg-blue-500/20 text-blue-300',
    check: 'text-blue-300',
    button: 'hover:bg-blue-600 hover:border-blue-500/50',
    glow: 'shadow-blue-500/20 ring-blue-300/30',
    insight: 'border-blue-300/20 bg-blue-950/45 text-blue-100',
  },
  teal: {
    cardBorder: 'hover:border-teal-500/30 border-t-teal-500/20',
    icon: 'text-teal-400',
    price: 'bg-teal-500/20 text-teal-300',
    check: 'text-teal-300',
    button: 'hover:bg-teal-600 hover:border-teal-500/50',
    glow: 'shadow-teal-500/20 ring-teal-300/30',
    insight: 'border-teal-300/20 bg-teal-950/45 text-teal-100',
  },
  indigo: {
    cardBorder: 'hover:border-indigo-500/30 border-t-indigo-500/20',
    icon: 'text-indigo-400',
    price: 'bg-indigo-500/20 text-indigo-300',
    check: 'text-indigo-300',
    button: 'hover:bg-indigo-600 hover:border-indigo-500/50',
    glow: 'shadow-indigo-500/20 ring-indigo-300/30',
    insight: 'border-indigo-300/20 bg-indigo-950/45 text-indigo-100',
  },
};

const ProviderAccessPage: React.FC<ProviderAccessPageProps> = ({
  onGoHome,
  onSignIn,
  onApply,
  onApplicantSignIn,
}) => {
  const [isProviderHelpVisible, setProviderHelpVisible] = useState(true);
  const [hoveredProviderPath, setHoveredProviderPath] = useState<string | null>(null);
  const [providerMobileStep, setProviderMobileStep] = useState(0);
  const providerPathRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handlers: Record<PathwayClickKey, () => void> = {
    signin: onSignIn,
    apply: onApply,
    applicant: onApplicantSignIn,
  };

  useEffect(() => {
    setProviderMobileStep(0);

    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSteps = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.providerStep || '0'))
          .filter((step) => step > 0);

        if (visibleSteps.length > 0) {
          setProviderMobileStep(Math.min(...visibleSteps));
        }
      },
      { rootMargin: '-8% 0px -48% 0px', threshold: [0.25, 0.5, 0.75] }
    );

    providerPathRefs.current.forEach((element, index) => {
      if (!element) return;
      element.dataset.providerStep = String(index + 1);
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-y-auto custom-scrollbar animate-in fade-in duration-700 relative z-10 scrollable p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-12 xl:p-20">
      <svg
        className={`pointer-events-none absolute inset-0 z-0 hidden h-full w-full transition-opacity duration-500 lg:block ${
          hoveredProviderPath ? 'opacity-100' : 'opacity-70'
        }`}
        viewBox="0 0 1200 760"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="providerAccessPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="providerAccessArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M2 2 L10 6 L2 10 Z" fill="#bfdbfe" />
          </marker>
        </defs>

        <path
          d="M600 40 C600 110 600 165 600 225"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeDasharray="10 18"
          markerEnd="url(#providerAccessArrow)"
          filter="url(#providerAccessPathGlow)"
        >
          <animate attributeName="stroke-dashoffset" from="70" to="0" dur="3s" repeatCount="indefinite" />
        </path>
        {[
          'M600 225 C430 290 300 380 215 565',
          'M600 225 C600 330 600 430 600 565',
          'M600 225 C770 290 900 380 985 565',
        ].map((path) => (
          <path
            key={path}
            d={path}
            fill="none"
            stroke="#5eead4"
            strokeWidth="2"
            strokeDasharray="8 20"
            filter="url(#providerAccessPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="90" to="0" dur="5s" repeatCount="indefinite" />
          </path>
        ))}
        <g className={hoveredProviderPath === PROVIDER_RETURN_PATH_ID ? 'opacity-100' : 'opacity-40'}>
          <path
            d="M1060 70 C920 92 800 132 700 184 C650 210 625 225 600 247"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="3"
            strokeDasharray="4 14"
            filter="url(#providerAccessPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="80" to="0" dur="4s" repeatCount="indefinite" />
          </path>
        </g>
        <circle r="6" fill="#dbeafe" filter="url(#providerAccessPathGlow)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M600 40 C600 110 600 165 600 225" />
        </circle>
        <circle r="4" fill="#99f6e4" filter="url(#providerAccessPathGlow)">
          <animateMotion dur="5s" begin="0.6s" repeatCount="indefinite" path="M600 225 C430 290 300 380 215 565" />
        </circle>
        <circle r="4" fill="#bfdbfe" filter="url(#providerAccessPathGlow)">
          <animateMotion dur="5s" begin="1s" repeatCount="indefinite" path="M600 225 C600 330 600 430 600 565" />
        </circle>
        <circle r="4" fill="#c7d2fe" filter="url(#providerAccessPathGlow)">
          <animateMotion dur="5s" begin="1.4s" repeatCount="indefinite" path="M600 225 C770 290 900 380 985 565" />
        </circle>
      </svg>

      <button
        type="button"
        onClick={onSignIn}
        onMouseEnter={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
        onMouseLeave={() => setHoveredProviderPath(null)}
        onFocus={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
        onBlur={() => setHoveredProviderPath(null)}
        className={`fixed right-4 top-4 z-30 rounded-2xl border border-cyan-200/30 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl transition-all hover:bg-cyan-500/20 sm:right-8 sm:top-8 sm:px-5 ${
          hoveredProviderPath === PROVIDER_RETURN_PATH_ID
            ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
            : ''
        }`}
      >
        Provider Login
      </button>

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 pb-6 sm:space-y-10 sm:pb-10 md:space-y-12">
        <button onClick={onGoHome} className="flex items-center gap-2 sm:gap-3 text-slate-500 hover:text-white transition-colors group">
          <Home className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="font-bold uppercase tracking-[0.4em] text-[9px] sm:text-[10px]">Portal Entry</span>
        </button>

        <div className="lg:hidden sticky top-16 z-20 mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl backdrop-blur-xl sm:top-20">
          <div className="relative space-y-3 pl-6">
            <div className="absolute bottom-2 left-1.5 top-2 w-px bg-white/10" />
            <div
              className="absolute left-1.5 top-2 w-px bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)] transition-all duration-500"
              style={{
                height: `${Math.min(
                  100,
                  Math.max(0, (providerMobileStep / (PROVIDER_MOBILE_STEPS.length - 1)) * 100)
                )}%`,
              }}
            />
            {PROVIDER_MOBILE_STEPS.map((step, index) => {
              const isActive = index <= providerMobileStep;
              return (
                <div key={step} className="relative flex items-center gap-3">
                  <span
                    className={`absolute -left-[1.4rem] h-3 w-3 rounded-full border transition-all ${
                      isActive
                        ? 'border-cyan-200 bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)]'
                        : 'border-white/20 bg-slate-900'
                    }`}
                  />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center space-y-3 sm:space-y-4">
          <p className="hidden text-[9px] font-black uppercase tracking-[0.6em] text-blue-300/70 lg:block">
            Start Here
          </p>
          <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter">Provider Access</h2>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg font-light px-2 sm:px-0">
            Sign in or choose a provider pathway to enter Conscious Network Hub Business Command Center.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-3">
            <div
              className="relative inline-flex"
              onMouseEnter={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
              onMouseLeave={() => setHoveredProviderPath(null)}
              onFocus={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
              onBlur={() => setHoveredProviderPath(null)}
            >
              <button
                onClick={onSignIn}
                className={`px-6 sm:px-8 py-3 bg-slate-950/80 hover:bg-cyan-500/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl border border-cyan-200/30 ${
                  hoveredProviderPath === PROVIDER_RETURN_PATH_ID
                    ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
                    : ''
                }`}
              >
                Approved Provider Sign In
              </button>
              <div
                className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 origin-top rounded-2xl border border-cyan-200/20 bg-slate-950/55 p-4 text-left text-cyan-50 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition-all duration-300 lg:block ${
                  hoveredProviderPath === PROVIDER_RETURN_PATH_ID
                    ? 'scale-100 opacity-100'
                    : 'scale-95 opacity-0'
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200/80">Insight</p>
                <p className="mt-2 text-xs leading-5 text-cyan-50">{PROVIDER_RETURN_INSIGHT}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              onMouseEnter={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
              onMouseLeave={() => setHoveredProviderPath(null)}
              onFocus={() => setHoveredProviderPath(PROVIDER_RETURN_PATH_ID)}
              onBlur={() => setHoveredProviderPath(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200/30 bg-amber-500/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-amber-100 shadow-xl shadow-amber-950/20 transition-all hover:bg-amber-500/20 sm:px-8 sm:text-xs"
            >
              <Shield className="h-4 w-4" />
              Admin Entry
            </button>
          </div>
          <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">
            New providers begin by selecting the Applicant Portal below.
          </p>
        </div>

        {isProviderHelpVisible && (
          <div className="glass-panel relative rounded-[1.5rem] border border-blue-500/20 bg-blue-500/5 p-5 sm:p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setProviderHelpVisible(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Dismiss provider guidance"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="max-w-3xl pr-10">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">
                Quick Start
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Existing approved providers can sign in to continue. New providers should apply to join through the Applicant Portal, and returning applicants should use the Candidate Portal.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7 md:gap-8">
          {providerPathways.map((pathway, pathwayIndex) => {
            const pathwayClasses = providerPathColorClasses[pathway.color];
            const Icon = pathway.icon;
            const isFocused = hoveredProviderPath === pathway.name;
            const shouldDim = Boolean(hoveredProviderPath && hoveredProviderPath !== pathway.name);

            return (
              <div
                key={pathway.name}
                ref={(element) => {
                  providerPathRefs.current[pathwayIndex] = element;
                }}
                onMouseEnter={() => setHoveredProviderPath(pathway.name)}
                onMouseLeave={() => setHoveredProviderPath(null)}
                onFocus={() => setHoveredProviderPath(pathway.name)}
                onBlur={() => setHoveredProviderPath(null)}
                className={`glass-panel group relative flex min-h-[25rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border-white/5 border-t-4 p-5 shadow-2xl transition-all duration-300 sm:min-h-[27rem] sm:rounded-[2.5rem] sm:p-8 md:p-10 ${
                  pathwayClasses.cardBorder
                } ${
                  isFocused ? `scale-[1.02] ring-2 ${pathwayClasses.glow}` : ''
                } ${
                  shouldDim ? 'scale-[0.98] opacity-45 blur-[1px]' : 'opacity-100'
                }`}
              >
                <div
                  className={`pointer-events-none absolute left-4 right-4 top-4 z-20 hidden origin-top rounded-2xl border p-4 text-left shadow-2xl backdrop-blur-xl transition-all duration-300 lg:block ${
                    pathwayClasses.insight
                  } ${isFocused ? 'scale-100 opacity-100' : 'scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100'}`}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.35em] opacity-80">Insight</p>
                  <p className="mt-2 text-xs leading-5">{pathway.insight}</p>
                </div>
                <div className={`absolute top-0 right-0 p-4 sm:p-8 opacity-5 group-hover:opacity-10 transition-opacity ${pathwayClasses.icon}`}>
                  <Shield className="w-16 h-16 sm:w-24 sm:h-24" />
                </div>
                <div>
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase tracking-tighter">{pathway.name}</h3>
                    <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black whitespace-nowrap tracking-widest ${pathwayClasses.price}`}>{pathway.label}</span>
                  </div>
                  <p className="text-blue-400/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] mb-6 sm:mb-8">Provider Option</p>

                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-light">{pathway.description}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Level</h4>
                      <div className="flex items-center gap-2 sm:gap-3 text-white text-[11px] sm:text-xs font-medium">
                        <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pathwayClasses.check}`} />
                        {pathway.access}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Ideal For</h4>
                      <div className="flex items-start gap-2 sm:gap-3 text-slate-400 text-[10px] sm:text-[11px] italic font-light">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${pathwayClasses.check}`} />
                        <p>{pathway.ideal}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlers[pathway.onClickKey]}
                  className={`mt-7 sm:mt-10 w-full py-4 sm:py-5 bg-white/5 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-all shadow-xl border border-white/5 ${pathwayClasses.button} ${
                    isFocused ? `animate-pulse bg-white/10 ring-2 ${pathwayClasses.glow}` : ''
                  }`}
                >
                  {pathway.actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProviderAccessPage;
