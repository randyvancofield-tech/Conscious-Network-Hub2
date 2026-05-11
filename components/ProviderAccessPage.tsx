import React from 'react';
import { Building2, ChevronRight, FileCheck2, FileText, Home, KeyRound, WalletCards } from 'lucide-react';
import logo from '../src/assets/brand/logo.png';

interface ProviderAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
  onApply: () => void;
  onApplicantSignIn: () => void;
}

const pathways = [
  {
    eyebrow: 'Existing Approved Provider',
    title: 'Approved Provider Sign In',
    description:
      'For verified providers who have already been approved to access the Higher Conscious Network provider system.',
    tooltip: 'Existing approved providers sign in here to access the CNH Provider CRM.',
    icon: WalletCards,
    tone: 'emerald',
    onClickKey: 'signin',
  },
  {
    eyebrow: 'New Provider Applicant',
    title: 'Apply to Join',
    description:
      'Start here to become a verified provider. Submit your application, upload your resume and cover letter, and schedule a discovery interview.',
    tooltip:
      'Start here to become a verified provider. Once submitted, you can track your status and book a discovery call.',
    icon: FileText,
    tone: 'amber',
    onClickKey: 'apply',
  },
  {
    eyebrow: 'Returning Applicant',
    title: 'Applicant Sign In',
    description:
      'Already submitted an application? Sign in here to view your application status and update your profile information.',
    tooltip: 'Return to your restricted applicant area to review status, materials, and next steps.',
    icon: KeyRound,
    tone: 'stone',
    onClickKey: 'applicant',
  },
] as const;

const toneClasses = {
  emerald: {
    border: 'border-emerald-300/20 hover:border-emerald-200/50 focus:ring-emerald-200/40',
    bg: 'bg-emerald-400/[0.08] hover:bg-emerald-400/15',
    text: 'text-emerald-100',
    muted: 'text-emerald-50/70',
    shadow: 'shadow-emerald-950/25',
    tooltip: 'border-emerald-200/15 text-emerald-50 shadow-emerald-950/30',
  },
  amber: {
    border: 'border-amber-200/20 hover:border-amber-100/50 focus:ring-amber-100/40',
    bg: 'bg-amber-400/[0.08] hover:bg-amber-400/15',
    text: 'text-amber-100',
    muted: 'text-amber-50/70',
    shadow: 'shadow-amber-950/20',
    tooltip: 'border-amber-200/15 text-amber-50 shadow-amber-950/25',
  },
  stone: {
    border: 'border-stone-200/20 hover:border-stone-100/50 focus:ring-stone-100/40',
    bg: 'bg-stone-300/[0.08] hover:bg-stone-300/15',
    text: 'text-stone-100',
    muted: 'text-stone-50/70',
    shadow: 'shadow-stone-950/20',
    tooltip: 'border-stone-200/15 text-stone-50 shadow-stone-950/25',
  },
};

const ProviderAccessPage: React.FC<ProviderAccessPageProps> = ({
  onGoHome,
  onSignIn,
  onApply,
  onApplicantSignIn,
}) => {
  const handlers = {
    signin: onSignIn,
    apply: onApply,
    applicant: onApplicantSignIn,
  };

  return (
    <div className="relative z-10 min-h-[100dvh] overflow-y-auto custom-scrollbar bg-[#06110f] p-4 text-slate-100 sm:p-6 md:p-8 lg:p-12">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col">
        <button
          type="button"
          onClick={onGoHome}
          className="mb-8 flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-100/55 transition-colors hover:text-white"
        >
          <Home className="h-4 w-4" />
          Portal Entry
        </button>

        <section className="flex flex-1 flex-col justify-center gap-10">
          <div className="grid items-end gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,0.2)]">
                  <img src={logo} alt="Conscious Network Hub Logo" className="h-9 w-9" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.45em] text-emerald-200/70">
                    Native Provider Access
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-100/50">
                    CNH Review Gateway
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.92] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                  Higher Conscious Network for Providers
                </h1>
                <p className="max-w-2xl text-base leading-8 text-emerald-50/70 sm:text-lg">
                  A high-trust gateway for aligned practitioners, leaders, educators, and care
                  professionals entering a mission-driven ecosystem with clarity and accountability.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-200/10 bg-white/[0.04] p-5 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-amber-200/15 bg-amber-400/10 p-3 text-amber-100">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">
                    Provider Pathways
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Choose the route that matches your current provider status. Applicant access is
                    intentionally restricted until review, approval, and future wallet verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {pathways.map((pathway) => {
              const Icon = pathway.icon;
              const tone = toneClasses[pathway.tone];
              return (
                <div className="group relative" key={pathway.title}>
                  <button
                    type="button"
                    onClick={handlers[pathway.onClickKey]}
                    className={`flex min-h-[15rem] w-full flex-col justify-between overflow-hidden rounded-2xl border p-6 text-left shadow-2xl transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 active:scale-[0.99] sm:p-7 ${tone.border} ${tone.bg} ${tone.shadow}`}
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.32em] opacity-70 ${tone.text}`}>
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
                  <div className={`pointer-events-none absolute bottom-full left-4 right-4 z-20 mb-3 origin-bottom rounded-2xl border bg-slate-950/85 p-4 text-xs leading-5 opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 md:left-6 md:right-auto md:w-80 ${tone.tooltip}`}>
                    {pathway.tooltip}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400">
            <FileCheck2 className="h-4 w-4 shrink-0 text-amber-100/70" />
            Application access is separate from provider CRM access. Review status does not grant
            approved-provider permissions.
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProviderAccessPage;
