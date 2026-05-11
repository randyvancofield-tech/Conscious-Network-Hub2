import { Course } from '../types';

export type ProviderSurfaceRecord = {
  id: string;
  name: string;
  category: string;
  location: string;
  bio: string;
  specialty: string;
  rating: number | null;
  experience: string;
  image: string;
  verificationStatus: 'review_pending' | 'verified';
  accessMode: 'request' | 'invite_only';
  services: string[];
};

export type MeetingSurfaceRecord = {
  id: string;
  title: string;
  providerId: string;
  providerName: string;
  description: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'live' | 'completed' | 'replay';
  capacity: number;
  participantCount: number;
  accessTier: 'Free / Community Tier' | 'Guided Tier' | 'Accelerated Tier';
  deliveryMode: 'live' | 'scheduled' | 'replay';
};

export type MembershipTierRecord = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  access: string;
  ideal: string;
  features: string[];
  checkoutEnabled: boolean;
};

export const PROVIDER_SURFACE_RECORDS: ProviderSurfaceRecord[] = [
  {
    id: 'provider-readiness-guide',
    name: 'Provider Readiness Guide',
    category: 'Provider Onboarding',
    location: 'Global',
    specialty: 'Native identity access, service publishing, session readiness',
    bio: 'A structured provider profile surface used to validate the native CNH marketplace flow while provider records are reviewed.',
    rating: null,
    experience: 'Integration Ready',
    image: '/images/provider-readiness.svg',
    verificationStatus: 'review_pending',
    accessMode: 'request',
    services: ['Provider profile intake', 'Session readiness', 'Service catalog setup'],
  },
];

export const COURSE_SURFACE_RECORDS: Course[] = [
  {
    id: 'identity-sovereignty-foundations',
    title: 'Identity Sovereignty Foundations',
    provider: 'Conscious Network Curriculum',
    description:
      'A foundational pathway for understanding member identity, privacy posture, consent, and profile integrity before advanced participation.',
    tier: 'Basic',
    enrolled: 0,
    image: '/images/course-identity.svg',
    progress: 0,
    progressScore: 0,
    status: 'frontend-ready',
    enrollmentStatus: null,
  },
  {
    id: 'provider-practice-operations',
    title: 'Provider Practice Operations',
    provider: 'Conscious Network Curriculum',
    description:
      'An operational pathway for providers preparing services, session boundaries, membership access, and outcome documentation.',
    tier: 'Professional',
    enrolled: 0,
    image: '/images/course-provider.svg',
    progress: 0,
    progressScore: 0,
    status: 'frontend-ready',
    enrollmentStatus: null,
  },
];

export const MEETING_SURFACE_RECORDS: MeetingSurfaceRecord[] = [
  {
    id: 'session-intake-architecture',
    title: 'Provider Session Intake Architecture',
    providerId: 'provider-readiness-guide',
    providerName: 'Provider Readiness Guide',
    description:
      'Structured meeting surface for provider-hosted session intake, capacity visibility, and future live/replay connection.',
    startTime: '2026-05-05T18:00:00.000Z',
    endTime: '2026-05-05T19:00:00.000Z',
    status: 'scheduled',
    capacity: 24,
    participantCount: 0,
    accessTier: 'Guided Tier',
    deliveryMode: 'scheduled',
  },
  {
    id: 'session-replay-readiness',
    title: 'Replay Session Readiness Review',
    providerId: 'provider-readiness-guide',
    providerName: 'Provider Readiness Guide',
    description:
      'Replay-ready meeting structure for post-session resources, notes, and recording access once backend storage is connected.',
    startTime: '2026-04-18T17:00:00.000Z',
    endTime: '2026-04-18T18:00:00.000Z',
    status: 'replay',
    capacity: 50,
    participantCount: 0,
    accessTier: 'Accelerated Tier',
    deliveryMode: 'replay',
  },
];

export const MEMBERSHIP_TIERS: MembershipTierRecord[] = [
  {
    id: 'free-community',
    name: 'Free / Community Tier',
    price: '$0',
    cadence: 'per month',
    description: 'Basic participation for public community discovery and selected events.',
    access: 'Stripe checkout for $0 monthly membership.',
    ideal: 'Individuals exploring the platform before committing to guided support.',
    features: ['Public social learning', 'Community profile', 'Selected events'],
    checkoutEnabled: true,
  },
  {
    id: 'guided',
    name: 'Guided Tier',
    price: '$22',
    cadence: 'per month',
    description: 'Structured access to curated learning and selected provider-led sessions.',
    access: 'Guided pathways, member sessions, and deeper community participation.',
    ideal: 'Members seeking clarity, emotional wellness, or spiritual development.',
    features: ['Guided pathways', 'Provider session access', 'Member learning history'],
    checkoutEnabled: true,
  },
  {
    id: 'accelerated',
    name: 'Accelerated Tier',
    price: '$44',
    cadence: 'per month',
    description: 'Advanced access for committed members and provider-connected growth.',
    access: 'Full provider discovery, live programs, and advanced thematic content.',
    ideal: 'Members committed to intentional development and consistent practice.',
    features: ['Provider marketplace access', 'Advanced courses', 'Live and replay sessions'],
    checkoutEnabled: true,
  },
];
