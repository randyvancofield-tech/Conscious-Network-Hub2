
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Globe, Brain, Shield, ExternalLink, Loader2, User, MapPin, ImageIcon, Maximize, Square } from 'lucide-react';
import { fastWisdomChat, getWisdomSearch, getWisdomMaps, generateWisdomImage, GroundingChunk } from '../services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  type: 'reasoning' | 'search' | 'maps' | 'image';
  sources?: GroundingChunk[];
  imageUrl?: string;
}

interface WisdomNodeProps {
  isOpen: boolean;
  onClose: () => void;
}

const WisdomNode: React.FC<WisdomNodeProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: "Wisdom Node initialized. I am the synthesis of the Conscious Network Hub's intelligence. How shall we expand your perspective?",
      type: 'reasoning'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'reasoning' | 'search' | 'maps' | 'image'>('reasoning');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const aspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      type: mode
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let aiText = '';
      let sources: GroundingChunk[] = [];
      let imageUrl = '';

      if (mode === 'search') {
        const result = await getWisdomSearch(input);
        aiText = result.text || "No specific data found.";
        sources = result.groundingChunks || [];
      } else if (mode === 'maps') {
        const result = await getWisdomMaps(input);
        aiText = result.text || "Location data unreachable.";
        sources = result.groundingChunks || [];
      } else if (mode === 'image') {
        const url = await generateWisdomImage(input, aspectRatio);
        if (url) {
          imageUrl = url;
          aiText = `Generated visualization for: "${input}" [${aspectRatio}]`;
        } else {
          aiText = "Visualization synthesis failed.";
        }
      } else {
        aiText = await fastWisdomChat(input) || "Neural link interrupted.";
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiText,
        type: mode,
        sources: sources.length > 0 ? sources : undefined,
        imageUrl: imageUrl || undefined
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[150] w-full max-w-xl bg-[#05070a]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-blue-600/5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none">Wisdom Node</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Multimodal Active</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="px-6 py-4 grid grid-cols-4 gap-2 border-b border-white/5 bg-black/20">
        {[
          { id: 'reasoning', icon: <Sparkles className="w-3 h-3" />, label: 'Fast' },
          { id: 'search', icon: <Globe className="w-3 h-3" />, label: 'Search' },
          { id: 'maps', icon: <MapPin className="w-3 h-3" />, label: 'Maps' },
          { id: 'image', icon: <ImageIcon className="w-3 h-3" />, label: 'Create' }
        ].map((m) => (
          <button 
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${mode === m.id ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Optional Aspect Ratio Selector for Image mode */}
      {mode === 'image' && (
        <div className="px-6 py-3 bg-blue-600/5 border-b border-white/5 flex items-center gap-4">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Square className="w-3 h-3" /> Aspect Ratio
          </span>
          <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar py-1">
            {aspectRatios.map(ar => (
              <button
                key={ar}
                onClick={() => setAspectRatio(ar)}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold border transition-all whitespace-nowrap ${aspectRatio === ar ? 'bg-blue-500 border-blue-400 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}
              >
                {ar}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`mt-1 p-2 rounded-lg ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600/20 border border-blue-500/20'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Brain className="w-4 h-4 text-blue-400" />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none shadow-lg' : 'glass-panel text-slate-200 rounded-tl-none border-blue-500/10 shadow-xl'}`}>
                {msg.text}
                
                {msg.imageUrl && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                    <img src={msg.imageUrl} alt="Generated Wisdom" className="w-full h-auto" />
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Grounded Intelligence
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        (source.web || source.maps) && (
                          <a 
                            key={idx} 
                            href={source.web?.uri || source.maps?.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1 text-blue-300 transition-colors"
                          >
                            {source.web?.title || source.maps?.title || 'Nexus Point'} <ExternalLink className="w-2 h-2" />
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="mt-1 p-2 rounded-lg bg-blue-600/20 border border-blue-500/20">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl text-sm text-slate-400 italic">
                {mode === 'search' ? 'Scanning digital ley lines...' : 
                 mode === 'maps' ? 'Triangulating place-based wisdom...' :
                 mode === 'image' ? 'Synthesizing visual manifestation...' :
                 'Tapping into the collective hub...'}
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-6 border-t border-white/10 bg-black/40">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'reasoning' ? "Quick query..." : 
              mode === 'search' ? "Search news or trends..." : 
              mode === 'maps' ? "Find locations or centers..." : 
              "Describe a visual concept..."
            }
            className="w-full pl-6 pr-14 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 font-medium"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 rounded-xl text-white transition-all shadow-xl"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            Secured via Wisdom Node v2.0
          </p>
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-teal-400" />
            <span className="text-[9px] text-teal-400 font-bold uppercase">Privacy Active</span>
          </div>
        </div>
      </form>
    </div>
  );
};

export default WisdomNode;
