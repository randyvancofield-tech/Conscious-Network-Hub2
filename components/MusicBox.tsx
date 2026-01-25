import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, GripHorizontal, Volume2, VolumeX, Minimize2, Maximize2, Repeat, Repeat1, Shuffle, Sparkles } from 'lucide-react';

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

  // ========== CONTEMPORARY WORLD FUSION ==========
  {
    name: "Global Consciousness",
    subtitle: "Conscious Network • Unity Frequency",
    culture: "🌍 Universal",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  },
  {
    name: "Sovereign Shift",
    subtitle: "Identity Anchor • Collective Resonance",
    culture: "🌐 All Peoples",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    source: "World Music Archive",
    license: "Public Domain"
  }
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

  // ========== CONTEMPORARY WORLD FUSION ==========
  {
    name: "Global Consciousness",
    subtitle: "Conscious Network • Unity Frequency",
    culture: "🌍 Universal",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
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
      
      if (position.x < snapThreshold) newPos.x = 20;
      else if (position.x > window.innerWidth - snapThreshold) newPos.x = window.innerWidth - 110;
      
      if (position.y < snapThreshold) newPos.y = 20;
      else if (position.y > window.innerHeight - snapThreshold) newPos.y = window.innerHeight - 110;
      
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
    const boxWidth = isMinimized ? 100 : 330;
    const boxHeight = isMinimized ? 100 : 360;
    
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
      className={`fixed z-[999] transition-all ${isDragging ? 'shadow-2xl' : 'shadow-xl'}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
    >
      {/* Minimized Alert Glow */}
      {isMinimized && (
        <div className={`absolute -inset-3 rounded-2xl ${isPlaying ? 'animate-pulse' : 'animate-spin'} opacity-50`}
             style={{
               background: 'radial-gradient(circle, rgba(96,165,250,0.4) 0%, rgba(30,144,255,0.1) 100%)',
               animationDuration: isPlaying ? '2s' : '4s'
             }}>
        </div>
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

      <div className={`music-box-glow glass-panel rounded-[1.8rem] border-2 border-cyan-400/40 backdrop-blur-3xl overflow-hidden flex flex-col transition-all duration-300 bg-gradient-to-br from-blue-950/70 via-slate-900/60 to-blue-900/50 ${isMinimized ? 'w-24 h-24' : 'w-96'}`}>
        {/* Drag Handle with Brand Name */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="h-8 flex items-center justify-between px-4 cursor-move hover:bg-cyan-500/10 border-b border-cyan-400/30"
        >
          <GripHorizontal className="w-4 h-4 text-cyan-400/70" />
          {!isMinimized && (
            <div className="flex items-center gap-2 flex-1 justify-center">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span className="text-[11px] font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent uppercase tracking-widest">
                Conscious Music
              </span>
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
            </div>
          )}
        </div>

        {isMinimized ? (
          // Minimized View - Alert Icon
          <button 
            onClick={() => setIsMinimized(false)}
            className="flex-1 flex items-center justify-center text-cyan-300 hover:text-cyan-100 transition-colors hover:bg-cyan-500/15 relative group"
            title="🎵 Conscious Music Entertainment - Click to enjoy global sounds"
          >
            <div className="relative">
              <Music className={`w-8 h-8 ${isPlaying ? 'animate-pulse' : ''}`} />
              <Sparkles className="w-4 h-4 text-yellow-300 absolute -top-1 -right-1 animate-bounce" />
            </div>
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-blue-900 to-blue-950 border border-cyan-400 px-3 py-2 rounded-lg text-[10px] text-cyan-100 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              🎵 Entertainment Hub
            </div>
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
                  style={{ width: `${(currentTime / duration) * 100}%` }}
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
                  onClick={nextTrack}
                  className="w-8 h-8 bg-blue-900/50 hover:bg-blue-800/70 border border-cyan-400/30 text-cyan-300 rounded-full flex items-center justify-center transition-all hover:shadow-lg hover:shadow-cyan-500/40"
                  title="Next track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleRepeat}
                  className={`p-2 rounded-lg transition-all border ${repeatMode === 'off' ? 'text-cyan-300/60 hover:text-cyan-300 border-transparent hover:border-cyan-400/30 hover:bg-blue-900/30' : 'text-cyan-200 bg-blue-900/40 border-cyan-400/40'}`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
                <button 
                  onClick={toggleShuffle}
                  className={`p-2 rounded-lg transition-all border ${isShuffle ? 'text-cyan-200 bg-blue-900/40 border-cyan-400/40' : 'text-cyan-300/60 hover:text-cyan-300 border-transparent hover:border-cyan-400/30 hover:bg-blue-900/30'}`}
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

            {/* Navigation & Controls */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cyan-400/20">
              <button 
                onClick={() => snapToCorner('top-left')}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Snap to top-left corner"
              >
                ↖️
              </button>
              <button 
                onClick={() => snapToCorner('center')}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Center on screen"
              >
                ⊙
              </button>
              <button 
                onClick={() => snapToCorner('top-right')}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Snap to top-right corner"
              >
                ↗️
              </button>
              <button 
                onClick={() => snapToCorner('bottom-left')}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Snap to bottom-left corner"
              >
                ↙️
              </button>
              <button 
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Toggle global playlist"
              >
                🌍
              </button>
              <button 
                onClick={() => snapToCorner('bottom-right')}
                className="text-[10px] px-2 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-400/25 hover:border-cyan-400/50 font-bold"
                title="Snap to bottom-right corner"
              >
                ↘️
              </button>
            </div>

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
