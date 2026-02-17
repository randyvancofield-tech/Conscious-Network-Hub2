
export enum AppView {
  ENTRY = 'ENTRY',
  MEMBERSHIP_ACCESS = 'MEMBERSHIP_ACCESS',
  DASHBOARD = 'DASHBOARD',
  MY_COURSES = 'MY_COURSES',
  PROVIDERS = 'PROVIDERS',
  MY_CONSCIOUS_IDENTITY = 'MY_CONSCIOUS_IDENTITY',
  MEMBERSHIP = 'MEMBERSHIP',
  KNOWLEDGE_PATHWAYS = 'KNOWLEDGE_PATHWAYS',
  COMMUNITY = 'COMMUNITY',
  CONSCIOUS_SOCIAL_LEARNING = 'CONSCIOUS_SOCIAL_LEARNING',
  CONSCIOUS_MEETINGS = 'CONSCIOUS_MEETINGS',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  AI_TRANSPARENCY_POLICY = 'AI_TRANSPARENCY_POLICY',
  BLOCKCHAIN_DATA_POLICY = 'BLOCKCHAIN_DATA_POLICY',
  VENDOR_API_GOVERNANCE_POLICY = 'VENDOR_API_GOVERNANCE_POLICY',
  NIST_MAPPING_SUMMARY = 'NIST_MAPPING_SUMMARY',
  AI_SAFETY_GOVERNANCE = 'AI_SAFETY_GOVERNANCE'
}

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  avatar: string;
  courses?: number;
  bio: string;
  availabilitySlots?: string[];
  tokenPrice?: number;
  tierIncludedMin?: string;
}

export interface Meeting {
  id: string;
  title: string;
  hostUserId: string;
  providerId: string;
  startTime: string;
  endTime: string;
  participants: { id: string, name: string, role: 'User' | 'Provider' }[];
  status: 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';
  paymentType: 'tier' | 'tokens';
  notes?: {
    transcript: string[];
    summary: string;
    decisions: string[];
    actionItems: { owner: string, task: string, dueDate: string }[];
  };
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
  passwordHash?: string;
  tier: string;
  identityVerified?: boolean;
  reputationScore?: number;
  walletBalanceTokens?: number;
  createdAt?: string;
  hasProfile?: boolean;
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
  twoFactorEnabled?: boolean;
  twoFactorMethod?: 'none' | 'phone' | 'wallet';
  phoneNumberMasked?: string | null;
  walletDid?: string | null;
}
