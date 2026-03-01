import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  MessageSquare,
  Search,
  ShieldCheck,
  Send,
  X,
  ArrowLeft,
  ChevronRight,
  Paperclip,
  CheckCircle2,
  Lock,
  Smartphone,
  Info,
  Eye,
  Loader2,
} from 'lucide-react';
import { UserProfile } from '../types';
import { buildAuthHeaders, getAuthToken } from '../services/sessionService';

interface Member {
  id: string;
  name: string;
  handle: string | null;
  role: string;
  location: string;
  bio: string;
  image: string | null;
  status: 'online' | 'offline';
  verified: boolean;
}

interface SocialProfileView {
  profile: any;
  posts: any[];
}

const AUTOMATED_PROFILE_PATTERN = /\b(bot|agent|assistant|seed|system)\b/i;

const toRelativeTimestamp = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  const deltaMs = Date.now() - parsed.getTime();
  const deltaMinutes = Math.floor(deltaMs / (60 * 1000));
  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
};

const toInitials = (value: string): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'N';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const isLikelyAutomatedProfile = (profile: any): boolean => {
  const fields = [profile?.name, profile?.handle, profile?.email]
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);
  return fields.some((field) => AUTOMATED_PROFILE_PATTERN.test(field));
};

const CommunityMembers: React.FC = () => {
  const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
  const toApiUrl = (route: string) => `${backendBaseUrl}${route}`;

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [messages, setMessages] = useState<{ [key: string]: { text: string; sender: 'me' | 'them'; time: string }[] }>({});
  const [input, setInput] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [isMemberInfoOpen, setMemberInfoOpen] = useState(false);
  const [selectedProfileView, setSelectedProfileView] = useState<SocialProfileView | null>(null);
  const [profileViewLoading, setProfileViewLoading] = useState(false);
  const [profileViewError, setProfileViewError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadMembers = async () => {
      const token = getAuthToken();
      if (!token) {
        setAllMembers([]);
        setSelectedMember(null);
        setDirectoryError('Sign in to view members.');
        return;
      }

      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const activeUser: UserProfile | null = JSON.parse(localStorage.getItem('hcn_active_user') || 'null');
        const response = await fetch(toApiUrl('/api/user/directory'), {
          headers: buildAuthHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load members.');
        }

        const directoryUsers = Array.isArray(payload?.users) ? payload.users : [];
        const toAssetUrl = (value: unknown): string => {
          const raw = String(value || '').trim();
          if (!raw) return '';
          if (/^https?:\/\//i.test(raw)) return raw;
          const normalized = raw.startsWith('/') ? raw : `/${raw}`;
          return `${backendBaseUrl}${normalized}`;
        };

        const mapped = directoryUsers
          .filter((profile: any) => profile?.id && !isLikelyAutomatedProfile(profile))
          .map((profile: any): Member => ({
            id: String(profile.id),
            name: String(profile.name || 'Node'),
            handle: String(profile.handle || '').trim() || null,
            role: `${String(profile.tier || 'Free / Community Tier')} Member`,
            location: String(profile.location || 'Decentralized Hub'),
            bio: String(profile.bio || 'Mission statement established.'),
            image:
              toAssetUrl(profile?.profileMedia?.avatar?.url) ||
              toAssetUrl(profile?.avatarUrl) ||
              null,
            status: activeUser?.id === profile.id ? 'online' : 'offline',
            verified: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAllMembers(mapped);
        setSelectedMember((prev) => (prev ? mapped.find((member) => member.id === prev.id) || null : null));
      } catch (error) {
        setAllMembers([]);
        setSelectedMember(null);
        setDirectoryError(error instanceof Error ? error.message : 'Unable to load members.');
      } finally {
        setDirectoryLoading(false);
      }
    };

    void loadMembers();
    const handleStorage = () => {
      void loadMembers();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [backendBaseUrl]);

  const filteredMembers = useMemo(
    () =>
      allMembers.filter(
        (member) =>
          member.name.toLowerCase().includes(search.toLowerCase()) ||
          member.role.toLowerCase().includes(search.toLowerCase()) ||
          (member.handle || '').toLowerCase().includes(search.toLowerCase())
      ),
    [allMembers, search]
  );

  const openProfileView = async (memberId: string) => {
    if (!memberId || !getAuthToken()) return;
    setProfileViewError('');
    setProfileViewLoading(true);
    try {
      const response = await fetch(toApiUrl(`/api/social/profile/${memberId}?limit=20`), {
        headers: buildAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load member profile.');
      }
      setSelectedProfileView({
        profile: data.profile || null,
        posts: Array.isArray(data.posts) ? data.posts : [],
      });
    } catch (error) {
      setProfileViewError(error instanceof Error ? error.message : 'Unable to load member profile.');
    } finally {
      setProfileViewLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !input.trim()) return;

    const attachmentSuffix = selectedAttachment ? ` [Attachment: ${selectedAttachment.name}]` : '';
    const newMessage = {
      text: `${input}${attachmentSuffix}`,
      sender: 'me' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [selectedMember.id]: [...(prev[selectedMember.id] || []), newMessage],
    }));
    setInput('');
    setSelectedAttachment(null);

    setTimeout(() => {
      const reply = {
        text: `Secure handshake established with node [${selectedMember.name}]. Data processed.`,
        sender: 'them' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => ({
        ...prev,
        [selectedMember.id]: [...(prev[selectedMember.id] || []), reply],
      }));
    }, 1500);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedMember]);

  const emptyStateMessage = search.trim()
    ? 'No member matched this search.'
    : directoryError || 'No member profiles are available yet.';

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
        <div className={`lg:col-span-1 flex flex-col space-y-4 overflow-hidden ${selectedMember ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3" /> MEMBERS ({filteredMembers.length})
            </h3>
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-widest font-black">
              {directoryLoading ? (
                <>
                  <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  <span className="text-blue-400">Syncing</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-teal-400">Live Hub</span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`glass-panel rounded-[1.6rem] border transition-all overflow-hidden ${
                  selectedMember?.id === member.id
                    ? 'border-blue-500 bg-blue-600/10 shadow-lg'
                    : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <button
                  type="button"
                  className="w-full p-4 text-left flex items-center gap-4"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="relative shrink-0">
                    {member.image ? (
                      <img
                        src={member.image}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/5"
                        alt={member.name}
                        onError={(event) => {
                          event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            member.name
                          )}&background=0f172a&color=38bdf8`;
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl ring-2 ring-white/5 bg-slate-900 text-blue-300 text-xs font-black flex items-center justify-center">
                        {toInitials(member.name)}
                      </div>
                    )}
                    <div
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#05070a] ${
                        member.status === 'online' ? 'bg-teal-400' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-black text-white uppercase tracking-tighter truncate">{member.name}</h4>
                      {member.verified && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                    </div>
                    <p className="text-[8px] text-blue-400/60 font-black uppercase tracking-widest truncate">{member.role}</p>
                    {member.handle && (
                      <p className="text-[9px] text-slate-400 font-bold tracking-wide truncate mt-1">@{member.handle}</p>
                    )}
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-700 transition-all ${
                      selectedMember?.id === member.id ? 'translate-x-1 text-blue-400' : ''
                    }`}
                  />
                </button>

                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </button>
                  <button
                    type="button"
                    onClick={() => void openProfileView(member.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Profile
                  </button>
                </div>
              </div>
            ))}

            {!directoryLoading && filteredMembers.length === 0 && (
              <div className="glass-panel p-8 rounded-[2rem] text-center border-dashed border-white/10 opacity-70">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{emptyStateMessage}</p>
              </div>
            )}
          </div>
        </div>

        <div
          className={`lg:col-span-2 glass-panel rounded-[2rem] md:rounded-[3rem] flex flex-col border-white/5 overflow-hidden shadow-2xl bg-black/40 backdrop-blur-3xl min-h-[450px] ${
            selectedMember ? 'flex h-[100dvh] fixed inset-0 z-[100] lg:relative lg:inset-auto lg:z-0 lg:h-full' : 'hidden lg:flex'
          }`}
        >
          {selectedMember ? (
            <>
              <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-3 md:gap-5 min-w-0">
                  <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 lg:hidden">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="relative shrink-0">
                    {selectedMember.image ? (
                      <img
                        src={selectedMember.image}
                        className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover ring-2 ring-white/10"
                        alt={selectedMember.name}
                        onError={(event) => {
                          event.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            selectedMember.name
                          )}&background=0f172a&color=38bdf8`;
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-900 text-blue-300 text-xs font-black flex items-center justify-center ring-2 ring-white/10">
                        {toInitials(selectedMember.name)}
                      </div>
                    )}
                    <div className="absolute -top-1.5 -right-1.5 p-1 bg-blue-600 rounded-lg shadow-xl">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none truncate">
                      {selectedMember.name}
                    </h4>
                    <p className="text-[8px] md:text-[9px] text-teal-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      Secure Node Channel
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => void openProfileView(selectedMember.id)}
                    className="hidden sm:flex p-2 hover:bg-white/5 rounded-xl text-slate-500"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button onClick={() => setMemberInfoOpen(true)} className="hidden sm:flex p-2 hover:bg-white/5 rounded-xl text-slate-500">
                    <Info className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-slate-500 transition-all"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.02)_0%,_transparent_50%)]">
                <div className="text-center py-4 border-b border-white/5 mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/5 border border-blue-500/10 rounded-full text-[8px] md:text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">
                    <ShieldCheck className="w-3 h-3" /> P2P Encryption Verified
                  </div>
                </div>

                {(messages[selectedMember.id] || []).map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                    <div
                      className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-[1rem] md:rounded-[1.5rem] text-xs md:text-sm leading-relaxed ${
                        msg.sender === 'me'
                          ? 'bg-blue-600 text-white rounded-tr-none shadow-xl'
                          : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/10'
                      }`}
                    >
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

              <form onSubmit={handleSendMessage} className="p-4 md:p-8 border-t border-white/5 bg-black/40">
                {selectedAttachment && (
                  <div className="mb-3 p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-300 font-black uppercase tracking-widest flex items-center justify-between gap-2">
                    <span className="truncate">Attached: {selectedAttachment.name}</span>
                    <button type="button" onClick={() => setSelectedAttachment(null)} className="p-1 hover:bg-blue-500/20 rounded-md">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="hidden sm:flex p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedAttachment(file);
                    }}
                  />
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
                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">
                  Select a member profile to send a message or open a full profile view.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMemberInfoOpen && selectedMember && (
        <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-xl rounded-[2rem] border border-white/10 p-6 sm:p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 min-w-0">
                {selectedMember.image ? (
                  <img src={selectedMember.image} alt={selectedMember.name} className="w-14 h-14 rounded-2xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 text-blue-300 text-xs font-black flex items-center justify-center">
                    {toInitials(selectedMember.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xl font-black text-white tracking-tight truncate">{selectedMember.name}</h4>
                  <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black truncate">{selectedMember.role}</p>
                </div>
              </div>
              <button onClick={() => setMemberInfoOpen(false)} className="p-2 rounded-xl hover:bg-white/5 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                <span className="text-slate-500 uppercase text-[10px] tracking-widest font-black">Location:</span> {selectedMember.location}
              </p>
              <p>
                <span className="text-slate-500 uppercase text-[10px] tracking-widest font-black">Status:</span> {selectedMember.status}
              </p>
              <p className="leading-relaxed">{selectedMember.bio}</p>
            </div>
            <button
              onClick={() => setMemberInfoOpen(false)}
              className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {(profileViewLoading || profileViewError || selectedProfileView) && (
        <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-white/10 shadow-2xl p-6 sm:p-8 animate-in zoom-in duration-300">
            <div className="flex items-start justify-between gap-4 mb-6">
              <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Member Profile</h4>
              <button
                onClick={() => {
                  setSelectedProfileView(null);
                  setProfileViewError('');
                }}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileViewLoading && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Loading profile...
              </div>
            )}

            {profileViewError && !profileViewLoading && (
              <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">{profileViewError}</div>
            )}

            {selectedProfileView && !profileViewLoading && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <img
                    src={
                      selectedProfileView.profile?.avatarUrl ||
                      selectedProfileView.profile?.profileMedia?.avatar?.url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedProfileView.profile?.name || 'Node'
                      )}&background=0f172a&color=38bdf8`
                    }
                    alt={selectedProfileView.profile?.name || 'Node'}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/10"
                  />
                  <div className="min-w-0">
                    <h5 className="text-xl font-black text-white tracking-tight truncate">{selectedProfileView.profile?.name || 'Node'}</h5>
                    <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black mt-1">
                      @{selectedProfileView.profile?.handle || 'node'}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">{selectedProfileView.profile?.bio || 'No biography provided yet.'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h6 className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Recent Social Posts</h6>
                  {selectedProfileView.posts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400">No public posts available.</div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProfileView.posts.slice(0, 8).map((post) => (
                        <div key={post.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-2">
                            {toRelativeTimestamp(String(post.createdAt || ''))}
                          </p>
                          <p className="text-sm text-slate-200 break-words">{String(post.text || '').trim() || 'Media post'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityMembers;
