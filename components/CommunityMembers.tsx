import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Smartphone,
  Info,
  Eye,
  Loader2,
} from 'lucide-react';
import { UserProfile } from '../types';
import { getAuthToken } from '../services/sessionService';
import { api, backendAssetUrl } from '../services/apiClient';
import {
  getProfileAvatarMedia,
  isVideoMediaAsset,
  type NormalizedMediaAsset,
} from '../services/mediaAssets';
import SocialProfileViewer, { type SocialProfileView } from './SocialProfileViewer';
import VisualRenderBoundary from './ui/VisualRenderBoundary';

interface Member {
  id: string;
  name: string;
  handle: string | null;
  role: string;
  location: string;
  bio: string;
  image: string | null;
  imageMedia: NormalizedMediaAsset;
  status: 'online' | 'offline';
  verified: boolean;
}

const PROFILE_UPDATED_EVENT = 'cnh:user-profile-updated';
const AUTOMATED_PROFILE_PATTERN = /\b(bot|agent|assistant|seed|system)\b/i;

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

const avatarFallbackUrl = (name: string): string =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Node')}&background=0f172a&color=38bdf8`;

const renderAvatarMedia = (
  media: NormalizedMediaAsset,
  name: string,
  className: string,
  fallbackClassName = className
) => {
  if (media.url) {
    if (isVideoMediaAsset(media)) {
      return (
        <video
          src={media.url}
          className={className}
          muted
          loop
          autoPlay
          playsInline
        />
      );
    }
    return (
      <img
        src={media.url}
        className={className}
        alt={name}
        onError={(event) => {
          event.currentTarget.src = avatarFallbackUrl(name);
        }}
      />
    );
  }

  return (
    <div className={`${fallbackClassName} bg-slate-900 text-blue-300 text-xs font-black flex items-center justify-center`}>
      {toInitials(name)}
    </div>
  );
};

const mapProfileToMember = (profile: any, activeUser: UserProfile | null): Member => {
  const id = String(profile?.id || '');
  const activeUserId = String(activeUser?.id || '');
  const mergedProfile =
    activeUser && id === activeUserId
      ? {
          ...profile,
          ...activeUser,
          avatarUrl: activeUser.avatarUrl || profile?.avatarUrl,
          profileMedia: activeUser.profileMedia || profile?.profileMedia,
          tier: activeUser.tier || profile?.tier,
        }
      : profile;
  const imageMedia = getProfileAvatarMedia(mergedProfile);

  return {
    id,
    name: String(mergedProfile.name || 'Node'),
    handle: String(mergedProfile.handle || '').trim() || null,
    role: `${String(mergedProfile.tier || 'Free / Community Tier')} Member`,
    location: String(mergedProfile.location || 'Decentralized Hub'),
    bio: String(mergedProfile.bio || 'Mission statement established.'),
    image: imageMedia.url || backendAssetUrl(mergedProfile?.avatarUrl) || null,
    imageMedia,
    status: id === activeUserId ? 'online' : 'offline',
    verified: true,
  };
};

interface CommunityMembersProps {
  user: UserProfile | null;
  onSignInPrompt?: () => void;
}

