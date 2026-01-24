
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, GripHorizontal, Volume2, VolumeX, Minimize2, Maximize2, Repeat, Repeat1, Shuffle } from 'lucide-react';

type RepeatMode = 'off' | 'all' | 'one';

const TRACKS = [
  {
    name: "Neural Link",
    subtitle: "Matrix Protocol",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    name: "Deep Discovery",
    subtitle: "Exploration Layer",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  },
  {
    name: "Sovereign Shift",
    subtitle: "Identity Anchor",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  },
  {
    name: "Ethereal Echoes",
    subtitle: "Consciousness Flow",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  },
  {
    name: "Harmonic Resonance",
    subtitle: "Frequency Sync",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
  },
  {
    name: "Digital Awakening",
    subtitle: "System Boot",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
  }
];

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

const MusicBox: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlist, setPlaylist] = useState<number[]>([...Array(TRACKS.length).keys()]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicBoxRef = useRef<HTMLDivElement | null>(null);

  // Initialize audio element and event listeners
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(TRACKS[currentTrack].url);
      audioRef.current.volume = volume / 100;
      
      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime ?? 0);
      };
      
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration ?? 0);
      };
      
      const handleEnded = () => {
        if (repeatMode === 'one') {
          audioRef.current?.play();
        } else {
          nextTrack();
        }
      };
      
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('ended', handleEnded);
      
      return () => {
        audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current?.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  // Update track when current track changes
  useEffect(() => {
    if (audioRef.current) {
      const wasPlaying = isPlaying;
      audioRef.current.src = TRACKS[currentTrack].url;
      audioRef.current.load();
      if (wasPlaying) {
        audioRef.current.play().catch(err => {
          console.warn("Autoplay blocked:", err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Snap to corners when minimized at edges
  useEffect(() => {
    if (isMinimized && !isDragging) {
      const snapThreshold = 100;
      const newPos = { ...position };
      
      // Snap horizontally
      if (position.x < snapThreshold) newPos.x = 20;
      else if (position.x > window.innerWidth - snapThreshold) newPos.x = window.innerWidth - 70;
      
      // Snap vertically
      if (position.y < snapThreshold) newPos.y = 20;
      else if (position.y > window.innerHeight - snapThreshold) newPos.y = window.innerHeight - 70;
      
      if (newPos.x !== position.x || newPos.y !== position.y) {
        setPosition(newPos);
      }
    }
  }, [isMinimized, isDragging, position]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Playback failed:", err);
          setIsPlaying(false);
        });
    }
  };

  const nextTrack = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * TRACKS.length);
    } else {
      nextIndex = (currentTrack + 1) % TRACKS.length;
    }
    setCurrentTrack(nextIndex);
  };

  const prevTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTrack((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const toggleRepeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const toggleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShuffle(!isShuffle);
  };

  const snapToCorner = (corner: CornerPosition) => {
    const padding = 20;
    const boxWidth = isMinimized ? 60 : 280;
    const boxHeight = isMinimized ? 60 : 300;
    
    const corners: Record<CornerPosition, { x: number; y: number }> = {
      'top-left': { x: padding, y: padding },
      'top-right': { x: window.innerWidth - boxWidth - padding, y: padding },
      'bottom-left': { x: padding, y: window.innerHeight - boxHeight - padding },
      'bottom-right': { x: window.innerWidth - boxWidth - padding, y: window.innerHeight - boxHeight - padding },
      'center': { x: (window.innerWidth - boxWidth) / 2, y: (window.innerHeight - boxHeight) / 2 }
    };
    
    setPosition(corners[corner]);
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setIsDragging(true);
    setDragOffset({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 300, clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 200, clientY - dragOffset.y))
      });
    };
    const handleUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, dragOffset]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div 
      ref={musicBoxRef}
      className={`fixed z-[999] transition-all ${isDragging ? 'shadow-2xl' : 'shadow-lg'}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
    >
      <div className={`glass-panel rounded-[1.5rem] border border-white/10 backdrop-blur-3xl overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'w-14 h-14' : 'w-72'}`}>
        {/* Drag Handle */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="h-6 flex items-center justify-center cursor-move hover:bg-white/5 border-b border-white/5"
        >
          <GripHorizontal className="w-4 h-4 text-slate-500" />
        </div>

        {isMinimized ? (
          // Minimized View
          <button 
            onClick={() => setIsMinimized(false)}
            className="flex-1 flex items-center justify-center text-blue-400 hover:text-white transition-colors hover:bg-white/5"
          >
            <Music className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
          </button>
        ) : (
          // Expanded View
          <div className="p-4 space-y-3">
            {/* Header with Title and Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 flex-shrink-0">
                  <Music className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{TRACKS[currentTrack].name}</h4>
                  <p className="text-[8px] text-slate-500 truncate uppercase">{TRACKS[currentTrack].subtitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMinimized(true)} 
                className="p-1 hover:bg-white/5 rounded-lg text-slate-500 flex-shrink-0"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={prevTrack}
                  className="w-6 h-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center transition-all text-xs"
                  title="Previous track"
                >
                  <SkipBack className="w-3 h-3" />
                </button>
                <button 
                  onClick={togglePlay}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-90"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button 
                  onClick={nextTrack}
                  className="w-6 h-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center transition-all"
                  title="Next track"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={toggleRepeat}
                  className={`p-1.5 rounded transition-all ${repeatMode === 'off' ? 'text-slate-500 hover:text-white' : 'text-blue-400 bg-blue-400/10'}`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
                <button 
                  onClick={toggleShuffle}
                  className={`p-1.5 rounded transition-all ${isShuffle ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-white'}`}
                  title="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button 
                  onClick={toggleMute}
                  className="p-1.5 text-slate-500 hover:text-white transition-all"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-slate-500" />
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-600"
                title={`Volume: ${volume}%`}
              />
              <span className="text-[8px] text-slate-400 w-6 text-right">{volume}%</span>
            </div>

            {/* Snap to Corners */}
            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/5">
              <button 
                onClick={() => snapToCorner('top-left')}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Snap to top-left"
              >
                ↖
              </button>
              <button 
                onClick={() => snapToCorner('center')}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Snap to center"
              >
                ⊙
              </button>
              <button 
                onClick={() => snapToCorner('top-right')}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Snap to top-right"
              >
                ↗
              </button>
              <button 
                onClick={() => snapToCorner('bottom-left')}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Snap to bottom-left"
              >
                ↙
              </button>
              <button 
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Toggle playlist"
              >
                📋
              </button>
              <button 
                onClick={() => snapToCorner('bottom-right')}
                className="text-[8px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                title="Snap to bottom-right"
              >
                ↘
              </button>
            </div>

            {/* Playlist Preview */}
            {showPlaylist && (
              <div className="border-t border-white/5 pt-2 mt-2 max-h-32 overflow-y-auto">
                <div className="text-[8px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Playlist</div>
                <div className="space-y-1">
                  {TRACKS.map((track, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentTrack(idx);
                      }}
                      className={`w-full text-left text-[8px] px-2 py-1 rounded transition-all ${
                        currentTrack === idx 
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold truncate">{track.name}</div>
                      <div className="text-slate-500 truncate">{track.subtitle}</div>
                    </button>
                  ))}
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
