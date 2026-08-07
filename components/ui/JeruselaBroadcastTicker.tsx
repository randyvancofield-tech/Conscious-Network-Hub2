import React from 'react';

const TICKER_TEXT = 'PREMIERING WITHIN THE NETWORK: THE BOOK OF JERUSELA — An Interactive Cinema Experience • A journey across borders • A battle beyond sight • Log in to enter the portal ➔';

export const JeruselaBroadcastTicker: React.FC = () => {
  const duplicatedText = `${TICKER_TEXT}  •  ${TICKER_TEXT}`;

  return (
    <div className="relative z-[60] w-full border-b border-white/10 bg-slate-950/95 text-slate-100 shadow-[0_10px_35px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <style>{`@keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }`}</style>
      <div className="mx-auto flex max-w-7xl items-center overflow-hidden px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="mr-3 shrink-0 text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200/90 sm:text-[10px]">
          Premiere
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="whitespace-nowrap will-change-transform" style={{ animation: 'marquee 24s linear infinite' }}>
            <span className="mr-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300 sm:text-xs">
              {duplicatedText}
            </span>
            <span className="mr-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300 sm:text-xs">
              {duplicatedText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JeruselaBroadcastTicker;
