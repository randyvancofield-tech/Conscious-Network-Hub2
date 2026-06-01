import { ethers } from 'ethers';
import type { LocalUserRecord } from './persistenceStore';

export const PROVIDER_CRM_SOLE_ADMIN_EMAIL = 'higherconscious.network1@gmail.com';
export const PROVIDER_CRM_LEGACY_ADMIN_EMAILS = ['guidance@higherconscious.network'] as const;
export const PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS = [
  'PROVIDER_CRM_ADMIN_WALLET_ADDRESS',
  'ADMIN_WALLET_ADDRESS',
] as const;

export const normalizeProviderCrmAdminWalletAddress = (value: unknown): string | null => {
  try {
    const normalized = ethers.getAddress(String(value || '').trim());
    return normalized || null;
  } catch {
    return null;
  }
};

export const getConfiguredProviderCrmAdminWalletAddress = (): string | null => {
  for (const key of PROVIDER_CRM_ADMIN_WALLET_ENV_KEYS) {
    const normalized = normalizeProviderCrmAdminWalletAddress(process.env[key]);
    if (normalized) return normalized;
  }
  return null;
};

export const maskProviderCrmAdminWalletAddress = (address: string | null | undefined): string | null => {
  const normalized = normalizeProviderCrmAdminWalletAddress(address);
  if (!normalized) return null;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

export const isProviderCrmAdminPasswordFallbackEnabled = (): boolean => {
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    return false;
  }
  const configured = String(process.env.ENABLE_ADMIN_PASSWORD_FALLBACK || '').trim().toLowerCase();
  if (configured) {
    return !['false', '0', 'off', 'no'].includes(configured);
  }
  return true;
};

export type ProviderCrmToolId =
  | 'home'
  | 'members'
  | 'sessions'
  | 'roundtable'
  | 'follow-ups'
  | 'notes'
  | 'referrals'
  | 'content-courses'
  | 'analytics'
  | 'resources'
  | 'knowledge-center'
  | 'collaboration'
  | 'admin-support';

export interface ProviderCrmTool {
  id: ProviderCrmToolId;
  label: string;
  description: string;
  phase: string;
  providerVisible: boolean;
  adminOnly: boolean;
  enabledByDefault: boolean;
}

export interface ProviderCrmToolView extends ProviderCrmTool {
  enabled: boolean;
}

export type ProviderCrmToolVisibilityOverrides = Map<ProviderCrmToolId, boolean>;

const TOOL_REGISTRY: ProviderCrmTool[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Business and treatment command center for provider-owned work and admin-wide operations.',
    phase: 'Launch core',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'members',
    label: 'Care Relationships',
    description: 'Provider-scoped user, organization, institution, and continuity record workspace.',
    phase: 'Launch core',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'Session history, upcoming sessions, and provider workflow controls.',
    phase: 'Launch core',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'roundtable',
    label: 'Conscious Roundtable',
    description: 'Private branded room scheduler with 12 hourly rooms for provider and admin sessions.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'follow-ups',
    label: 'Follow-Ups',
    description: 'Provider-owned follow-up task queue with due dates, status tracking, and scoped assignments.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Private provider note workspace for care, applicant, member, session, and internal CRM context.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'referrals',
    label: 'Institutions & Contracts',
    description: 'Organizations and institutions CNH should evaluate for relationships, contracts, and partnerships.',
    phase: 'Launch core',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'content-courses',
    label: 'Content/Courses',
    description: 'Provider course/content management for drafts, edits, and publish-state control.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Real aggregate CRM, content, meeting, membership, and provider-operations metrics.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'resources',
    label: 'Resources',
    description: 'Reusable provider resources and operating guidance.',
    phase: 'Launch core',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'knowledge-center',
    label: 'Best Practices & Knowledge Center',
    description: 'Standardized provider delivery guidance, checklists, and operating practices.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    description: 'Provider and admin coordination records for handoffs, status, and internal collaboration.',
    phase: 'Launch workspace',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'admin-support',
    label: 'Admin Support',
    description: 'Sole-admin oversight and provider assistance control layer.',
    phase: 'Admin oversight',
    providerVisible: false,
    adminOnly: true,
    enabledByDefault: true,
  },
];

const runtimeVisibilityOverrides = new Map<ProviderCrmToolId, boolean>();

const normalizeEmail = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const parseToolList = (value: unknown): Set<ProviderCrmToolId> =>
  new Set(
    String(value || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry): entry is ProviderCrmToolId =>
        TOOL_REGISTRY.some((tool) => tool.id === entry)
      )
  );

export const isProviderCrmSoleAdmin = (user: LocalUserRecord | null | undefined): boolean =>
  Boolean(
    user &&
      String(user.role || '').trim().toLowerCase() === 'admin' &&
      normalizeEmail(user.email) === PROVIDER_CRM_SOLE_ADMIN_EMAIL
  );

export const listProviderCrmToolRegistry = (): ProviderCrmTool[] =>
  TOOL_REGISTRY.map((tool) => ({ ...tool }));

export const getProviderCrmTool = (toolId: string): ProviderCrmTool | null => {
  const normalized = String(toolId || '').trim().toLowerCase();
  return TOOL_REGISTRY.find((tool) => tool.id === normalized) || null;
};

export const isProviderCrmToolEnabled = (
  tool: ProviderCrmTool,
  persistedOverrides?: ProviderCrmToolVisibilityOverrides
): boolean => {
  const disabled = parseToolList(process.env.PROVIDER_CRM_DISABLED_TOOLS);
  const enabled = parseToolList(process.env.PROVIDER_CRM_ENABLED_TOOLS);

  if (persistedOverrides?.has(tool.id)) {
    return persistedOverrides.get(tool.id) === true;
  }
  if (runtimeVisibilityOverrides.has(tool.id)) {
    return runtimeVisibilityOverrides.get(tool.id) === true;
  }
  if (disabled.has(tool.id)) return false;
  if (enabled.size > 0) return enabled.has(tool.id);
  return tool.enabledByDefault;
};

export const listProviderCrmToolsForRole = (
  role: 'provider' | 'admin',
  persistedOverrides?: ProviderCrmToolVisibilityOverrides
): ProviderCrmToolView[] => {
  const tools = TOOL_REGISTRY.map((tool) => ({
    ...tool,
    enabled: isProviderCrmToolEnabled(tool, persistedOverrides),
  }));

  if (role === 'admin') {
    return tools;
  }

  return tools.filter((tool) => tool.providerVisible && !tool.adminOnly && tool.enabled);
};

export const setProviderCrmToolVisibility = (
  toolId: string,
  enabled: boolean
): ProviderCrmToolView | null => {
  const tool = getProviderCrmTool(toolId);
  if (!tool) return null;
  runtimeVisibilityOverrides.set(tool.id, enabled);
  return {
    ...tool,
    enabled,
  };
};

export const clearProviderCrmRuntimeVisibilityForTests = (): void => {
  runtimeVisibilityOverrides.clear();
};
