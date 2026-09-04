import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crown, LockKeyhole, Sparkles, Volume2 } from 'lucide-react';
import { UserProfile } from '../../types';

type JeruselaPhase = 'void' | 'calling' | 'checking' | 'chosen' | 'gated';
type JeruselaChoice = 'man' | 'woman';

interface JeruselaPortalViewProps {
  user: UserProfile | null;
  onBack: () => void;
  onMembership: () => void;
}

interface JeruselaAudioLayer {
  start: () => Promise<void>;
  stop: () => void;
  playChime: () => void;
  getEnergy: () => number;
}

const JOHN_OPENING =
  'In the beginning was the Word, and the Word was with God, and the Word was God. ' +
  'The same was in the beginning with God. All things were made by him; and without him was not any thing made that was made. ' +
  'In him was life; and the life was the light of men. And the light shineth in darkness; and the darkness comprehended it not.';

const membershipUrl = 'https://conscious-network.org/membership';

const isPaidJeruselaMember = (user: UserProfile | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'provider') return true;

  const tier = String(user.tier || '').trim().toLowerCase();
  if (tier.includes('guided') || tier.includes('accelerated')) return true;
  if (tier.includes('free') || tier.includes('community')) return false;

  const membershipStatus = String(user.membershipStatus || user.subscriptionStatus || '')
    .trim()
    .toLowerCase();
  return user.hasActiveMembership === true && ['active', 'trialing'].includes(membershipStatus);
};

const buildCharacterName = (user: UserProfile | null): string => {
  const name = String(user?.name || '').trim();
  if (name) return name.split(/\s+/)[0] || name;
  const emailName = String(user?.email || '').split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName || 'Traveler';
};

const createJeruselaAudioLayer = (onNarrationEnd: () => void): JeruselaAudioLayer => {
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let oscillator: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let data: Uint8Array | null = null;
  let narrationEnded = false;

  const ensureContext = (): AudioContext | null => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContext) {
      audioContext = new AudioContextCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      data = new Uint8Array(analyser.frequencyBinCount);
      gain = audioContext.createGain();
      gain.gain.value = 0.035;
      oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 46;
      oscillator.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioContext.destination);
      oscillator.start();
    }
    return audioContext;
  };

  const finishNarration = () => {
    if (narrationEnded) return;
    narrationEnded = true;
    onNarrationEnd();
  };

  return {
    async start() {
      const context = ensureContext();
      if (context?.state === 'suspended') {
        await context.resume();
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(JOHN_OPENING);
        utterance.rate = 0.82;
        utterance.pitch = 0.72;
        utterance.volume = 0.92;
        utterance.onend = finishNarration;
        utterance.onerror = finishNarration;
        window.speechSynthesis.speak(utterance);
      } else {
        window.setTimeout(finishNarration, 9000);
      }
    },
    stop() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      oscillator?.stop();
      oscillator?.disconnect();
      gain?.disconnect();
      analyser?.disconnect();
      void audioContext?.close();
      oscillator = null;
      gain = null;
      analyser = null;
      audioContext = null;
      data = null;
    },
    playChime() {
      const context = ensureContext();
      if (!context) return;
      const chime = context.createOscillator();
      const chimeGain = context.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(660, context.currentTime);
      chime.frequency.exponentialRampToValueAtTime(990, context.currentTime + 0.24);
      chimeGain.gain.setValueAtTime(0.0001, context.currentTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.025);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
      chime.connect(chimeGain);
      chimeGain.connect(context.destination);
      chime.start();
      chime.stop(context.currentTime + 0.8);
    },
    getEnergy() {
      if (!analyser || !data) return 0;
      analyser.getByteFrequencyData(data);
      const lowBins = data.slice(1, 14);
      return lowBins.reduce((sum, value) => sum + value, 0) / (lowBins.length * 255);
    },
  };
};

const JeruselaVoidCanvas: React.FC<{
  phase: JeruselaPhase;
  getAudioEnergy: () => number;
}> = ({ phase, getAudioEnergy }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const freezeRef = useRef(false);

  useEffect(() => {
    freezeRef.current = phase === 'gated';
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const particles = Array.from({ length: 150 }, (_, index) => ({
      angle: (Math.PI * 2 * index) / 150,
      orbit: 26 + Math.random() * 240,
      speed: 0.00025 + Math.random() * 0.0012,
      size: 0.7 + Math.random() * 2.7,
      drift: Math.random() * Math.PI * 2,
    }));
    let width = 0;
    let height = 0;
    let frame = 0;
    let animation = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (!freezeRef.current) frame += 1;
      const cx = width / 2;
      const cy = height / 2;
      const energy = getAudioEnergy();
      const breath = 0.5 + Math.sin(frame * 0.032) * 0.5;
      const callBoost = phase === 'calling' || phase === 'checking' ? 1.28 : 1;
      const chosenBoost = phase === 'chosen' ? 1.48 : 1;
      const core = (42 + breath * 24 + energy * 72) * callBoost * chosenBoost;

      context.fillStyle = 'rgba(1, 3, 9, 0.32)';
      context.fillRect(0, 0, width, height);

      const backdrop = context.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.75);
      backdrop.addColorStop(0, `rgba(250, 252, 210, ${0.18 + energy * 0.22})`);
      backdrop.addColorStop(0.18, `rgba(95, 214, 232, ${0.08 + breath * 0.07})`);
      backdrop.addColorStop(0.42, 'rgba(38, 49, 89, 0.08)');
      backdrop.addColorStop(1, 'rgba(1, 3, 9, 0.92)');
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (!freezeRef.current) {
          particle.angle += particle.speed * (10 + energy * 38);
          particle.drift += 0.006;
        }
        const pulse = Math.sin(frame * 0.018 + particle.drift) * 18;
        const x = cx + Math.cos(particle.angle) * (particle.orbit + pulse);
        const y = cy + Math.sin(particle.angle * 0.78) * (particle.orbit * 0.42 + pulse);
        const alpha = 0.12 + breath * 0.18 + energy * 0.28;
        context.beginPath();
        context.fillStyle = `rgba(218, 249, 255, ${alpha})`;
        context.arc(x, y, particle.size + energy * 2.2, 0, Math.PI * 2);
        context.fill();
      });

      const halo = context.createRadialGradient(cx, cy, 0, cx, cy, core * 5.6);
      halo.addColorStop(0, 'rgba(255, 255, 232, 0.98)');
      halo.addColorStop(0.12, `rgba(251, 246, 176, ${0.72 + energy * 0.2})`);
      halo.addColorStop(0.34, `rgba(105, 232, 241, ${0.18 + energy * 0.18})`);
      halo.addColorStop(0.68, 'rgba(70, 81, 150, 0.08)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, core * 5.6, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(255, 255, 245, 0.96)';
      context.beginPath();
      context.arc(cx, cy, Math.max(10, core * 0.42), 0, Math.PI * 2);
      context.fill();

      animation = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener('resize', resize);
    };
  }, [getAudioEnergy, phase]);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen bg-[#010309]" aria-hidden="true" />;
};

