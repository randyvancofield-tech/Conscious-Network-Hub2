import React from 'react';

const TICKER_TEXT = 'NOW STREAMING: THE BOOK OF JERUSELA • An Exclusive Cognitive Development Game • Bridging global culture through immersive, choice-driven narrative cinema • Authenticate your membership below to interact ➔';

export const JeruselaBroadcastTicker: React.FC = () => {
  return (
    <div className="relative z-[60] w-full border-b border-white/10 bg-slate-950/95 text-slate-100 shadow-[0_10px_35px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <style>{`@keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }`}</style>
      <div className="mx-auto flex max-w-7xl items-center overflow-hidden px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex w-max whitespace-nowrap will-change-transform" style={{ animation: 'marquee 18s linear infinite' }}>
            <span className="mr-12 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 sm:text-xs">
              {TICKER_TEXT}
            </span>
            <span className="mr-12 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 sm:text-xs">
              {TICKER_TEXT}
            </span>
            <span className="mr-12 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 sm:text-xs">
              {TICKER_TEXT}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JeruselaBroadcastTicker;
