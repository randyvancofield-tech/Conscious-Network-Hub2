
export enum AppView {
  ENTRY = 'ENTRY',
  RESET_PASSWORD = 'RESET_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  VERIFY_SESSION = 'VERIFY_SESSION',
  MEMBERSHIP_ACCESS = 'MEMBERSHIP_ACCESS',
  PROVIDER_ACCESS = 'PROVIDER_ACCESS',
  PROVIDER_SIGN_IN = 'PROVIDER_SIGN_IN',
  PROVIDER_APPLY = 'PROVIDER_APPLY',
  PROVIDER_APPLICANT_SIGN_IN = 'PROVIDER_APPLICANT_SIGN_IN',
  PROVIDER_APPLICATION_STATUS = 'PROVIDER_APPLICATION_STATUS',
  PROVIDER_CRM = 'PROVIDER_CRM',
  CONSCIOUS_CAREERS = 'CONSCIOUS_CAREERS',
  GRANT_APPLICATION = 'GRANT_APPLICATION',
  ENTREPRENEURSHIP_SUPPORT = 'ENTREPRENEURSHIP_SUPPORT',
  DASHBOARD = 'DASHBOARD',
  MY_COURSES = 'MY_COURSES',
  PROVIDERS = 'PROVIDERS',
  PROVIDER_DETAIL = 'PROVIDER_DETAIL',
  MY_CONSCIOUS_IDENTITY = 'MY_CONSCIOUS_IDENTITY',
  MEMBERSHIP = 'MEMBERSHIP',
  KNOWLEDGE_PATHWAYS = 'KNOWLEDGE_PATHWAYS',
  COURSE_DETAIL = 'COURSE_DETAIL',
  COMMUNITY = 'COMMUNITY',
  CONSCIOUS_SOCIAL_LEARNING = 'CONSCIOUS_SOCIAL_LEARNING',
  CONSCIOUS_MEETINGS = 'CONSCIOUS_MEETINGS',
  CONSCIOUS_MEETINGS_UPCOMING = 'CONSCIOUS_MEETINGS_UPCOMING',
  CONSCIOUS_MEETINGS_PORTAL = 'CONSCIOUS_MEETINGS_PORTAL',
  MEETING_DETAIL = 'MEETING_DETAIL',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_OF_SERVICE = 'TERMS_OF_SERVICE',
  AI_TRANSPARENCY_POLICY = 'AI_TRANSPARENCY_POLICY',
  BLOCKCHAIN_DATA_POLICY = 'BLOCKCHAIN_DATA_POLICY',
  VENDOR_API_GOVERNANCE_POLICY = 'VENDOR_API_GOVERNANCE_POLICY',
  NIST_MAPPING_SUMMARY = 'NIST_MAPPING_SUMMARY',
  AI_SAFETY_GOVERNANCE = 'AI_SAFETY_GOVERNANCE',
  NOTIFICATIONS = 'NOTIFICATIONS',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_PROVIDER_APPLICANTS = 'ADMIN_PROVIDER_APPLICANTS',
  NOT_FOUND = 'NOT_FOUND'
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
  accessType: 'tier' | 'restricted';
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
  description?: string;
  tier: 'Basic' | 'Elite' | 'Professional';
  enrolled: number;
  image: string;
  progress?: number;
  progressScore?: number;
  status?: string;
  enrollmentStatus?: string | null;
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
  role?: 'user' | 'applicant' | 'provider' | 'admin';
  passwordHash?: string;
  tier: string | null;
  subscriptionStatus?: string | null;
  membershipStatus?: string | null;
  hasActiveMembership?: boolean;
  membershipStartDate?: string | null;
  membershipEndDate?: string | null;
  identityVerified?: boolean;
  emailVerified?: boolean;
  reputationScore?: number;
  accessKeyIndex?: number;
  createdAt?: string;
  hasProfile?: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  location?: string | null;
  dateOfBirth?: string | null;
  profileMedia?: {
    avatar: {
      url: string | null;
      storageProvider: string | null;
      objectKey: string | null;
    };
    cover: {
      url: string | null;
      storageProvider: string | null;
      objectKey: string | null;
    };
  };
  profileBackgroundVideo?: string | null;
  bio?: string;
  interests?: string[];
  twitterUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  privacySettings?: {
    profileVisibility: 'public' | 'private';
    showEmail: boolean;
    allowMessages: boolean;
    blockedUsers: string[];
  };
  twoFactorEnabled?: boolean;
  twoFactorMethod?: 'none' | 'phone' | 'wallet';
  phoneNumberMasked?: string | null;
  walletDid?: string | null;
  initialTwoFactorRequired?: boolean;
  initialTwoFactorCompleted?: boolean;
  canAccessFullPlatform?: boolean;
}
