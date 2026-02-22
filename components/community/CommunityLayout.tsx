
import React, { useState, useRef } from 'react';
import { 
  Camera, Edit3, Plus, ChevronRight, ArrowLeft, X, ShieldCheck, 
  UserCircle, Upload, LogOut, Layout, 
  Award, Zap, Shield, GraduationCap,
  Sparkles, PenTool, Bookmark, Lock, MessageSquare, Mail, Eye, EyeOff,
  Twitter, Github, Globe
} from 'lucide-react';
import { UserProfile, Course } from '../../types';
import { buildAuthHeaders } from '../../services/sessionService';

interface ConsciousIdentityProps {
  user: UserProfile | null;
  enrolledCourses: Course[];
  onComplete: (profileData: Partial<UserProfile>) => void;
  onSignOut: () => void;
  onGoBack: () => void;
  onSignInPrompt: () => void;
}

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

  const [isEditing, setIsEditing] = useState(!user.hasProfile);
  const [step, setStep] = useState(1);
  const [uploadingField, setUploadingField] = useState<'avatarUrl' | 'bannerUrl' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
  const toApiUrl = (route: string) => `${backendBaseUrl}${route}`;

  const [formData, setFormData] = useState({
    handle: user.handle || user.name.toLowerCase().replace(/\s+/g, '_'),
    bio: user.bio || '',
    location: user.location || '',
    dateOfBirth: user.dateOfBirth || '',
    interests: user.interests || [] as string[],
    avatarUrl: user.avatarUrl || `https://picsum.photos/seed/${user.name}/200`,
    bannerUrl: user.bannerUrl || `https://picsum.photos/seed/${user.name}_banner/1200/400`,
    profileMedia: user.profileMedia || {
      avatar: {
        url: user.avatarUrl || null,
        storageProvider: null,
        objectKey: null,
      },
      cover: {
        url: user.bannerUrl || null,
        storageProvider: null,
        objectKey: null,
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

  const [reflections, setReflections] = useState([
    { id: 1, text: "The journey toward digital autonomy begins with the first verified identity node.", date: "Today" },
    { id: 2, text: "Reflecting on the intersection of AI ethics and decentralized learning today.", date: "Yesterday" }
  ]);
  const [newReflection, setNewReflection] = useState('');

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
      const endpoint = field === 'avatarUrl' ? '/api/upload/avatar' : '/api/upload/cover';
      const payload = new FormData();
      payload.append('image', file);

      const response = await fetch(toApiUrl(endpoint), {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Upload failed');
      }

      const fileUrl = String(data?.fileUrl || '').trim();
      if (!fileUrl) {
        throw new Error('Upload succeeded without a file URL');
      }

      const media = data?.media || {};
      setFormData((prev) => ({
        ...prev,
        [field]: fileUrl,
        profileMedia: {
          ...prev.profileMedia,
          ...(field === 'avatarUrl'
            ? {
                avatar: {
                  url: fileUrl,
                  storageProvider: media.storageProvider || prev.profileMedia.avatar.storageProvider,
                  objectKey: media.objectKey || prev.profileMedia.avatar.objectKey,
                },
              }
            : {
                cover: {
                  url: fileUrl,
                  storageProvider: media.storageProvider || prev.profileMedia.cover.storageProvider,
                  objectKey: media.objectKey || prev.profileMedia.cover.objectKey,
                },
              }),
        },
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = () => {
    if (uploadingField) return;
    onComplete(formData);
    setIsEditing(false);
  };

  const addReflection = () => {
    if (!newReflection.trim()) return;
    setReflections([{ id: Date.now(), text: newReflection, date: "Just now" }, ...reflections]);
    setNewReflection('');
  };

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-8">
        <div className="glass-panel p-8 sm:p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden border-blue-500/20 shadow-blue-900/10">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
            <div className="h-full bg-gradient-to-r from-blue-600 to-teal-400 transition-all duration-500" style={{ width: `${(step/2)*100}%` }} />
          </div>

          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Evolve Your Identity</h2>
              <p className="text-slate-400 text-sm font-medium">Design your sovereign presence within the Conscious Network Hub.</p>
            </div>
            {user.hasProfile && (
              <button onClick={() => setIsEditing(false)} className="p-3 hover:bg-white/10 rounded-2xl text-slate-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {step === 1 ? (
            <div className="space-y-12 animate-in slide-in-from-right-4">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Aesthetic Layers</label>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">Step 1 of 2</span>
                </div>
                
                <div className="relative h-56 rounded-[2.5rem] overflow-hidden border border-white/10 group cursor-pointer shadow-inner" onClick={() => bannerInputRef.current?.click()}>
                  <img src={formData.bannerUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-full mb-3 shadow-2xl">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Replace Banner Image</span>
                  </div>
                  <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'bannerUrl')} />
                </div>

                <div className="flex justify-center -mt-24 relative z-10">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <div className="w-44 h-44 rounded-[4rem] p-1.5 bg-gradient-to-br from-blue-600 to-teal-400 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-8 ring-[#05070a] transition-transform group-hover:scale-105 duration-500">
                      <img src={formData.avatarUrl} className="w-full h-full rounded-[3.7rem] object-cover border-4 border-transparent" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-[4rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Camera className="w-10 h-10 text-white" />
                    </div>
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatarUrl')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Sovereign Handle</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Verified Node Name</label>
                  <div className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-3xl text-slate-500 cursor-not-allowed font-medium text-lg">
                    {user.name}
                  </div>
                </div>
              </div>

              {(uploadingField || uploadError) && (
                <div className={`rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-widest ${uploadError ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
                  {uploadError
                    ? uploadError
                    : `Uploading ${uploadingField === 'avatarUrl' ? 'avatar' : 'cover'} image...`}
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
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sovereign Connections</label>
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
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Privacy Toggles</label>
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
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-600/10 border-amber-500/50 text-white' : 'bg-blue-600/10 border-blue-500/50 text-white'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      <Shield className={`w-4 h-4 ${formData.privacySettings.profileVisibility === 'private' ? 'text-amber-400' : 'text-blue-400'}`} />
                      Profile Visibility
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-500/30 text-amber-300' : 'bg-blue-500/30 text-blue-300'}`}>
                      {formData.privacySettings.profileVisibility}
                    </div>
                  </button>
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, privacySettings: { ...prev.privacySettings, showEmail: !prev.privacySettings.showEmail }}))}
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${formData.privacySettings.showEmail ? 'bg-blue-600/10 border-blue-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      {formData.privacySettings.showEmail ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
                      Public Email
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.privacySettings.showEmail ? 'bg-blue-500' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.privacySettings.showEmail ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, privacySettings: { ...prev.privacySettings, allowMessages: !prev.privacySettings.allowMessages }}))}
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${formData.privacySettings.allowMessages ? 'bg-teal-600/10 border-teal-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
                      <MessageSquare className={`w-4 h-4 ${formData.privacySettings.allowMessages ? 'text-teal-400' : ''}`} />
                      Messaging
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
                  Encryption Agreement
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Establishing this identity will generate a unique hash in your browser's secure storage. Your portrait and banner remain encrypted locally until you broadcast to the Community Layer.
                </p>
              </div>

              <div className="flex gap-6">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-3xl font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" /> Previous
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-5 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white rounded-3xl font-bold text-xl shadow-2xl transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95"
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
    <div className="max-w-6xl mx-auto pb-32 space-y-12 animate-in fade-in duration-1000">
      <div className="relative group/header">
        <div className="glass-panel rounded-[4rem] overflow-hidden border-white/5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative">
          <div className="h-80 sm:h-[450px] relative overflow-hidden">
            <img src={formData.bannerUrl} className="w-full h-full object-cover group-hover/header:scale-105 transition-transform duration-[3s]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/20 to-transparent" />
            
            <div className="absolute top-10 right-10 flex gap-4 z-20">
              <button onClick={onGoBack} className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-[1.5rem] border border-white/10 transition-all text-white text-sm font-bold shadow-2xl hover:-translate-y-1">
                <Layout className="w-5 h-5" /> Back to Portal
              </button>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 backdrop-blur-xl rounded-[1.5rem] border border-blue-500/20 transition-all text-white text-sm font-bold shadow-2xl hover:-translate-y-1">
                <Edit3 className="w-5 h-5" /> Edit Profile
              </button>
              <button onClick={onSignOut} className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 backdrop-blur-xl rounded-[1.5rem] border border-red-500/20 transition-all text-red-400 text-sm font-bold hover:-translate-y-1">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </div>

          <div className="px-10 sm:px-16 pb-16 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-10 -mt-24 sm:-mt-36">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-8 text-center sm:text-left">
                <div className="relative group">
                  <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-[4.5rem] p-2 bg-gradient-to-br from-blue-600 to-teal-400 shadow-[0_30px_60px_rgba(0,0,0,0.6)] ring-[10px] ring-[#05070a] transition-transform group-hover:scale-105 duration-700">
                    <img src={formData.avatarUrl} className="w-full h-full rounded-[4.2rem] object-cover border-[10px] border-[#05070a]" />
                  </div>
                  {user.identityVerified && (
                    <div className="absolute bottom-10 right-0 p-3.5 bg-blue-600 rounded-[1.8rem] shadow-2xl ring-[10px] ring-[#05070a] group-hover:rotate-12 transition-transform">
                      <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                  )}
                </div>
                <div className="pb-10">
                  <h1 className="text-5xl sm:text-7xl font-bold text-white tracking-tighter leading-none mb-4 group flex items-center justify-center sm:justify-start">
                    {user.name}
                    <span className="inline-block ml-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <Sparkles className="w-10 h-10 text-teal-400" />
                    </span>
                  </h1>
                  <div className="flex items-center justify-center sm:justify-start gap-6">
                    <span className="text-blue-400 font-bold uppercase tracking-[0.4em] text-sm flex items-center gap-2">
                      <UserCircle className="w-4 h-4" /> @{formData.handle}
                    </span>
                    <div className="h-6 w-px bg-white/10 hidden sm:block" />
                    <div className="flex items-center gap-3 px-5 py-2 bg-teal-400/10 rounded-full border border-teal-400/20 shadow-inner">
                      <Award className="w-5 h-5 text-teal-400" />
                      <span className="text-[11px] text-teal-400 rounded-lg font-bold uppercase tracking-widest">{user.tier} Access</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-16">
              <div className="lg:col-span-2 space-y-16">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                    <UserCircle className="w-6 h-6 text-blue-500" /> Identity Mission Statement
                  </h3>
                  <p className="text-slate-200 leading-relaxed text-3xl font-light italic opacity-95 tracking-tight max-w-4xl">
                    "{formData.bio || "Your mission is the core of your conscious node. Define your intentions in the hub."}"
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="p-10 bg-white/5 border border-white/5 rounded-[3rem] hover:bg-white/10 transition-all group shadow-xl">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8 text-center sm:text-left">Verified Sovereignty</h4>
                    <div className="flex justify-center sm:justify-start gap-6">
                      <a 
                        href={formData.twitterUrl || '#'} 
                        target={formData.twitterUrl ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl ${formData.twitterUrl ? 'bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}
                      >
                        <Twitter className="w-7 h-7" />
                      </a>
                      <a 
                        href={formData.githubUrl || '#'} 
                        target={formData.githubUrl ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl ${formData.githubUrl ? 'bg-slate-500/10 hover:bg-slate-500 text-slate-400 hover:text-white' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}
                      >
                        <Github className="w-7 h-7" />
                      </a>
                      <a 
                        href={formData.websiteUrl || '#'} 
                        target={formData.websiteUrl ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`p-5 rounded-[1.8rem] transition-all hover:-translate-y-2 shadow-xl ${formData.websiteUrl ? 'bg-teal-500/10 hover:bg-teal-600 text-teal-400 hover:text-white' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}
                      >
                        <Globe className="w-7 h-7" />
                      </a>
                    </div>
                  </div>
                  <div className="p-10 bg-white/5 border border-white/5 rounded-[3rem] hover:bg-white/10 transition-all flex flex-col justify-between shadow-xl group">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Reputation Node</h4>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center">
                          <Zap className="w-7 h-7 text-yellow-400" />
                        </div>
                        <span className="text-xl text-slate-300 font-medium">Network Trust</span>
                      </div>
                      <span className="text-5xl font-mono font-bold text-white group-hover:scale-110 transition-transform">{user.reputationScore}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                <div className="glass-panel p-10 rounded-[3.5rem] border-blue-500/20 shadow-2xl space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Lock className="w-24 h-24 text-blue-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-6">Sovereign Privacy</h4>
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className={`w-5 h-5 ${formData.privacySettings.profileVisibility === 'private' ? 'text-amber-400' : 'text-blue-400'}`} />
                        <span className="text-sm font-medium text-slate-300">Profile Visibility</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.profileVisibility === 'private' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {formData.privacySettings.profileVisibility}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className={`w-5 h-5 ${formData.privacySettings.showEmail ? 'text-blue-400' : 'text-slate-600'}`} />
                        <span className="text-sm font-medium text-slate-300">Public Email</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.showEmail ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-600'}`}>
                        {formData.privacySettings.showEmail ? 'Broadcasting' : 'Cloaked'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className={`w-5 h-5 ${formData.privacySettings.allowMessages ? 'text-teal-400' : 'text-slate-600'}`} />
                        <span className="text-sm font-medium text-slate-300">Direct Comms</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${formData.privacySettings.allowMessages ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-slate-600'}`}>
                        {formData.privacySettings.allowMessages ? 'Enabled' : 'Restricted'}
                      </div>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all">
                      Configure Secure Layer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="glass-panel p-12 rounded-[4rem] border-white/5 shadow-2xl space-y-10">
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-bold text-white flex items-center gap-4">
              <PenTool className="w-8 h-8 text-blue-400" /> Sovereign Reflections
            </h3>
            <span className="px-4 py-1 bg-white/5 rounded-full text-[11px] text-slate-500 font-bold uppercase tracking-widest">{reflections.length} Nodes</span>
          </div>

          <div className="space-y-8">
            <div className="relative group">
              <textarea 
                value={newReflection}
                onChange={e => setNewReflection(e.target.value)}
                placeholder="Cast a thought into your sovereign node..."
                className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[160px] resize-none shadow-inner placeholder:text-slate-600"
              />
              <button 
                onClick={addReflection}
                disabled={!newReflection.trim()}
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl shadow-2xl transition-all active:scale-90 flex items-center justify-center"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-6 custom-scrollbar">
              {reflections.map(r => (
                <div key={r.id} className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] hover:bg-white/10 transition-all group/ref relative">
                  <p className="text-slate-200 text-lg leading-relaxed mb-4">{r.text}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 group-hover/ref:scale-150 transition-transform" />
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{r.date} Timestamp</span>
                    </div>
                    <button className="text-[10px] text-slate-700 hover:text-red-400 font-bold uppercase tracking-widest transition-colors opacity-0 group-hover/ref:opacity-100">Prune Node</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel p-12 rounded-[4rem] border-white/5 shadow-2xl space-y-10">
           <div className="flex justify-between items-center">
             <h3 className="text-3xl font-bold text-white flex items-center gap-4">
               <GraduationCap className="w-9 h-9 text-teal-400" /> Knowledge Vault
             </h3>
             <button onClick={onGoBack} className="flex items-center gap-2 px-5 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
               Pathways <ChevronRight className="w-4 h-4" />
             </button>
           </div>
           
           <div className="space-y-8">
             {enrolledCourses.length > 0 ? enrolledCourses.map(course => (
               <div key={course.id} className="flex gap-8 p-8 bg-white/5 rounded-[3rem] border border-white/5 group/course hover:border-teal-500/20 transition-all hover:-translate-x-2 cursor-pointer shadow-lg">
                 <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shrink-0 ring-4 ring-white/5">
                    <img src={course.image} className="w-full h-full object-cover group-hover/course:scale-125 transition-transform duration-[2s]" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xl font-bold text-white truncate group-hover/course:text-teal-400 transition-colors">{course.title}</h5>
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
               <div className="text-center py-24 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/5 group">
                 <Bookmark className="w-16 h-16 text-slate-700 mx-auto mb-6 group-hover:scale-110 transition-transform opacity-30" />
                 <p className="text-slate-500 text-lg font-medium italic">Your sovereign library is currently void.</p>
                 <button onClick={onGoBack} className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-xs font-bold text-white uppercase tracking-widest transition-all">Enroll Now</button>
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="text-center py-20 border-t border-white/5">
        <p className="text-[11px] text-slate-700 uppercase tracking-[0.6em] font-bold">
          CONSCIOUS NETWORK HUB NODE PROTOCOL v0.9.5-ESTABLISHED
        </p>
      </div>
    </div>
  );
};
