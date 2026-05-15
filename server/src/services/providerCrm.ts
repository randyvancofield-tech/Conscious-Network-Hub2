import type { LocalUserRecord } from './persistenceStore';

export const PROVIDER_CRM_SOLE_ADMIN_EMAIL = 'higherconscious.network1@gmail.com';
export const PROVIDER_CRM_LEGACY_ADMIN_EMAILS = ['guidance@higherconscious.network'] as const;

export type ProviderCrmToolId =
  | 'home'
  | 'members'
  | 'sessions'
  | 'follow-ups'
  | 'notes'
  | 'referrals'
  | 'content-courses'
  | 'analytics'
  | 'resources'
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

const TOOL_REGISTRY: ProviderCrmTool[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Daily CRM command center for approved providers.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'members',
    label: 'Members',
    description: 'Provider-scoped member and relationship workspace placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'Session history, upcoming sessions, and session workflow placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'follow-ups',
    label: 'Follow-Ups',
    description: 'Provider follow-up task queue placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Structured provider note workspace placeholder.',
    phase: 'Prepared for Phase 4',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: false,
  },
  {
    id: 'referrals',
    label: 'Referrals',
    description: 'Internal referral and handoff workspace placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'content-courses',
    label: 'Content/Courses',
    description: 'Provider content and course recommendation control placeholder.',
    phase: 'Prepared for Phase 6',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: false,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Provider impact reporting placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'resources',
    label: 'Resources',
    description: 'Reusable provider resource workspace placeholder.',
    phase: 'Phase 1 shell',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: true,
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    description: 'Provider collaboration and handoff workspace placeholder.',
    phase: 'Prepared for Phase 6',
    providerVisible: true,
    adminOnly: false,
    enabledByDefault: false,
  },
  {
    id: 'admin-support',
    label: 'Admin Support',
    description: 'Sole-admin oversight and provider assistance control layer.',
    phase: 'Phase 0 foundation',
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

export const isProviderCrmToolEnabled = (tool: ProviderCrmTool): boolean => {
  const disabled = parseToolList(process.env.PROVIDER_CRM_DISABLED_TOOLS);
  const enabled = parseToolList(process.env.PROVIDER_CRM_ENABLED_TOOLS);

  if (runtimeVisibilityOverrides.has(tool.id)) {
    return runtimeVisibilityOverrides.get(tool.id) === true;
  }
  if (disabled.has(tool.id)) return false;
  if (enabled.size > 0) return enabled.has(tool.id);
  return tool.enabledByDefault;
};

export const listProviderCrmToolsForRole = (
  role: 'provider' | 'admin'
): ProviderCrmToolView[] => {
  const tools = TOOL_REGISTRY.map((tool) => ({
    ...tool,
    enabled: isProviderCrmToolEnabled(tool),
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
