
export enum AppView {
  ENTRY = 'ENTRY',
  MEMBERSHIP_ACCESS = 'MEMBERSHIP_ACCESS',
  DASHBOARD = 'DASHBOARD',
  MY_COURSES = 'MY_COURSES',
  PROVIDERS = 'PROVIDERS',
  AI_CONSULT = 'AI_CONSULT',
  MY_CONSCIOUS_IDENTITY = 'MY_CONSCIOUS_IDENTITY',
  MEMBERSHIP = 'MEMBERSHIP'
}

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  avatar: string;
  courses: number;
  bio: string;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  tier: 'Basic' | 'Elite' | 'Professional';
  enrolled: number;
  image: string;
  progress?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  category: 'Workshop' | 'Meetup' | 'Session';
}

export interface UserProfile {
  id: string;
  name: string;
  handle?: string;
  email: string;
  passwordHash: string;
  tier: string;
  identityVerified: boolean;
  reputationScore: number;
  createdAt: string;
  hasProfile: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  interests?: string[];
  twitterUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  privacySettings?: {
    showEmail: boolean;
    allowMessages: boolean;
  };
}