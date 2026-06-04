
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Camera, Edit3, Plus, ChevronRight, ArrowLeft, X, ShieldCheck, 
  UserCircle, Upload, LogOut, Layout, 
  Award, Zap, Shield, GraduationCap,
  Sparkles, PenTool, Bookmark, Lock, MessageSquare, Mail, Eye, EyeOff,
  Twitter, Github, Globe
} from 'lucide-react';
import { UserProfile, Course } from '../../types';
import { api, backendAssetUrl } from '../../services/apiClient';
import { openPrivateUpload } from '../../services/privateUploadService';
import ProfileIntegrityVerificationPanel from '../ProfileIntegrityVerificationPanel';

interface ConsciousIdentityProps {
  user: UserProfile | null;
  enrolledCourses: Course[];
  onComplete: (profileData: Partial<UserProfile>) => void;
  onSignOut: () => void;
  onGoBack: () => void;
  onSignInPrompt: () => void;
}

interface ReflectionRecord {
  id: string;
  content?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const decodeUploadObjectKeyMimeType = (objectKey?: string | null): string | null => {
  const raw = String(objectKey || '').trim();
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { mimeType?: unknown } | null;
    const mimeType = String(parsed?.mimeType || '').trim().toLowerCase();
    return mimeType || null;
  } catch {
    return null;
  }
};

const isLikelyVideoUrl = (url?: string | null): boolean => {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith('blob:')) return false;
  return /\.(mp4|webm|ogg|mov|m4v|avi)([?#].*)?$/.test(value);
};

const isVideoMediaAsset = (url?: string | null, mimeType?: string | null): boolean => {
  if (String(mimeType || '').toLowerCase().startsWith('video/')) return true;
  return isLikelyVideoUrl(url);
};

const normalizeMediaUrl = (value: unknown, objectKey?: unknown): string =>
  backendAssetUrl(objectKey) ||
  backendAssetUrl(value) ||
  (typeof value === 'string' ? value.trim() : '');

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

const MediaFallback: React.FC<{ className: string; label: string; compact?: boolean }> = ({
  className,
  label,
  compact = false,
}) => (
  <div
    className={`${className} flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_78%_72%,rgba(45,212,191,0.18),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] text-blue-100`}
    aria-label={label}
  >
    {compact ? (
      <span className="text-lg font-black uppercase text-blue-200 sm:text-2xl">{toInitials(label)}</span>
    ) : (
      <div className="px-6 text-center">
        <p className="text-[10px] font-black uppercase text-blue-200/70">Conscious Network Hub</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Profile media will appear here after upload.</p>
      </div>
    )}
  </div>
);

const ProfileMediaFrame: React.FC<{
  src?: string | null;
  isVideo?: boolean;
  alt: string;
  className: string;
  compactFallback?: boolean;
  mediaClassName?: string;
  autoPlay?: boolean;
}> = ({
  src,
  isVideo = false,
  alt,
  className,
  compactFallback = false,
  mediaClassName = 'object-cover',
  autoPlay = true,
}) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = String(src || '').trim();

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return <MediaFallback className={className} label={alt} compact={compactFallback} />;
  }

  if (isVideo) {
    return (
      <video
        src={resolvedSrc}
        className={`${className} ${mediaClassName}`}
        muted
        loop
        autoPlay={autoPlay}
        playsInline
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`${className} ${mediaClassName}`}
      onError={() => setFailed(true)}
    />
  );
};

