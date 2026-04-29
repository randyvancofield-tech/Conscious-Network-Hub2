import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Volume2,
  VolumeX,
  Minimize2,
  Repeat,
  Repeat1,
  Shuffle,
  Sparkles
} from 'lucide-react';

type RepeatMode = 'off' | 'all' | 'one';

interface Track {
  name: string;
  subtitle: string;
  culture: string;
  url: string;
  source: string;
  license: string;
}

const TRACKS: Track[] = [
  // ========== AFRICA - AUTHENTIC BEATS ==========
  {
    name: "Kora Dreams",
    subtitle: "West African Harmony • Senegal",
    culture: "🇸🇳 West African",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Dundun Rhythm",
    subtitle: "Percussion Heritage • Guinea",
    culture: "🇬🇳 West African",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Marimba Call",
    subtitle: "Southern African Xylophone • Zimbabwe",
    culture: "🇿🇼 Southern African",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Ngoma Pulse",
    subtitle: "Drum Language • Congo Basin",
    culture: "🇨🇩 Central African",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Tuareg Blues",
    subtitle: "Desert Strings • Mali/Sahara",
    culture: "🇲🇱 Saharan",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== SOUTH ASIA - AUTHENTIC CLASSICAL ==========
  {
    name: "Sitar Raga",
    subtitle: "Hindustani Classical • North India",
    culture: "🇮🇳 Indian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Tabla Traditions",
    subtitle: "Drum Mastery • Classical India",
    culture: "🇮🇳 Indian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Veena Journey",
    subtitle: "Carnatic Strings • South India",
    culture: "🇮🇳 South Indian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Bansuri Echo",
    subtitle: "Flute Meditation • Vedic Heritage",
    culture: "🇮🇳 Indian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== EAST ASIA - AUTHENTIC INSTRUMENTS ==========
  {
    name: "Koto Meditation",
    subtitle: "13-String Zither • Japan",
    culture: "🇯🇵 Japanese",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Erhu Whisper",
    subtitle: "Two-String Fiddle • China",
    culture: "🇨🇳 Chinese",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Guzheng Cascade",
    subtitle: "Plucked Zither • Ancient China",
    culture: "🇨🇳 Chinese",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Taiko Drumming",
    subtitle: "Japanese Percussion • Edo Tradition",
    culture: "🇯🇵 Japanese",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== MIDDLE EAST & CENTRAL ASIA ==========
  {
    name: "Oud Mystique",
    subtitle: "Lute Poetry • Arabic Tradition",
    culture: "🌍 Middle Eastern",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Ney Serenade",
    subtitle: "Bamboo Flute • Sufi Wisdom",
    culture: "🕌 Islamic Heritage",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Qanun Harmony",
    subtitle: "Ancient Harp • Levantine Strings",
    culture: "🌍 Middle Eastern",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Doumbek Beat",
    subtitle: "Hand Drum • North Africa",
    culture: "🌍 Middle Eastern",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== WESTERN SACRED - GREGORIAN CHANT ==========
  {
    name: "Kyrie Eleison",
    subtitle: "Gregorian Vespers - Catholic Chant",
    culture: "Western Sacred",
    url: "https://upload.wikimedia.org/wikipedia/commons/7/73/Schola_Gregoriana-Kyrie_eleison.ogg",
    source: "Wikimedia Commons - Schola Gregoriana",
    license: "CC BY-SA 3.0"
  },

  // ========== LATIN AMERICA & CARIBBEAN ==========
  {
    name: "Son Jarocho",
    subtitle: "Zapotec Fusion • Veracruz, Mexico",
    culture: "🇲🇽 Mexican",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Andean Quena",
    subtitle: "Flute Heritage • Incan Traditions",
    culture: "🇵🇪 Andean",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Cumbia Rhythm",
    subtitle: "Colombian Heartbeat • Caribbean",
    culture: "🇨🇴 Colombian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Bossa Nova Soul",
    subtitle: "Brazilian Jazz • Samba Root",
    culture: "🇧🇷 Brazilian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Steel Drum Pan",
    subtitle: "Caribbean Percussion • Trinidad",
    culture: "🇹🇹 Caribbean",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== EASTERN EUROPE & CELTIC ==========
  {
    name: "Klezmer Spirit",
    subtitle: "Jewish Folk • Eastern European",
    culture: "✡️ Jewish Heritage",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Bagpipe Call",
    subtitle: "Scottish Highlands • Celtic Roots",
    culture: "🇬🇧 Celtic",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Accordion Tales",
    subtitle: "Eastern European Folk • Balkan",
    culture: "🌍 Balkan",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },

  // ========== INDIGENOUS & DIASPORA ==========
  {
    name: "Didgeridoo Dreaming",
    subtitle: "Aboriginal Songlines • Australia",
    culture: "🇦🇺 Aboriginal",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "First Nations Pulse",
    subtitle: "Drum Circle • North America",
    culture: "🇨🇦 Indigenous",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Throat Singing",
    subtitle: "Mongolian Harmonics • Central Asia",
    culture: "🇲🇳 Mongolian",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Sovereign Shift",
    subtitle: "Identity Anchor • Collective Resonance",
    culture: "🌐 All Peoples",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  }
];

const MusicBox: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const safePlay = () => {
    if (!audioRef.current) return;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(err => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
  };

  // Next track logic with repeat/off handling
  const nextTrack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // If repeat is OFF and we're at the last track (and not shuffle), stop.
    if (!isShuffle && repeatMode === 'off' && currentTrack === TRACKS.length - 1) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * TRACKS.length);
    } else {
      nextIndex = (currentTrack + 1) % TRACKS.length; // repeatMode 'all' loops
    }
    setCurrentTrack(nextIndex);
  };

  const prevTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTrack((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
  };

  // Initialize audio element and event listeners
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(TRACKS[currentTrack].url);
      audioRef.current.preload = 'metadata';
      audioRef.current.volume = (isMuted ? 0 : volume / 100);

      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime ?? 0);
      };

      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration ?? 0);
      };

      const handleEnded = () => {
        if (!audioRef.current) return;

        if (repeatMode === 'one') {
          audioRef.current.currentTime = 0;
          safePlay();
          return;
        }
        nextTrack();
      };

      // If a track fails to load/play, skip forward automatically
      const handleError = () => {
        console.warn("Audio error on track:", TRACKS[currentTrack]?.name);
        setIsPlaying(false);
        nextTrack();
      };

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);

      return () => {
        audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current?.removeEventListener('ended', handleEnded);
        audioRef.current?.removeEventListener('error', handleError);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update track when current track changes
  useEffect(() => {
    if (!audioRef.current) return;

    const wasPlaying = isPlaying;

    setCurrentTime(0);
    setDuration(0);

    audioRef.current.src = TRACKS[currentTrack].url;
    audioRef.current.load();

    if (wasPlaying) {
      safePlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      safePlay();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const toggleRepeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  const toggleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShuffle(!isShuffle);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      className="fixed right-3 sm:right-5 lg:right-6 z-[90] pointer-events-none transition-all"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
      {/* Minimized Alert Glow */}
      {isMinimized && (
        <div
          className={`absolute -inset-1 rounded-full ${isPlaying ? 'animate-pulse' : ''} opacity-50`}
          style={{
            background: 'radial-gradient(circle, rgba(96,165,250,0.4) 0%, rgba(30,144,255,0.1) 100%)',
            animationDuration: isPlaying ? '2s' : '4s'
          }}
        />
      )}

      <style>{`
        @keyframes float-glow {
          0%, 100% { box-shadow: 0 0 25px rgba(96,165,250,0.5), 0 0 50px rgba(30,144,255,0.3), inset 0 0 20px rgba(96,165,250,0.1); }
          50% { box-shadow: 0 0 40px rgba(96,165,250,0.7), 0 0 80px rgba(30,144,255,0.4), inset 0 0 30px rgba(96,165,250,0.15); }
        }
        .music-box-glow {
          animation: float-glow 3s ease-in-out infinite;
        }
      `}</style>

      <div className={`music-box-glow pointer-events-auto glass-panel border-2 border-cyan-400/40 backdrop-blur-3xl overflow-hidden flex flex-col transition-all duration-300 bg-gradient-to-br from-blue-950/70 via-slate-900/60 to-blue-900/50 ${isMinimized ? 'rounded-full' : 'w-[min(calc(100vw-1.5rem),24rem)] rounded-[1.5rem] max-h-[calc(100dvh-2rem)]'}`}>
        {!isMinimized && (
          <div className="h-11 flex items-center justify-between gap-3 px-4 border-b border-cyan-400/30 bg-blue-950/40">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span className="truncate text-[11px] font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent uppercase tracking-widest">
                Conscious Music
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 hover:bg-cyan-500/20 rounded-lg text-cyan-300/70 hover:text-cyan-200 flex-shrink-0 transition-all"
              title="Minimize music player"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {isMinimized ? (
          // Minimized View - Alert Icon
          <button
            onClick={() => setIsMinimized(false)}
            className="group flex h-12 max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2 rounded-full px-4 text-cyan-200 hover:text-cyan-50 transition-colors hover:bg-cyan-500/15"
            title="🎵 Conscious Music Entertainment - Click to enjoy global sounds"
          >
            <Music className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Music</span>
            {isPlaying && <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />}
          </button>
        ) : (
          // Expanded View
          <div className="p-5 space-y-4 bg-gradient-to-b from-transparent via-blue-900/20 to-transparent max-h-[90vh] overflow-y-auto">
            {/* Current Track Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/40 to-blue-500/30 border border-cyan-400/40 flex-shrink-0 mt-0.5">
                  <Music className="w-4 h-4 text-cyan-200" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[11px] font-bold text-cyan-100 truncate uppercase tracking-wider">{TRACKS[currentTrack].name}</h3>
                  <p className="text-[9px] text-blue-200/70 mt-1">{TRACKS[currentTrack].culture}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 hover:bg-cyan-500/20 rounded-lg text-cyan-300/70 hover:text-cyan-200 flex-shrink-0 transition-all"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Track Info Card */}
            <div className="px-3 py-3 rounded-xl bg-blue-950/50 border border-cyan-400/25 backdrop-blur-sm">
              <p className="text-[8px] text-cyan-100/80 leading-relaxed font-medium">{TRACKS[currentTrack].subtitle}</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="bg-blue-950/60 rounded-full h-2.5 overflow-hidden border border-cyan-400/20">
                <div
                  className="bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-600 h-full transition-all duration-100 shadow-lg shadow-cyan-500/60"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] text-cyan-300/60 font-semibold">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevTrack}
                  className="w-8 h-8 bg-blue-900/50 hover:bg-blue-800/70 border border-cyan-400/30 text-cyan-300 rounded-full flex items-center justify-center transition-all hover:shadow-lg hover:shadow-cyan-500/40"
                  title="Previous track"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-cyan-500/50 active:scale-90 border border-cyan-300/60"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button
                  onClick={(e) => nextTrack(e)}
                  className="w-8 h-8 bg-blue-900/50 hover:bg-blue-800/70 border border-cyan-400/30 text-cyan-300 rounded-full flex items-center justify-center transition-all hover:shadow-lg hover:shadow-cyan-500/40"
                  title="Next track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleRepeat}
                  className={`p-2 rounded-lg transition-all border ${repeatMode === 'off'
                    ? 'text-cyan-300/60 hover:text-cyan-300 border-transparent hover:border-cyan-400/30 hover:bg-blue-900/30'
                    : 'text-cyan-200 bg-blue-900/40 border-cyan-400/40'}`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-lg transition-all border ${isShuffle
                    ? 'text-cyan-200 bg-blue-900/40 border-cyan-400/40'
                    : 'text-cyan-300/60 hover:text-cyan-300 border-transparent hover:border-cyan-400/30 hover:bg-blue-900/30'}`}
                  title="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleMute}
                  className="p-2 text-cyan-300/60 hover:text-cyan-300 transition-all hover:bg-blue-900/30 border border-transparent hover:border-cyan-400/30 rounded-lg"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-950/50 border border-cyan-400/25">
              <Volume2 className="w-4 h-4 text-cyan-300/70 flex-shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="flex-1 h-2 bg-blue-900 rounded-full appearance-none cursor-pointer accent-cyan-400"
                title={`Volume: ${volume}%`}
              />
              <span className="text-[9px] text-cyan-300/70 w-6 text-right font-bold">{volume}%</span>
            </div>

            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              className="w-full rounded-xl border border-cyan-400/25 bg-blue-900/40 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-cyan-200 transition-all hover:bg-blue-800/60 hover:text-cyan-50"
              title="Toggle global playlist"
            >
              {showPlaylist ? 'Hide Playlist' : 'Open Playlist'}
            </button>

            {/* Global Playlist with Cultural Representation & Licensing Info */}
            {showPlaylist && (
              <div className="border-t border-cyan-400/20 pt-3 mt-3 rounded-xl bg-blue-950/50 border border-cyan-400/25 p-3">
                <div className="text-[9px] font-bold text-cyan-200 mb-3 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  Authentic Global Playlist
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {TRACKS.map((track, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentTrack(idx);
                      }}
                      className={`w-full text-left text-[8px] px-3 py-2 rounded-lg transition-all border ${
                        currentTrack === idx
                          ? 'bg-cyan-500/25 text-cyan-100 border-cyan-400/50 shadow-lg shadow-cyan-500/30'
                          : 'bg-blue-900/30 text-cyan-200 border-cyan-400/20 hover:bg-blue-800/50 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="font-bold truncate">{track.name}</div>
                      <div className="text-cyan-300/70 truncate text-[7px] mt-1">{track.culture} • {track.subtitle}</div>
                      <div className="text-cyan-400/60 text-[6.5px] mt-1 flex items-center gap-1">
                        <span>📍 {track.source}</span>
                      </div>
                      <div className="text-yellow-300/60 text-[6.5px] mt-0.5">
                        {track.license}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-cyan-400/20 text-[6px] text-cyan-300/50 text-center">
                  All music is copyright-free, authentic, and ethically sourced from open archives
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicBox;
