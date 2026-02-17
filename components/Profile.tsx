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
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reflectionFile, setReflectionFile] = useState<File | null>(null);
  const [reflectionContent, setReflectionContent] = useState('');
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

  useEffect(() => {
    fetchReflections();
  }, [user.id]);

  useEffect(() => {
    setEditData({ ...user });
    setBgVideoUrl(toAssetUrl(user.profileBackgroundVideo));
    setSecurityState({
      twoFactorMethod: user.twoFactorMethod || 'none',
      phoneNumberMasked: user.phoneNumberMasked || null,
      walletDid: user.walletDid || null,
    });
  }, [user.id, user.name, user.profileBackgroundVideo, user.twoFactorMethod, user.phoneNumberMasked, user.walletDid]);

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
      setSecurityError('Enter a wallet DID to enroll wallet 2FA');
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
      setSecurityMessage('Wallet 2FA enabled');
      await fetchSecuritySettings();
    } catch (e: any) {
      setSecurityError(
        e?.response?.data?.error || 'Failed to enable wallet 2FA'
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

  const handleProfileSave = async () => {
    setLoading(true);
    setError('');
    try {
      let videoUrl = bgVideoUrl;
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
      const res = await axios.put(
        toApiUrl(`/api/user/${user.id}`),
        { ...editData, profileBackgroundVideo: videoUrl },
        { headers: buildAuthHeaders() }
      );
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

  return (
    <div className="profile-container">
      <h2>Edit Profile</h2>
      <input name="name" value={editData.name || ''} onChange={handleProfileChange} placeholder="Name" />
      <textarea name="bio" value={editData.bio || ''} onChange={handleProfileChange} placeholder="Bio" />
      <div>
        <label>Profile Background Video:</label>
        <input type="file" accept="video/*" onChange={handleBgVideoChange} />
        {bgVideoUrl && <video src={bgVideoUrl} controls width={320} />}
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
          <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>Wallet DID: {securityState.walletDid}</div>
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
            placeholder="Wallet DID (did:hcn:ed25519:...)"
          />
          <button onClick={enrollWalletTwoFactor} disabled={securityLoading}>Enable Wallet 2FA</button>
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
          <div key={ref.id} className="reflection-item">
            {ref.fileType === 'video' ? (
              <video src={ref.fileUrl} controls width={240} />
            ) : (
              <a href={ref.fileUrl} target="_blank" rel="noopener noreferrer">View Document</a>
            )}
            <div>{ref.content}</div>
            <div><small>{new Date(ref.createdAt).toLocaleString()}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;
