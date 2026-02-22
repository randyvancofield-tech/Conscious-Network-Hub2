import { AppView } from '../types';

export const FRONTEND_TIERS = {
  FREE: 'Free / Community Tier',
  GUIDED: 'Guided Tier',
  ACCELERATED: 'Accelerated Tier',
} as const;

export type FrontendTier = (typeof FRONTEND_TIERS)[keyof typeof FRONTEND_TIERS];

const NAV_VIEW_BY_ID: Record<string, AppView> = {
  dashboard: AppView.DASHBOARD,
  'social-learning': AppView.CONSCIOUS_SOCIAL_LEARNING,
  meetings: AppView.CONSCIOUS_MEETINGS,
  'my-courses': AppView.MY_COURSES,
  providers: AppView.PROVIDERS,
  profile: AppView.MY_CONSCIOUS_IDENTITY,
  membership: AppView.MEMBERSHIP,
};

const BASE_ACCESS_VIEWS = [
  AppView.ENTRY,
  AppView.MEMBERSHIP_ACCESS,
  AppView.DASHBOARD,
  AppView.MY_CONSCIOUS_IDENTITY,
  AppView.PRIVACY_POLICY,
  AppView.AI_TRANSPARENCY_POLICY,
  AppView.BLOCKCHAIN_DATA_POLICY,
  AppView.VENDOR_API_GOVERNANCE_POLICY,
  AppView.NIST_MAPPING_SUMMARY,
  AppView.AI_SAFETY_GOVERNANCE,
] as const;

const TIER_ACCESS_MAP: Record<FrontendTier, AppView[]> = {
  [FRONTEND_TIERS.FREE]: [
    ...BASE_ACCESS_VIEWS,
    AppView.CONSCIOUS_SOCIAL_LEARNING,
    AppView.MEMBERSHIP,
  ],
  [FRONTEND_TIERS.GUIDED]: [
    ...BASE_ACCESS_VIEWS,
    AppView.CONSCIOUS_SOCIAL_LEARNING,
    AppView.CONSCIOUS_MEETINGS,
    AppView.MY_COURSES,
    AppView.KNOWLEDGE_PATHWAYS,
    AppView.MEMBERSHIP,
  ],
  [FRONTEND_TIERS.ACCELERATED]: [
    ...BASE_ACCESS_VIEWS,
    AppView.CONSCIOUS_SOCIAL_LEARNING,
    AppView.CONSCIOUS_MEETINGS,
    AppView.MY_COURSES,
    AppView.KNOWLEDGE_PATHWAYS,
    AppView.PROVIDERS,
    AppView.MEMBERSHIP,
  ],
};

export const normalizeFrontendTier = (tier?: string | null): FrontendTier => {
  if (!tier) return FRONTEND_TIERS.FREE;
  if (tier === FRONTEND_TIERS.GUIDED) return FRONTEND_TIERS.GUIDED;
  if (tier === FRONTEND_TIERS.ACCELERATED) return FRONTEND_TIERS.ACCELERATED;
  return FRONTEND_TIERS.FREE;
};

export const getAllowedViewsForTier = (tier?: string | null): AppView[] => {
  const normalized = normalizeFrontendTier(tier);
  return TIER_ACCESS_MAP[normalized];
};

export const canTierAccessView = (tier: string | null | undefined, view: AppView): boolean =>
  getAllowedViewsForTier(tier).includes(view);

export const canTierAccessNavItem = (tier: string | null | undefined, navId: string): boolean => {
  const view = NAV_VIEW_BY_ID[navId];
  if (!view) return false;
  return canTierAccessView(tier, view);
};