const CommunityMembersContent: React.FC<CommunityMembersProps> = ({ user, onSignInPrompt }) => {
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [isMemberInfoOpen, setMemberInfoOpen] = useState(false);
  const [selectedProfileView, setSelectedProfileView] = useState<SocialProfileView | null>(null);
  const [profileViewLoading, setProfileViewLoading] = useState(false);
  const [profileViewError, setProfileViewError] = useState('');
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const profileViewRequestRef = useRef(0);

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
        const payload = await api<any>('/user/directory');

        const directoryUsers = Array.isArray(payload?.users) ? payload.users : [];

        const mapped = directoryUsers
          .filter((profile: any) => profile?.id && !isLikelyAutomatedProfile(profile))
          .map((profile: any): Member => mapProfileToMember(profile, user))
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
    const refreshDirectory = () => {
      void loadMembers();
    };
    window.addEventListener('storage', refreshDirectory);
    window.addEventListener(PROFILE_UPDATED_EVENT, refreshDirectory as EventListener);
    return () => {
      window.removeEventListener('storage', refreshDirectory);
      window.removeEventListener(PROFILE_UPDATED_EVENT, refreshDirectory as EventListener);
    };
  }, [
    user?.id,
    user?.name,
    user?.handle,
    user?.tier,
    user?.avatarUrl,
    user?.profileMedia?.avatar?.url,
    user?.profileMedia?.avatar?.objectKey,
    user?.profileMedia?.avatar?.mimeType,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    const mergeActiveUser = (member: Member): Member =>
      member.id === user.id ? mapProfileToMember({ ...member, ...user, id: user.id }, user) : member;
    setAllMembers((current) => current.map(mergeActiveUser));
    setSelectedMember((current) => (current ? mergeActiveUser(current) : current));
  }, [
    user?.id,
    user?.name,
    user?.handle,
    user?.tier,
    user?.avatarUrl,
    user?.profileMedia?.avatar?.url,
    user?.profileMedia?.avatar?.objectKey,
    user?.profileMedia?.avatar?.mimeType,
  ]);

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSelectedMember(null);
    }
    const requestId = profileViewRequestRef.current + 1;
    profileViewRequestRef.current = requestId;
    setProfileViewError('');
    setSelectedProfileView(null);
    setProfileViewLoading(true);
    try {
      let profile: any = null;
      let cursor: string | null = null;
      const allPosts: any[] = [];
      const seen = new Set<string>();

      for (let page = 0; page < 10; page += 1) {
        const params = new URLSearchParams({ limit: '50' });
        if (cursor) params.set('cursor', cursor);
        const data = await api<any>(`/social/profile/${memberId}?${params.toString()}`);
        if (!profile) profile = data?.profile || null;
        const pagePosts = Array.isArray(data?.posts) ? data.posts : [];
        for (const post of pagePosts) {
          const id = String(post?.id || '').trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          allPosts.push(post);
        }
        const nextCursor = String(data?.nextCursor || '').trim();
        if (!nextCursor || pagePosts.length === 0) break;
        cursor = nextCursor;
      }

      if (profileViewRequestRef.current === requestId) {
        setSelectedProfileView({
          profile,
          posts: allPosts,
        });
      }
    } catch (error) {
      if (profileViewRequestRef.current === requestId) {
        setProfileViewError(error instanceof Error ? error.message : 'Unable to load member profile.');
      }
    } finally {
      if (profileViewRequestRef.current === requestId) {
        setProfileViewLoading(false);
      }
    }
  };

  const closeProfileView = () => {
    profileViewRequestRef.current += 1;
    setProfileViewLoading(false);
    setSelectedProfileView(null);
    setProfileViewError('');
  };

  const emptyStateMessage = search.trim()
    ? 'No member matched this search.'
    : directoryError || 'No member profiles are available yet.';
  const isProfileViewOpen = profileViewLoading || Boolean(profileViewError) || Boolean(selectedProfileView);

  useEffect(() => {
    if (!isProfileViewOpen) return;
    window.setTimeout(() => {
      profilePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [isProfileViewOpen]);

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

      {isProfileViewOpen && (
        <div ref={profilePanelRef} className="scroll-mt-24 px-0 md:scroll-mt-28 md:px-0 lg:scroll-mt-6">
          <SocialProfileViewer
            title="Member Profile"
            isOpen={isProfileViewOpen}
            loading={profileViewLoading}
            error={profileViewError}
            profileView={selectedProfileView}
            onClose={closeProfileView}
            presentation="inline"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col xl:grid xl:grid-cols-3 gap-6 min-h-0 overflow-visible xl:overflow-hidden pb-8">
        <div className={`xl:col-span-1 flex flex-col space-y-4 min-h-0 overflow-visible xl:overflow-hidden ${selectedMember ? 'hidden xl:flex' : 'flex'}`}>
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

          <div className="flex-1 overflow-y-auto custom-scrollbar scrollable pr-2 space-y-3">
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
                    {renderAvatarMedia(
                      member.imageMedia,
                      member.name,
                      'w-12 h-12 rounded-xl object-cover ring-2 ring-white/5'
                    )}
                    <div
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#05070a] ${
                        member.status === 'online' ? 'bg-teal-400' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="cnh-ellipsis text-sm font-black text-white uppercase tracking-tighter" title={member.name}>{member.name}</h4>
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
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" /> <span className="cnh-action-label">Select</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void openProfileView(member.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" /> <span className="cnh-action-label">View Profile</span>
                  </button>
                </div>
              </div>
            ))}

            {!directoryLoading && filteredMembers.length === 0 && (
              <div className="glass-panel p-8 rounded-[2rem] text-center border-dashed border-white/10 opacity-70">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{emptyStateMessage}</p>
                {directoryError === 'Sign in to view members.' && onSignInPrompt && (
                  <button
                    type="button"
                    onClick={onSignInPrompt}
                    className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
                  >
                    Sign In Or Create Profile
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className={`xl:col-span-2 glass-panel rounded-[2rem] md:rounded-[3rem] flex flex-col border-white/5 overflow-hidden shadow-2xl bg-black/40 backdrop-blur-3xl min-h-[450px] ${
            selectedMember ? 'flex h-[100dvh] max-h-[100dvh] fixed inset-0 z-[100] xl:relative xl:inset-auto xl:z-0 xl:h-full xl:max-h-none' : 'hidden xl:flex'
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
                    {renderAvatarMedia(
                      selectedMember.imageMedia,
                      selectedMember.name,
                      'w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover ring-2 ring-white/10'
                    )}
                    <div className="absolute -top-1.5 -right-1.5 p-1 bg-blue-600 rounded-lg shadow-xl">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="cnh-person-name text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-tight">
                      {selectedMember.name}
                    </h4>
                    <p className="text-[8px] md:text-[9px] text-teal-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      Profile Selected
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
                    <ShieldCheck className="w-3 h-3" /> Messaging Unavailable In Launch
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                  <div className="p-8 bg-blue-600/5 rounded-[3rem] border border-blue-500/10">
                    <MessageSquare className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="max-w-lg space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
                      Secure messaging is gated
                    </p>
                    <p className="text-sm leading-6 text-slate-400">
                      Direct member messages and message attachments are not active until private conversation storage,
                      participant access checks, and moderation controls are enabled.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-8 border-t border-white/5 bg-black/40">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs leading-5 text-slate-300">
                  Messaging controls are intentionally unavailable. Use profile views and provider request flows until
                  private conversations are fully persisted and audited.
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 text-center space-y-8 opacity-40">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-600/20 blur-[60px] rounded-full animate-pulse" />
                <div className="p-8 md:p-10 bg-white/5 rounded-[2rem] md:rounded-[3rem] border border-white/10 relative">
                  <Smartphone className="w-12 h-12 md:w-16 md:h-16 text-blue-400" />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Identity Interface</h4>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">
                  Select a member profile to view details. Direct messaging is unavailable until secure conversation storage is enabled.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMemberInfoOpen && selectedMember && (
        <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center overflow-y-auto custom-scrollbar">
          <div className="glass-panel w-full max-w-xl my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar rounded-[2rem] border border-white/10 p-6 sm:p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 min-w-0">
                {renderAvatarMedia(selectedMember.imageMedia, selectedMember.name, 'w-14 h-14 rounded-2xl object-cover')}
                <div className="min-w-0">
                  <h4 className="cnh-person-name text-xl font-black leading-tight tracking-tight text-white">{selectedMember.name}</h4>
                  <p className="break-words text-[10px] uppercase tracking-widest text-blue-300 font-black">{selectedMember.role}</p>
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
              <p className="cnh-user-content leading-relaxed">{selectedMember.bio}</p>
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

    </div>
  );
};

const CommunityMembers: React.FC<CommunityMembersProps> = (props) => (
  <VisualRenderBoundary moduleName="CommunityMembersProfileModals" fallbackTitle="Member profile tools could not render.">
    <CommunityMembersContent {...props} />
  </VisualRenderBoundary>
);

export default CommunityMembers;
