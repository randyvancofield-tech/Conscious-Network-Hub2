import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crown, LockKeyhole, Sparkles, Volume2 } from 'lucide-react';
import { UserProfile } from '../../types';

type JeruselaPhase = 'void' | 'calling' | 'initiation' | 'checking' | 'gated' | 'arrival';
type JeruselaChoice = 'man' | 'woman';
type EnvironmentEntityKind = 'human' | 'bird' | 'terrestrial' | 'aquatic' | 'vegetation';

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
  whisperChosen: () => void;
  getEnergy: () => number;
}

interface PlayerState {
  name: string;
  form: JeruselaChoice;
}

interface EnvironmentEntity {
  id: string;
  kind: EnvironmentEntityKind;
  x: number;
  y: number;
  z: number;
  speed: number;
  scale: number;
  palette: string[];
  motion: 'walk' | 'glide' | 'swim' | 'sway';
  variant?: 'adult' | 'older' | 'young-adult' | 'curly' | 'coily' | 'straight' | 'wavy';
}

interface SpatialConfig {
  horizon: number;
  player: { x: number; y: number; scale: number };
  entities: EnvironmentEntity[];
  rules: Array<{ label: string; x: number; y: number; delay: number }>;
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
    if (narrationEnded) return;
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
    utterance.rate = options.rate ?? 0.82;
    utterance.pitch = options.pitch ?? 0.72;
    utterance.volume = options.volume ?? 0.9;
    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(utterance);
  };

  return {
    async start() {
      const context = ensureContext();
      if (context?.state === 'suspended') await context.resume();
      speak(JOHN_OPENING, { onEnd: finishNarration });
    },
    stop() {
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
    whisperChosen() {
      speak('You are chosen.', { rate: 0.72, pitch: 0.6, volume: 0.62 });
    },
    getEnergy() {
      if (!analyser || !data) return 0;
      analyser.getByteFrequencyData(data);
      const lowBins = data.slice(1, 14);
      return lowBins.reduce((sum, value) => sum + value, 0) / (lowBins.length * 255);
    },
  };
};

const worldConfig: SpatialConfig = {
  horizon: 0.48,
  player: { x: 0.5, y: 0.67, scale: 1.18 },
  rules: [
    { label: 'SERVE', x: 0.24, y: 0.3, delay: 0 },
    { label: 'SHINE', x: 0.5, y: 0.24, delay: 900 },
    { label: 'ENDURE', x: 0.76, y: 0.32, delay: 1800 },
  ],
  entities: [
    { id: 'elder-teacher', kind: 'human', x: 0.18, y: 0.62, z: 0.7, speed: 0.18, scale: 0.82, motion: 'walk', palette: ['#7a4f37', '#f5f0d6', '#335c67'], variant: 'older' },
    { id: 'runner', kind: 'human', x: 0.72, y: 0.66, z: 0.8, speed: -0.22, scale: 0.78, motion: 'walk', palette: ['#2f1f18', '#d6a77a', '#8ecae6'], variant: 'coily' },
    { id: 'artisan', kind: 'human', x: 0.84, y: 0.58, z: 0.5, speed: 0.12, scale: 0.68, motion: 'walk', palette: ['#c7895c', '#172a3a', '#e9c46a'], variant: 'wavy' },
    { id: 'traveler', kind: 'human', x: 0.31, y: 0.72, z: 0.9, speed: -0.1, scale: 0.74, motion: 'walk', palette: ['#51311d', '#5f0f40', '#e0fbfc'], variant: 'straight' },
    { id: 'child-guide', kind: 'human', x: 0.43, y: 0.6, z: 0.62, speed: 0.15, scale: 0.56, motion: 'walk', palette: ['#9f6b4d', '#0f766e', '#fde68a'], variant: 'young-adult' },
    { id: 'heron', kind: 'bird', x: 0.65, y: 0.18, z: 0.3, speed: -0.28, scale: 0.75, motion: 'glide', palette: ['#dce7ef', '#0b3954'] },
    { id: 'small-flock', kind: 'bird', x: 0.3, y: 0.22, z: 0.25, speed: 0.34, scale: 0.48, motion: 'glide', palette: ['#1f2937', '#e5e7eb'] },
    { id: 'deer-like-grazer', kind: 'terrestrial', x: 0.12, y: 0.78, z: 0.95, speed: 0.08, scale: 0.62, motion: 'walk', palette: ['#8b5e34', '#e6ccb2'] },
    { id: 'fox-like-runner', kind: 'terrestrial', x: 0.61, y: 0.82, z: 1, speed: -0.26, scale: 0.48, motion: 'walk', palette: ['#b45309', '#fff7ed'] },
    { id: 'shore-fish', kind: 'aquatic', x: 0.76, y: 0.9, z: 1, speed: 0.2, scale: 0.42, motion: 'swim', palette: ['#67e8f9', '#155e75'] },
    { id: 'silver-school', kind: 'aquatic', x: 0.88, y: 0.86, z: 1, speed: -0.17, scale: 0.36, motion: 'swim', palette: ['#e0f2fe', '#0891b2'] },
    { id: 'meadow-grass', kind: 'vegetation', x: 0.08, y: 0.7, z: 1, speed: 0.05, scale: 0.95, motion: 'sway', palette: ['#7dd3fc', '#166534'] },
    { id: 'reed-bank', kind: 'vegetation', x: 0.9, y: 0.74, z: 1, speed: -0.04, scale: 0.92, motion: 'sway', palette: ['#a7f3d0', '#365314'] },
  ],
};

