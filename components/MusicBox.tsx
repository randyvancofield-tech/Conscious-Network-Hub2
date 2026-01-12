
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, Music, GripHorizontal, Volume2, VolumeX, Minimize2 } from 'lucide-react';

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
  }
];

const MusicBox: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(TRACKS[currentTrack].url);
      audioRef.current.loop = true;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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

  const nextTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTrack((prev) => (prev + 1) % TRACKS.length);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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

  return (
    <div 
      className={`fixed z-[999] transition-shadow ${isDragging ? 'shadow-2xl' : 'shadow-lg'}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
    >
      <div className={`glass-panel rounded-[1.5rem] border border-white/10 backdrop-blur-3xl overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'w-14 h-14' : 'w-64'}`}>
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="h-6 flex items-center justify-center cursor-move hover:bg-white/5 border-b border-white/5"
        >
          <GripHorizontal className="w-4 h-4 text-slate-500" />
        </div>

        {isMinimized ? (
          <button 
            onClick={() => setIsMinimized(false)}
            className="flex-1 flex items-center justify-center text-blue-400 hover:text-white transition-colors"
          >
            <Music className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
          </button>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400">
                  <Music className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{TRACKS[currentTrack].name}</h4>
                  <p className="text-[8px] text-slate-500 truncate uppercase">{TRACKS[currentTrack].subtitle}</p>
                </div>
              </div>
              <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/5 rounded-lg text-slate-500">
                <Minimize2 className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={togglePlay}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-90"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button 
                  onClick={nextTrack}
                  className="w-7 h-7 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center transition-all"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              <button 
                onClick={toggleMute}
                className="p-1.5 text-slate-500 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicBox;
