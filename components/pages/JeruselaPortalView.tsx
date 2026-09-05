import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crown, LockKeyhole, Sparkles, Volume2 } from 'lucide-react';
import { UserProfile } from '../../types';

type JeruselaPhase = 'void' | 'calling' | 'initiation' | 'checking' | 'gated' | 'arrival';
type JeruselaChoice = 'man' | 'woman';

interface JeruselaPortalViewProps {
  user: UserProfile | null;
  onBack: () => void;
  onSignIn: () => void;
  onMembership: () => void;
}

interface JeruselaAudioLayer {
  start: () => Promise<void>;
  stop: () => void;
  playChime: () => void;
  getEnergy: () => number;
}

interface PlayerState {
  name: string;
  form: JeruselaChoice;
}

const JOHN_OPENING =
  'In the beginning was the Word, and the Word was with God, and the Word was God. ' +
  'In him was life; and the life was the light of men. ' +
  'And the light shineth in darkness; and the darkness comprehended it not.';

const membershipUrl = 'https://conscious-network.org/membership';
const paidTierSignals = ['guided', 'accelerated', 'premium', 'professional', 'founder', 'privileged'];

const isEligibleJeruselaPlayer = (user: UserProfile | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'provider') return true;

  const tier = String(user.tier || '').trim().toLowerCase();
  if (tier.includes('free') || tier.includes('community')) return false;
  if (paidTierSignals.some((signal) => tier.includes(signal))) return true;

  const membershipStatus = String(user.membershipStatus || user.subscriptionStatus || '')
    .trim()
    .toLowerCase();
  return user.hasActiveMembership === true && !['free', 'inactive', 'canceled', 'cancelled'].includes(membershipStatus);
};

const buildPlayerName = (user: UserProfile | null): string => {
  const name = String(user?.name || '').trim();
  if (name) return name;
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
  let narrationStarted = false;
  let stopped = false;

  const ensureContext = (): AudioContext | null => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContext) {
      audioContext = new AudioContextCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      data = new Uint8Array(analyser.frequencyBinCount);
      gain = audioContext.createGain();
      gain.gain.value = 0.05;
      oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 44;
      oscillator.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioContext.destination);
      oscillator.start();
    }
    return audioContext;
  };

  const finishNarration = () => {
    if (narrationEnded || stopped) return;
    narrationEnded = true;
    onNarrationEnd();
  };

  const speak = (text: string, options: { rate?: number; pitch?: number; volume?: number; onEnd?: () => void } = {}) => {
    if (!('speechSynthesis' in window)) {
      window.setTimeout(options.onEnd || (() => undefined), 1600);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const englishVoices = window.speechSynthesis.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang));
    const voice = englishVoices.find((voice) => /natural|neural|samantha|aria|jenny|google US English/i.test(voice.name))
      || englishVoices.find((voice) => voice.default)
      || englishVoices[0];
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    // Keep a natural pitch and measured sentence rhythm for a warm narrative reading.
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 0.9;
    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(utterance);
  };

  return {
    async start() {
      if (narrationStarted || stopped) return;
      narrationStarted = true;
      const context = ensureContext();
      if (context?.state === 'suspended') void context.resume().catch(() => undefined);
      speak(JOHN_OPENING, { onEnd: finishNarration });
    },
    stop() {
      stopped = true;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
      chimeGain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.025);
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
  reducedMotion: boolean;
  getAudioEnergy: () => number;
}> = ({ phase, reducedMotion, getAudioEnergy }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const particles = Array.from({ length: reducedMotion ? 70 : 170 }, (_, index) => ({
      angle: (Math.PI * 2 * index) / (reducedMotion ? 70 : 170),
      orbit: 24 + Math.random() * 260,
      speed: 0.00025 + Math.random() * 0.0012,
      size: 0.9 + Math.random() * 3.1,
      drift: Math.random() * Math.PI * 2,
    }));
    let width = 0;
    let height = 0;
    let frame = 0;
    let animation = 0;
    const start = performance.now();

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

    const drawVoid = (time: number) => {
      if (!reducedMotion) frame += 1;
      const cx = width / 2;
      const cy = height / 2;
      const energy = getAudioEnergy();
      const breath = 0.5 + Math.sin(frame * 0.034) * 0.5;
      const coreBoost = phase === 'calling' || phase === 'initiation' || phase === 'checking' ? 1.85 : 1.45;
      const core = (66 + breath * 38 + energy * 112) * coreBoost;

      context.fillStyle = 'rgba(1, 3, 9, 0.28)';
      context.fillRect(0, 0, width, height);

      const backdrop = context.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.78);
      backdrop.addColorStop(0, `rgba(255, 252, 210, ${0.34 + energy * 0.28})`);
      backdrop.addColorStop(0.18, `rgba(95, 214, 232, ${0.16 + breath * 0.12})`);
      backdrop.addColorStop(0.42, 'rgba(53, 73, 140, 0.12)');
      backdrop.addColorStop(1, 'rgba(1, 3, 9, 0.95)');
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (!reducedMotion) {
          particle.angle += particle.speed * (10 + energy * 38);
          particle.drift += 0.006;
        }
        const pulse = Math.sin(frame * 0.018 + particle.drift) * 18;
        const x = cx + Math.cos(particle.angle) * (particle.orbit + pulse);
        const y = cy + Math.sin(particle.angle * 0.78) * (particle.orbit * 0.42 + pulse);
        context.beginPath();
        context.fillStyle = `rgba(223, 250, 255, ${0.16 + breath * 0.24 + energy * 0.3})`;
        context.arc(x, y, particle.size + energy * 2.2, 0, Math.PI * 2);
        context.fill();
      });

      const halo = context.createRadialGradient(cx, cy, 0, cx, cy, core * 6.4);
      halo.addColorStop(0, 'rgba(255, 255, 232, 1)');
      halo.addColorStop(0.08, 'rgba(255, 249, 184, 0.94)');
      halo.addColorStop(0.24, `rgba(105, 232, 241, ${0.42 + energy * 0.24})`);
      halo.addColorStop(0.54, 'rgba(70, 81, 150, 0.14)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, core * 6.4, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(255, 255, 245, 0.98)';
      context.beginPath();
      context.arc(cx, cy, Math.max(28, core * 0.54), 0, Math.PI * 2);
      context.fill();
    };

    const draw = (time: number) => {
      drawVoid(time);
      animation = window.requestAnimationFrame(draw);
    };

    resize();
    draw(start);
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener('resize', resize);
    };
  }, [getAudioEnergy, phase, reducedMotion]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 h-screen w-screen bg-[#010309]" aria-hidden="true" />;
};