const JeruselaPortalView: React.FC<JeruselaPortalViewProps> = ({ user, onBack, onMembership }) => {
  const [phase, setPhase] = useState<JeruselaPhase>('void');
  const [choice, setChoice] = useState<JeruselaChoice | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [gameState, setGameState] = useState<{ name: string; form: JeruselaChoice } | null>(null);
  const audioLayerRef = useRef<JeruselaAudioLayer | null>(null);

  const characterName = useMemo(() => buildCharacterName(user), [user]);

  useEffect(() => {
    audioLayerRef.current = createJeruselaAudioLayer(() => {
      setPhase((current) => (current === 'void' ? 'calling' : current));
    });

    const start = () => {
      setAudioReady(true);
      void audioLayerRef.current?.start();
    };

    start();
    window.addEventListener('pointerdown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      audioLayerRef.current?.stop();
      audioLayerRef.current = null;
    };
  }, []);

  const chooseForm = async (nextChoice: JeruselaChoice) => {
    setChoice(nextChoice);
    setPhase('checking');
    audioLayerRef.current?.playChime();
    await new Promise((resolve) => window.setTimeout(resolve, 760));

    if (isPaidJeruselaMember(user)) {
      setGameState({ name: characterName, form: nextChoice });
      setPhase('chosen');
      return;
    }

    setPhase('gated');
  };

  const choiceVisible = phase === 'calling';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#010309] text-white">
      <JeruselaVoidCanvas
        phase={phase}
        getAudioEnergy={() => audioLayerRef.current?.getEnergy() || 0}
      />

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(1,3,9,0.22),rgba(1,3,9,0.88))]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-black uppercase text-slate-200 backdrop-blur-xl transition hover:bg-white/10"
            aria-label="Return"
          >
            <ArrowLeft className="h-4 w-4" />
            Return
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-black uppercase text-slate-300 backdrop-blur-xl">
            <Volume2 className="h-4 w-4 text-cyan-200" />
            {audioReady ? 'Signal Active' : 'Signal Waiting'}
          </div>
        </div>

        <section className="flex flex-1 items-center justify-center px-4 pb-16 pt-8">
          <div className="flex min-h-[18rem] w-full max-w-4xl flex-col items-center justify-center text-center">
            <div
              className={`flex flex-wrap items-center justify-center gap-4 transition duration-1000 ${
                choiceVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              aria-hidden={!choiceVisible}
            >
              {(['man', 'woman'] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => void chooseForm(entry)}
                  disabled={!choiceVisible}
                  className="min-h-14 min-w-36 rounded-full border border-white/15 bg-white/10 px-8 py-4 text-sm font-black uppercase text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl transition hover:border-cyan-200/40 hover:bg-cyan-200/15 focus:outline-none focus:ring-2 focus:ring-cyan-200/60 disabled:pointer-events-none"
                >
                  {entry === 'man' ? 'Man' : 'Woman'}
                </button>
              ))}
            </div>

            {phase === 'checking' && (
              <div className="animate-pulse text-[10px] font-black uppercase text-cyan-100">
                Identity Check
              </div>
            )}

            {phase === 'chosen' && gameState && (
              <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl sm:p-8">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-cyan-200/30 bg-cyan-200/15 text-cyan-100">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-black uppercase text-white sm:text-5xl">You are chosen...</h1>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                  {gameState.name}, your goal is to serve as the light and remain bright throughout the darkness.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {['Serve', 'Shine', 'Endure'].map((label) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase text-cyan-100">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {phase === 'gated' && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/72 px-4 backdrop-blur-xl">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-white/12 bg-[#07101d]/95 p-6 text-center shadow-2xl shadow-black/50 sm:p-8">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-amber-200/25 bg-amber-200/12 text-amber-100">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black uppercase text-white">Membership Required</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-300">
              The path of the Light requires an active membership to synchronize your personal dashboard journey and ethical scores with the world of Jerusela.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={membershipUrl}
                onClick={(event) => {
                  event.preventDefault();
                  onMembership();
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black uppercase text-slate-950 transition hover:bg-cyan-200"
              >
                <Crown className="h-4 w-4" />
                Upgrade Membership
              </a>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase text-slate-200 transition hover:bg-white/10"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export default JeruselaPortalView;
