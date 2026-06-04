import React, { useState, useEffect, ChangeEvent } from 'react';
import { UserProfile } from '../types';
import { api, backendAssetUrl } from '../services/apiClient';
import { openPrivateUpload } from '../services/privateUploadService';
import {
  getProfileAvatarMedia,
  getProfileCoverMedia,
  getProfileBackgroundMedia,
} from '../services/mediaAssets';

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
  const toAssetUrl = (url?: string) => {
    return backendAssetUrl(url);
  };
  const normalizeUploadUrl = (url?: unknown, objectKey?: unknown) =>
    backendAssetUrl(objectKey) || backendAssetUrl(url) || (typeof url === 'string' ? url.trim() : '');
  const getAvatarUrl = (profile: UserProfile) => getProfileAvatarMedia(profile).url || toAssetUrl(profile.avatarUrl);
  const getCoverUrl = (profile: UserProfile) => getProfileCoverMedia(profile).url || toAssetUrl(profile.bannerUrl);
  const getBackgroundUrl = (profile: UserProfile) =>
    getProfileBackgroundMedia(profile).url || toAssetUrl(profile.profileBackgroundVideo);

  const [editData, setEditData] = useState<Partial<UserProfile>>({ ...user });
  const [bgVideo, setBgVideo] = useState<File | null>(null);
  const [bgVideoUrl, setBgVideoUrl] = useState<string | undefined>(getBackgroundUrl(user) || undefined);
  const [avatarImage, setAvatarImage] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>(getAvatarUrl(user) || undefined);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | undefined>(getCoverUrl(user) || undefined);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reflectionFile, setReflectionFile] = useState<File | null>(null);
  const [reflectionContent, setReflectionContent] = useState('');
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [editingReflectionContent, setEditingReflectionContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const avatarPreviewMimeType =
    avatarImage?.type ||
    editData.profileMedia?.avatar?.mimeType ||
    user.profileMedia?.avatar?.mimeType ||
    '';
  const coverPreviewMimeType =
    coverImage?.type ||
    editData.profileMedia?.cover?.mimeType ||
    user.profileMedia?.cover?.mimeType ||
    '';
  const avatarPreviewIsVideo = avatarPreviewMimeType.startsWith('video/') || isLikelyVideoUrl(avatarPreviewUrl);
  const coverPreviewIsVideo = coverPreviewMimeType.startsWith('video/') || isLikelyVideoUrl(coverPreviewUrl);

  useEffect(() => {
    fetchReflections();
  }, [user.id]);

  useEffect(() => {
    setEditData({ ...user });
    setBgVideoUrl(getBackgroundUrl(user) || undefined);
    setAvatarPreviewUrl(getAvatarUrl(user) || undefined);
    setCoverPreviewUrl(getCoverUrl(user) || undefined);
  }, [user.id, user.name, user.profileBackgroundVideo, user.avatarUrl, user.bannerUrl, user.profileMedia]);

  const fetchReflections = async () => {
    try {
      const data = await api<any>(`/reflection/${user.id}`);
      setReflections(
        (data.reflections || []).map((reflection: Reflection) => ({
          ...reflection,
          fileUrl: toAssetUrl(reflection.fileUrl),
        }))
      );
    } catch (e) {
      setError('Failed to load reflections');
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
        const uploadData = await api<any>('/upload/profile-background', {
          method: 'POST',
          body: formData,
        });
        videoUrl = normalizeUploadUrl(uploadData.fileUrl);
        setBgVideoUrl(videoUrl);
      }

      if (avatarImage) {
        const formData = new FormData();
        formData.append('image', avatarImage);
        const uploadData = await api<any>('/upload/avatar', {
          method: 'POST',
          body: formData,
        });
        const avatarMedia = uploadData?.media || {};
        const avatarObjectKey = typeof avatarMedia?.objectKey === 'string' ? avatarMedia.objectKey.trim() : '';
        avatarUrl = normalizeUploadUrl(uploadData.fileUrl, avatarObjectKey);
        setAvatarPreviewUrl(avatarUrl || undefined);
        profileMedia = {
          ...profileMedia,
          avatar: {
            url: normalizeUploadUrl(avatarMedia?.url, avatarObjectKey) || avatarUrl,
            storageProvider: avatarMedia?.storageProvider || 'local',
            objectKey: avatarObjectKey || null,
            mimeType: avatarMedia?.mimeType || avatarImage.type || null,
          },
        };
      }

      if (coverImage) {
        const formData = new FormData();
        formData.append('image', coverImage);
        const uploadData = await api<any>('/upload/cover', {
          method: 'POST',
          body: formData,
        });
        const coverMedia = uploadData?.media || {};
        const coverObjectKey = typeof coverMedia?.objectKey === 'string' ? coverMedia.objectKey.trim() : '';
        bannerUrl = normalizeUploadUrl(uploadData.fileUrl, coverObjectKey);
        setCoverPreviewUrl(bannerUrl || undefined);
        profileMedia = {
          ...profileMedia,
          cover: {
            url: normalizeUploadUrl(coverMedia?.url, coverObjectKey) || bannerUrl,
            storageProvider: coverMedia?.storageProvider || 'local',
            objectKey: coverObjectKey || null,
            mimeType: coverMedia?.mimeType || coverImage.type || null,
          },
        };
      }

      const data = await api<any>(`/user/${user.id}`, {
        method: 'PUT',
        body: {
          ...editData,
          avatarUrl,
          bannerUrl,
          profileMedia,
          profileBackgroundVideo: videoUrl,
        },
      });
      setAvatarImage(null);
      setCoverImage(null);
      onUserUpdate(data.user);
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
      const uploadData = await api<any>('/upload/reflection', {
        method: 'POST',
        body: formData,
      });
      const fileUrl = normalizeUploadUrl(uploadData.fileUrl);
      const fileType = reflectionFile.type.startsWith('video') ? 'video' : 'document';
      await api('/reflection', {
        method: 'POST',
        body: { userId: user.id, content: reflectionContent, fileUrl, fileType },
      });
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
      await api(`/reflection/${reflectionId}`, {
        method: 'DELETE',
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
      const data = await api<any>(`/reflection/${reflectionId}`, {
        method: 'PATCH',
        body: { content: editingReflectionContent },
      });
      const updated = data?.reflection;
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
          Sign-in: <strong>Email and password</strong>
        </div>
        <div style={{ marginBottom: '8px' }}>
          Additional verification: <strong>Not required for launch access</strong>
        </div>
        <div style={{ color: 'rgba(226,232,240,0.8)', fontSize: '13px', lineHeight: 1.5 }}>
          Phone, SMS, email-code, and email-link verification are not part of the normal launch sign-in path.
        </div>
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
              <button
                type="button"
                onClick={() => {
                  void openPrivateUpload({ url: ref.fileUrl, originalName: 'reflection-video' }).catch((error) => {
                    setError(error instanceof Error ? error.message : 'Unable to open private reflection.');
                  });
                }}
              >
                Open Private Video
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void openPrivateUpload({ url: ref.fileUrl, originalName: 'reflection-document' }).catch((error) => {
                    setError(error instanceof Error ? error.message : 'Unable to open private reflection.');
                  });
                }}
              >
                View Private Document
              </button>
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
