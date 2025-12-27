
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Globe, Brain, Shield, ExternalLink, Loader2, User } from 'lucide-react';
import { chatWithEthicalAI, getEthicalAIAdvice, GroundingChunk } from '../services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  type: 'reasoning' | 'search';
  sources?: GroundingChunk[];
}

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIChatbot: React.FC<AIChatbotProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: "Neural link established. I am the Conscious Network Hub Intelligence. How can I assist your journey toward autonomy today?",
      type: 'reasoning'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'reasoning' | 'search'>('reasoning');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      let aiResponseText = '';
      let sources: GroundingChunk[] = [];

      if (mode === 'search') {
        const result = await getEthicalAIAdvice(input);
        aiResponseText = result.text || "No specific data found.";
        sources = result.groundingChunks || [];
      } else {
        aiResponseText = await chatWithEthicalAI(input) || "Neural link interrupted.";
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiResponseText,
        type: mode,
        sources: sources.length > 0 ? sources : undefined
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
            <h2 className="text-xl font-bold text-white leading-none">Ethical AI Consult</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Node Synced</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="px-6 py-4 flex gap-2 border-b border-white/5">
        <button 
          onClick={() => setMode('reasoning')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${mode === 'reasoning' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-900/20' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
        >
          <Sparkles className="w-3 h-3" /> DEEP REASONING
        </button>
        <button 
          onClick={() => setMode('search')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${mode === 'search' ? 'bg-teal-600/20 border-teal-500 text-teal-400 shadow-lg shadow-teal-900/20' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
        >
          <Globe className="w-3 h-3" /> SEARCH GROUNDING
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`mt-1 p-2 rounded-lg ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600/20 border border-blue-500/20'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Shield className="w-4 h-4 text-blue-400" />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'glass-panel text-slate-200 rounded-tl-none border-blue-500/10'}`}>
                {msg.text}
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Grounded Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        source.web && (
                          <a 
                            key={idx} 
                            href={source.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1 text-blue-300 transition-colors"
                          >
                            {source.web.title || 'Source'} <ExternalLink className="w-2 h-2" />
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
                {mode === 'search' ? 'Interrogating decentralized data layers...' : 'Thinking through ethical frameworks...'}
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
            placeholder={mode === 'reasoning' ? "Ask about autonomy, ethics, or the platform..." : "Search for recent news or decentralized facts..."}
            className="w-full pl-6 pr-14 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 rounded-xl text-white transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-3 uppercase tracking-widest font-medium">
          Secured via AES-256 Neural Relay
        </p>
      </form>
    </div>
  );
};

export default AIChatbot;