const JeruselaPortalView: React.FC<JeruselaPortalViewProps> = ({ user, onBack, onSignIn, onMembership }) => {
  const [phase, setPhase] = useState<JeruselaPhase>('void');
  const [choice, setChoice] = useState<JeruselaChoice | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [eligibilityResolving, setEligibilityResolving] = useState(false);
  const audioLayerRef = useRef<JeruselaAudioLayer | null>(null);
  const choiceLockRef = useRef(false);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const playerName = useMemo(() => buildPlayerName(user), [user]);
  const choiceVisible = phase === 'calling';

  useEffect(() => {
    audioLayerRef.current = createJeruselaAudioLayer(() => {
      setPhase((current) => (current === 'void' ? 'calling' : current));
    });

    const start = () => {
      setAudioReady(true);
      void audioLayerRef.current?.start();
    };

    window.addEventListener('pointerdown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      audioLayerRef.current?.stop();
      audioLayerRef.current = null;
    };
  }, []);

  const chooseForm = (nextChoice: JeruselaChoice) => {
    if (choiceLockRef.current) return;
    choiceLockRef.current = true;
    setChoice(nextChoice);
    setPlayer({ name: playerName, form: nextChoice });
    setAcknowledged(false);
    setPhase('initiation');
    audioLayerRef.current?.playChime();
  };

  const resolveEligibility = async () => {
    if (!choice || !acknowledged || eligibilityResolving) return;
    setEligibilityResolving(true);
    setPhase('checking');
    audioLayerRef.current?.playChime();
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setEligibilityResolving(false);

    if (isEligibleJeruselaPlayer(user)) {
      audioLayerRef.current?.stop();
      setPhase('arrival');
      return;
    }

    setPhase('gated');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#010309] text-white">
      {phase !== 'arrival' && <JeruselaVoidCanvas
        phase={phase}
        reducedMotion={reducedMotion}
        getAudioEnergy={() => audioLayerRef.current?.getEnergy() || 0}
      />}

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(1,3,9,0.1),rgba(1,3,9,0.78))]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-black uppercase text-slate-200 backdrop-blur-xl transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/70"
            aria-label="Return"
          >
            <ArrowLeft className="h-4 w-4" />
            Return
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-black uppercase text-slate-300 backdrop-blur-xl">
            <Volume2 className="h-4 w-4 text-cyan-200" />
            {audioReady ? (phase === 'arrival' ? 'Signal Complete' : 'Signal Active') : 'Signal Waiting'}
          </div>
        </div>

        <section className="flex flex-1 items-center justify-center px-4 pb-16 pt-8">
          <div className="flex min-h-[20rem] w-full max-w-4xl flex-col items-center justify-center text-center">
            {!audioReady && (
              <button
                type="button"
                onClick={() => {
                  setAudioReady(true);
                  void audioLayerRef.current?.start();
                }}
                className="rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                Begin narration
              </button>
            )}
            <div
              className={`transition duration-1000 ${
                choiceVisible ? 'translate-y-0 opacity-100' : 'hidden'
              } pointer-events-auto relative z-20`}
              aria-hidden={!choiceVisible}
            >
              <p className="mb-6 text-base font-black uppercase text-white sm:text-xl">
                Choose how you will enter Jerusela.
              </p>
              <div
                data-jerusela-choice-group="true"
                className="flex flex-wrap items-center justify-center gap-4"
                onMouseDown={(event) => {
                  if (!choiceVisible || choice) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  chooseForm(event.clientX < bounds.left + bounds.width / 2 ? 'man' : 'woman');
                }}
              >
                {(['man', 'woman'] as const).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    data-jerusela-choice={entry}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      chooseForm(entry);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      chooseForm(entry);
                    }}
                    disabled={!choiceVisible}
                    className="pointer-events-auto relative z-30 min-h-14 min-w-36 rounded-full border border-white/15 bg-white/10 px-8 py-4 text-sm font-black uppercase text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl transition hover:border-cyan-200/40 hover:bg-cyan-200/15 focus:outline-none focus:ring-2 focus:ring-cyan-200/60 disabled:pointer-events-none"
                  >
                    {entry === 'man' ? 'Man' : 'Woman'}
                  </button>
                ))}
              </div>
            </div>

            {phase === 'initiation' && player && (
              <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl sm:p-8">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-cyan-200/30 bg-cyan-200/15 text-cyan-100">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-black uppercase text-white sm:text-5xl">You Are Chosen</h1>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                  Jerusela, your goal is to serve as the light and remain bright throughout the darkness.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {['Serve', 'Shine', 'Endure'].map((label) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase text-cyan-100">{label}</p>
                    </div>
                  ))}
                </div>
                <label className="mx-auto mt-7 flex max-w-2xl cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left text-sm leading-6 text-slate-100 transition hover:bg-white/[0.09]">
                  <input
                    type="checkbox"
                    data-jerusela-acknowledgement="true"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-white/30 bg-black/40 text-cyan-300 focus:ring-2 focus:ring-cyan-200/70"
                  />
                  <span>
                    I understand the three guiding principles of Jerusela - Serve, Shine, and Endure - and I am ready to enter.
                  </span>
                </label>
                <button
                  type="button"
                  data-jerusela-enter="true"
                  onClick={() => void resolveEligibility()}
                  disabled={!acknowledged || eligibilityResolving}
                  className="mt-7 inline-flex min-h-12 max-w-2xl items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-xs font-black uppercase leading-5 text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-white/80 disabled:opacity-70"
                >
                  Enter Jerusela
                </button>
              </div>
            )}

            {phase === 'checking' && (
              <div className="rounded-full border border-cyan-200/25 bg-black/35 px-6 py-4 text-[10px] font-black uppercase text-cyan-100 backdrop-blur-xl">
                Resolving Eligibility
              </div>
            )}

            {phase === 'arrival' && (
              <h1 className="text-4xl font-black tracking-[0.15em] text-white sm:text-6xl" aria-live="polite">
                COMING 2027
              </h1>
            )}
          </div>
        </section>
      </div>

      {phase === 'gated' && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/62 px-4 backdrop-blur-xl">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-white/12 bg-[#07101d]/95 p-6 text-center shadow-2xl shadow-black/50 sm:p-8">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-amber-200/25 bg-amber-200/12 text-amber-100">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black uppercase text-white">Eligible Membership Required</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-300">
              {user
                ? 'Jerusela requires an eligible Conscious Network Hub membership before your dashboard journey and ethical scores can synchronize with this world.'
                : 'Sign in to your Conscious Network Hub account so Jerusela can verify whether your membership, provider, or administrator access is eligible.'}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {user ? (
                <a
                  href={membershipUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    onMembership();
                  }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black uppercase text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-white/80"
                >
                  <Crown className="h-4 w-4" />
                  Membership
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black uppercase text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-white/80"
                >
                  <Crown className="h-4 w-4" />
                  Sign In
                </button>
              )}
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase text-slate-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/70"
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
