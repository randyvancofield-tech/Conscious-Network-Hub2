import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';
import { UserProfile } from '../types';
import { buildAuthHeaders } from '../services/sessionService';

interface Reflection {
  id: string;
  content?: string;
  fileUrl?: string;
  fileType?: string;
  createdAt: string;
}

interface ProfileProps {
  user: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
}

const isLikelyVideoUrl = (url?: string): boolean => {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith('blob:')) return false;
  return /\.(mp4|webm|ogg|mov|m4v|avi)([?#].*)?$/.test(value);
};

const Profile: React.FC<ProfileProps> = ({ user, onUserUpdate }) => {
  const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
  const toApiUrl = (path: string) => `${backendBaseUrl}${path}`;
  const toAssetUrl = (url?: string) => {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    return `${backendBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const [editData, setEditData] = useState<Partial<UserProfile>>({ ...user });
  const [bgVideo, setBgVideo] = useState<File | null>(null);
  const [bgVideoUrl, setBgVideoUrl] = useState<string | undefined>(toAssetUrl(user.profileBackgroundVideo));
  const [avatarImage, setAvatarImage] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>(toAssetUrl(user.avatarUrl));
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | undefined>(toAssetUrl(user.bannerUrl));
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reflectionFile, setReflectionFile] = useState<File | null>(null);
  const [reflectionContent, setReflectionContent] = useState('');
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [editingReflectionContent, setEditingReflectionContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securityState, setSecurityState] = useState<{
    twoFactorMethod: 'none' | 'phone' | 'wallet';
    phoneNumberMasked: string | null;
    walletDid: string | null;
  }>({
    twoFactorMethod: user.twoFactorMethod || 'none',
    phoneNumberMasked: user.phoneNumberMasked || null,
    walletDid: user.walletDid || null,
  });
  const [phoneEnrollInput, setPhoneEnrollInput] = useState('');
  const [walletEnrollInput, setWalletEnrollInput] = useState('');
  const [error, setError] = useState('');

  const avatarPreviewIsVideo = (avatarImage ? avatarImage.type : '').startsWith('video/') || isLikelyVideoUrl(avatarPreviewUrl);
  const coverPreviewIsVideo = (coverImage ? coverImage.type : '').startsWith('video/') || isLikelyVideoUrl(coverPreviewUrl);

  useEffect(() => {
    fetchReflections();
  }, [user.id]);

  useEffect(() => {
    setEditData({ ...user });
    setBgVideoUrl(toAssetUrl(user.profileBackgroundVideo));
    setAvatarPreviewUrl(toAssetUrl(user.avatarUrl));
    setCoverPreviewUrl(toAssetUrl(user.bannerUrl));
    setSecurityState({
      twoFactorMethod: user.twoFactorMethod || 'none',
      phoneNumberMasked: user.phoneNumberMasked || null,
      walletDid: user.walletDid || null,
    });
  }, [user.id, user.name, user.profileBackgroundVideo, user.avatarUrl, user.bannerUrl, user.twoFactorMethod, user.phoneNumberMasked, user.walletDid]);

  useEffect(() => {
    fetchSecuritySettings();
  }, [user.id]);

  const fetchReflections = async () => {
    try {
      const res = await axios.get(toApiUrl(`/api/reflection/${user.id}`), {
        headers: buildAuthHeaders(),
      });
      setReflections(
        (res.data.reflections || []).map((reflection: Reflection) => ({
          ...reflection,
          fileUrl: toAssetUrl(reflection.fileUrl),
        }))
      );
    } catch (e) {
      setError('Failed to load reflections');
    }
  };

  const fetchSecuritySettings = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await axios.get(toApiUrl('/api/user/security'), {
        headers: buildAuthHeaders(),
      });
      const security = res.data?.security || {};
      setSecurityState({
        twoFactorMethod: security.twoFactorMethod || 'none',
        phoneNumberMasked: security.phoneNumberMasked || null,
        walletDid: security.walletDid || null,
      });
      onUserUpdate({
        ...user,
        twoFactorEnabled: security.twoFactorMethod && security.twoFactorMethod !== 'none',
        twoFactorMethod: security.twoFactorMethod || 'none',
        phoneNumberMasked: security.phoneNumberMasked || null,
        walletDid: security.walletDid || null,
      });
    } catch {
      setSecurityError('Failed to load security settings');
    } finally {
      setSecurityLoading(false);
    }
  };

  const enrollPhoneTwoFactor = async () => {
    if (!phoneEnrollInput.trim()) {
      setSecurityError('Enter a phone number to enroll phone 2FA');
      return;
    }

    setSecurityLoading(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      await axios.post(
        toApiUrl('/api/user/2fa/phone/enroll'),
        { phoneNumber: phoneEnrollInput.trim() },
        { headers: buildAuthHeaders() }
      );
      setPhoneEnrollInput('');
      setSecurityMessage('Phone 2FA enabled');
      await fetchSecuritySettings();
    } catch (e: any) {
      setSecurityError(
        e?.response?.data?.error || 'Failed to enable phone 2FA'
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const enrollWalletTwoFactor = async () => {
    if (!walletEnrollInput.trim()) {
      setSecurityError('Enter an address DID to enroll signature-based 2FA');
      return;
    }

    setSecurityLoading(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      await axios.post(
        toApiUrl('/api/user/2fa/wallet/enroll'),
        { walletDid: walletEnrollInput.trim() },
        { headers: buildAuthHeaders() }
      );
      setWalletEnrollInput('');
      setSecurityMessage('Signature-based 2FA enabled');
      await fetchSecuritySettings();
    } catch (e: any) {
      setSecurityError(
        e?.response?.data?.error || 'Failed to enable signature-based 2FA'
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      await axios.post(
        toApiUrl('/api/user/2fa/disable'),
        {},
        { headers: buildAuthHeaders() }
      );
      setSecurityMessage('2FA disabled');
      await fetchSecuritySettings();
    } catch (e: any) {
      setSecurityError(
        e?.response?.data?.error || 'Failed to disable 2FA'
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleProfileChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleBgVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBgVideo(e.target.files[0]);
    }
  };

  const handleAvatarImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarImage(file);
      setAvatarPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCoverImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImage(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    setError('');
    try {
      let videoUrl = bgVideoUrl;
      let avatarUrl = editData.avatarUrl || avatarPreviewUrl || user.avatarUrl || null;
      let bannerUrl = editData.bannerUrl || coverPreviewUrl || user.bannerUrl || null;
      let profileMedia = editData.profileMedia || user.profileMedia || {
        avatar: { url: avatarUrl, storageProvider: null, objectKey: null },
        cover: { url: bannerUrl, storageProvider: null, objectKey: null },
      };

      if (bgVideo) {
        const formData = new FormData();
        formData.append('video', bgVideo);
        const uploadRes = await axios.post(toApiUrl('/api/upload/profile-background'), formData, {
          headers: {
            ...buildAuthHeaders(),
            'Content-Type': 'multipart/form-data',
          },
        });
        videoUrl = uploadRes.data.fileUrl;
        setBgVideoUrl(videoUrl);
      }

      if (avatarImage) {
        const formData = new FormData();
        formData.append('image', avatarImage);
        const uploadRes = await axios.post(toApiUrl('/api/upload/avatar'), formData, {
          headers: {
            ...buildAuthHeaders(),
            'Content-Type': 'multipart/form-data',
          },
        });
        avatarUrl = uploadRes.data.fileUrl;
        setAvatarPreviewUrl(avatarUrl || undefined);
        profileMedia = {
          ...profileMedia,
          avatar: {
            url: avatarUrl,
            storageProvider: uploadRes.data?.media?.storageProvider || 'local',
            objectKey: uploadRes.data?.media?.objectKey || null,
          },
        };
      }

      if (coverImage) {
        const formData = new FormData();
        formData.append('image', coverImage);
        const uploadRes = await axios.post(toApiUrl('/api/upload/cover'), formData, {
          headers: {
            ...buildAuthHeaders(),
            'Content-Type': 'multipart/form-data',
          },
        });
        bannerUrl = uploadRes.data.fileUrl;
        setCoverPreviewUrl(bannerUrl || undefined);
        profileMedia = {
          ...profileMedia,
          cover: {
            url: bannerUrl,
            storageProvider: uploadRes.data?.media?.storageProvider || 'local',
            objectKey: uploadRes.data?.media?.objectKey || null,
          },
        };
      }

      const res = await axios.put(
        toApiUrl(`/api/user/${user.id}`),
        {
          ...editData,
          avatarUrl,
          bannerUrl,
          profileMedia,
          profileBackgroundVideo: videoUrl,
        },
        { headers: buildAuthHeaders() }
      );
      setAvatarImage(null);
      setCoverImage(null);
      onUserUpdate(res.data.user);
    } catch (e) {
      setError('Failed to update profile');
    }
    setLoading(false);
  };

  const handleReflectionFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReflectionFile(e.target.files[0]);
    }
  };

  const handleReflectionUpload = async () => {
    if (!reflectionFile) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', reflectionFile);
      const uploadRes = await axios.post(toApiUrl('/api/upload/reflection'), formData, {
        headers: {
          ...buildAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });
      const fileUrl = uploadRes.data.fileUrl;
      const fileType = reflectionFile.type.startsWith('video') ? 'video' : 'document';
      await axios.post(
        toApiUrl('/api/reflection'),
        { userId: user.id, content: reflectionContent, fileUrl, fileType },
        { headers: buildAuthHeaders() }
      );
      setReflectionFile(null);
      setReflectionContent('');
      fetchReflections();
    } catch (e) {
      setError('Failed to upload reflection');
    }
    setLoading(false);
  };

  const handleReflectionDelete = async (reflectionId: string) => {
    setLoading(true);
    setError('');
    try {
      await axios.delete(toApiUrl(`/api/reflection/${reflectionId}`), {
        headers: buildAuthHeaders(),
      });
      setReflections((prev) => prev.filter((entry) => entry.id !== reflectionId));
    } catch {
      setError('Failed to delete reflection');
    }
    setLoading(false);
  };

  const handleReflectionUpdate = async (reflectionId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.patch(
        toApiUrl(`/api/reflection/${reflectionId}`),
        { content: editingReflectionContent },
        { headers: buildAuthHeaders() }
      );
      const updated = res.data?.reflection;
      setReflections((prev) =>
        prev.map((entry) =>
          entry.id === reflectionId
            ? {
                ...entry,
                content: updated?.content ?? editingReflectionContent,
              }
            : entry
        )
      );
      setEditingReflectionId(null);
      setEditingReflectionContent('');
    } catch {
      setError('Failed to update reflection');
    }
    setLoading(false);
  };

  return (
    <div
      className="profile-container"
      style={{ maxWidth: '980px', width: '100%', margin: '0 auto', display: 'grid', gap: '12px' }}
    >
      <h2>Edit Profile</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        <input
          name="name"
          value={editData.name || ''}
          onChange={handleProfileChange}
          placeholder="Name"
          style={{ width: '100%' }}
        />
        <input
          name="location"
          value={editData.location || ''}
          onChange={handleProfileChange}
          placeholder="Location"
          style={{ width: '100%' }}
        />
        <input
          type="date"
          name="dateOfBirth"
          value={editData.dateOfBirth ? String(editData.dateOfBirth).slice(0, 10) : ''}
          onChange={handleProfileChange}
          style={{ width: '100%' }}
        />
      </div>
      <textarea
        name="bio"
        value={editData.bio || ''}
        onChange={handleProfileChange}
        placeholder="Bio"
        style={{ width: '100%', minHeight: '110px' }}
      />
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div>
        <label>Avatar Image or MP4:</label>
        <input type="file" accept="image/*,video/*,.gif,.mp4,.webm,.mov" onChange={handleAvatarImageChange} />
        {avatarPreviewUrl && (
          avatarPreviewIsVideo ? (
            <video
              src={avatarPreviewUrl}
              controls
              style={{ width: '100%', maxWidth: '240px', borderRadius: '12px' }}
            />
          ) : (
            <img
              src={avatarPreviewUrl}
              alt="Avatar preview"
              style={{ width: '100%', maxWidth: '240px', borderRadius: '12px' }}
            />
          )
        )}
        </div>
        <div>
        <label>Cover Image or MP4:</label>
        <input type="file" accept="image/*,video/*,.gif,.mp4,.webm,.mov" onChange={handleCoverImageChange} />
        {coverPreviewUrl && (
          coverPreviewIsVideo ? (
            <video
              src={coverPreviewUrl}
              controls
              style={{ width: '100%', maxWidth: '420px', borderRadius: '12px' }}
            />
          ) : (
            <img
              src={coverPreviewUrl}
              alt="Cover preview"
              style={{ width: '100%', maxWidth: '420px', borderRadius: '12px' }}
            />
          )
        )}
        </div>
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        <label>Profile Background Video:</label>
        <input type="file" accept="video/*,video/mp4,.mp4" onChange={handleBgVideoChange} />
        {bgVideoUrl && <video src={bgVideoUrl} controls style={{ width: '100%', maxWidth: '520px' }} />}
      </div>
      <button onClick={handleProfileSave} disabled={loading}>Save Profile</button>
      {error && <div className="error">{error}</div>}
      <hr />
      <h3>Security Settings</h3>
      <div style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          Current 2FA: <strong>{securityState.twoFactorMethod === 'none' ? 'Disabled' : securityState.twoFactorMethod.toUpperCase()}</strong>
        </div>
        {securityState.phoneNumberMasked && (
          <div style={{ marginBottom: '8px' }}>Phone: {securityState.phoneNumberMasked}</div>
        )}
        {securityState.walletDid && (
          <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>Address DID: {securityState.walletDid}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <input
            type="tel"
            value={phoneEnrollInput}
            onChange={(e) => setPhoneEnrollInput(e.target.value)}
            placeholder="Phone for OTP (e.g. +15551234567)"
          />
          <button onClick={enrollPhoneTwoFactor} disabled={securityLoading}>Enable Phone 2FA</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <input
            type="text"
            value={walletEnrollInput}
            onChange={(e) => setWalletEnrollInput(e.target.value)}
            placeholder="Address DID (did:hcn:ed25519:...)"
          />
          <button onClick={enrollWalletTwoFactor} disabled={securityLoading}>Enable Signature 2FA</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={disableTwoFactor} disabled={securityLoading}>Disable 2FA</button>
          <button onClick={fetchSecuritySettings} disabled={securityLoading}>Refresh Security</button>
        </div>

        {securityMessage && <div style={{ color: '#34d399', marginTop: '10px' }}>{securityMessage}</div>}
        {securityError && <div style={{ color: '#f87171', marginTop: '10px' }}>{securityError}</div>}
      </div>
      <hr />
      <h3>Reflections</h3>
      <textarea value={reflectionContent} onChange={e => setReflectionContent(e.target.value)} placeholder="Reflection notes (optional)" />
      <input type="file" onChange={handleReflectionFileChange} />
      <button onClick={handleReflectionUpload} disabled={loading}>Upload Reflection</button>
      <div className="reflections-list">
        {reflections.map(ref => (
          <div key={ref.id} className="reflection-item" style={{ marginBottom: '14px' }}>
            {ref.fileType === 'video' ? (
              <video src={ref.fileUrl} controls style={{ width: '100%', maxWidth: '420px' }} />
            ) : (
              <a href={ref.fileUrl} target="_blank" rel="noopener noreferrer">View Document</a>
            )}
            {editingReflectionId === ref.id ? (
              <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                <textarea
                  value={editingReflectionContent}
                  onChange={(e) => setEditingReflectionContent(e.target.value)}
                  style={{ width: '100%', minHeight: '80px' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleReflectionUpdate(ref.id)} disabled={loading}>Save Reflection</button>
                  <button
                    onClick={() => {
                      setEditingReflectionId(null);
                      setEditingReflectionContent('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>{ref.content}</div>
            )}
            <div><small>{new Date(ref.createdAt).toLocaleString()}</small></div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setEditingReflectionId(ref.id);
                  setEditingReflectionContent(ref.content || '');
                }}
                disabled={loading}
              >
                Edit Reflection
              </button>
              <button onClick={() => handleReflectionDelete(ref.id)} disabled={loading}>Delete Reflection</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;