export const ConsciousIdentity: React.FC<ConsciousIdentityProps> = ({ 
  user, 
  enrolledCourses, 
  onComplete, 
  onSignOut, 
  onGoBack,
  onSignInPrompt
}) => {
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6 animate-in fade-in zoom-in duration-700">
        <div className="glass-panel p-12 rounded-[4rem] text-center space-y-8 border-blue-500/20 shadow-[0_50px_100px_-20px_rgba(0,149,255,0.15)]">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-teal-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl rotate-3">
            <Lock className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-white tracking-tight">Identity Vault Locked</h2>
            <p className="text-slate-400 max-w-md mx-auto text-lg leading-relaxed">
              Your "Conscious Identity" is your sovereign node in the hub. To establish your presence, you must first initialize your local session.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={onSignInPrompt}
              className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 group"
            >
              Sign In to Identity <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onGoBack}
              className="px-10 py-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-lg border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isProviderTrustProfile =
    user.role === 'admin' ||
    (user.role === 'provider' &&
      user.providerApproved === true &&
      String(user.providerApprovalStatus || '').trim().toLowerCase() === 'approved' &&
      !user.providerRevokedAt);

  const [isEditing, setIsEditing] = useState(!user.hasProfile);
  const [step, setStep] = useState(1);
  const [uploadingField, setUploadingField] = useState<'avatarUrl' | 'bannerUrl' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    handle: user.handle || user.name.toLowerCase().replace(/\s+/g, '_'),
    bio: user.bio || '',
    location: user.location || '',
    dateOfBirth: user.dateOfBirth || '',
    interests: user.interests || [] as string[],
    avatarUrl: normalizeMediaUrl(user.avatarUrl, user.profileMedia?.avatar?.objectKey),
    bannerUrl: normalizeMediaUrl(user.bannerUrl, user.profileMedia?.cover?.objectKey),
    profileMedia: {
      avatar: {
        url: normalizeMediaUrl(
          user.profileMedia?.avatar?.url || user.avatarUrl,
          user.profileMedia?.avatar?.objectKey
        ) || null,
        storageProvider: user.profileMedia?.avatar?.storageProvider || null,
        objectKey: user.profileMedia?.avatar?.objectKey || null,
        mimeType: user.profileMedia?.avatar?.mimeType || null,
      },
      cover: {
        url: normalizeMediaUrl(
          user.profileMedia?.cover?.url || user.bannerUrl,
          user.profileMedia?.cover?.objectKey
        ) || null,
        storageProvider: user.profileMedia?.cover?.storageProvider || null,
        objectKey: user.profileMedia?.cover?.objectKey || null,
        mimeType: user.profileMedia?.cover?.mimeType || null,
      },
    },
    twitterUrl: user.twitterUrl || '',
    githubUrl: user.githubUrl || '',
    websiteUrl: user.websiteUrl || '',
    privacySettings: user.privacySettings || {
      profileVisibility: 'public',
      showEmail: false,
      allowMessages: true,
      blockedUsers: [],
    }
  });

  const platformContainerStyle = useMemo<React.CSSProperties>(() => {
    if (typeof navigator === 'undefined') return {};
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      return {
        paddingBottom: 'max(4rem, env(safe-area-inset-bottom))',
      };
    }
    if (/android/.test(ua)) {
      return {
        paddingBottom: '4.5rem',
      };
    }
    return {};
  }, []);

  const bannerMimeType =
    formData.profileMedia?.cover?.mimeType ||
    decodeUploadObjectKeyMimeType(formData.profileMedia?.cover?.objectKey);
  const avatarMimeType =
    formData.profileMedia?.avatar?.mimeType ||
    decodeUploadObjectKeyMimeType(formData.profileMedia?.avatar?.objectKey);
  const bannerIsVideo = isVideoMediaAsset(formData.bannerUrl, bannerMimeType);
  const avatarIsVideo = isVideoMediaAsset(formData.avatarUrl, avatarMimeType);
  const hasVerifiedIdentitySignal = Boolean(
    user.emailVerified || user.walletDid || user.providerWalletAddressBound
  );
  const securityStatusLabel = hasVerifiedIdentitySignal
    ? user.walletDid || user.providerWalletAddressBound
      ? 'Wallet linked'
      : 'Email verified'
    : 'Launch sign-in active';
  const securityStatusDetail = hasVerifiedIdentitySignal
    ? 'At least one identity signal is verified for this profile.'
    : 'Signed sessions are active. Email or wallet verification is not required for launch access.';

  const [reflections, setReflections] = useState<ReflectionRecord[]>([]);
  const [newReflection, setNewReflection] = useState('');
  const [reflectionFile, setReflectionFile] = useState<File | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionNotice, setReflectionNotice] = useState('');
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [editingReflectionContent, setEditingReflectionContent] = useState('');

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'avatarUrl' | 'bannerUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError('');
    setUploadingField(field);

    try {
      const endpoint = field === 'avatarUrl' ? '/upload/avatar' : '/upload/cover';
      const payload = new FormData();
      payload.append('image', file);

      const data = await api<any>(endpoint, {
        method: 'POST',
        body: payload,
      });

      const media = data?.media || {};
      const objectKey = typeof media?.objectKey === 'string' ? media.objectKey.trim() : '';
      const fileUrl = normalizeMediaUrl(data?.fileUrl, objectKey);
      if (!fileUrl) {
        throw new Error('Upload succeeded without a file URL');
      }

      const mediaUrl = normalizeMediaUrl(media?.url, objectKey) || fileUrl;
      setFormData((prev) => ({
        ...prev,
        [field]: fileUrl,
        profileMedia: {
          ...prev.profileMedia,
          ...(field === 'avatarUrl'
            ? {
                avatar: {
                  url: mediaUrl,
                  storageProvider: media.storageProvider || prev.profileMedia.avatar.storageProvider,
                  objectKey: media.objectKey || prev.profileMedia.avatar.objectKey,
                  mimeType: media.mimeType || file.type || prev.profileMedia.avatar.mimeType || null,
                },
              }
            : {
                cover: {
                  url: mediaUrl,
                  storageProvider: media.storageProvider || prev.profileMedia.cover.storageProvider,
                  objectKey: media.objectKey || prev.profileMedia.cover.objectKey,
                  mimeType: media.mimeType || file.type || prev.profileMedia.cover.mimeType || null,
                },
              }),
        },
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload media');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = () => {
    if (uploadingField) return;
    onComplete(formData);
    setIsEditing(false);
  };

  const loadReflections = async () => {
    setReflectionNotice('');
    try {
      const data = await api<{ reflections?: ReflectionRecord[] }>(`/reflection/${user.id}`, {
        cache: 'no-store',
      });
      setReflections(Array.isArray(data.reflections) ? data.reflections : []);
    } catch (error) {
      setReflectionNotice(
        error instanceof Error ? error.message : 'Unable to load private reflections.'
      );
    }
  };

  useEffect(() => {
    void loadReflections();
  }, [user.id]);

  const addReflection = async () => {
    if (!reflectionFile) {
      setReflectionNotice('Choose a private reflection file before saving.');
      return;
    }

    setReflectionLoading(true);
    setReflectionNotice('');
    try {
      const payload = new FormData();
      payload.append('file', reflectionFile);
      const upload = await api<any>('/upload/reflection', {
        method: 'POST',
        body: payload,
      });
      const fileUrl = normalizeMediaUrl(upload?.fileUrl);
      if (!fileUrl) {
        throw new Error('Private reflection upload did not return a file URL.');
      }
      const fileType = reflectionFile.type.startsWith('video/') ? 'video' : 'document';
      await api('/reflection', {
        method: 'POST',
        body: {
          userId: user.id,
          content: newReflection,
          fileUrl,
          fileType,
        },
      });
      setNewReflection('');
      setReflectionFile(null);
      await loadReflections();
      setReflectionNotice('Private reflection saved.');
    } catch (error) {
      setReflectionNotice(error instanceof Error ? error.message : 'Unable to save reflection.');
    } finally {
      setReflectionLoading(false);
    }
  };

  const updateReflection = async (reflectionId: string) => {
    setReflectionLoading(true);
    setReflectionNotice('');
    try {
      const data = await api<{ reflection?: ReflectionRecord }>(`/reflection/${reflectionId}`, {
        method: 'PATCH',
        body: { content: editingReflectionContent },
      });
      setReflections((current) =>
        current.map((reflection) =>
          reflection.id === reflectionId
            ? { ...reflection, content: data.reflection?.content ?? editingReflectionContent }
            : reflection
        )
      );
      setEditingReflectionId(null);
      setEditingReflectionContent('');
      setReflectionNotice('Reflection notes updated.');
    } catch (error) {
      setReflectionNotice(error instanceof Error ? error.message : 'Unable to update reflection.');
    } finally {
      setReflectionLoading(false);
    }
  };

  const pruneReflection = async (reflectionId: string) => {
    setReflectionLoading(true);
    setReflectionNotice('');
    try {
      await api(`/reflection/${reflectionId}`, { method: 'DELETE' });
      setReflections((prev) => prev.filter((reflection) => reflection.id !== reflectionId));
      setReflectionNotice('Private reflection deleted.');
    } catch (error) {
      setReflectionNotice(error instanceof Error ? error.message : 'Unable to delete reflection.');
    } finally {
      setReflectionLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto py-8 sm:py-12 px-3 sm:px-4 animate-in fade-in slide-in-from-bottom-8">
        <div className="glass-panel p-5 sm:p-8 lg:p-12 rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl relative overflow-hidden border-blue-500/20 shadow-blue-900/10">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
            <div className="h-full bg-gradient-to-r from-blue-600 to-teal-400 transition-all duration-500" style={{ width: `${(step/2)*100}%` }} />
          </div>

          <div className="flex justify-between items-start gap-4 mb-8 sm:mb-10">
            <div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Evolve Your Identity</h2>
              <p className="text-slate-400 text-xs sm:text-sm font-medium">Design your sovereign presence within the Conscious Network Hub.</p>
            </div>
            {user.hasProfile && (
              <button onClick={() => setIsEditing(false)} className="p-3 hover:bg-white/10 rounded-2xl text-slate-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {step === 1 ? (
            <div className="space-y-8 sm:space-y-12 animate-in slide-in-from-right-4">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Aesthetic Layers</label>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">Step 1 of 2</span>
                </div>
                
                <div className="group relative h-44 cursor-pointer overflow-hidden rounded-[1.5rem] border border-white/10 shadow-inner transition-all sm:h-52 sm:rounded-[2rem]" onClick={() => bannerInputRef.current?.click()}>
                  <ProfileMediaFrame
                    src={formData.bannerUrl}
                    isVideo={bannerIsVideo}
                    alt={`${user.name} banner`}
                    className="h-full w-full"
                    mediaClassName="object-cover object-center transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-full mb-3 shadow-2xl">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Replace Banner Image</span>
                  </div>
                  <input type="file" ref={bannerInputRef} className="hidden" accept="image/*,video/*,.gif,.mp4,.webm,.mov" onChange={(e) => handleFileUpload(e, 'bannerUrl')} />
                </div>

                <div className="relative z-10 flex justify-center -mt-12 sm:-mt-16">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <div className="h-32 w-32 rounded-[2.4rem] bg-gradient-to-br from-blue-600 to-teal-400 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-8 ring-[#05070a] transition-transform duration-500 group-hover:scale-105 sm:h-40 sm:w-40 sm:rounded-[3.2rem]">
                      <ProfileMediaFrame
                        src={formData.avatarUrl}
                        isVideo={avatarIsVideo}
                        alt={user.name}
                        compactFallback
                        className="h-full w-full rounded-[2.1rem] border-4 border-transparent sm:rounded-[2.9rem]"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-[2.6rem] sm:rounded-[4rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Camera className="w-10 h-10 text-white" />
                    </div>
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*,video/*,.gif,.mp4,.webm,.mov" onChange={(e) => handleFileUpload(e, 'avatarUrl')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Profile Handle</label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-lg group-focus-within:text-teal-400 transition-colors">@</span>
                    <input 
                      type="text" 
                      value={formData.handle}
                      onChange={e => setFormData({...formData, handle: e.target.value})}
                      className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white focus:ring-2 focus:ring-blue-500/30 transition-all outline-none text-lg font-medium shadow-inner"
                      placeholder="username"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Profile Name</label>
                  <div className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-3xl text-slate-500 cursor-not-allowed font-medium text-lg">
                    {user.name}
                  </div>
                </div>
              </div>

              {(uploadingField || uploadError) && (
                <div className={`rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-widest ${uploadError ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
                  {uploadError
                    ? uploadError
                    : `Uploading ${uploadingField === 'avatarUrl' ? 'avatar' : 'cover'} media...`}
                </div>
              )}
               
              <button 
                onClick={() => setStep(2)}
                disabled={Boolean(uploadingField)}
                className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-60 text-white rounded-3xl font-bold text-xl shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95"
              >
                Continue Design <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="space-y-10 animate-in slide-in-from-right-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Identity Mission Statement</label>
                  <span className="text-[10px] text-teal-400 font-bold uppercase">Step 2 of 2</span>
                </div>
                <textarea 
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white focus:ring-2 focus:ring-teal-500/30 transition-all outline-none min-h-[160px] resize-none text-lg leading-relaxed placeholder:text-slate-600 shadow-inner"
                  placeholder="What values do you bring to the network? Define your learning objectives and sovereign intentions..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-teal-500/30 outline-none text-sm shadow-inner"
                    placeholder="City, Country"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth ? String(formData.dateOfBirth).slice(0, 10) : ''}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-teal-500/30 outline-none text-sm shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Public Links</label>
                <div className="space-y-4">
                  <div className="relative group">
                    <Twitter className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                    <input 
                      type="url" 
                      value={formData.twitterUrl}
                      onChange={e => setFormData({...formData, twitterUrl: e.target.value})}
                      className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500/30 outline-none text-sm shadow-inner"
                      placeholder="Twitter URL"
                    />
                  </div>
                  <div className="relative group">
                    <Github className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="url" 
                      value={formData.githubUrl}
                      onChange={e => setFormData({...formData, githubUrl: e.target.value})}
                      className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-slate-500/30 outline-none text-sm shadow-inner"
                      placeholder="Github URL"
                    />
                  </div>
                  <div className="relative group">
                    <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-400" />
                    <input 
                      type="url" 
                      value={formData.websiteUrl}
                      onChange={e => setFormData({...formData, websiteUrl: e.target.value})}
                      className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-teal-500/30 outline-none text-sm shadow-inner"
                      placeholder="Website URL"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Privacy Settings</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        privacySettings: {
                          ...prev.privacySettings,
                          profileVisibility:
                            prev.privacySettings.profileVisibility === 'public'
                              ? 'private'
                              : 'public',
                        },
                      }))
                    }
                    className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all xs:flex-row xs:items-center xs:justify-between ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-600/10 border-amber-500/50 text-white' : 'bg-blue-600/10 border-blue-500/50 text-white'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      <Shield className={`w-4 h-4 ${formData.privacySettings.profileVisibility === 'private' ? 'text-amber-400' : 'text-blue-400'}`} />
                      Profile Visibility
                    </div>
                    <div className={`cnh-status-badge px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-500/30 text-amber-300' : 'bg-blue-500/30 text-blue-300'}`}>
                      {formData.privacySettings.profileVisibility}
                    </div>
                  </button>
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, privacySettings: { ...prev.privacySettings, showEmail: !prev.privacySettings.showEmail }}))}
                    className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all xs:flex-row xs:items-center xs:justify-between ${formData.privacySettings.showEmail ? 'bg-blue-600/10 border-blue-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      {formData.privacySettings.showEmail ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
                      Email Visibility
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.privacySettings.showEmail ? 'bg-blue-500' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.privacySettings.showEmail ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, privacySettings: { ...prev.privacySettings, allowMessages: !prev.privacySettings.allowMessages }}))}
                    className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all xs:flex-row xs:items-center xs:justify-between ${formData.privacySettings.allowMessages ? 'bg-teal-600/10 border-teal-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      <MessageSquare className={`w-4 h-4 ${formData.privacySettings.allowMessages ? 'text-teal-400' : ''}`} />
                      Future Messaging Preference
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.privacySettings.allowMessages ? 'bg-teal-500' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.privacySettings.allowMessages ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] relative group">
                <div className="absolute -top-4 -right-4 p-4 bg-blue-600 rounded-2xl shadow-xl group-hover:rotate-12 transition-transform">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-base font-bold text-blue-400 flex items-center gap-2 mb-3 uppercase tracking-widest">
                  Storage and Privacy Notice
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Profile changes are saved to your authenticated account. Avatar and cover media are public profile media; reflection uploads use private authenticated storage.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-3xl font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" /> Previous
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-5 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white rounded-3xl font-bold text-base sm:text-xl shadow-2xl transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95"
                >
                  Anchor Identity <Sparkles className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-16 sm:pb-24 md:pb-32 space-y-8 sm:space-y-12 animate-in fade-in duration-1000 overflow-x-hidden"
      style={platformContainerStyle}
    >
      <div className="relative group/header">
        <div className="glass-panel relative overflow-hidden rounded-[2rem] border-white/5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] sm:rounded-[2.75rem]">
          <div className="relative h-[180px] overflow-hidden sm:h-[240px] lg:h-[280px] xl:h-[320px]">
            <ProfileMediaFrame
              src={formData.bannerUrl}
              isVideo={bannerIsVideo}
              alt={`${user.name} banner`}
              className="h-full w-full"
              mediaClassName="object-cover object-center transition-transform duration-[3s] group-hover/header:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/20 to-transparent" />
            
            <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 lg:left-auto lg:right-6 flex flex-wrap gap-2 sm:gap-3 z-20 lg:justify-end">
              <button onClick={onGoBack} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] border border-white/10 transition-all text-white text-xs sm:text-sm font-bold shadow-2xl hover:-translate-y-1">
                <Layout className="w-5 h-5" /> Back to Portal
              </button>
              <button onClick={() => setIsEditing(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] border border-blue-500/20 transition-all text-white text-xs sm:text-sm font-bold shadow-2xl hover:-translate-y-1">
                <Edit3 className="w-5 h-5" /> Edit Profile
              </button>
              <button onClick={onSignOut} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-500/10 hover:bg-red-500/20 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] border border-red-500/20 transition-all text-red-400 text-xs sm:text-sm font-bold hover:-translate-y-1">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </div>

          <div className="relative px-4 pb-10 sm:px-8 sm:pb-14 lg:px-10 xl:px-14">
            <div className="-mt-12 grid grid-cols-1 items-end gap-5 sm:-mt-16 lg:-mt-20 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-7 xl:gap-9">
              <div className="flex justify-center lg:justify-start">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-teal-400 p-1.5 shadow-[0_30px_60px_rgba(0,0,0,0.6)] ring-[6px] ring-[#05070a] transition-transform duration-700 group-hover:scale-105 sm:h-40 sm:w-40 sm:rounded-[3.25rem] lg:h-44 lg:w-44">
                    <ProfileMediaFrame
                      src={formData.avatarUrl}
                      isVideo={avatarIsVideo}
                      alt={user.name}
                      compactFallback
                      className="h-full w-full rounded-[2.2rem] border-[6px] border-[#05070a] sm:rounded-[2.95rem]"
                    />
                  </div>
                  {hasVerifiedIdentitySignal && (
                    <div className="absolute bottom-2 right-0 rounded-[1.2rem] bg-blue-600 p-2.5 shadow-2xl ring-[6px] ring-[#05070a] transition-transform group-hover:rotate-12 sm:bottom-3 sm:p-3">
                      <ShieldCheck className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 max-w-full pb-1 text-center lg:pb-5 lg:text-left">
                  <h1 className="cnh-person-name group mb-4 flex max-w-full items-center justify-center text-[clamp(1.75rem,3vw,3.25rem)] font-bold leading-[1.05] tracking-tight text-white lg:justify-start">
                    <span className="min-w-0 [overflow-wrap:normal] [word-break:normal]">{user.name}</span>
                    <span className="hidden shrink-0 sm:inline-block ml-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <Sparkles className="h-7 w-7 text-teal-400 sm:h-8 sm:w-8" />
                    </span>
                  </h1>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6 min-w-0">
                    <span className="cnh-profile-field flex max-w-full min-w-0 items-center gap-2 text-[11px] font-bold uppercase text-blue-400 sm:text-sm">
                      <UserCircle className="h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">@{formData.handle}</span>
                    </span>
                    <div className="h-6 w-px bg-white/10 hidden sm:block" />
                    <div className="flex max-w-full items-center gap-3 rounded-full border border-teal-400/20 bg-teal-400/10 px-4 py-2 shadow-inner">
                      <Award className="h-5 w-5 shrink-0 text-teal-400" />
                      <span className="cnh-status-badge text-[11px] text-teal-400 rounded-lg font-bold uppercase tracking-widest">{user.tier} Access</span>
                    </div>
                  </div>
              </div>
            </div>
            
            <div className="mt-10 grid grid-cols-1 gap-7 xl:grid-cols-3 xl:gap-10">
              <div className="space-y-8 xl:col-span-2">
                <div className="space-y-5">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                    <UserCircle className="w-6 h-6 text-blue-500" /> Identity Mission Statement
                  </h3>
                  <p className="cnh-user-content max-w-4xl text-[clamp(1rem,1.6vw,1.55rem)] font-light italic leading-relaxed tracking-tight text-slate-200 opacity-95">
                    "{formData.bio || "Your mission is the core of your conscious node. Define your intentions in the hub."}"
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/5 bg-white/5 p-5 shadow-xl transition-all hover:bg-white/10 sm:p-7">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8 text-center sm:text-left">Public Links</h4>
                    <div className="flex justify-center sm:justify-start gap-6">
                      {formData.twitterUrl ? (
                        <a
                          href={formData.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white"
                        >
                          <Twitter className="w-7 h-7" />
                        </a>
                      ) : (
                        <span className="p-5 rounded-[1.8rem] shadow-xl bg-white/5 text-slate-700 cursor-not-allowed">
                          <Twitter className="w-7 h-7" />
                        </span>
                      )}
                      {formData.githubUrl ? (
                        <a
                          href={formData.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl bg-slate-500/10 hover:bg-slate-500 text-slate-400 hover:text-white"
                        >
                          <Github className="w-7 h-7" />
                        </a>
                      ) : (
                        <span className="p-5 rounded-[1.8rem] shadow-xl bg-white/5 text-slate-700 cursor-not-allowed">
                          <Github className="w-7 h-7" />
                        </span>
                      )}
                      {formData.websiteUrl ? (
                        <a
                          href={formData.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl bg-teal-500/10 hover:bg-teal-600 text-teal-400 hover:text-white"
                        >
                          <Globe className="w-7 h-7" />
                        </a>
                      ) : (
                        <span className="p-5 rounded-[1.8rem] shadow-xl bg-white/5 text-slate-700 cursor-not-allowed">
                          <Globe className="w-7 h-7" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between rounded-[1.5rem] border border-white/5 bg-white/5 p-5 shadow-xl transition-all hover:bg-white/10 sm:p-7">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Account Security</h4>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center">
                          <Zap className="w-7 h-7 text-yellow-400" />
                        </div>
                        <span className="text-base sm:text-lg text-slate-300 font-medium">Security Status</span>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="block text-xl sm:text-2xl font-bold text-white">{securityStatusLabel}</span>
                        <span className="mt-2 block max-w-xs text-xs leading-5 text-slate-500">{securityStatusDetail}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass-panel relative overflow-hidden rounded-[1.75rem] border-blue-500/20 p-5 shadow-2xl sm:p-7">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Lock className="w-24 h-24 text-blue-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-6">Profile Privacy</h4>
                  <div className="space-y-6 relative z-10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className={`w-5 h-5 ${formData.privacySettings.profileVisibility === 'private' ? 'text-amber-400' : 'text-blue-400'}`} />
                        <span className="text-sm font-medium text-slate-300">Profile Visibility</span>
                      </div>
                      <div className={`cnh-status-badge px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {formData.privacySettings.profileVisibility}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className={`w-5 h-5 ${formData.privacySettings.showEmail ? 'text-blue-400' : 'text-slate-600'}`} />
                        <span className="text-sm font-medium text-slate-300">Email Visibility</span>
                      </div>
                      <div className={`cnh-status-badge px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.showEmail ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-600'}`}>
                        {formData.privacySettings.showEmail ? 'Visible on Profile' : 'Hidden'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className={`w-5 h-5 ${formData.privacySettings.allowMessages ? 'text-teal-400' : 'text-slate-600'}`} />
                        <span className="text-sm font-medium text-slate-300">Messaging Preference</span>
                      </div>
                      <div className={`cnh-status-badge px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.allowMessages ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-slate-600'}`}>
                        {formData.privacySettings.allowMessages ? 'Opted In' : 'Opted Out'}
                      </div>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Messaging preference is saved to your profile settings. Full direct messaging is not active in the launch path.
                    </p>
                    <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all">
                      Edit Privacy Settings
                    </button>
                  </div>
                </div>

                {isProviderTrustProfile && (
                  <ProfileIntegrityVerificationPanel
                    user={user}
                    profilePayload={{
                      name: user.name,
                      handle: formData.handle,
                      bio: formData.bio || null,
                      location: formData.location || null,
                      dateOfBirth: formData.dateOfBirth || null,
                      avatarUrl: formData.profileMedia.avatar.url || formData.avatarUrl || null,
                      bannerUrl: formData.profileMedia.cover.url || formData.bannerUrl || null,
                      interests: formData.interests,
                      links: {
                        twitterUrl: formData.twitterUrl || null,
                        githubUrl: formData.githubUrl || null,
                        websiteUrl: formData.websiteUrl || null,
                      },
                      privacySettings: formData.privacySettings,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-16">
        <div className="glass-panel p-6 sm:p-8 2xl:p-12 rounded-[2rem] sm:rounded-[3rem] 2xl:rounded-[4rem] border-white/5 shadow-2xl space-y-8 sm:space-y-10">
          <div className="flex justify-between items-center gap-3">
            <h3 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 sm:gap-4">
              <PenTool className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" /> Private Reflections
            </h3>
            <span className="px-4 py-1 bg-white/5 rounded-full text-[11px] text-slate-500 font-bold uppercase tracking-widest">{reflections.length} Saved</span>
          </div>

          <div className="space-y-6 sm:space-y-8">
            <div className="space-y-4">
              <textarea 
                value={newReflection}
                onChange={e => setNewReflection(e.target.value)}
                placeholder="Optional private notes for this reflection file"
                className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 text-base sm:text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[160px] resize-none shadow-inner placeholder:text-slate-600"
              />
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <input
                  key={reflectionFile ? reflectionFile.name : 'reflection-file-empty'}
                  type="file"
                  accept="video/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf"
                  onChange={(event) => setReflectionFile(event.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white"
                />
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Reflection files are stored as private uploads and require your signed session to open.
                </p>
              </div>
              <button 
                onClick={addReflection}
                disabled={reflectionLoading || !reflectionFile}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-2xl transition-all hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                {reflectionLoading ? 'Saving' : 'Save Private Reflection'}
              </button>
              {reflectionNotice && (
                <p className="rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4 text-xs leading-5 text-blue-100">
                  {reflectionNotice}
                </p>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6 max-h-[500px] overflow-y-auto pr-2 sm:pr-6 custom-scrollbar">
              {reflections.length === 0 && (
                <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.04] p-5 text-sm leading-6 text-slate-300">
                  No private reflections saved yet.
                </div>
              )}
              {reflections.map(r => (
                <div key={r.id} className="p-5 sm:p-8 bg-white/5 border border-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] hover:bg-white/10 transition-all group/ref relative">
                  {editingReflectionId === r.id ? (
                    <div className="mb-4 space-y-3">
                      <textarea
                        value={editingReflectionContent}
                        onChange={(event) => setEditingReflectionContent(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void updateReflection(r.id)}
                          disabled={reflectionLoading}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
                        >
                          Save Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReflectionId(null);
                            setEditingReflectionContent('');
                          }}
                          disabled={reflectionLoading}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="cnh-user-content text-slate-200 text-base sm:text-lg leading-relaxed mb-4">
                      {r.content || 'Private reflection file saved.'}
                    </p>
                  )}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 group-hover/ref:scale-150 transition-transform" />
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void openPrivateUpload({
                            url: r.fileUrl || '',
                            originalName: r.fileType === 'video' ? 'reflection-video' : 'reflection-document',
                          }).catch((error) => {
                            setReflectionNotice(error instanceof Error ? error.message : 'Unable to open private reflection.');
                          });
                        }}
                        className="text-[10px] text-blue-300 hover:text-blue-100 font-bold uppercase tracking-widest transition-colors"
                      >
                        Open Private File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReflectionId(r.id);
                          setEditingReflectionContent(r.content || '');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-widest transition-colors"
                      >
                        Edit Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => void pruneReflection(r.id)}
                        disabled={reflectionLoading}
                        className="text-[10px] text-slate-500 hover:text-red-300 font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 sm:p-8 2xl:p-12 rounded-[2rem] sm:rounded-[3rem] 2xl:rounded-[4rem] border-white/5 shadow-2xl space-y-8 sm:space-y-10">
           <div className="flex justify-between items-center gap-3">
             <h3 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 sm:gap-4">
               <GraduationCap className="w-7 h-7 sm:w-9 sm:h-9 text-teal-400" /> Knowledge Vault
             </h3>
             <button onClick={onGoBack} className="flex items-center gap-2 px-5 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
               Pathways <ChevronRight className="w-4 h-4" />
             </button>
           </div>
           
           <div className="space-y-6 sm:space-y-8">
             {enrolledCourses.length > 0 ? enrolledCourses.map(course => (
               <div key={course.id} className="flex flex-col sm:flex-row gap-5 sm:gap-8 p-5 sm:p-8 bg-white/5 rounded-[2rem] sm:rounded-[3rem] border border-white/5 group/course hover:border-teal-500/20 transition-all sm:hover:-translate-x-2 cursor-pointer shadow-lg">
                 <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shrink-0 ring-4 ring-white/5">
                    <img src={course.image} className="w-full h-full object-cover group-hover/course:scale-125 transition-transform duration-[2s]" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-3">
                    <h5 className="min-w-0 break-words text-xl font-bold leading-tight text-white group-hover/course:text-teal-400 transition-colors">{course.title}</h5>
                    <span className="text-[10px] px-3 py-1 bg-white/10 text-slate-400 rounded-lg uppercase font-bold tracking-widest">{course.tier}</span>
                   </div>
                   <p className="text-xs text-slate-500 uppercase tracking-widest mb-5 font-bold">{course.provider}</p>
                   <div className="flex items-center gap-5">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-blue-500" style={{ width: `${course.progress || 35}%` }} />
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-400">{course.progress || 35}% Synced</span>
                   </div>
                 </div>
               </div>
             )) : (
               <div className="text-center py-16 sm:py-24 bg-white/5 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-white/5 group">
                 <Bookmark className="w-16 h-16 text-slate-700 mx-auto mb-6 group-hover:scale-110 transition-transform opacity-30" />
                 <p className="text-slate-500 text-lg font-medium italic">Your sovereign library is currently void.</p>
                 <button onClick={onGoBack} className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-xs font-bold text-white uppercase tracking-widest transition-all">Enroll Now</button>
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="text-center py-12 sm:py-20 border-t border-white/5">
        <p className="text-[10px] sm:text-[11px] text-slate-700 uppercase tracking-[0.35em] sm:tracking-[0.6em] font-bold">
          Profile and private reflections are protected by your signed platform session
        </p>
      </div>
    </div>
  );
};
