
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, MessageSquare, Search, ShieldCheck, 
  Send, X, Sparkles, Globe, ArrowLeft,
  ChevronRight, MoreHorizontal, Smile, Paperclip,
  CheckCircle2, Lock, UserCheck, Smartphone, Info
} from 'lucide-react';
import { UserProfile } from '../types';

interface Member {
  id: string;
  name: string;
  role: string;
  age: number;
  location: string;
  bio: string;
  image: string;
  status: 'online' | 'offline';
  verified: boolean;
}

const STATIC_MEMBERS: Member[] = [
  { id: '1', name: 'Aarav Sharma', role: 'Blockchain Developer', age: 28, location: 'Mumbai, IN', bio: 'Building the future of decentralized protocols and trustless governance.', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200', status: 'online', verified: true },
  { id: '2', name: 'Sarah Jenkins', role: 'Wellness Advocate', age: 35, location: 'London, UK', bio: 'Healing trauma through community-led circles and somatic therapy.', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', status: 'online', verified: true },
  { id: '3', name: 'Marcus Thorne', role: 'Social Entrepreneur', age: 50, location: 'Atlanta, US', bio: 'Scaling impact through decentralized finance and minority-owned business nodes.', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', status: 'offline', verified: true },
  { id: '4', name: 'Amara Diop', role: 'Cultural Researcher', age: 31, location: 'Dakar, SN', bio: 'Preserving ancestral wisdom in digital archives using zero-knowledge proofs.', image: 'https://images.unsplash.com/photo-1567532939604-b6b5b0ad2f01?auto=format&fit=crop&q=80&w=200', status: 'online', verified: true },
  { id: '5', name: 'Yuki Tanaka', role: 'Philosophy Professor', age: 58, location: 'Tokyo, JP', bio: 'Exploring the Zen of the Conscious Network and the future of human learning.', image: 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?auto=format&fit=crop&q=80&w=200', status: 'online', verified: true },
  { id: '6', name: 'Zara Khan', role: 'Data Scientist', age: 27, location: 'Toronto, CA', bio: 'Privacy-preserving AI and data sovereignty for marginalized groups.', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200', status: 'online', verified: true }
];

const CommunityMembers: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [messages, setMessages] = useState<{[key: string]: {text: string, sender: 'me' | 'them', time: string}[]}>({});
  const [input, setInput] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>(STATIC_MEMBERS);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDynamicMembers = () => {
      const storedProfiles: UserProfile[] = JSON.parse(localStorage.getItem('hcn_profiles') || '[]');
      const activeUser: UserProfile | null = JSON.parse(localStorage.getItem('hcn_active_user') || 'null');

      const dynamicMembers: Member[] = storedProfiles.map(profile => ({
        id: profile.id,
        name: profile.name,
        role: `${profile.tier} Node`,
        age: 0,
        location: 'Decentralized Hub',
        bio: profile.bio || 'Mission statement established.',
        image: profile.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`,
        status: activeUser?.id === profile.id ? 'online' : 'offline',
        verified: profile.identityVerified
      }));

      const combined = [...STATIC_MEMBERS];
      dynamicMembers.forEach(dm => {
        if (!combined.find(sm => sm.id === dm.id)) {
          combined.push(dm);
        }
      });
      setAllMembers(combined);
    };

    loadDynamicMembers();
    // Listen for storage changes in case of signup/signin in other contexts
    window.addEventListener('storage', loadDynamicMembers);
    return () => window.removeEventListener('storage', loadDynamicMembers);
  }, []);

  const filteredMembers = allMembers.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !input.trim()) return;

    const newMessage = { 
      text: input, 
      sender: 'me' as const, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => ({
      ...prev,
      [selectedMember.id]: [...(prev[selectedMember.id] || []), newMessage]
    }));
    setInput('');

    setTimeout(() => {
      const reply = { 
        text: `Secure handshake established with node [${selectedMember.name}]. Data processed.`, 
        sender: 'them' as const, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setMessages(prev => ({
        ...prev,
        [selectedMember.id]: [...(prev[selectedMember.id] || []), reply]
      }));
    }, 1500);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedMember]);

  return (
    <div className="h-full flex flex-col space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 md:px-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">Conscious Identities</h2>
          <p className="text-blue-400/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Global Node Directory</p>
        </div>
        <div className="relative group w-full max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search identities..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium placeholder:tracking-wider uppercase" 
          />
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-6 overflow-hidden pb-8">
        {/* Members List - Visible unless member selected on mobile */}
        <div className={`lg:col-span-1 flex flex-col space-y-4 overflow-hidden ${selectedMember ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3" /> VERIFIED NODES ({filteredMembers.length})
            </h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
              <span className="text-[8px] text-teal-400 font-black uppercase">LIVE HUB</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {filteredMembers.map((member) => (
              <button 
                key={member.id} 
                className={`w-full glass-panel p-4 rounded-[1.5rem] border text-left transition-all group relative overflow-hidden flex items-center gap-4 ${selectedMember?.id === member.id ? 'border-blue-500 bg-blue-600/10 shadow-lg' : 'border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                onClick={() => setSelectedMember(member)}
              >
                <div className="relative shrink-0">
                  <img src={member.image} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/5" alt={member.name} />
                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#05070a] ${member.status === 'online' ? 'bg-teal-400' : 'bg-slate-600'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-black text-white uppercase tracking-tighter truncate">{member.name}</h4>
                    {member.verified && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                  </div>
                  <p className="text-[8px] text-blue-400/60 font-black uppercase tracking-widest truncate">{member.role}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-700 transition-all ${selectedMember?.id === member.id ? 'translate-x-1 text-blue-400' : ''}`} />
              </button>
            ))}
            {filteredMembers.length === 0 && (
              <div className="glass-panel p-8 rounded-[2rem] text-center border-dashed border-white/10 opacity-40">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Node not found in current layer</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Box - Mobile: Full Screen if selected, Desktop: 2/3 columns */}
        <div className={`lg:col-span-2 glass-panel rounded-[2rem] md:rounded-[3rem] flex flex-col border-white/5 overflow-hidden shadow-2xl bg-black/40 backdrop-blur-3xl min-h-[450px] ${selectedMember ? 'flex h-full fixed inset-0 z-[100] lg:relative lg:inset-auto lg:z-0' : 'hidden lg:flex'}`}>
          {selectedMember ? (
            <>
              {/* Message Header */}
              <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-3 md:gap-5">
                  <button 
                    onClick={() => setSelectedMember(null)} 
                    className="p-2 hover:bg-white/10 rounded-full text-slate-400 lg:hidden"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="relative">
                    <img src={selectedMember.image} className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover ring-2 ring-white/10" alt={selectedMember.name} />
                    <div className="absolute -top-1.5 -right-1.5 p-1 bg-blue-600 rounded-lg shadow-xl">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">{selectedMember.name}</h4>
                    <p className="text-[8px] md:text-[9px] text-teal-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                       SECURE NODE CHANNEL
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="hidden sm:flex p-2 hover:bg-white/5 rounded-xl text-slate-500"><Info className="w-5 h-5" /></button>
                  <button 
                    onClick={() => setSelectedMember(null)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-slate-500 transition-all"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </div>

              {/* Chat View */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.02)_0%,_transparent_50%)]">
                <div className="text-center py-4 border-b border-white/5 mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/5 border border-blue-500/10 rounded-full text-[8px] md:text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">
                    <ShieldCheck className="w-3 h-3" /> P2P ENCRYPTION VERIFIED
                  </div>
                </div>
                
                {(messages[selectedMember.id] || []).map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-[1rem] md:rounded-[1.5rem] text-xs md:text-sm leading-relaxed ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-tr-none shadow-xl' : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/10'}`}>
                      {msg.text}
                    </div>
                    <span className="text-[7px] md:text-[8px] text-slate-600 uppercase font-black tracking-widest mt-1.5 px-1">{msg.time}</span>
                  </div>
                ))}
                
                {(!messages[selectedMember.id] || messages[selectedMember.id].length === 0) && (
                   <div className="flex flex-col items-center justify-center h-full opacity-30 text-center space-y-6 py-12">
                      <div className="p-8 bg-blue-600/5 rounded-[3rem] border border-blue-500/10">
                        <MessageSquare className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-blue-400">Initialize Identity Sync</p>
                   </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Footer */}
              <form onSubmit={handleSendMessage} className="p-4 md:p-8 border-t border-white/5 bg-black/40">
                <div className="flex items-center gap-3">
                  <button type="button" className="hidden sm:flex p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl"><Paperclip className="w-5 h-5" /></button>
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Sync message with ${selectedMember.name.split(' ')[0]}...`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 md:py-4 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim()}
                    className="p-3 md:p-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl text-white transition-all shadow-xl active:scale-95"
                  >
                    <Send className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 text-center space-y-8 opacity-40">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-600/20 blur-[60px] rounded-full animate-pulse" />
                <div className="p-10 bg-white/5 rounded-[3rem] border border-white/10 relative">
                  <Smartphone className="w-12 h-12 md:w-16 md:h-16 text-blue-400" />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Identity Interface</h4>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">Select a Conscious Identity node from the directory to start a private encrypted transmission layer.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityMembers;