const drawHuman = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  entity: EnvironmentEntity,
  time: number
) => {
  const [skin, cloth, accent] = entity.palette;
  const stride = Math.sin(time * 0.004 + x) * 4 * scale;
  context.fillStyle = cloth;
  context.beginPath();
  context.roundRect(x - 7 * scale, y - 25 * scale, 14 * scale, 26 * scale, 6 * scale);
  context.fill();
  context.fillStyle = accent;
  context.beginPath();
  context.arc(x + 4 * scale, y - 12 * scale, 2.4 * scale, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.moveTo(x - 6 * scale, y - 9 * scale);
  context.lineTo(x + 7 * scale, y - 2 * scale);
  context.stroke();
  context.strokeStyle = skin;
  context.lineWidth = 3 * scale;
  context.beginPath();
  context.moveTo(x - 4 * scale, y);
  context.lineTo(x - 8 * scale + stride, y + 18 * scale);
  context.moveTo(x + 4 * scale, y);
  context.lineTo(x + 8 * scale - stride, y + 18 * scale);
  context.stroke();
  context.fillStyle = skin;
  context.beginPath();
  context.arc(x, y - 34 * scale, 8 * scale, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = entity.variant === 'straight' ? '#21130c' : entity.variant === 'wavy' ? '#3f2417' : '#111827';
  const hairCount = entity.variant === 'straight' ? 3 : entity.variant === 'older' ? 4 : 5;
  for (let i = -Math.floor(hairCount / 2); i <= Math.floor(hairCount / 2); i += 1) {
    context.beginPath();
    context.arc(x + i * 4 * scale, y - 41 * scale + Math.sin(time * 0.003 + i) * scale, entity.variant === 'straight' ? 3 * scale : 4.4 * scale, 0, Math.PI * 2);
    context.fill();
  }
  if (entity.variant === 'older') {
    context.strokeStyle = '#e5e7eb';
    context.lineWidth = 1.4 * scale;
    context.beginPath();
    context.moveTo(x + 10 * scale, y - 12 * scale);
    context.lineTo(x + 14 * scale, y + 18 * scale);
    context.stroke();
  }
};

const drawPlayer = (
  context: CanvasRenderingContext2D,
  choice: JeruselaChoice,
  x: number,
  y: number,
  scale: number,
  time: number
) => {
  const glow = context.createRadialGradient(x, y - 40 * scale, 0, x, y - 40 * scale, 110 * scale);
  glow.addColorStop(0, 'rgba(255, 250, 180, 0.72)');
  glow.addColorStop(0.42, 'rgba(34, 211, 238, 0.2)');
  glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y - 40 * scale, 110 * scale, 0, Math.PI * 2);
  context.fill();

  const entity: EnvironmentEntity = {
    id: 'player',
    kind: 'human',
    x: 0,
    y: 0,
    z: 1,
    speed: 0,
    scale,
    motion: 'walk',
    palette: choice === 'woman' ? ['#8f5f46', '#fff1c2', '#14b8a6'] : ['#5b3525', '#dff7ff', '#60a5fa'],
    variant: choice === 'woman' ? 'curly' : 'wavy',
  };
  drawHuman(context, x, y, scale * 1.42, entity, time);
};

const drawEntity = (
  context: CanvasRenderingContext2D,
  entity: EnvironmentEntity,
  width: number,
  height: number,
  time: number,
  camera: number
) => {
  const drift = Math.sin(time * 0.0007 + entity.x * 9) * entity.speed * 80;
  const x = ((entity.x * width + drift - camera * entity.z * 120) % (width + 140) + width + 70) % (width + 140) - 70;
  const y = entity.y * height + Math.sin(time * 0.0015 + entity.z) * 8 * entity.scale;
  const scale = entity.scale * (0.72 + entity.z * 0.45);

  if (entity.kind === 'human') {
    drawHuman(context, x, y, scale, entity, time);
    return;
  }

  if (entity.kind === 'bird') {
    context.strokeStyle = entity.palette[0];
    context.lineWidth = 2 * scale;
    const wing = Math.sin(time * 0.007 + entity.x) * 7 * scale;
    context.beginPath();
    context.moveTo(x - 16 * scale, y + wing);
    context.quadraticCurveTo(x, y - 8 * scale, x + 16 * scale, y - wing);
    context.stroke();
    return;
  }

  if (entity.kind === 'aquatic') {
    context.fillStyle = entity.palette[0];
    context.beginPath();
    context.ellipse(x, y, 14 * scale, 5 * scale, Math.sin(time * 0.002) * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = entity.palette[1];
    context.beginPath();
    context.moveTo(x - 14 * scale, y);
    context.lineTo(x - 24 * scale, y - 6 * scale);
    context.lineTo(x - 24 * scale, y + 6 * scale);
    context.closePath();
    context.fill();
    return;
  }

  if (entity.kind === 'terrestrial') {
    context.fillStyle = entity.palette[0];
    context.beginPath();
    context.ellipse(x, y, 22 * scale, 10 * scale, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + 18 * scale, y - 8 * scale, 7 * scale, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = entity.palette[1];
    context.lineWidth = 2 * scale;
    context.beginPath();
    context.moveTo(x - 10 * scale, y + 8 * scale);
    context.lineTo(x - 14 * scale, y + 23 * scale);
    context.moveTo(x + 9 * scale, y + 8 * scale);
    context.lineTo(x + 14 * scale, y + 23 * scale);
    context.stroke();
    return;
  }

  context.strokeStyle = entity.palette[0];
  context.lineWidth = 2 * scale;
  for (let blade = 0; blade < 12; blade += 1) {
    const offset = (blade - 6) * 5 * scale;
    const sway = Math.sin(time * 0.002 + blade) * 7 * scale;
    context.beginPath();
    context.moveTo(x + offset, y + 28 * scale);
    context.quadraticCurveTo(x + offset + sway, y, x + offset + sway * 0.5, y - 36 * scale);
    context.stroke();
  }
};

const JeruselaVoidCanvas: React.FC<{
  phase: JeruselaPhase;
  player: PlayerState | null;
  reducedMotion: boolean;
  getAudioEnergy: () => number;
}> = ({ phase, player, reducedMotion, getAudioEnergy }) => {
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

    const drawArrival = (time: number) => {
      const progress = Math.min(1, (time - start) / 6200);
      const camera = reducedMotion ? 0.28 : progress * 0.5;
      const horizon = height * worldConfig.horizon;

      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#07111f');
      sky.addColorStop(0.34, '#155e75');
      sky.addColorStop(0.62, '#3f6212');
      sky.addColorStop(1, '#092018');
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      context.fillStyle = 'rgba(255, 246, 180, 0.82)';
      context.beginPath();
      context.arc(width * 0.74, height * 0.18, 42, 0, Math.PI * 2);
      context.fill();

      for (let ridge = 0; ridge < 3; ridge += 1) {
        context.fillStyle = `rgba(${14 + ridge * 12}, ${38 + ridge * 26}, ${49 + ridge * 18}, ${0.68 - ridge * 0.12})`;
        context.beginPath();
        context.moveTo(0, horizon + ridge * 34);
        for (let x = 0; x <= width; x += 90) {
          context.lineTo(x, horizon + Math.sin(x * 0.012 + ridge) * 32 + ridge * 38);
        }
        context.lineTo(width, height);
        context.lineTo(0, height);
        context.closePath();
        context.fill();
      }

      const water = context.createLinearGradient(0, height * 0.78, 0, height);
      water.addColorStop(0, 'rgba(34, 211, 238, 0.28)');
      water.addColorStop(1, 'rgba(8, 47, 73, 0.72)');
      context.fillStyle = water;
      context.beginPath();
      context.ellipse(width * 0.83, height * 0.89, width * 0.26, height * 0.11, -0.08, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      context.lineWidth = 2;
      for (let wave = 0; wave < 4; wave += 1) {
        context.beginPath();
        for (let x = width * 0.62; x <= width; x += 18) {
          const y = height * (0.83 + wave * 0.028) + Math.sin(time * 0.002 + x * 0.03 + wave) * 4;
          if (x === width * 0.62) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }

      worldConfig.entities
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((entity) => drawEntity(context, entity, width, height, time, camera));

      const playerX = width * (worldConfig.player.x + (reducedMotion ? 0 : Math.sin(time * 0.00035) * 0.012));
      const playerY = height * worldConfig.player.y + Math.max(0, 1 - progress) * height * 0.12;
      if (player) drawPlayer(context, player.form, playerX, playerY, worldConfig.player.scale, time);

      const mechanicsProgress = Math.min(1, Math.max(0, (time - start - 2300) / 900));
      if (mechanicsProgress > 0) {
        context.globalAlpha = mechanicsProgress;
        context.textAlign = 'center';
        context.font = `900 ${Math.max(13, Math.min(18, width * 0.018))}px Orbitron, sans-serif`;
        context.fillStyle = '#cffafe';
        context.shadowColor = 'rgba(8, 145, 178, 0.9)';
        context.shadowBlur = 18;
        context.fillText('Core Rules / Spatial Mechanics', playerX, playerY - 146 * worldConfig.player.scale);
        context.font = `700 ${Math.max(12, Math.min(16, width * 0.014))}px Inter, sans-serif`;
        context.fillStyle = '#f8fafc';
        context.fillText('Move through darkness by how you serve, shine, and endure.', playerX, playerY - 122 * worldConfig.player.scale);
        context.shadowBlur = 0;
        context.globalAlpha = 1;
      }

      worldConfig.rules.forEach((rule) => {
        const ruleProgress = Math.min(1, Math.max(0, (time - start - rule.delay) / 800));
        if (ruleProgress <= 0) return;
        context.globalAlpha = ruleProgress;
        context.font = `900 ${Math.max(18, width * 0.024)}px Orbitron, sans-serif`;
        context.textAlign = 'center';
        context.fillStyle = '#f8fafc';
        context.shadowColor = 'rgba(125, 211, 252, 0.8)';
        context.shadowBlur = 24;
        context.fillText(rule.label, width * rule.x, height * rule.y);
        context.shadowBlur = 0;
        context.globalAlpha = 1;
      });
    };

    const draw = (time: number) => {
      if (phase === 'arrival') drawArrival(time);
      else drawVoid(time);
      animation = window.requestAnimationFrame(draw);
    };

    resize();
    draw(start);
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(animation);
      window.removeEventListener('resize', resize);
    };
  }, [getAudioEnergy, phase, player, reducedMotion]);

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

    start();
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
      audioLayerRef.current?.whisperChosen();
      setPhase('arrival');
      return;
    }

    setPhase('gated');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#010309] text-white">
      <JeruselaVoidCanvas
        phase={phase}
        player={player}
        reducedMotion={reducedMotion}
        getAudioEnergy={() => audioLayerRef.current?.getEnergy() || 0}
      />

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
            {audioReady ? 'Signal Active' : 'Signal Waiting'}
          </div>
        </div>

        <section className="flex flex-1 items-center justify-center px-4 pb-16 pt-8">
          <div className="flex min-h-[20rem] w-full max-w-4xl flex-col items-center justify-center text-center">
            <div
              className={`transition duration-1000 ${
                choiceVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
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

            {phase === 'arrival' && player && (
              <p className="sr-only">
                {player.name} enters Jerusela as the {player.form}. Core Rules and Spatial Mechanics begin in the world: Serve, Shine, Endure.
              </p>
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
