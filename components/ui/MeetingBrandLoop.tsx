import React, { useEffect, useRef, useState } from 'react';

type MeetingBrandLoopProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
};

const cnhLogo = '/brand/conscious-network-hub-logo.png';
const meetingBrandLoop = '/brand/conscious-meetings-loop.gif';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MeetingBrandLoop: React.FC<MeetingBrandLoopProps> = ({
  alt = 'Conscious Meetings branded WebRTC room animation',
  className = '',
  imageClassName = 'h-full w-full object-cover',
  eager = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReduceMotion(reduced);
    if (eager) {
      setShouldLoad(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const target = containerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '420px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-slate-950 ${className}`}>
      {shouldLoad ? (
        <img
          src={meetingBrandLoop}
          alt={alt}
          className={imageClassName}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div className="flex h-full min-h-[7rem] w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.2),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <img
              src={cnhLogo}
              alt=""
              className="h-14 w-14 rounded-2xl bg-white/95 object-contain p-1.5 shadow-xl"
            />
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-100">
              {reduceMotion ? 'CNH meeting media ready' : 'CNH native WebRTC'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingBrandLoop;
