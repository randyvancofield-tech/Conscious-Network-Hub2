
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare, Heart,
  Send, Globe, Zap, Sparkles, Filter, 
  LayoutGrid, BookOpen, Layers, Users, ShieldCheck, 
  ArrowRight, FileText, ImageIcon, FileVideo, Cpu, X, Play,
  Activity, Terminal, ChevronRight, Link as LinkIcon, Youtube, ExternalLink,
  Pencil, Trash2, RefreshCw
} from 'lucide-react';
import { UserProfile } from '../types';
import { api } from '../services/apiClient';
import {
  getProfileAvatarMedia,
  isVideoMediaAsset,
  normalizeMediaAsset,
  type NormalizedMediaAsset,
} from '../services/mediaAssets';
import SocialProfileViewer, { type SocialProfileView } from './SocialProfileViewer';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
}

interface NodeContent {
  id: string;
  authorId: string;
  author: string;
  avatar: string;
  avatarMedia?: NormalizedMediaAsset;
  type: 'text' | 'image' | 'video' | 'file';
  title: string;
  content: string;
  timestamp: string;
  resonances: number;
  links: number;
  hasResonated?: boolean;
  visibility?: 'public' | 'private';
  comments: Comment[];
}

interface SelectedUpload {
  file: File;
  data: string;
  type: 'image' | 'video' | 'file';
}

interface SocialLearningHubProps {
  user: UserProfile | null;
}

const INITIAL_NODES: NodeContent[] = [];

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getFirstUrl = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
};

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

