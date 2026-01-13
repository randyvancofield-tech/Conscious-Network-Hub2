
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Video, Calendar, Users, ShieldCheck, Zap, 
  Search, Filter, Clock, CreditCard, CheckCircle2, 
  Plus, X, Send, Camera, Mic, MicOff, CameraOff, 
  Settings, Download, Share2, Info, Loader2, Play,
  // Added ChevronRight to imports to fix undefined error
  ChevronRight
} from 'lucide-react';
import { UserProfile, Provider, Meeting } from '../types';
import { summarizeMeeting } from '../services/geminiService';

interface ConsciousMeetingsProps {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

// Added required 'bio' property to each provider to match the Provider interface
const PROVIDERS: Provider[] = [
  {
    id: 'p1',
    name: 'Dr. Jordan Wells',
    specialty: 'Trauma-informed coaching',
    rating: 4.9,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    bio: 'Specialist in restorative trauma-informed coaching for digital nomads navigating decentralized systems.',
    availabilitySlots: ['Mon 10:00 AM', 'Wed 02:00 PM', 'Fri 09:00 AM'],
    tokenPrice: 50,
    tierIncludedMin: 'Guided Tier'
  },
  {
    id: 'p2',
    name: 'Coach Amira Santos',
    specialty: 'Conscious Careers',
    rating: 4.8,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    bio: 'Helping professionals navigate career transitions and find purpose in the decentralized economy.',
    availabilitySlots: ['Tue 11:00 AM', 'Thu 03:00 PM'],
    tokenPrice: 30,
    tierIncludedMin: 'Accelerated Tier'
  },
  {
    id: 'p3',
    name: 'Master Sven Bergstrom',
    specialty: 'Sovereign Performance',
    rating: 4.7,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
    bio: 'Performance expert focused on high-stakes decision making, sovereignty, and cognitive optimization.',
    availabilitySlots: ['Sat 10:00 AM'],
    tokenPrice: 60,
    tierIncludedMin: 'Accelerated Tier'
  }
];

const ConsciousMeetings: React.FC<ConsciousMeetingsProps> = ({ user, onUpdateUser }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([
    {
      id: 'm1',
      title: 'Divine Alignment Check-In (1:1)',
      hostUserId: user?.id || 'guest',
      providerId: 'p1',
      startTime: 'Today, 2:00 PM',
      endTime: 'Today, 3:00 PM',
      participants: [
        { id: user?.id || 'guest', name: user?.name || 'Guest', role: 'User' },
        { id: 'p1', name: 'Dr. Jordan Wells', role: 'Provider' }
      ],
      status: 'Upcoming',
      paymentType: 'tier',
      notes: { transcript: [], summary: '', decisions: [], actionItems: [] }
    },
    {
      id: 'm2',
      title: 'Career Purpose Mapping (Group)',
      hostUserId: user?.id || 'guest',
      providerId: 'p2',
      startTime: 'Friday, 11:00 AM',
      endTime: 'Friday, 12:30 PM',
      participants: [
        { id: user?.id || 'guest', name: user?.name || 'Guest', role: 'User' },
        { id: 'p2', name: 'Coach Amira Santos', role: 'Provider' },
        { id: 'u2', name: 'Zara Khan', role: 'User' },
        { id: 'u3', name: 'Aarav Sharma', role: 'User' }
      ],
      status: 'Upcoming',
      paymentType: 'tokens',
      notes: { transcript: [], summary: '', decisions: [], actionItems: [] }
    }
  ]);

  const [activeTab, setActiveTab] = useState<'schedule' | 'lobby' | 'calendar'>('schedule');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isSchedulingModalOpen, setSchedulingModalOpen] = useState(false);
  const [isNoteTakerOn, setNoteTakerOn] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Mock transcript for AI notetaker
  const mockTranscript = [
    "Jordan: Welcome to our session. How are you feeling about your digital boundaries?",
    "User: I'm feeling overwhelmed with information. I need to restrict my neural input.",
    "Jordan: Understood. Let's set a goal to implement a 2-hour digital fast daily.",
    "User: That sounds manageable. I'll start tomorrow.",
    "Jordan: Great, I will also provide you with the bio-hacking resource by Sven."
  ];

