import React from 'react';
import { ShieldCheck, Sparkles, PlayCircle } from 'lucide-react';

interface JeruselaPortalViewProps {
  onBack: () => void;
}

const JeruselaPortalView: React.FC<JeruselaPortalViewProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">The Book of Jerusela</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.2em] text-white sm:text-3xl">
              Authenticated portal preview
            </h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Return to dashboard
          </button>
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-[0_25px_80px_rgba(6,11,26,0.6)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.2),_transparent_38%)]" />
            <div className="relative flex h-full min-h-[24rem] flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div className="flex items-center gap-3 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.35em]">Secure cinematic entry</span>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  3–5 minute preview
                </div>
                <h2 className="max-w-2xl text-3xl font-black uppercase tracking-[0.2em] text-white sm:text-4xl">
                  A premium cinematic preview will open here.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  This protected shell is ready for the future video payload, immersive scene transitions, and choice-driven narrative controls.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-3 text-slate-200">
                  <PlayCircle className="h-5 w-5 text-cyan-300" />
                  <span className="text-sm font-semibold">Future streaming media layer</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" />
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Portal guidance</p>
              <h3 className="mt-2 text-xl font-black uppercase tracking-[0.2em] text-white">Story mechanics</h3>
            </div>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>• Preview the cinematic opening sequence.</p>
              <p>• Review the core game rules and spatial mechanics.</p>
              <p>• Move into a choice-driven narrative experience once the media payload is connected.</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              The route is protected and only available after authenticated access is established.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default JeruselaPortalView;
