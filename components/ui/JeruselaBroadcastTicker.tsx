import React from 'react';

const TICKER_ITEMS = [
  'THE BOOK OF JERUSELA • IMMERSIVE CINEMA • EXCLUSIVE PORTAL ACCESS •',
  'PREVIEW THE FIRST CHAPTER • WALLET-VERIFIED ENTRY • PREMIUM EXPERIENCE •',
  'HIGH-FIDELITY STORYSPACE • CHOICE-DRIVEN NAVIGATION • AUTHENTICATED DASHBOARD •',
];

export const JeruselaBroadcastTicker: React.FC = () => {
  const duplicatedItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="relative z-[60] w-full border-b border-white/10 bg-slate-950/95 text-slate-100 shadow-[0_10px_35px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center overflow-hidden px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="mr-3 shrink-0 text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200/90 sm:text-[10px]">
          Broadcast
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="animate-[marquee_22s_linear_infinite] whitespace-nowrap will-change-transform">
            {duplicatedItems.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="mr-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300 sm:text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JeruselaBroadcastTicker;
