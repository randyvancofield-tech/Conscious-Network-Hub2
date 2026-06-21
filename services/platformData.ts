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
