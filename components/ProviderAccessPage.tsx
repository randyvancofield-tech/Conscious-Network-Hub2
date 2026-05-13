import React from 'react';
import { ChevronRight, FileText, Home, KeyRound, WalletCards } from 'lucide-react';
import logo from '../src/assets/brand/logo.png';

interface ProviderAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
  onApply: () => void;
  onApplicantSignIn: () => void;
}

type PathwayClickKey = 'signin' | 'apply' | 'applicant';

const pathways: Array<{
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof WalletCards;
  tone: 'blue' | 'teal' | 'indigo';
  onClickKey: PathwayClickKey;
}> = [
  {
    eyebrow: 'Approved Provider Sign In',
    title: 'Provider Portal',
    description: 'Enter the approved provider portal with your verified CNH provider account.',
    icon: WalletCards,
    tone: 'blue',
    onClickKey: 'signin',
  },
  {
    eyebrow: 'Apply to Join',
    title: 'Applicant Portal',
    description: 'Begin a provider application and submit your professional review materials.',
    icon: FileText,
    tone: 'teal',
    onClickKey: 'apply',
  },
  {
    eyebrow: 'Applicant Sign In',
    title: 'Candidate Portal',
    description: 'Return to your candidate portal to review application status and next steps.',
    icon: KeyRound,
    tone: 'indigo',
    onClickKey: 'applicant',
  },
];

const toneClasses = {
  blue: {
    border: 'border-blue-300/20 hover:border-blue-200/50 focus:ring-blue-200/40',
    bg: 'bg-blue-500/[0.08] hover:bg-blue-500/15',
    text: 'text-blue-100',
    muted: 'text-blue-50/70',
    shadow: 'shadow-blue-950/25',
  },
  teal: {
    border: 'border-teal-200/20 hover:border-teal-100/50 focus:ring-teal-100/40',
    bg: 'bg-teal-400/[0.08] hover:bg-teal-400/15',
    text: 'text-teal-100',
    muted: 'text-teal-50/70',
    shadow: 'shadow-teal-950/20',
  },
  indigo: {
    border: 'border-indigo-200/20 hover:border-indigo-100/50 focus:ring-indigo-100/40',
    bg: 'bg-indigo-400/[0.08] hover:bg-indigo-400/15',
    text: 'text-indigo-100',
    muted: 'text-indigo-50/70',
    shadow: 'shadow-indigo-950/20',
  },
};

const ProviderAccessPage: React.FC<ProviderAccessPageProps> = ({
  onGoHome,
  onSignIn,
  onApply,
  onApplicantSignIn,
}) => {
  const handlers: Record<PathwayClickKey, () => void> = {
    signin: onSignIn,
    apply: onApply,
    applicant: onApplicantSignIn,
  };

  return (
    <div className="relative z-10 min-h-[100dvh] bg-[#05070a] px-4 py-6 text-slate-100 sm:px-6 sm:py-8 md:px-8 lg:px-12 xl:px-20">
      <svg
        className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full opacity-70 lg:block"
        viewBox="0 0 1200 820"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="providerPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="providerArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M2 2 L10 6 L2 10 Z" fill="#bfdbfe" />
          </marker>
        </defs>
        {[
          'M130 145 C300 175 415 235 520 330',
          'M1070 115 C890 160 765 230 650 335',
          'M600 360 C515 445 405 505 250 615',
          'M600 360 C610 470 690 560 925 670',
        ].map((path, index) => (
          <path
            key={path}
            d={path}
            fill="none"
            stroke={index % 2 === 0 ? '#60a5fa' : '#5eead4'}
            strokeWidth="2"
            strokeDasharray="8 20"
            markerEnd={index > 1 ? 'url(#providerArrow)' : undefined}
            filter="url(#providerPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="90" to="0" dur={index > 1 ? '5s' : '4s'} repeatCount="indefinite" />
          </path>
        ))}
      </svg>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] max-w-7xl flex-col gap-8 pb-4 sm:min-h-[calc(100dvh-4rem)] sm:gap-10">
        <button
          type="button"
          onClick={onGoHome}
          className="flex w-fit items-center gap-2 text-slate-500 transition-colors hover:text-white sm:gap-3"
        >
          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[9px] font-bold uppercase sm:text-[10px]">Portal Entry</span>
        </button>

        <section className="flex flex-1 flex-col justify-center gap-8 sm:gap-10">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 shadow-[0_0_35px_rgba(59,130,246,0.2)]">
                <img src={logo} alt="Conscious Network Hub Logo" className="h-9 w-9" />
              </div>
              <p className="max-w-xl text-xs font-bold uppercase leading-5 text-cyan-100/70 sm:text-sm">
                Conscious Network Hub Business Command Center
              </p>
            </div>

            <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.95] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Provider Access
            </h1>
          </div>

          <section className="grid gap-5 lg:grid-cols-3">
            {pathways.map((pathway) => {
              const Icon = pathway.icon;
              const tone = toneClasses[pathway.tone];
              return (
                <button
                  key={pathway.title}
                  type="button"
                  onClick={handlers[pathway.onClickKey]}
                  className={`group relative flex min-h-[13rem] w-full flex-col justify-between overflow-hidden rounded-[1.75rem] border p-6 text-left shadow-2xl transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 active:scale-[0.99] sm:p-7 ${tone.border} ${tone.bg} ${tone.shadow}`}
                >
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-[10px] font-black uppercase opacity-70 ${tone.text}`}>
                        {pathway.eyebrow}
                      </p>
                      <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                        {pathway.title}
                      </h2>
                    </div>
                    <Icon className={`h-7 w-7 ${tone.text}`} />
                  </div>
                  <div className="relative z-10 flex items-end justify-between gap-4 pt-8">
                    <p className={`max-w-sm text-sm leading-6 ${tone.muted}`}>{pathway.description}</p>
                    <ChevronRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${tone.text}`} />
                  </div>
                </button>
              );
            })}
          </section>
        </section>
      </div>
    </div>
  );
};

export default ProviderAccessPage;