  const checkPermissions = async () => {
    setPermissionState('pending');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPermissionState('granted');
    } catch (err) {
      setPermissionState('denied');
    }
  };

  const handleSchedule = (provider: Provider) => {
    setSelectedProvider(provider);
    setSchedulingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!selectedProvider || !user) return;

    const isIncluded = user.tier === 'Accelerated Tier' || (user.tier === 'Guided Tier' && selectedProvider.tierIncludedMin === 'Guided Tier');
    
    if (!isIncluded) {
      if (user.walletBalanceTokens < (selectedProvider.tokenPrice || 0)) {
        alert("Insufficient tokens. Please top up your vault.");
        return;
      }
      
      const confirmed = window.confirm(`This will deduct ${selectedProvider.tokenPrice} tokens. Confirm?`);
      if (confirmed) {
        const updatedUser = { ...user, walletBalanceTokens: user.walletBalanceTokens - (selectedProvider.tokenPrice || 0) };
        if (onUpdateUser) onUpdateUser(updatedUser);
      } else return;
    }

    const newMeeting: Meeting = {
      id: Date.now().toString(),
      title: `${selectedProvider.specialty} Session`,
      hostUserId: user.id,
      providerId: selectedProvider.id,
      startTime: 'Next Available',
      endTime: 'Next Available + 60m',
      participants: [
        { id: user.id, name: user.name, role: 'User' },
        { id: selectedProvider.id, name: selectedProvider.name, role: 'Provider' }
      ],
      status: 'Upcoming',
      paymentType: isIncluded ? 'tier' : 'tokens'
    };

    setMeetings([newMeeting, ...meetings]);
    setSchedulingModalOpen(false);
    setActiveTab('calendar');
  };

  const generateAINotes = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const result = await summarizeMeeting(mockTranscript);
    if (result) {
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, notes: { ...result, transcript: mockTranscript } } : m));
    }
  };

  const filteredProviders = PROVIDERS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700 relative overflow-hidden lg:overflow-visible">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <h2 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-4">
            <Video className="w-10 h-10 text-blue-400" />
            Conscious Meetings
          </h2>
          <p className="text-blue-400/60 text-[10px] sm:text-[12px] font-black uppercase tracking-[0.5em]">Virtual Sovereignty & Expert Wisdom</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="glass-panel px-6 py-3 rounded-2xl border-white/5 shadow-xl flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vault Balance</p>
              <p className="text-lg font-mono font-bold text-white">{user?.walletBalanceTokens || 0} HCN</p>
            </div>
            <Zap className="w-5 h-5 text-teal-400" />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
        {[
          { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
          { id: 'lobby', label: 'Live Lobby', icon: <Play className="w-4 h-4" /> },
          { id: 'calendar', label: 'My Calendar', icon: <Clock className="w-4 h-4" /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'schedule' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  type="text" 
                  placeholder="Find a provider..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                />
              </div>
              <button className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-white transition-all flex items-center gap-2">
                <Filter className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Filter</span>
              </button>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
              {filteredProviders.map(provider => {
                const isIncluded = user?.tier === 'Accelerated Tier' || (user?.tier === 'Guided Tier' && provider.tierIncludedMin === 'Guided Tier');
                return (
                  <div key={provider.id} className="glass-panel group rounded-[2.5rem] overflow-hidden flex flex-col border-white/5 hover:border-blue-500/30 transition-all duration-500 shadow-2xl relative">
                    <div className="p-8 space-y-6">
                      <div className="flex items-center gap-5">
                        <img src={provider.avatar} className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/5 shadow-2xl" />
                        <div>
                          <h4 className="text-xl font-black text-white uppercase tracking-tighter leading-none">{provider.name}</h4>
                          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-2">{provider.specialty}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <span>Next Slot: {provider.availabilitySlots?.[0]}</span>
                          <span className="flex items-center gap-1 text-yellow-400"><CheckCircle2 className="w-3 h-3" /> {provider.rating} Rating</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Access Layer</span>
                          </div>
                          {isIncluded ? (
                            <span className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full text-[9px] font-black uppercase">Tier Included</span>
                          ) : (
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[9px] font-black uppercase">{provider.tokenPrice} HCN Credits</span>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => handleSchedule(provider)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:-translate-y-1 active:scale-95"
                      >
                        Schedule 1:1 Session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in py-10">
            <div className="glass-panel p-10 rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Video className="w-48 h-48 text-blue-400" />
              </div>
              
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-[10px] font-black text-teal-400 uppercase tracking-[0.4em]">Next Session Ready</span>
                </div>
                
                <div>
                  <h3 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-4">{meetings[0].title}</h3>
                  <div className="flex items-center gap-6 text-slate-400 text-sm font-medium">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {meetings[0].startTime}</span>
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {meetings[0].participants.length} Participants</span>
                  </div>
                </div>

                {/* Pre-join flow */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware Manifest</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={checkPermissions}
                      className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${permissionState === 'granted' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        {permissionState === 'granted' ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
                        <span className="text-xs font-bold uppercase tracking-widest">Visual Input Layer</span>
                      </div>
                      {permissionState === 'granted' ? <CheckCircle2 className="w-5 h-5" /> : permissionState === 'pending' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={checkPermissions}
                      className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${permissionState === 'granted' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        {permissionState === 'granted' ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        <span className="text-xs font-bold uppercase tracking-widest">Audio Input Layer</span>
                      </div>
                      {permissionState === 'granted' ? <CheckCircle2 className="w-5 h-5" /> : permissionState === 'pending' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                    </button>
                  </div>

                  <button 
                    disabled={permissionState !== 'granted'}
                    onClick={() => setIsJoining(true)}
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-3xl font-black text-xl uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4"
                  >
                    {isJoining ? <Loader2 className="w-6 h-6 animate-spin" /> : <Video className="w-6 h-6" />}
                    Join Virtual Session
                  </button>
                </div>
              </div>
            </div>

            {/* AI Notetaker Preview Settings */}
            <div className="glass-panel p-8 rounded-[2.5rem] border-blue-500/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600/10 rounded-2xl">
                  <Zap className={`w-6 h-6 ${isNoteTakerOn ? 'text-teal-400 animate-pulse' : 'text-slate-600'}`} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">AI Synthesis Notetaker</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Real-time transcription & action extraction</p>
                </div>
              </div>
              <button 
                onClick={() => setNoteTakerOn(!isNoteTakerOn)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${isNoteTakerOn ? 'bg-teal-500/20 border-teal-500/40 text-teal-400 shadow-glow' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
              >
                {isNoteTakerOn ? 'Synthesis Active' : 'Enable Synthesis'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 pb-20">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] flex items-center gap-3">
              <Calendar className="w-4 h-4 text-blue-400" /> Sovereign Schedule
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Upcoming List */}
              <div className="lg:col-span-2 space-y-6">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="glass-panel rounded-[2.5rem] p-8 border-white/5 hover:border-blue-500/20 transition-all shadow-xl group">
                    <div className="flex flex-col sm:flex-row justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${meeting.status === 'Live' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-blue-500/10 text-blue-400'}`}>
                            {meeting.status}
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{meeting.paymentType === 'tier' ? 'Included' : 'Token Access'}</span>
                        </div>
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-blue-400 transition-colors">{meeting.title}</h4>
                        <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {meeting.startTime}</span>
                          <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {meeting.participants.length} Participating</span>
                        </div>
                      </div>
                      
                      <div className="flex sm:flex-col gap-3 justify-end shrink-0">
                        <button 
                          onClick={() => generateAINotes(meeting.id)}
                          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                        >
                          View Synthesis
                        </button>
                        <button className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                          Reschedule
                        </button>
                      </div>
                    </div>

                    {/* Expandable Notes */}
                    {meeting.notes && meeting.notes.summary && (
                      <div className="mt-8 pt-8 border-t border-white/5 space-y-6 animate-in slide-in-from-top-4">
                        <div className="bg-blue-600/5 p-6 rounded-2xl border border-blue-500/10">
                          <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Synthesis Summary</h5>
                          <p className="text-sm text-slate-300 italic leading-relaxed">{meeting.notes.summary}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Decisions</h5>
                            <ul className="space-y-2">
                              {meeting.notes.decisions.map((d, i) => (
                                <li key={i} className="flex items-center gap-3 text-xs text-white">
                                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Action Items</h5>
                            <ul className="space-y-3">
                              {meeting.notes.actionItems.map((a, i) => (
                                <li key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{a.owner}</span>
                                    <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{a.dueDate}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-medium">{a.task}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex gap-4">
                           <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-slate-400"><Download className="w-4 h-4" /> Download Notes</button>
                           <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-slate-400"><Share2 className="w-4 h-4" /> Sync to participants</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sidebar Calendar Stats */}
              <div className="space-y-8">
                <div className="glass-panel p-8 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sovereign Statistics</h4>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Sessions</span>
                         <span className="text-white font-mono font-bold">{meetings.length + 12}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">HCN Distributed</span>
                         <span className="text-white font-mono font-bold">840 HCN</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Provider Nodes</span>
                         <span className="text-white font-mono font-bold">3 Active</span>
                      </div>
                   </div>
                </div>

                <div className="glass-panel p-8 rounded-[3rem] border-blue-500/20 shadow-2xl space-y-6">
                  <div className="flex items-center gap-3 text-blue-400">
                    <Info className="w-5 h-5" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Meeting Integrity</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-light italic">
                    By entering a virtual session, all participants agree to end-to-end encrypted recording if Synthesis is enabled. Data remains private to the host and participants.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduling Modal */}
      {isSchedulingModalOpen && selectedProvider && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl p-10 rounded-[4rem] relative animate-in zoom-in duration-300 border-blue-500/20 shadow-2xl">
            <button onClick={() => setSchedulingModalOpen(false)} className="absolute top-10 right-10 p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500">
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex items-start gap-8 mb-10">
              <img src={selectedProvider.avatar} className="w-24 h-24 rounded-3xl object-cover ring-8 ring-white/5 shadow-2xl" />
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{selectedProvider.name}</h3>
                <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">{selectedProvider.specialty}</p>
                <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest pt-2">
                   <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> 60 Minute Session</span>
                   <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Verified Provider</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Synchronous Slot</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedProvider.availabilitySlots?.map((slot, i) => (
                      <button key={i} className={`p-5 rounded-2xl border transition-all text-xs font-bold uppercase tracking-widest ${i === 0 ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Invite Participants</h4>
                  <div className="relative">
                    <Plus className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="text" 
                      placeholder="Add users by node ID or handle..." 
                      className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
                    />
                  </div>
               </div>

               <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Access Protocol</h5>
                    <p className="text-white font-bold text-lg uppercase tracking-tighter">
                      {user?.tier === 'Accelerated Tier' || (user?.tier === 'Guided Tier' && selectedProvider.tierIncludedMin === 'Guided Tier') 
                        ? 'Included with Membership' 
                        : `${selectedProvider.tokenPrice} HCN Tokens Required`}
                    </p>
                  </div>
                  <button 
                    onClick={confirmBooking}
                    className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center gap-2"
                  >
                    Confirm Anchor Session <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .shadow-glow { box-shadow: 0 0 15px rgba(45, 212, 191, 0.4); }
        @keyframes pulse-meeting {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ConsciousMeetings;
