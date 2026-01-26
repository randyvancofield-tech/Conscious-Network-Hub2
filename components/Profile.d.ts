import { UserProfile } from '../types';
export interface Reflection {
  id: string;
  content?: string;
  fileUrl?: string;
  fileType?: string;
  createdAt: string;
}
export interface ProfileProps {
  user: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
}
