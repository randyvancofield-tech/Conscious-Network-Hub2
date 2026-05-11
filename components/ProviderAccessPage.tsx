import React from 'react';
import { Building2, ChevronRight, FileText, Home, WalletCards } from 'lucide-react';
import logo from '../src/assets/brand/logo.png';

interface ProviderAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
  onApply: () => void;
}

const ProviderAccessPage: React.FC<ProviderAccessPageProps> = ({
  onGoHome,
  onSignIn,
  onApply,
}) => (
  <div className="relative z-10 min-h-[100dvh] overflow-y-auto custom-scrollbar bg-[#06110f] p-4 text-slate-100 sm:p-6 md:p-8 lg:p-12">
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_32%)]" />
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
                  Provider Gateway
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-100/50">
                  CNH Native Access
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.92] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Higher Conscious Network for Providers
              </h1>
              <p className="max-w-2xl text-base leading-8 text-emerald-50/70 sm:text-lg">
                A trusted professional gateway for guides, practitioners, educators, and service
                providers supporting conscious growth with integrity, clarity, and sovereign access.
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
                  Choose the path that matches your status. These routes are placeholders for the
                  next provider onboarding and wallet access phases.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="group relative">
            <button
              type="button"
              onClick={onSignIn}
              className="flex min-h-[13rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-6 text-left shadow-2xl shadow-emerald-950/25 transition-all hover:-translate-y-1 hover:border-emerald-200/50 hover:bg-emerald-400/15 focus:outline-none focus:ring-2 focus:ring-emerald-200/40 active:scale-[0.99] sm:p-7"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full transition-transform duration-1000 group-hover:translate-x-full" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-100/60">
                    Existing Provider Path
                  </p>
                  <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                    Sign In via Wallet
                  </h2>
                </div>
                <WalletCards className="h-7 w-7 text-emerald-100" />
              </div>
              <div className="relative z-10 flex items-center justify-between gap-4 pt-8">
                <p className="max-w-sm text-sm leading-6 text-emerald-50/70">
                  Access the future provider CRM path once wallet verification is added.
                </p>
                <ChevronRight className="h-5 w-5 shrink-0 text-emerald-100 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
            <div className="pointer-events-none absolute bottom-full left-4 right-4 z-20 mb-3 origin-bottom rounded-2xl border border-emerald-200/15 bg-slate-950/80 p-4 text-xs leading-5 text-emerald-50 opacity-0 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 md:left-6 md:right-auto md:w-80">
              Existing approved providers sign in here to access the CNH Provider CRM.
            </div>
          </div>

          <div className="group relative">
            <button
              type="button"
              onClick={onApply}
              className="flex min-h-[13rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/20 bg-amber-400/[0.08] p-6 text-left shadow-2xl shadow-amber-950/20 transition-all hover:-translate-y-1 hover:border-amber-100/50 hover:bg-amber-400/15 focus:outline-none focus:ring-2 focus:ring-amber-100/40 active:scale-[0.99] sm:p-7"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full transition-transform duration-1000 group-hover:translate-x-full" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-100/60">
                    New Applicant Path
                  </p>
                  <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                    Apply to Join
                  </h2>
                </div>
                <FileText className="h-7 w-7 text-amber-100" />
              </div>
              <div className="relative z-10 flex items-center justify-between gap-4 pt-8">
                <p className="max-w-sm text-sm leading-6 text-amber-50/70">
                  Start the verified provider application path in the next onboarding phase.
                </p>
                <ChevronRight className="h-5 w-5 shrink-0 text-amber-100 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
            <div className="pointer-events-none absolute bottom-full left-4 right-4 z-20 mb-3 origin-bottom rounded-2xl border border-amber-200/15 bg-slate-950/80 p-4 text-xs leading-5 text-amber-50 opacity-0 shadow-2xl shadow-amber-950/25 backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 md:left-6 md:right-auto md:w-80">
              Start here to become a verified provider. Once submitted, you can track your status
              and book a discovery call.
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
);

export default ProviderAccessPage;
