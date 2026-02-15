export const TIER_VALUES = {
  FREE: 'Free / Community Tier',
  GUIDED: 'Guided Tier',
  ACCELERATED: 'Accelerated Tier',
} as const;

export type TierValue = (typeof TIER_VALUES)[keyof typeof TIER_VALUES];

const TIER_RANK: Record<string, number> = {
  [TIER_VALUES.FREE]: 1,
  [TIER_VALUES.GUIDED]: 2,
  [TIER_VALUES.ACCELERATED]: 3,
};

export const normalizeTier = (tier?: string | null): TierValue => {
  if (!tier) return TIER_VALUES.FREE;
  if (tier in TIER_RANK) return tier as TierValue;
  return TIER_VALUES.FREE;
};

export const hasTierAccess = (currentTier: string | null | undefined, minTier: TierValue): boolean => {
  const normalizedCurrent = normalizeTier(currentTier);
  return TIER_RANK[normalizedCurrent] >= TIER_RANK[minTier];
};