const defaultAvatarUrl = (seed: string): string =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'node')}`;

const renderAvatarMedia = (media: NormalizedMediaAsset, name: string, className: string) => {
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
    return <img src={media.url} className={className} alt={name} />;
  }

  return <img src={defaultAvatarUrl(name)} className={className} alt={name} />;
};

const mapSocialPostToNode = (post: any): NodeContent => {
  const media = Array.isArray(post?.media) ? post.media[0] : null;
  const type = media?.mediaType === 'video' ? 'video' : media?.mediaType === 'file' ? 'file' : media ? 'image' : 'text';
  const fallbackAvatar = defaultAvatarUrl(String(post?.authorId || 'node'));
  const authorAvatarMedia = normalizeMediaAsset({ url: post?.authorAvatarUrl }, fallbackAvatar);
  return {
    id: String(post?.id || Date.now()),
    authorId: String(post?.authorId || post?.author?.id || ''),
    author: String(post?.authorName || 'Node'),
    avatar: authorAvatarMedia.url || fallbackAvatar,
    avatarMedia: authorAvatarMedia,
    type,
    title: type === 'text' ? 'Knowledge Node' : `${type.toUpperCase()} Node`,
    content: media?.url || String(post?.text || ''),
    timestamp: toRelativeTimestamp(String(post?.createdAt || '')),
    resonances: Number(post?.likeCount || 0),
    links: 0,
    visibility: String(post?.visibility || '').trim().toLowerCase() === 'private' ? 'private' : 'public',
    comments: [],
  };
};

const SocialLearningHub: React.FC<SocialLearningHubProps> = ({ user }) => {
  const [nodes, setNodes] = useState<NodeContent[]>(INITIAL_NODES);
  const [newPost, setNewPost] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [isRefreshingFeed, setRefreshingFeed] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedUpload | null>(null);
  const [injectError, setInjectError] = useState('');
  const [postActionError, setPostActionError] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [commentInput, setCommentInput] = useState<{[key: string]: string}>({});
  const [showFilters, setShowFilters] = useState(false);
  const [contentFilter, setContentFilter] = useState<'all' | 'text' | 'image' | 'video' | 'file'>('all');
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'thread'>('grid');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [selectedProfileView, setSelectedProfileView] = useState<SocialProfileView | null>(null);
  const [profileViewLoading, setProfileViewLoading] = useState(false);
  const [profileViewError, setProfileViewError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const injectionPanelRef = useRef<HTMLDivElement>(null);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const profileViewRequestRef = useRef(0);

  const detectedUrl = useMemo(() => getFirstUrl(newPost), [newPost]);
  const detectedYoutubeId = useMemo(() => detectedUrl ? getYoutubeId(detectedUrl) : null, [detectedUrl]);

  const loadFeed = useCallback(async () => {
    if (!user) {
      setNodes([]);
      return;
    }

    setRefreshingFeed(true);
    try {
      const data = await api<any>('/social/newsfeed?limit=100');

      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const mapped = posts.map(mapSocialPostToNode);
      setNodes(mapped);
    } catch {
      setNodes([]);
    } finally {
      setRefreshingFeed(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesType = contentFilter === 'all' || node.type === contentFilter;
      const matchesOwnership = !showMineOnly || (Boolean(user?.id) && node.authorId === user?.id);
      return matchesType && matchesOwnership;
    });
  }, [nodes, contentFilter, showMineOnly, user?.id]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!injectionPanelRef.current || window.innerWidth < 1024) return;
    const rect = injectionPanelRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 10, y: y * -10 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, filterType: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({
          file,
          data: reader.result as string,
          type: filterType
        });
        setInjectError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  const triggerUpload = (type: 'image' | 'video' | 'file') => {
    if (!user) {
      setInjectError('Sign in to publish social posts or upload media.');
      return;
    }
    if (fileInputRef.current) {
      setInjectError('');
      const accept =
        type === 'image' ? 'image/*' : type === 'video' ? 'video/*,video/mp4,.mp4' : '*/*';
      fileInputRef.current.setAttribute('accept', accept);
      fileInputRef.current.onchange = (e: any) => handleFileChange(e, type);
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() && !selectedFile) return;
    if (!user) {
      setInjectError('Sign in to publish social posts. Guest posting is disabled for launch integrity.');
      return;
    }

    setIsInjecting(true);
    setInjectError('');

    try {
      let media: Array<{
        mediaType: 'image' | 'video' | 'file';
        url: string;
        storageProvider: string | null;
        objectKey: string | null;
      }> = [];

      if (selectedFile) {
        const uploadPayload = new FormData();
        uploadPayload.append('file', selectedFile.file);

        const uploadData = await api<any>('/upload/social', {
          method: 'POST',
          body: uploadPayload,
        });

        const uploadedUrl = String(uploadData?.fileUrl || '').trim();
        if (!uploadedUrl) {
          throw new Error('Media upload completed without a file URL');
        }

        media = [
          {
            mediaType: selectedFile.type,
            url: uploadedUrl,
            storageProvider:
              typeof uploadData?.media?.storageProvider === 'string'
                ? uploadData.media.storageProvider
                : null,
            objectKey:
              typeof uploadData?.media?.objectKey === 'string'
                ? uploadData.media.objectKey
                : null,
          },
        ];
      }

      const data = await api<any>('/social/posts', {
        method: 'POST',
        body: {
          text: newPost.trim(),
          visibility: 'public',
          media,
        },
      });
      const mapped = mapSocialPostToNode(data.post);
      setNodes((prev) => [mapped, ...prev.filter((entry) => entry.id !== mapped.id)]);
      setNewPost('');
      clearSelectedFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish node';
      setInjectError(message);
    } finally {
      setIsInjecting(false);
    }
  };

  const toggleResonance = async (nodeId: string) => {
    if (!user) {
      setPostActionError('Sign in to resonate with social posts.');
      return;
    }

    try {
      const data = await api<any>(`/social/posts/${nodeId}/like`, {
        method: 'POST',
      });
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                hasResonated: Boolean(data?.liked),
                resonances: Number(data?.likeCount || 0),
              }
            : node
        )
      );
      setPostActionError('');
      return;
    } catch (error) {
      setPostActionError(error instanceof Error ? error.message : 'Unable to update resonance.');
    }
  };

  const toggleComments = (nodeId: string) => {
    setExpandedComments(prev => 
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
  };

  const handleAddComment = (nodeId: string) => {
    const text = commentInput[nodeId];
    if (!text?.trim()) return;
    setPostActionError('Comments and linkages require the Phase 4 backend comments service before they can be used.');
  };

  const openProfileView = async (authorId: string) => {
    if (!authorId || !user) return;
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
        const data = await api<any>(`/social/profile/${authorId}?${params.toString()}`);
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
        setProfileViewError(error instanceof Error ? error.message : 'Unable to load profile');
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

  const beginEditNode = (node: NodeContent) => {
    if (node.type !== 'text') {
      setPostActionError('Only text posts can be edited inline right now.');
      return;
    }
    setPostActionError('');
    setEditingNodeId(node.id);
    setEditingText(node.content);
  };

  const saveNodeEdit = async (nodeId: string) => {
    const nextText = editingText.trim();
    if (!nextText) {
      setPostActionError('Edited post cannot be empty.');
      return;
    }
    if (!user) return;

    try {
      const data = await api<any>(`/social/posts/${nodeId}`, {
        method: 'PATCH',
        body: { text: nextText },
      });
      const mapped = mapSocialPostToNode(data.post);
      setNodes((prev) => prev.map((node) => (node.id === nodeId ? mapped : node)));
      setEditingNodeId(null);
      setEditingText('');
      setPostActionError('');
    } catch (error) {
      setPostActionError(error instanceof Error ? error.message : 'Failed to update post');
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (!user) return;
    const confirmed = window.confirm('Delete this post? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await api(`/social/posts/${nodeId}`, {
        method: 'DELETE',
      });
      setNodes((prev) => prev.filter((node) => node.id !== nodeId));
      setPostActionError('');
    } catch (error) {
      setPostActionError(error instanceof Error ? error.message : 'Failed to delete post');
    }
  };

  const resonateGlobally = async (node: NodeContent) => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?node=${encodeURIComponent(node.id)}`
        : node.id;
    try {
      if (navigator.share) {
        await navigator.share({
          title: node.title,
          text: node.type === 'text' ? node.content.slice(0, 140) : `Shared from Social Hub: ${node.title}`,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard.');
    } catch {
      // no-op if share is canceled
    }
  };
  const isProfileViewOpen = profileViewLoading || Boolean(profileViewError) || Boolean(selectedProfileView);

  useEffect(() => {
    if (!isProfileViewOpen) return;
    window.setTimeout(() => {
      profilePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [isProfileViewOpen]);

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 relative">
      
      {/* Immersive Header */}
      <header className="relative perspective-1000 transform-style-3d py-4 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div className="space-y-2 transform transition-transform lg:hover:translate-z-10 duration-500">
            <h2 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-4">
              <Cpu className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 animate-spin-slow" />
              Social Hub
            </h2>
            <p className="text-blue-400/60 text-[10px] sm:text-[12px] font-black uppercase tracking-[0.5em]">The Algorithm Forge & Collective Intellect</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Entropy: 0.042 Stable</span>
            </div>
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="p-3 sm:p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-900/40 transition-all active:scale-95 group"
            >
              <Filter className="w-5 h-5 lg:group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 glass-panel p-4 rounded-2xl border border-white/10 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex flex-wrap gap-2">
              {(['all', 'text', 'image', 'video', 'file'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setContentFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${
                    contentFilter === filter
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[10px] text-slate-300 font-black uppercase tracking-widest">
              <input
                type="checkbox"
                checked={showMineOnly}
                onChange={(e) => setShowMineOnly(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              My nodes only
            </label>
            <button
              onClick={() => void loadFeed()}
              className="lg:ml-auto px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFeed ? 'animate-spin' : ''}`} />
              Refresh Feed
            </button>
          </div>
        )}
        
        {/* Floating Background Element */}
        <div className="absolute -top-10 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
      </header>

      {isProfileViewOpen && (
        <div ref={profilePanelRef} className="scroll-mt-24 md:scroll-mt-28 lg:scroll-mt-6">
          <SocialProfileViewer
            title="User Profile"
            isOpen={isProfileViewOpen}
            loading={profileViewLoading}
            error={profileViewError}
            profileView={selectedProfileView}
            onClose={closeProfileView}
            presentation="inline"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar: Creation Tools & Sentinel Row */}
        <div className="lg:col-span-1 space-y-8 flex flex-col">
          
          {/* Node Injection Panel */}
          <div 
            ref={injectionPanelRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ 
              transform: window.innerWidth >= 1024 ? `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` : 'none',
              transition: isInjecting ? 'none' : 'transform 0.2s ease-out'
            }}
            className="glass-panel p-6 sm:p-8 rounded-[2.5rem] border-white/10 shadow-2xl relative group overflow-hidden bg-black/40 backdrop-blur-3xl"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Terminal className="w-24 h-24 text-blue-400" />
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-2">
                <Zap className="w-4 h-4 animate-pulse" /> Forge Algorithm
              </h3>
              <Sparkles className="w-4 h-4 text-teal-400 opacity-40" />
            </div>
            
            <form onSubmit={handleInject} className="space-y-4 relative z-10">
              <div className="relative">
                <textarea 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={user ? 'Share a social learning post...' : 'Sign in to publish social posts'}
                  disabled={!user}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[160px] resize-none placeholder:text-slate-700 font-mono"
                />
                
                {selectedFile && (
                  <div className="absolute inset-2 bg-black/90 backdrop-blur-2xl rounded-xl border border-blue-500/40 overflow-hidden flex flex-col items-center justify-center p-4 animate-in zoom-in duration-300">
                    <button 
                      type="button" 
                      onClick={clearSelectedFile}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all z-20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {selectedFile.type === 'image' && <img src={selectedFile.data} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />}
                    {selectedFile.type === 'video' && (
                      <div className="w-full h-full flex flex-col items-center gap-3">
                        <video
                          src={selectedFile.data}
                          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                          controls
                          autoPlay
                          muted
                          playsInline
                        />
                        <span className="text-[10px] text-blue-300 font-black uppercase tracking-widest">Temporal Stream Ready</span>
                      </div>
                    )}
                    {selectedFile.type === 'file' && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-500/20 rounded-full flex items-center justify-center border border-white/10">
                          <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Static Data Buffered</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Link/Youtube Preview within Inject Panel */}
                {!selectedFile && (detectedYoutubeId || detectedUrl) && (
                  <div className="mt-2 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 mb-2">
                      {detectedYoutubeId ? <Youtube className="w-3.5 h-3.5 text-red-500" /> : <LinkIcon className="w-3.5 h-3.5 text-blue-400" />}
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Detected Link Layer</span>
                    </div>
                    {detectedYoutubeId ? (
                      <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                        <img src={`https://img.youtube.com/vi/${detectedYoutubeId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-50" />
                        <Play className="absolute w-8 h-8 text-white fill-white opacity-80" />
                      </div>
                    ) : (
                      <div className="text-[10px] text-blue-300 truncate font-mono">{detectedUrl}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => triggerUpload('image')}
                  disabled={!user}
                  className="flex flex-col items-center gap-2 p-3 bg-white/[0.02] hover:bg-blue-600/10 border border-white/10 rounded-xl text-slate-500 hover:text-blue-400 transition-all group/btn"
                >
                  <ImageIcon className="w-5 h-5 transition-transform" />
                  <span className="text-[7px] font-black uppercase tracking-[0.2em]">Image</span>
                </button>
                <button 
                  type="button"
                  onClick={() => triggerUpload('video')}
                  disabled={!user}
                  className="flex flex-col items-center gap-2 p-3 bg-white/[0.02] hover:bg-teal-600/10 border border-white/10 rounded-xl text-slate-500 hover:text-teal-400 transition-all group/btn"
                >
                  <FileVideo className="w-5 h-5 transition-transform" />
                  <span className="text-[7px] font-black uppercase tracking-[0.2em]">Video</span>
                </button>
                <button 
                  type="button"
                  onClick={() => triggerUpload('file')}
                  disabled={!user}
                  className="flex flex-col items-center gap-2 p-3 bg-white/[0.02] hover:bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-white transition-all group/btn"
                >
                  <FileText className="w-5 h-5 transition-transform" />
                  <span className="text-[7px] font-black uppercase tracking-[0.2em]">Data</span>
                </button>
              </div>

              <input type="file" ref={fileInputRef} className="hidden" />
              
              <button 
                type="submit"
                disabled={!user || (!newPost.trim() && !selectedFile) || isInjecting}
                className="w-full p-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800/50 disabled:text-slate-600 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3 relative overflow-hidden active:scale-95"
              >
                {isInjecting ? (
                  <>
                    <div className="absolute inset-0 bg-blue-400/20 animate-pulse" />
                    <Cpu className="w-4 h-4 animate-spin" />
                    Forging...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 lg:group-hover:translate-x-1 lg:group-hover:-translate-y-1 transition-transform" />
                    {user ? 'Commit to Network' : 'Sign In Required'}
                  </>
                )}
              </button>

              {injectError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-200">
                  {injectError}
                </div>
              )}
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Backend Auth Required
              </span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>

          {/* Sentinel Corner */}
          <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 shadow-2xl flex flex-col bg-black/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-teal-400 uppercase tracking-[0.4em] flex items-center gap-2">
                <Users className="w-4 h-4" /> Live Sentinels
              </h3>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Layer 1</span>
            </div>
            <div className="space-y-4 pr-2">
              <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-slate-400 text-xs leading-relaxed">
                Verified provider presence will appear here when backed by live provider data.
              </div>
            </div>
            <button
              onClick={() => void loadFeed()}
              className="mt-6 w-full py-4 bg-white/[0.03] hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
            >
              Deep Sync <Globe className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Main Content: The Collective Scroll */}
        <div className="lg:col-span-3 flex flex-col min-h-0 pb-20">
          <div className="flex items-center justify-between px-4 mb-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] flex items-center gap-3">
              <Layers className="w-4 h-4 text-blue-400" /> Algorithmic Stream
            </h3>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-lg shadow-xl transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('thread')}
                className={`p-2.5 rounded-lg shadow-xl transition-all ${viewMode === 'thread' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-8' : 'space-y-10'}>
            {postActionError && (
              <div className="xl:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-200">
                {postActionError}
              </div>
            )}
            {visibleNodes.length === 0 && (
              <div className="xl:col-span-2 glass-panel p-10 rounded-[2rem] border-white/10 text-center">
                <h4 className="text-lg font-black text-white uppercase tracking-tight">No social posts yet</h4>
                <p className="text-sm text-slate-400 mt-2">
                  Real posts created by signed-in members will appear here.
                </p>
              </div>
            )}
            {visibleNodes.map((node, i) => {
              const nodeUrl = getFirstUrl(node.content);
              const nodeYoutubeId = nodeUrl ? getYoutubeId(nodeUrl) : null;
              const isCommentsExpanded = expandedComments.includes(node.id);

              return (
                <div 
                  key={node.id} 
                  className="glass-panel rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden border-white/5 lg:hover:border-blue-500/20 transition-all duration-700 lg:hover:-translate-y-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] group relative bg-black/40 backdrop-blur-3xl"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="p-6 sm:p-12 flex flex-col gap-8 sm:gap-10">
                    <div className="flex-1 space-y-6 sm:space-y-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => void openProfileView(node.authorId)}
                          className="flex items-center gap-4 sm:gap-5 text-left group/author"
                        >
                          {renderAvatarMedia(
                            node.avatarMedia || normalizeMediaAsset({ url: node.avatar }),
                            node.author,
                            'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-4 ring-white/5 shadow-2xl'
                          )}
                          <div>
                            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tighter leading-none group-hover/author:text-blue-300 transition-colors">{node.author}</h4>
                            <p className="text-[9px] sm:text-[10px] text-blue-400/60 font-black uppercase tracking-widest mt-1.5">{node.timestamp}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 bg-teal-400/5 border border-teal-400/20 rounded-full w-fit">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                          <span className="text-[8px] sm:text-[9px] font-black text-teal-400 uppercase tracking-widest">NODE VERIFIED</span>
                        </div>
                      </div>

                      <div className="space-y-4 sm:space-y-5">
                        <h3 className="text-xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-tight sm:leading-none group-hover:text-blue-400 transition-colors drop-shadow-2xl">
                          {node.title}
                        </h3>

                        <div className="space-y-4">
                          {/* Main Media Content */}
                          {node.type === 'image' ? (
                            <div className="rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl transition-transform duration-[2s]">
                              <img src={node.content} className="w-full h-auto object-cover" alt={node.title} />
                            </div>
                          ) : node.type === 'video' ? (
                            <div className="rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl aspect-video bg-black relative">
                              <video
                                src={node.content}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                              />
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-slate-300 text-sm sm:text-xl leading-relaxed font-light opacity-80 max-w-4xl">
                                {node.content}
                              </p>
                              
                              {/* YouTube Embed */}
                              {nodeYoutubeId && (
                                <div className="rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl aspect-video bg-black animate-in zoom-in duration-700">
                                  <iframe 
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${nodeYoutubeId}`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              )}

                              {/* Generic Link Preview */}
                              {nodeUrl && !nodeYoutubeId && (
                                <a 
                                  href={nodeUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block p-4 sm:p-5 bg-blue-600/5 border border-blue-500/20 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-blue-600/10 transition-all group/link"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl shrink-0">
                                        <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[8px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">External Resource</p>
                                        <p className="text-[10px] sm:text-xs text-white truncate">{nodeUrl}</p>
                                      </div>
                                    </div>
                                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 shrink-0 lg:group-hover/link:text-blue-400 transition-all" />
                                  </div>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {user?.id && node.authorId === user.id && (
                        <div className="flex flex-wrap items-center gap-2">
                          {editingNodeId === node.id ? (
                            <div className="w-full space-y-3">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full min-h-[110px] bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => void saveNodeEdit(node.id)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  Save Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNodeId(null);
                                    setEditingText('');
                                  }}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => beginEditNode(node)}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => void deleteNode(node.id)}
                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="pt-6 sm:pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-6 sm:gap-8">
                        <div className="flex items-center gap-6 sm:gap-8">
                          <button 
                            onClick={() => toggleResonance(node.id)}
                            className={`flex items-center gap-2 sm:gap-3 transition-all group/btn ${node.hasResonated ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}
                          >
                            <Heart className={`w-5 h-5 sm:w-6 sm:h-6 lg:group-hover/btn:scale-125 transition-transform ${node.hasResonated ? 'fill-red-400' : ''}`} />
                            <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest">{node.resonances} Resonances</span>
                          </button>
                          <button 
                            onClick={() => toggleComments(node.id)}
                            className={`flex items-center gap-2 sm:gap-3 transition-all group/btn ${isCommentsExpanded ? 'text-blue-400' : 'text-slate-500 hover:text-blue-400'}`}
                          >
                            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 lg:group-hover/btn:scale-125 transition-transform" />
                            <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest">{node.comments.length} Linkages</span>
                          </button>
                        </div>
                        <button
                          onClick={() => void resonateGlobally(node)}
                          className="flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl sm:rounded-2xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all group shadow-xl w-full sm:w-auto justify-center active:scale-95"
                        >
                          Resonate Globally <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>

                      {/* Comment Section (Linkages) */}
                      {isCommentsExpanded && (
                        <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6 pt-6 sm:pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
                          <div className="space-y-4">
                            {node.comments.map((comment) => (
                              <div key={comment.id} className="flex gap-3 sm:gap-4 p-4 sm:p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] sm:rounded-[1.8rem] animate-in fade-in">
                                {renderAvatarMedia(
                                  normalizeMediaAsset({ url: comment.avatar }),
                                  comment.author,
                                  'w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover ring-2 ring-white/5 shrink-0'
                                )}
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <h5 className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-tighter truncate">{comment.author}</h5>
                                    <span className="text-[8px] sm:text-[9px] text-slate-600 uppercase font-black tracking-widest shrink-0">{comment.timestamp}</span>
                                  </div>
                                  <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed">{comment.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add Comment Input */}
                          <div className="flex items-center gap-2 sm:gap-3 pt-4">
                            <input 
                              type="text" 
                              value={commentInput[node.id] || ''}
                              onChange={(e) => setCommentInput(prev => ({ ...prev, [node.id]: e.target.value }))}
                              placeholder="Comments require the Phase 4 comments service"
                              disabled
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-[10px] sm:text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                              onKeyDown={(e) => e.key === 'Enter' && handleAddComment(node.id)}
                            />
                            <button 
                              onClick={() => handleAddComment(node.id)}
                              disabled
                              className="p-2.5 sm:p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-white transition-all active:scale-95"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div className="py-16 sm:py-24 text-center space-y-6 sm:space-y-8">
              <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 mx-auto opacity-10 animate-pulse" />
              <p className="text-[9px] sm:text-[11px] text-slate-700 uppercase tracking-[0.6em] sm:tracking-[0.8em] font-black">Syncing distant knowledge nodes...</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .animate-spin-slow { animation: spin 12s linear infinite; }
        .shadow-glow { box-shadow: 0 0 15px rgba(45, 212, 191, 0.6); }
      `}</style>
    </div>
  );
};

export default SocialLearningHub;
