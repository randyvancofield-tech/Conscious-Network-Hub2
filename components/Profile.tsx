import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';
import { UserProfile } from '../types';

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
  const [editData, setEditData] = useState<Partial<UserProfile>>({ ...user });
  const [bgVideo, setBgVideo] = useState<File | null>(null);
  const [bgVideoUrl, setBgVideoUrl] = useState<string | undefined>(user.profileBackgroundVideo);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reflectionFile, setReflectionFile] = useState<File | null>(null);
  const [reflectionContent, setReflectionContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReflections();
  }, [user.id]);

  const fetchReflections = async () => {
    try {
      const res = await axios.get(`/api/reflection/${user.id}`);
      setReflections(res.data.reflections || []);
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

  const handleProfileSave = async () => {
    setLoading(true);
    setError('');
    try {
      let videoUrl = bgVideoUrl;
      if (bgVideo) {
        const formData = new FormData();
        formData.append('video', bgVideo);
        const uploadRes = await axios.post('/api/upload/profile-background', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        videoUrl = uploadRes.data.fileUrl;
        setBgVideoUrl(videoUrl);
      }
      const res = await axios.put(`/api/user/${user.id}`, { ...editData, profileBackgroundVideo: videoUrl });
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
      const uploadRes = await axios.post('/api/upload/reflection', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const fileUrl = uploadRes.data.fileUrl;
      const fileType = reflectionFile.type.startsWith('video') ? 'video' : 'document';
      await axios.post('/api/reflection', { userId: user.id, content: reflectionContent, fileUrl, fileType });
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
