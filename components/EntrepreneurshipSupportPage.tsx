import React from 'react';
import { ArrowLeft, Clock3, Rocket, ShieldCheck } from 'lucide-react';

interface EntrepreneurshipSupportPageProps {
  onBack: () => void;
}

const EntrepreneurshipSupportPage: React.FC<EntrepreneurshipSupportPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-[100dvh] w-full p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-3 text-slate-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Conscious Careers</span>
        </button>

        <section className="glass-panel relative overflow-hidden rounded-[2rem] border border-teal-300/15 p-6 shadow-2xl sm:rounded-[3rem] sm:p-10 lg:p-14">
          <div className="absolute right-0 top-0 p-10 text-teal-300 opacity-5">
            <Rocket className="h-40 w-40" />
          </div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-200/20 bg-teal-400/10 text-teal-100">
              <Clock3 className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.45em] text-teal-200/70">
                Coming Soon
              </p>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white sm:text-5xl">
                Entrepreneurship Support
              </h1>
              <p className="text-sm leading-7 text-slate-300 sm:text-base">
                Conscious Careers entrepreneurship support is being prepared as a direct pathway for mentorship, planning, stewardship, and values-driven business development.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                'Mentorship readiness',
                'Business planning support',
                'Faith-driven stewardship',
              ].map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <ShieldCheck className="mb-3 h-5 w-5 text-teal-300" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EntrepreneurshipSupportPage;
