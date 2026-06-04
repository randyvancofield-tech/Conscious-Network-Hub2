
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dashboard from './components/Dashboard';
import IdentitySecurityPanel from './components/IdentitySecurityPanel';
import MyCourses from './components/MyCourses';
import ProvidersMarket from './components/ProvidersMarket';
import KnowledgePathways from './components/KnowledgePathways';
import CommunityMembers from './components/CommunityMembers';
import SocialLearningHub from './components/SocialLearningHub';
import ConsciousMeetingsUpcomingPage from './components/ConsciousMeetingsUpcomingPage';
import MembershipPage from './components/MembershipPage';
import NotFoundPage from './components/NotFoundPage';
import MusicBox from './components/MusicBox';
import NotificationsCenter from './components/NotificationsCenter';
import AdminDashboard from './components/AdminDashboard';
import AdministrativeAccessPage from './components/AdministrativeAccessPage';
import ProviderAccessPage from './components/ProviderAccessPage';
import ProviderApplicationPage from './components/ProviderApplicationPage';
import ProviderApplicantSignInPage from './components/ProviderApplicantSignInPage';
import ProviderApplicationStatusPage from './components/ProviderApplicationStatusPage';
import AdminProviderApplicantsPage from './components/AdminProviderApplicantsPage';
import ProviderCrmShell from './components/ProviderCrmShell';
import GrantApplicationPage from './components/GrantApplicationPage';
import EntrepreneurshipSupportPage from './components/EntrepreneurshipSupportPage';
import { ConsciousIdentity } from './components/community/CommunityLayout';
import { AppView, UserProfile, Course } from './types';
import { NAVIGATION_ITEMS } from './constants';
import { 
  Shield, X, Search, Bell,
  ChevronRight, Home, LogOut, Building2, CheckCircle2, Sparkles, Key, WalletCards, LockKeyhole
} from 'lucide-react';
import cnhLogo from './src/assets/brand/conscious-network-hub-logo.png';
import careersLogo from './src/assets/brand/conscious-careers-logo.png';
import privacyPolicy from './docs/compliance/privacy-policy-draft.md?raw';
import termsOfService from './docs/compliance/terms-of-service-draft.md?raw';
import aiTransparencyPolicy from './docs/compliance/ai-transparency-policy-draft.md?raw';
import blockchainDataPolicy from './docs/compliance/blockchain-data-policy-draft.md?raw';
import vendorApiGovernancePolicy from './docs/compliance/vendor-api-governance-policy-draft.md?raw';
import nistMappingSummary from './docs/compliance/nist-mapping-summary.md?raw';
import {
  getAuthToken,
  getCachedAuthUser,
  getProviderControlSession,
  setAdminElevationToken,
  setGuestSession,
  setProviderControlSession,
  setUserAuthSession,
} from './services/sessionService';
import { canTierAccessNavItem, canTierAccessView } from './services/tierAccess';
import { ApiError, api, apiHealth, backendAssetUrl } from './services/apiClient';
import { getProfileAvatarMedia, isVideoMediaAsset } from './services/mediaAssets';
import { createNativeProviderControlSession } from './services/backendApiService';
import {
  detectWalletProviderEnvironment,
  readWalletChainId,
  walletErrorMessage,
  type WalletProviderEnvironment,
} from './services/walletProvider';

const LazyThreeScene = React.lazy(() => import('./components/ThreeScene'));
const LazyConsciousMeetingPortalPage = React.lazy(() => import('./components/ConsciousMeetingPortalPage'));
const LazyConsciousMeetingRoomPage = React.lazy(() => import('./components/ConsciousMeetingRoomPage'));

type RouteState = {
  view: AppView;
  params: Record<string, string>;
  path: string;
};

type ProviderWalletChallenge = {
  challengeId: string;
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

type PlatformSearchResult = {
  id: string;
  title: string;
  description: string;
  view: AppView;
  keywords: string[];
};

const PLATFORM_SEARCH_CATALOG: PlatformSearchResult[] = [
  { id: 'dashboard', title: 'Portal Home', description: 'Member dashboard and latest platform overview.', view: AppView.DASHBOARD, keywords: ['home', 'dashboard', 'portal'] },
  { id: 'courses', title: 'Courses', description: 'Published learning pathways and course enrollment.', view: AppView.KNOWLEDGE_PATHWAYS, keywords: ['learning', 'classes', 'pathways'] },
  { id: 'my-courses', title: 'My Courses', description: 'Your enrolled learning pathways.', view: AppView.MY_COURSES, keywords: ['enrolled', 'resume', 'learning'] },
  { id: 'social', title: 'Social Learning', description: 'Member social learning feed.', view: AppView.CONSCIOUS_SOCIAL_LEARNING, keywords: ['posts', 'feed', 'community'] },
  { id: 'community', title: 'Community', description: 'Member directory and profiles.', view: AppView.COMMUNITY, keywords: ['members', 'directory', 'profiles'] },
  { id: 'meetings', title: 'Conscious Meetings', description: 'Upcoming provider-created meeting sessions.', view: AppView.CONSCIOUS_MEETINGS_UPCOMING, keywords: ['sessions', 'events', 'video'] },
  { id: 'providers', title: 'Available Providers', description: 'Approved public provider profiles.', view: AppView.PROVIDERS, keywords: ['provider', 'services', 'market'] },
  { id: 'careers', title: 'Conscious Careers', description: 'Entrepreneurship readiness, Conscious Plan, guidance, and grant pathway.', view: AppView.ENTREPRENEURSHIP_SUPPORT, keywords: ['grant', 'career', 'entrepreneurship'] },
  { id: 'entrepreneurship', title: 'Entrepreneurship Support', description: 'Conscious Careers pathway portal for readiness and regional entrepreneurship resources.', view: AppView.ENTREPRENEURSHIP_SUPPORT, keywords: ['business', 'sbdc', 'readiness'] },
  { id: 'provider-access', title: 'Provider Access', description: 'Approved provider sign-in, application, and applicant status.', view: AppView.PROVIDER_ACCESS, keywords: ['provider sign in', 'apply', 'applicant'] },
  { id: 'provider-apply', title: 'Provider Application', description: 'Apply to become a CNH provider.', view: AppView.PROVIDER_APPLY, keywords: ['provider apply', 'application'] },
  { id: 'provider-status', title: 'Provider Applicant Status', description: 'Returning applicant sign-in and review status.', view: AppView.PROVIDER_APPLICANT_SIGN_IN, keywords: ['candidate', 'applicant', 'status'] },
  { id: 'provider-crm', title: 'Provider CRM', description: 'Approved provider operations workspace.', view: AppView.PROVIDER_CRM, keywords: ['provider tools', 'crm', 'operations'] },
  { id: 'profile', title: 'My Conscious Identity', description: 'Profile, privacy, and identity settings.', view: AppView.MY_CONSCIOUS_IDENTITY, keywords: ['profile', 'settings', 'identity'] },
  { id: 'membership', title: 'Memberships', description: 'Membership tier and access management.', view: AppView.MEMBERSHIP, keywords: ['tier', 'stripe', 'subscription'] },
  { id: 'admin', title: 'Admin Console', description: 'Admin dashboard and governance controls.', view: AppView.ADMIN_DASHBOARD, keywords: ['admin', 'governance', 'users'] },
  { id: 'privacy', title: 'Privacy Policy', description: 'CNH privacy and data handling policy.', view: AppView.PRIVACY_POLICY, keywords: ['privacy', 'data'] },
  { id: 'terms', title: 'Terms Of Service', description: 'Platform terms and conditions.', view: AppView.TERMS_OF_SERVICE, keywords: ['terms', 'legal'] },
  { id: 'ai-policy', title: 'AI Transparency', description: 'AI transparency and safety policy.', view: AppView.AI_TRANSPARENCY_POLICY, keywords: ['ai', 'transparency', 'safety'] },
];

const FREE_TIER_NAME = 'Free / Community Tier';
const PENDING_CHECKOUT_SESSION_KEY = 'hcn.pendingCheckoutSessionId';
const ACCOUNT_RECOVERY_UI_ENABLED = true;
const MEMBERSHIP_RETURN_PATH_ID = 'return';
const PROFILE_UPDATED_EVENT = 'cnh:user-profile-updated';
const MEMBERSHIP_MOBILE_STEPS = ['Start', 'Free', 'Guided', 'Accelerated'];
const MEMBERSHIP_RETURN_INSIGHT = 'The Return – Welcome back, Traveler. Resume your journey.';
const MEMBERSHIP_INSIGHTS: Record<string, string> = {
  [FREE_TIER_NAME]:
    'The Seed – Enter the community and begin your observation. (Instant Stripe Verification → Portal Access).',
  'Guided Tier':
    'The Growth – Expand your influence with deeper tools. (Secure Checkout → Dashboard Unlock).',
  'Accelerated Tier':
    'The Enlightenment – Full ecosystem mastery. (Premium Access → Direct Entry).',
};

const buildProviderSiweMessage = (challenge: ProviderWalletChallenge): string =>
  [
    `${challenge.domain} wants you to sign in with your Ethereum account:`,
    challenge.address,
    '',
    challenge.statement,
    '',
    `URI: ${challenge.uri}`,
    `Version: ${challenge.version}`,
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expirationTime}`,
  ].join('\n');
const MEMBERSHIP_TIER_COLOR_CLASSES = {
  blue: {
    cardBorder: 'hover:border-blue-500/30 border-t-blue-500/20',
    icon: 'text-blue-400',
    price: 'bg-blue-500/20 text-blue-300',
    check: 'text-blue-300',
    button: 'hover:bg-blue-600 hover:border-blue-500/50',
    glow: 'shadow-blue-500/20 ring-blue-300/30',
    insight: 'border-blue-300/20 bg-blue-950/45 text-blue-100',
  },
  teal: {
    cardBorder: 'hover:border-teal-500/30 border-t-teal-500/20',
    icon: 'text-teal-400',
    price: 'bg-teal-500/20 text-teal-300',
    check: 'text-teal-300',
    button: 'hover:bg-teal-600 hover:border-teal-500/50',
    glow: 'shadow-teal-500/20 ring-teal-300/30',
    insight: 'border-teal-300/20 bg-teal-950/45 text-teal-100',
  },
  indigo: {
    cardBorder: 'hover:border-indigo-500/30 border-t-indigo-500/20',
    icon: 'text-indigo-400',
    price: 'bg-indigo-500/20 text-indigo-300',
    check: 'text-indigo-300',
    button: 'hover:bg-indigo-600 hover:border-indigo-500/50',
    glow: 'shadow-indigo-500/20 ring-indigo-300/30',
    insight: 'border-indigo-300/20 bg-indigo-950/45 text-indigo-100',
  },
};

const normalizePathname = (pathname: string): string => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const getStoredPendingCheckoutSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const value = String(window.sessionStorage.getItem(PENDING_CHECKOUT_SESSION_KEY) || '').trim();
  return value || null;
};

const setStoredPendingCheckoutSessionId = (sessionId: string | null): void => {
  if (typeof window === 'undefined') return;
  const normalized = String(sessionId || '').trim();
  if (normalized) {
    window.sessionStorage.setItem(PENDING_CHECKOUT_SESSION_KEY, normalized);
  } else {
    window.sessionStorage.removeItem(PENDING_CHECKOUT_SESSION_KEY);
  }
};

const routePathForView = (view: AppView, params: Record<string, string> = {}): string => {
  switch (view) {
    case AppView.ENTRY:
      return '/';
    case AppView.RESET_PASSWORD:
      return '/reset-password';
    case AppView.VERIFY_EMAIL:
      return '/verify-email';
    case AppView.VERIFY_SESSION:
      return '/verify-session';
    case AppView.MEMBERSHIP_ACCESS:
      return '/membership-access';
    case AppView.ADMINISTRATIVE_ACCESS:
      return '/administrative-access';
    case AppView.ADMIN_SIGN_IN:
      return '/administrative/sign-in';
    case AppView.PROVIDER_ACCESS:
      return '/provider-access';
    case AppView.PROVIDER_SIGN_IN:
      return '/provider/sign-in';
    case AppView.PROVIDER_APPLY:
      return '/provider/apply';
    case AppView.PROVIDER_APPLICANT_SIGN_IN:
      return '/provider/applicant-sign-in';
    case AppView.PROVIDER_APPLICATION_STATUS:
      return '/provider/application-status';
    case AppView.PROVIDER_CRM:
      return '/provider/crm';
    case AppView.CONSCIOUS_CAREERS:
      return '/conscious-careers/entrepreneurship-support';
    case AppView.GRANT_APPLICATION:
      return '/conscious-careers/grant-application';
    case AppView.ENTREPRENEURSHIP_SUPPORT:
      return '/conscious-careers/entrepreneurship-support';
    case AppView.DASHBOARD:
      return '/dashboard';
    case AppView.CONSCIOUS_SOCIAL_LEARNING:
      return '/social';
    case AppView.COMMUNITY:
      return '/community';
    case AppView.CONSCIOUS_MEETINGS:
      return '/conscious-meetings';
    case AppView.CONSCIOUS_MEETINGS_UPCOMING:
      return '/conscious-meetings/upcoming';
    case AppView.CONSCIOUS_MEETINGS_PORTAL:
      return '/conscious-meetings/portal';
    case AppView.MEETING_DETAIL:
      return `/conscious-meetings/session/${encodeURIComponent(params.id || '')}`;
    case AppView.MY_COURSES:
      return '/my-courses';
    case AppView.KNOWLEDGE_PATHWAYS:
      return '/courses';
    case AppView.COURSE_DETAIL:
      return `/courses/${encodeURIComponent(params.id || '')}`;
    case AppView.PROVIDERS:
      return '/providers';
    case AppView.PROVIDER_DETAIL:
      return `/providers/${encodeURIComponent(params.id || '')}`;
    case AppView.MY_CONSCIOUS_IDENTITY:
      return '/profile';
    case AppView.MEMBERSHIP:
      return '/membership';
    case AppView.NOTIFICATIONS:
      return '/notifications';
    case AppView.ADMIN_DASHBOARD:
      return '/admin';
    case AppView.ADMIN_PROVIDER_APPLICANTS:
      return '/admin/provider-applicants';
    case AppView.PRIVACY_POLICY:
      return '/privacy-policy';
    case AppView.TERMS_OF_SERVICE:
      return '/terms-of-service';
    case AppView.AI_TRANSPARENCY_POLICY:
      return '/policies/ai-transparency';
    case AppView.BLOCKCHAIN_DATA_POLICY:
      return '/policies/blockchain-data';
    case AppView.VENDOR_API_GOVERNANCE_POLICY:
      return '/policies/vendor-api-governance';
    case AppView.NIST_MAPPING_SUMMARY:
      return '/policies/nist-mapping';
    case AppView.AI_SAFETY_GOVERNANCE:
      return '/policies/ai-safety-governance';
    case AppView.NOT_FOUND:
      return params.path || '/not-found';
    default:
      return '/dashboard';
  }
};

const resolveRoute = (pathname: string, search = ''): RouteState => {
  const path = normalizePathname(pathname);
  const params = new URLSearchParams(search);

  if (params.get('externalMeetingInvite')) {
    return { view: AppView.CONSCIOUS_MEETINGS_PORTAL, params: {}, path };
  }

  const staticRoutes: Record<string, AppView> = {
    '/': AppView.ENTRY,
    '/reset-password': AppView.RESET_PASSWORD,
    '/verify-email': AppView.VERIFY_EMAIL,
    '/verify-session': AppView.VERIFY_SESSION,
    '/membership-access': AppView.MEMBERSHIP_ACCESS,
    '/administrative-access': AppView.ADMINISTRATIVE_ACCESS,
    '/admin-access': AppView.ADMINISTRATIVE_ACCESS,
    '/administrative/sign-in': AppView.ADMIN_SIGN_IN,
    '/admin/sign-in': AppView.ADMIN_SIGN_IN,
    '/provider-access': AppView.PROVIDER_ACCESS,
    '/provider/sign-in': AppView.PROVIDER_SIGN_IN,
    '/provider/apply': AppView.PROVIDER_APPLY,
    '/provider/applicant-sign-in': AppView.PROVIDER_APPLICANT_SIGN_IN,
    '/provider/application-status': AppView.PROVIDER_APPLICATION_STATUS,
    '/provider/crm': AppView.PROVIDER_CRM,
    '/conscious-careers': AppView.ENTREPRENEURSHIP_SUPPORT,
    '/careers': AppView.ENTREPRENEURSHIP_SUPPORT,
    '/conscious-careers/grant-application': AppView.GRANT_APPLICATION,
    '/careers/grant-application': AppView.GRANT_APPLICATION,
    '/conscious-careers/entrepreneurship-support': AppView.ENTREPRENEURSHIP_SUPPORT,
    '/careers/entrepreneurship-support': AppView.ENTREPRENEURSHIP_SUPPORT,
    '/dashboard': AppView.DASHBOARD,
    '/social': AppView.CONSCIOUS_SOCIAL_LEARNING,
    '/social-learning': AppView.CONSCIOUS_SOCIAL_LEARNING,
    '/community': AppView.COMMUNITY,
    '/meetings': AppView.CONSCIOUS_MEETINGS,
    '/conscious-meetings': AppView.CONSCIOUS_MEETINGS,
    '/meetings/upcoming': AppView.CONSCIOUS_MEETINGS_UPCOMING,
    '/conscious-meetings/upcoming': AppView.CONSCIOUS_MEETINGS_UPCOMING,
    '/meetings/portal': AppView.CONSCIOUS_MEETINGS_PORTAL,
    '/conscious-meetings/portal': AppView.CONSCIOUS_MEETINGS_PORTAL,
    '/my-courses': AppView.MY_COURSES,
    '/courses': AppView.KNOWLEDGE_PATHWAYS,
    '/providers': AppView.PROVIDERS,
    '/profile': AppView.MY_CONSCIOUS_IDENTITY,
    '/membership': AppView.MEMBERSHIP,
    '/notifications': AppView.NOTIFICATIONS,
    '/admin': AppView.ADMIN_DASHBOARD,
    '/admin/provider-applicants': AppView.ADMIN_PROVIDER_APPLICANTS,
    '/privacy-policy': AppView.PRIVACY_POLICY,
    '/privacy': AppView.PRIVACY_POLICY,
    '/policies/privacy': AppView.PRIVACY_POLICY,
    '/terms-of-service': AppView.TERMS_OF_SERVICE,
    '/terms': AppView.TERMS_OF_SERVICE,
    '/policies/ai-transparency': AppView.AI_TRANSPARENCY_POLICY,
    '/policies/blockchain-data': AppView.BLOCKCHAIN_DATA_POLICY,
    '/policies/vendor-api-governance': AppView.VENDOR_API_GOVERNANCE_POLICY,
    '/policies/nist-mapping': AppView.NIST_MAPPING_SUMMARY,
    '/policies/ai-safety-governance': AppView.AI_SAFETY_GOVERNANCE,
  };

  if (staticRoutes[path]) {
    const staticParams =
      path === '/reset-password' || path === '/verify-email'
        ? { token: params.get('token') || '' }
        : path === '/verify-session'
          ? { sessionId: params.get('session_id') || params.get('sessionId') || '' }
          : path === '/social' || path === '/social-learning'
            ? { node: params.get('node') || '' }
            : {};
    return {
      view: staticRoutes[path],
      params: staticParams,
      path,
    };
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 2 && segments[0] === 'meetings') {
    return { view: AppView.MEETING_DETAIL, params: { id: decodeURIComponent(segments[1]) }, path };
  }
  if (segments.length === 3 && segments[0] === 'conscious-meetings' && (segments[1] === 'session' || segments[1] === 'live')) {
    return { view: AppView.MEETING_DETAIL, params: { id: decodeURIComponent(segments[2]) }, path };
  }
  if (segments.length === 2 && segments[0] === 'courses') {
    return { view: AppView.COURSE_DETAIL, params: { id: decodeURIComponent(segments[1]) }, path };
  }
  if (segments.length === 2 && segments[0] === 'providers') {
    return { view: AppView.PROVIDER_DETAIL, params: { id: decodeURIComponent(segments[1]) }, path };
  }

  return { view: AppView.NOT_FOUND, params: { path }, path };
};

const getInitialRoute = (): RouteState => {
  if (typeof window === 'undefined') {
    return { view: AppView.ENTRY, params: {}, path: '/' };
  }
  return resolveRoute(window.location.pathname, window.location.search);
};

const requiresStoredSession = (view: AppView): boolean =>
  [
    AppView.DASHBOARD,
    AppView.MY_COURSES,
    AppView.MY_CONSCIOUS_IDENTITY,
    AppView.NOTIFICATIONS,
    AppView.ADMIN_DASHBOARD,
    AppView.ADMIN_PROVIDER_APPLICANTS,
    AppView.PROVIDER_CRM,
    AppView.PROVIDER_APPLICATION_STATUS,
    AppView.GRANT_APPLICATION,
  ].includes(view);

const isGuestAllowedView = (view: AppView): boolean =>
  [
    AppView.ENTRY,
    AppView.RESET_PASSWORD,
    AppView.VERIFY_EMAIL,
    AppView.VERIFY_SESSION,
    AppView.MEMBERSHIP_ACCESS,
    AppView.ADMINISTRATIVE_ACCESS,
    AppView.ADMIN_SIGN_IN,
    AppView.PROVIDER_ACCESS,
    AppView.PROVIDER_SIGN_IN,
    AppView.PROVIDER_APPLY,
    AppView.PROVIDER_APPLICANT_SIGN_IN,
    AppView.CONSCIOUS_CAREERS,
    AppView.ENTREPRENEURSHIP_SUPPORT,
    AppView.MEMBERSHIP,
    AppView.COMMUNITY,
    AppView.CONSCIOUS_SOCIAL_LEARNING,
    AppView.CONSCIOUS_MEETINGS,
    AppView.CONSCIOUS_MEETINGS_UPCOMING,
    AppView.CONSCIOUS_MEETINGS_PORTAL,
    AppView.MEETING_DETAIL,
    AppView.KNOWLEDGE_PATHWAYS,
    AppView.COURSE_DETAIL,
    AppView.PRIVACY_POLICY,
    AppView.TERMS_OF_SERVICE,
    AppView.AI_TRANSPARENCY_POLICY,
    AppView.BLOCKCHAIN_DATA_POLICY,
    AppView.VENDOR_API_GOVERNANCE_POLICY,
    AppView.NIST_MAPPING_SUMMARY,
    AppView.AI_SAFETY_GOVERNANCE,
    AppView.NOT_FOUND,
  ].includes(view);

const isNoTierSignedInAllowedView = (view: AppView): boolean =>
  [
    AppView.ENTRY,
    AppView.VERIFY_SESSION,
    AppView.MEMBERSHIP_ACCESS,
    AppView.ADMINISTRATIVE_ACCESS,
    AppView.ADMIN_SIGN_IN,
    AppView.PROVIDER_ACCESS,
    AppView.PROVIDER_SIGN_IN,
    AppView.PROVIDER_APPLY,
    AppView.PROVIDER_APPLICANT_SIGN_IN,
    AppView.PROVIDER_APPLICATION_STATUS,
    AppView.PROVIDER_CRM,
    AppView.NOTIFICATIONS,
    AppView.CONSCIOUS_CAREERS,
    AppView.GRANT_APPLICATION,
    AppView.ENTREPRENEURSHIP_SUPPORT,
    AppView.CONSCIOUS_MEETINGS_UPCOMING,
    AppView.CONSCIOUS_MEETINGS_PORTAL,
    AppView.MEMBERSHIP,
    AppView.PRIVACY_POLICY,
    AppView.TERMS_OF_SERVICE,
    AppView.AI_TRANSPARENCY_POLICY,
    AppView.BLOCKCHAIN_DATA_POLICY,
    AppView.VENDOR_API_GOVERNANCE_POLICY,
    AppView.NIST_MAPPING_SUMMARY,
    AppView.AI_SAFETY_GOVERNANCE,
    AppView.NOT_FOUND,
  ].includes(view);

const shouldPreserveNoTierViewAfterAuth = (view: AppView): boolean =>
  [
    AppView.CONSCIOUS_CAREERS,
    AppView.GRANT_APPLICATION,
    AppView.ENTREPRENEURSHIP_SUPPORT,
  ].includes(view);

const isProviderPublicView = (view: AppView): boolean =>
  [
    AppView.PROVIDER_ACCESS,
    AppView.PROVIDER_SIGN_IN,
    AppView.PROVIDER_APPLY,
    AppView.PROVIDER_APPLICANT_SIGN_IN,
    AppView.PROVIDER_APPLICATION_STATUS,
  ].includes(view);

const isAdministrativePublicView = (view: AppView): boolean =>
  [
    AppView.ADMINISTRATIVE_ACCESS,
    AppView.ADMIN_SIGN_IN,
  ].includes(view);

const isCareersPublicView = (view: AppView): boolean =>
  [
    AppView.CONSCIOUS_CAREERS,
    AppView.GRANT_APPLICATION,
    AppView.ENTREPRENEURSHIP_SUPPORT,
  ].includes(view);

type VerticalScrollIntent = 'up' | 'down' | 'start' | 'end';

const KEYBOARD_SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

const SCROLLABLE_SELECTOR = '.app-main-scroll, .scrollable, .custom-scrollbar, [data-page-scroll-root="true"]';
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const SPACE_ACTIVATION_SELECTOR =
  'button, a[href], summary, [role="button"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"]';

const getKeyboardScrollIntent = (event: KeyboardEvent): VerticalScrollIntent | null => {
  switch (event.key) {
    case 'ArrowDown':
    case 'PageDown':
      return 'down';
    case 'ArrowUp':
    case 'PageUp':
      return 'up';
    case 'Home':
      return 'start';
    case 'End':
      return 'end';
    case ' ':
    case 'Spacebar':
      return event.shiftKey ? 'up' : 'down';
    default:
      return null;
  }
};

const getEventElement = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target : null;

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  const element = getEventElement(target);
  return Boolean(element?.closest(EDITABLE_SELECTOR));
};

const isSpaceActivationTarget = (target: EventTarget | null): boolean => {
  const element = getEventElement(target);
  return Boolean(element?.closest(SPACE_ACTIVATION_SELECTOR));
};

const isVisibleElement = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

const allowsVerticalScroll = (element: HTMLElement): boolean => {
  const overflowY = window.getComputedStyle(element).overflowY;
  return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight - element.clientHeight > 1;
};

const canMoveScrollTarget = (element: HTMLElement, intent: VerticalScrollIntent): boolean => {
  if (!allowsVerticalScroll(element)) return false;
  if (intent === 'start') return element.scrollTop > 1;
  if (intent === 'end') return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  if (intent === 'up') return element.scrollTop > 1;
  return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
};

const findScrollableAncestor = (
  target: EventTarget | null,
  intent: VerticalScrollIntent
): HTMLElement | null => {
  const element = getEventElement(target);
  let current = element instanceof HTMLElement ? element : element?.parentElement || null;

  while (current) {
    if (canMoveScrollTarget(current, intent)) return current;
    current = current.parentElement;
  }

  return null;
};

const getScrollableCandidates = (root: HTMLElement): HTMLElement[] => {
  const candidates = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR)),
  ];

  return candidates.filter(isVisibleElement);
};

const findLayerScrollTarget = (intent: VerticalScrollIntent): HTMLElement | null => {
  const layers = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], .fixed')
  ).filter((layer) => {
    if (!isVisibleElement(layer)) return false;
    const rect = layer.getBoundingClientRect();
    return rect.width >= window.innerWidth * 0.72 && rect.height >= window.innerHeight * 0.72;
  });

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const target = getScrollableCandidates(layers[index])
      .reverse()
      .find((candidate) => canMoveScrollTarget(candidate, intent));
    if (target) return target;
  }

  return null;
};

const findFallbackScrollTarget = (intent: VerticalScrollIntent): HTMLElement | null => {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR))
    .filter(isVisibleElement)
    .reverse();
  return candidates.find((candidate) => canMoveScrollTarget(candidate, intent)) || null;
};

const getDocumentScrollTarget = (intent: VerticalScrollIntent): HTMLElement | null => {
  const scroller = document.scrollingElement as HTMLElement | null;
  return scroller && canMoveScrollTarget(scroller, intent) ? scroller : null;
};

const selectKeyboardScrollTarget = (
  event: KeyboardEvent,
  primaryScrollRoot: HTMLElement | null
): HTMLElement | null => {
  const intent = getKeyboardScrollIntent(event);
  if (!intent) return null;

  return (
    findScrollableAncestor(event.target, intent) ||
    findLayerScrollTarget(intent) ||
    (primaryScrollRoot && canMoveScrollTarget(primaryScrollRoot, intent) ? primaryScrollRoot : null) ||
    getDocumentScrollTarget(intent) ||
    findFallbackScrollTarget(intent)
  );
};

const scrollTargetByIntent = (
  target: HTMLElement,
  intent: VerticalScrollIntent,
  event: KeyboardEvent
): void => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = event.repeat || prefersReducedMotion ? 'auto' : 'smooth';

  if (intent === 'start' || intent === 'end') {
    target.scrollTo({
      top: intent === 'start' ? 0 : target.scrollHeight,
      behavior,
    });
    return;
  }

  const isLineScroll = event.key === 'ArrowDown' || event.key === 'ArrowUp';
  const distance = isLineScroll ? 72 : Math.max(160, Math.floor(target.clientHeight * 0.82));
  target.scrollBy({
    top: intent === 'down' ? distance : -distance,
    behavior,
  });
};

const App: React.FC = () => {
  const initialRoute = useMemo(getInitialRoute, []);
  const [currentView, setCurrentViewState] = useState<AppView>(initialRoute.view);
  const [routeParams, setRouteParams] = useState<Record<string, string>>(initialRoute.params);
  const [activePath, setActivePath] = useState(initialRoute.path);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMeetingsMenuOpen, setMeetingsMenuOpen] = useState(
    [
      AppView.CONSCIOUS_MEETINGS,
      AppView.CONSCIOUS_MEETINGS_UPCOMING,
      AppView.CONSCIOUS_MEETINGS_PORTAL,
      AppView.MEETING_DETAIL,
    ].includes(initialRoute.view)
  );
  const [user, setUser] = useState<UserProfile | null>(() => getCachedAuthUser());
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);
  const [isSigninModalOpen, setSigninModalOpen] = useState(false);
  const [isIdentitySecurityOpen, setIdentitySecurityOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(FREE_TIER_NAME);
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isProviderWalletVerificationRequired, setProviderWalletVerificationRequired] = useState(false);
  const [isProviderWalletBindingRequired, setProviderWalletBindingRequired] = useState(false);
  const [isProviderWalletVerifying, setProviderWalletVerifying] = useState(false);
  const [isProviderWalletBinding, setProviderWalletBinding] = useState(false);
  const [providerWalletStatus, setProviderWalletStatus] = useState('');
  const [isAdminWalletVerifying, setAdminWalletVerifying] = useState(false);
  const [adminWalletStatus, setAdminWalletStatus] = useState('');
  const [adminAccessStatus, setAdminAccessStatus] = useState<{
    walletConfigured: boolean;
    walletAddressMasked: string | null;
    adminAccountReady: boolean;
    passwordFallbackEnabled: boolean;
  } | null>(null);
  const [walletEnvironment, setWalletEnvironment] = useState<WalletProviderEnvironment>(() =>
    detectWalletProviderEnvironment()
  );
  const [isAdminAccessStatusLoading, setAdminAccessStatusLoading] = useState(false);
  const [isPasswordResetRequestOpen, setPasswordResetRequestOpen] = useState(false);
  const [passwordResetEmailInput, setPasswordResetEmailInput] = useState('');
  const [passwordResetNotice, setPasswordResetNotice] = useState('');
  const [isPasswordResetPending, setPasswordResetPending] = useState(false);
  const [recoveryCodeEmailInput, setRecoveryCodeEmailInput] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [oneTimeRecoveryCodes, setOneTimeRecoveryCodes] = useState<string[]>([]);
  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [isContactSubmitting, setContactSubmitting] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isGlobalSearchOpen, setGlobalSearchOpen] = useState(false);
  
  // Membership checkout states
  const [isSelectingTier, setIsSelectingTier] = useState(false);
  const [isMembershipHelpVisible, setMembershipHelpVisible] = useState(true);
  const [isMembershipCheckoutPending, setMembershipCheckoutPending] = useState(false);
  const [membershipNotice, setMembershipNotice] = useState('');
  const [pendingCheckoutSessionId, setPendingCheckoutSessionId] = useState<string | null>(null);
  const [isMembershipAuthGuardChecking, setMembershipAuthGuardChecking] = useState(false);
  const [hoveredMembershipPath, setHoveredMembershipPath] = useState<string | null>(null);
  const [membershipMobileStep, setMembershipMobileStep] = useState(0);
  const membershipTierRefs = useRef<(HTMLDivElement | null)[]>([]);
  const membershipAuthGuardInFlightRef = useRef(false);
  const [contactMessage, setContactMessage] = useState('');

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [isIdentityGuestPromptOpen, setIdentityGuestPromptOpen] = useState(false);

  const insightRef = useRef<HTMLDivElement>(null);
  const primaryScrollRef = useRef<HTMLElement | null>(null);
  const [pendingScrollWisdom, setPendingScrollWisdom] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [navAvatarFailed, setNavAvatarFailed] = useState(false);

  const setCurrentView = (
    view: AppView,
    params: Record<string, string> = {},
    options: { replace?: boolean; preserveSearch?: boolean } = {}
  ) => {
    setCurrentViewState(view);
    setRouteParams(params);

    if (typeof window === 'undefined') return;

    const nextPath = routePathForView(view, params);
    const currentSearch = options.preserveSearch ? window.location.search : '';
    const nextUrl = `${nextPath}${currentSearch}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    setActivePath(nextPath);
    if (nextUrl !== currentUrl) {
      if (options.replace) {
        window.history.replaceState({}, document.title, nextUrl);
      } else {
        window.history.pushState({}, document.title, nextUrl);
      }
    }
  };

  useEffect(() => {
    setNavAvatarFailed(false);
  }, [
    user?.id,
    user?.avatarUrl,
    user?.profileMedia?.avatar?.url,
    user?.profileMedia?.avatar?.objectKey,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshWalletEnvironment = () => {
      setWalletEnvironment(detectWalletProviderEnvironment());
    };

    refreshWalletEnvironment();
    window.addEventListener('focus', refreshWalletEnvironment);
    window.addEventListener('ethereum#initialized', refreshWalletEnvironment as EventListener);
    const ethereum = (window as any).ethereum;
    ethereum?.on?.('connect', refreshWalletEnvironment);
    ethereum?.on?.('disconnect', refreshWalletEnvironment);
    ethereum?.on?.('accountsChanged', refreshWalletEnvironment);
    ethereum?.on?.('chainChanged', refreshWalletEnvironment);

    return () => {
      window.removeEventListener('focus', refreshWalletEnvironment);
      window.removeEventListener('ethereum#initialized', refreshWalletEnvironment as EventListener);
      ethereum?.removeListener?.('connect', refreshWalletEnvironment);
      ethereum?.removeListener?.('disconnect', refreshWalletEnvironment);
      ethereum?.removeListener?.('accountsChanged', refreshWalletEnvironment);
      ethereum?.removeListener?.('chainChanged', refreshWalletEnvironment);
    };
  }, [currentView, isProviderWalletVerificationRequired]);

  useEffect(() => {
    const handleKeyboardScroll = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !KEYBOARD_SCROLL_KEYS.has(event.key) ||
        isEditableKeyboardTarget(event.target) ||
        ((event.key === ' ' || event.key === 'Spacebar') && isSpaceActivationTarget(event.target))
      ) {
        return;
      }

      const target = selectKeyboardScrollTarget(event, primaryScrollRef.current);
      if (!target) return;

      event.preventDefault();
      scrollTargetByIntent(target, getKeyboardScrollIntent(event) as VerticalScrollIntent, event);
    };

    window.addEventListener('keydown', handleKeyboardScroll);
    return () => window.removeEventListener('keydown', handleKeyboardScroll);
  }, []);

  const TIERS = [
    {
      name: FREE_TIER_NAME,
      price: "Free",
      description: "Start your account with community access, public learning areas, and selected events.",
      access: "Stripe checkout for $0 monthly membership.",
      ideal: "New members who want a simple starting point before upgrading.",
      color: "blue"
    },
    {
      name: "Guided Tier",
      price: "$22/month",
      description: "Structured access to curated content, thematic learning pathways, and selected provider-led sessions.",
      access: "Stripe checkout for monthly membership.",
      ideal: "Individuals seeking clarity, emotional wellness, or spiritual development.",
      color: "teal"
    },
    {
      name: "Accelerated Tier",
      price: "$44/month",
      description: "Full access to expert-led sessions, live programs, collaborations, and advanced thematic content.",
      access: "Stripe checkout for monthly membership.",
      ideal: "Users committed to intentional development and consistent practice.",
      color: "indigo"
    }
  ];

  const backendConnectionErrorMessage = (actionLabel: string): string => {
    return `Unable to ${actionLabel}. The service is temporarily unavailable. Please try again shortly.`;
  };

  const resetSignInChallengeInputs = () => {
    setProviderWalletVerificationRequired(false);
    setProviderWalletBindingRequired(false);
    setProviderWalletVerifying(false);
    setProviderWalletBinding(false);
    setProviderWalletStatus('');
  };

  const refreshWalletEnvironment = (): WalletProviderEnvironment => {
    const next = detectWalletProviderEnvironment();
    setWalletEnvironment(next);
    return next;
  };

  const openMetaMaskMobileBrowser = () => {
    const next = refreshWalletEnvironment();
    if (next.deepLinkUrl) {
      window.location.assign(next.deepLinkUrl);
      return;
    }
    setError(next.guidance);
  };

  const walletNetworkMismatchMessage = (
    actualChainId: number,
    expectedChainId: number
  ): string =>
    `Switch your wallet to network ${expectedChainId} before signing. Current network: ${actualChainId}.`;

  const normalizeCourse = (rawCourse: any): Course => ({
    id: String(rawCourse?.id || ''),
    title: String(rawCourse?.title || 'Untitled pathway'),
    provider: String(rawCourse?.provider || 'Conscious Network'),
    description: rawCourse?.description ? String(rawCourse.description) : undefined,
    tier:
      rawCourse?.tier === 'Elite' || rawCourse?.tier === 'Professional' || rawCourse?.tier === 'Basic'
        ? rawCourse.tier
        : 'Basic',
    enrolled: Number(rawCourse?.enrolled || rawCourse?.enrolledCount || 0),
    image: String(rawCourse?.image || ''),
    progress: Number(rawCourse?.progress ?? rawCourse?.progressScore ?? 0),
    progressScore: Number(rawCourse?.progressScore ?? rawCourse?.progress ?? 0),
    status: rawCourse?.status ? String(rawCourse.status) : undefined,
    enrollmentStatus: rawCourse?.enrollmentStatus || null,
  });

  const refreshUserCourses = async (): Promise<Course[]> => {
    if (!getAuthToken()) {
      setEnrolledCourses([]);
      return [];
    }

    try {
      const data = await api<{ courses?: unknown[] }>('/user/courses');
      const courses = Array.isArray(data.courses) ? data.courses.map(normalizeCourse) : [];
      setEnrolledCourses(courses);
      return courses;
    } catch (courseError) {
      if (courseError instanceof ApiError && courseError.status === 401) {
        setGuestSession();
        setUser(null);
      }
      console.error('Course refresh error:', courseError);
      setEnrolledCourses([]);
      return [];
    }
  };

  const normalizePrivacySettings = (raw: any) => ({
    profileVisibility: raw?.profileVisibility === 'private' ? 'private' as const : 'public' as const,
    showEmail: Boolean(raw?.showEmail),
    allowMessages: raw?.allowMessages === undefined ? true : Boolean(raw?.allowMessages),
    blockedUsers: Array.isArray(raw?.blockedUsers)
      ? raw.blockedUsers
          .filter((entry: unknown): entry is string => typeof entry === 'string')
          .map((entry: string) => entry.trim())
          .filter((entry: string) => entry.length > 0)
      : [],
  });

  const toAbsoluteAssetUrl = (value: unknown, objectKey?: unknown): string | undefined => {
    return backendAssetUrl(objectKey) || backendAssetUrl(value);
  };

  const toNullableTrimmedString = (value: unknown): string | null => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : null;
  };

  const toCanonicalUser = (rawUser: any): UserProfile => {
    const rawTier = typeof rawUser?.tier === 'string' ? rawUser.tier.trim() : '';
    const canonicalTier = rawTier.length > 0 ? rawTier : null;
    const subscriptionStatus =
      typeof rawUser?.subscriptionStatus === 'string' && rawUser.subscriptionStatus.trim()
        ? rawUser.subscriptionStatus.trim()
        : 'inactive';
    const profileMedia =
      rawUser?.profileMedia && typeof rawUser.profileMedia === 'object'
        ? {
            avatar: {
              url: toAbsoluteAssetUrl(
                rawUser.profileMedia?.avatar?.url,
                rawUser.profileMedia?.avatar?.objectKey
              ) || null,
              storageProvider: toNullableTrimmedString(rawUser.profileMedia?.avatar?.storageProvider),
              objectKey: toNullableTrimmedString(rawUser.profileMedia?.avatar?.objectKey),
              mimeType: toNullableTrimmedString(rawUser.profileMedia?.avatar?.mimeType),
            },
            cover: {
              url: toAbsoluteAssetUrl(
                rawUser.profileMedia?.cover?.url,
                rawUser.profileMedia?.cover?.objectKey
              ) || null,
              storageProvider: toNullableTrimmedString(rawUser.profileMedia?.cover?.storageProvider),
              objectKey: toNullableTrimmedString(rawUser.profileMedia?.cover?.objectKey),
              mimeType: toNullableTrimmedString(rawUser.profileMedia?.cover?.mimeType),
            },
          }
        : undefined;

    return {
      id: rawUser.id,
      name: rawUser.name || (rawUser.email ? rawUser.email.split('@')[0] : 'Member'),
      handle: rawUser.handle,
      email: rawUser.email,
      role: ['user', 'applicant', 'provider', 'admin'].includes(String(rawUser?.role || '').toLowerCase())
        ? String(rawUser.role).toLowerCase() as 'user' | 'applicant' | 'provider' | 'admin'
        : 'user',
      tier: canonicalTier,
      subscriptionStatus,
      membershipStatus: toNullableTrimmedString(rawUser?.membershipStatus),
      hasActiveMembership: rawUser?.hasActiveMembership === true,
      membershipStartDate: toNullableTrimmedString(rawUser?.membershipStartDate),
      membershipEndDate: toNullableTrimmedString(rawUser?.membershipEndDate),
      createdAt: rawUser.createdAt || new Date().toISOString(),
      hasProfile: rawUser.hasProfile ?? false,
      identityVerified:
        rawUser.identityVerified === true ||
        rawUser.emailVerified === true ||
        Boolean(rawUser.walletDid) ||
        rawUser.providerWalletAddressBound === true,
      emailVerified: rawUser.emailVerified === true,
      providerApproved: rawUser.providerApproved === true,
      providerApprovalStatus: toNullableTrimmedString(rawUser.providerApprovalStatus),
      providerRevokedAt: toNullableTrimmedString(rawUser.providerRevokedAt),
      providerWalletAddressBound: rawUser.providerWalletAddressBound === true,
      reputationScore: rawUser.reputationScore ?? 100,
      accessKeyIndex: rawUser.accessKeyIndex ?? 200,
      avatarUrl: toAbsoluteAssetUrl(rawUser.avatarUrl, rawUser.profileMedia?.avatar?.objectKey),
      bannerUrl: toAbsoluteAssetUrl(rawUser.bannerUrl, rawUser.profileMedia?.cover?.objectKey),
      location: rawUser.location ?? null,
      dateOfBirth: rawUser.dateOfBirth ?? null,
      profileMedia,
      profileBackgroundVideo: toAbsoluteAssetUrl(rawUser.profileBackgroundVideo) || null,
      bio: rawUser.bio,
      interests: rawUser.interests,
      twitterUrl: rawUser.twitterUrl,
      githubUrl: rawUser.githubUrl,
      websiteUrl: rawUser.websiteUrl,
      privacySettings: normalizePrivacySettings(rawUser.privacySettings),
      twoFactorEnabled: rawUser.twoFactorEnabled,
      twoFactorMethod: rawUser.twoFactorMethod || 'none',
      phoneNumberMasked: rawUser.phoneNumberMasked || null,
      walletDid: rawUser.walletDid || null,
      initialTwoFactorRequired: rawUser.initialTwoFactorRequired === true,
      initialTwoFactorCompleted: rawUser.initialTwoFactorCompleted === true,
      canAccessFullPlatform: rawUser.canAccessFullPlatform !== false,
    };
  };

  const toPlatformUser = (rawUser: any): UserProfile => {
    const canonicalUser = toCanonicalUser(rawUser);
    return {
      ...canonicalUser,
      role: canonicalUser.role || 'user',
      tier: canonicalUser.tier,
    };
  };

  const toSessionUserFromBackend = (token: string | null, rawUser: any): UserProfile => {
    const canonicalUser = toCanonicalUser(rawUser);
    return canonicalUser;
  };

  const hasApprovedProviderProfile = (profile: UserProfile | null | undefined): boolean =>
    Boolean(
      profile?.role === 'provider' &&
        profile.providerApproved === true &&
        String(profile.providerApprovalStatus || '').trim().toLowerCase() === 'approved' &&
        !profile.providerRevokedAt
    );

  const hasBoundProviderWallet = (profile: UserProfile | null | undefined): boolean =>
    Boolean(profile?.providerWalletAddressBound === true);

  const hasProviderOperationsAccess = (profile: UserProfile | null | undefined): boolean =>
    Boolean(profile?.role === 'admin' || hasApprovedProviderProfile(profile));

  const hasActiveProviderControlSession = (): boolean => Boolean(getProviderControlSession());

  const canOpenProviderCrm = (profile: UserProfile | null | undefined): boolean => {
    if (!hasProviderOperationsAccess(profile)) return false;
    if (profile?.role === 'admin') return true;
    return hasActiveProviderControlSession();
  };

  const hasConfirmedMembership = (profile: UserProfile | null | undefined): boolean =>
    Boolean(
      profile?.hasActiveMembership === true ||
        ['active', 'trialing', 'free'].includes(
          String(profile?.membershipStatus || '').trim().toLowerCase()
        ) ||
        hasProviderOperationsAccess(profile)
    );

  const hasApplicantRole = (profile: UserProfile | null | undefined): boolean => {
    const providerStatus = String(profile?.providerApprovalStatus || '').trim().toLowerCase();
    return Boolean(
      profile?.role === 'applicant' ||
        (
          profile?.role === 'user' &&
          profile.providerApproved !== true &&
          ['submitted', 'under_review', 'needs_more_info', 'discovery_scheduled', 'rejected'].includes(providerStatus)
        )
    );
  };

  const hasAdminRole = (profile: UserProfile | null | undefined): boolean =>
    profile?.role === 'admin';

  const MIN_PASSWORD_LENGTH = 12;

  const validatePasswordStrength = (email: string, password: string): string | null => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
    if (!/\d/.test(password)) return 'Password must include at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one symbol.';

    const fragments = email
      .toLowerCase()
      .split(/[@._-]+/)
      .filter((fragment) => fragment.length >= 3);
    const loweredPassword = password.toLowerCase();
    for (const fragment of fragments) {
      if (loweredPassword.includes(fragment)) {
        return 'Password must not include parts of your email address.';
      }
    }

    return null;
  };

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = resolveRoute(window.location.pathname, window.location.search);
      setCurrentViewState(nextRoute.view);
      setRouteParams(nextRoute.params);
      setActivePath(nextRoute.path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    if (window.innerWidth >= 1024) setSidebarOpen(true);
    const initialParams = new URLSearchParams(window.location.search);
    if (initialParams.get('externalMeetingInvite')) {
      setCurrentView(AppView.CONSCIOUS_MEETINGS);
    }
    const initializeSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setGuestSession();
        return;
      }

      try {
        const data = await api<{ user: any }>('/user/current', { cache: 'no-store' });
        const canonicalUser = toSessionUserFromBackend(token, data.user);
        setUser(canonicalUser);
        setUserAuthSession(token, canonicalUser);
        setSelectedTier(canonicalUser.tier || FREE_TIER_NAME);
        if (hasApplicantRole(canonicalUser)) {
          setIsSelectingTier(false);
          setMembershipNotice('');
          setPendingCheckoutSessionId(null);
          setStoredPendingCheckoutSessionId(null);
          if (
            ![
              AppView.PROVIDER_ACCESS,
              AppView.PROVIDER_APPLY,
              AppView.PROVIDER_APPLICANT_SIGN_IN,
              AppView.PROVIDER_APPLICATION_STATUS,
            ].includes(initialRoute.view)
          ) {
            setCurrentView(AppView.PROVIDER_APPLICATION_STATUS, {}, { replace: true });
          }
          return;
        }
        void refreshUserCourses();
        const needsMembershipSelection = !hasConfirmedMembership(canonicalUser);
        setIsSelectingTier(needsMembershipSelection);
        if (!needsMembershipSelection && initialRoute.view === AppView.MEMBERSHIP_ACCESS) {
          setStoredPendingCheckoutSessionId(null);
          setPendingCheckoutSessionId(null);
          setMembershipCheckoutPending(false);
          setMembershipNotice('');
          setCurrentView(AppView.DASHBOARD, {}, { replace: true });
          if (window.innerWidth >= 1024) {
            setSidebarOpen(true);
          }
          return;
        }
        if (needsMembershipSelection && !isNoTierSignedInAllowedView(initialRoute.view)) {
          setMembershipNotice('Select a membership tier to continue.');
          setCurrentView(AppView.MEMBERSHIP_ACCESS, {}, { replace: true });
        }
      } catch {
        setGuestSession();
        setUser(null);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const checkoutState = url.searchParams.get('checkout');
    const checkoutSessionId = url.searchParams.get('session_id');
    const routeSessionId =
      initialRoute.view === AppView.VERIFY_SESSION
        ? String(initialRoute.params.sessionId || '').trim()
        : '';
    const sessionId = checkoutSessionId || routeSessionId;
    if (!checkoutState && !sessionId) {
      return;
    }

    url.searchParams.delete('checkout');
    url.searchParams.delete('session_id');
    const nextPath = initialRoute.view === AppView.VERIFY_SESSION ? routePathForView(AppView.VERIFY_SESSION) : url.pathname;
    window.history.replaceState({}, document.title, `${nextPath}${url.search}${url.hash}`);

    if (checkoutState === 'cancel') {
      setMembershipNotice('Checkout canceled. Select a tier to continue.');
      setCurrentView(AppView.MEMBERSHIP_ACCESS);
      setIsSelectingTier(true);
      return;
    }

    if ((checkoutState === 'success' || initialRoute.view === AppView.VERIFY_SESSION) && sessionId) {
      setStoredPendingCheckoutSessionId(sessionId);
      setMembershipNotice('Redirecting to your platform...');
      setPendingCheckoutSessionId(sessionId);
      setCurrentView(AppView.VERIFY_SESSION, {}, { replace: true });
      setIsSelectingTier(true);
      return;
    }

    if (sessionId) {
      setStoredPendingCheckoutSessionId(sessionId);
      setMembershipNotice('Redirecting to your platform...');
      setPendingCheckoutSessionId(sessionId);
      setCurrentView(AppView.VERIFY_SESSION, {}, { replace: true });
      setIsSelectingTier(true);
    }
  }, []);

  useEffect(() => {
    const storedCheckoutSessionId = getStoredPendingCheckoutSessionId();
    if (storedCheckoutSessionId && user && hasConfirmedMembership(user)) {
      setStoredPendingCheckoutSessionId(null);
      return;
    }
    if (storedCheckoutSessionId && !pendingCheckoutSessionId) {
      setPendingCheckoutSessionId(storedCheckoutSessionId);
      setMembershipNotice('Redirecting to your platform...');
    }
  }, [pendingCheckoutSessionId, user?.id, user?.hasActiveMembership]);

  useEffect(() => {
    if (currentView !== AppView.MEMBERSHIP_ACCESS) {
      setHoveredMembershipPath(null);
      return;
    }

    setMembershipMobileStep(0);

    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSteps = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.membershipStep || '0'))
          .filter((step) => step > 0);

        if (visibleSteps.length > 0) {
          setMembershipMobileStep(Math.min(...visibleSteps));
        }
      },
      { rootMargin: '-8% 0px -48% 0px', threshold: [0.25, 0.5, 0.75] }
    );

    membershipTierRefs.current.forEach((element, index) => {
      if (!element) return;
      element.dataset.membershipStep = String(index + 1);
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [currentView]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);
    const ping = async () => {
      try {
        await apiHealth({ signal: controller.signal });
        setHealthStatus('online');
      } catch {
        setHealthStatus('offline');
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    ping();
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      primaryScrollRef.current?.scrollTo({ top: 0, left: 0 });
      document.scrollingElement?.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currentView]);

  useEffect(() => {
    if (pendingScrollWisdom && currentView === AppView.DASHBOARD) {
      insightRef.current?.scrollIntoView({ behavior: 'smooth' });
      setPendingScrollWisdom(false);
    }
  }, [pendingScrollWisdom, currentView]);

  useEffect(() => {
    if (currentView !== AppView.ADMIN_SIGN_IN) return;

    let cancelled = false;
    const loadAdminAccessStatus = async () => {
      setAdminAccessStatusLoading(true);
      try {
        const status = await api<any>('/provider/auth/admin/wallet/status', {
          method: 'GET',
          auth: false,
          cache: 'no-store',
        });
        if (cancelled) return;
        setAdminAccessStatus({
          walletConfigured: status?.walletConfigured === true,
          walletAddressMasked: status?.walletAddressMasked || null,
          adminAccountReady: status?.adminAccountReady === true,
          passwordFallbackEnabled: status?.passwordFallbackEnabled === true,
        });
      } catch {
        if (!cancelled) setAdminAccessStatus(null);
      } finally {
        if (!cancelled) setAdminAccessStatusLoading(false);
      }
    };

    void loadAdminAccessStatus();
    return () => {
      cancelled = true;
    };
  }, [currentView]);

  const handleOpenSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleEnterHub = () => {
    setCurrentView(AppView.MEMBERSHIP_ACCESS);
  };

  const handleEnterProviderAccess = () => {
    setCurrentView(AppView.PROVIDER_ACCESS);
  };

  const handleEnterAdministrativeAccess = () => {
    setCurrentView(AppView.ADMINISTRATIVE_ACCESS);
  };

  const handleEnterConsciousCareers = () => {
    setCurrentView(AppView.ENTREPRENEURSHIP_SUPPORT);
  };
  
  const handleGoHome = () => setCurrentView(AppView.ENTRY);
  
  const handleExploreAsGuest = () => {
    setGuestSession();
    setUser(null);
    setEnrolledCourses([]);
    setMembershipNotice('');
    setCurrentView(AppView.COMMUNITY);
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  };

  const openMemberLogin = () => {
    setSignupModalOpen(false);
    setSigninModalOpen(true);
    resetSignInChallengeInputs();
    setError('');
  };

  const handleOpenIdentityFromSidebar = () => {
    if (user) {
      setCurrentView(AppView.MY_CONSCIOUS_IDENTITY);
      closeSidebarOnMobile();
      return;
    }

    setIdentityGuestPromptOpen(true);
    closeSidebarOnMobile();
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const refreshCanonicalUser = async (): Promise<UserProfile | null> => {
    try {
      const data = await api<{ user: any }>('/user/current', { cache: 'no-store' });
      const token = getAuthToken();
      const canonicalUser = toSessionUserFromBackend(token, data.user);
      setUser(canonicalUser);
      if (token) {
        setUserAuthSession(token, canonicalUser);
      }
      setSelectedTier(canonicalUser.tier || FREE_TIER_NAME);
      return canonicalUser;
    } catch {
      setGuestSession();
      setUser(null);
      return null;
    }
  };

  const routeActiveMemberToDashboard = (profile: UserProfile): boolean => {
    if (!hasConfirmedMembership(profile)) {
      return false;
    }

    setSelectedTier(profile.tier || FREE_TIER_NAME);
    setIsSelectingTier(false);
    setMembershipCheckoutPending(false);
    setMembershipNotice('');
    setStoredPendingCheckoutSessionId(null);
    setPendingCheckoutSessionId(null);
    setCurrentView(AppView.DASHBOARD, {}, { replace: true });
    setSidebarOpen(window.innerWidth >= 1024);
    return true;
  };

  const routeApplicantToStatus = (profile: UserProfile): boolean => {
    if (!hasApplicantRole(profile)) {
      return false;
    }
    setUser(profile);
    setIsSelectingTier(false);
    setMembershipCheckoutPending(false);
    setMembershipNotice('');
    setPendingCheckoutSessionId(null);
    setStoredPendingCheckoutSessionId(null);
    setCurrentView(AppView.PROVIDER_APPLICATION_STATUS, {}, { replace: true });
    setSidebarOpen(false);
    return true;
  };

  useEffect(() => {
    if (currentView !== AppView.PROVIDER_SIGN_IN || !hasApprovedProviderProfile(user)) {
      return;
    }
    if (hasBoundProviderWallet(user)) {
      setProviderWalletBindingRequired(false);
      setProviderWalletVerificationRequired(true);
      setProviderWalletStatus((current) => current || 'Complete wallet verification to open provider tools.');
      return;
    }
    setProviderWalletVerificationRequired(false);
    setProviderWalletBindingRequired(true);
    setProviderWalletStatus((current) => current || 'Bind your provider wallet before verification.');
  }, [currentView, user?.id, user?.providerWalletAddressBound, user?.providerApproved, user?.providerApprovalStatus, user?.providerRevokedAt]);

  useEffect(() => {
    if (currentView !== AppView.MEMBERSHIP_ACCESS) {
      setMembershipAuthGuardChecking(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setMembershipAuthGuardChecking(false);
      return;
    }

    let isCancelled = false;

    if (user && hasConfirmedMembership(user)) {
      routeActiveMemberToDashboard(user);
      return;
    }

    if (membershipAuthGuardInFlightRef.current) {
      return;
    }

    membershipAuthGuardInFlightRef.current = true;
    setMembershipAuthGuardChecking(true);
    const noticeTimer = window.setTimeout(() => {
      if (!isCancelled) {
        setMembershipNotice('Checking membership access...');
      }
    }, 150);

    void (async () => {
      try {
        const refreshed = await refreshCanonicalUser();
        if (isCancelled) return;

        if (refreshed && (routeApplicantToStatus(refreshed) || routeActiveMemberToDashboard(refreshed))) {
          return;
        }

        if (refreshed) {
          setIsSelectingTier(true);
          setMembershipNotice('Select a membership tier to continue.');
        }
      } finally {
        window.clearTimeout(noticeTimer);
        membershipAuthGuardInFlightRef.current = false;
        if (!isCancelled) {
          setMembershipAuthGuardChecking(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
      window.clearTimeout(noticeTimer);
    };
  }, [
    currentView,
    user?.id,
    user?.hasActiveMembership,
    user?.membershipStatus,
    user?.subscriptionStatus,
    user?.tier,
  ]);

  useEffect(() => {
    if (!pendingCheckoutSessionId) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setMembershipCheckoutPending(false);
      setMembershipNotice('Sign in to finish membership checkout verification.');
      setSignupModalOpen(false);
      setSigninModalOpen(true);
      setCurrentView(AppView.VERIFY_SESSION, {}, { replace: true });
      setIsSelectingTier(true);
      return;
    }

    const confirmCheckoutSession = async () => {
      setMembershipCheckoutPending(true);
      setError('');
      let keepPendingCheckoutSession = false;

      try {
        await api('/membership/stripe/confirm-session', {
          method: 'POST',
          body: { sessionId: pendingCheckoutSessionId },
        });

        const refreshed = await refreshCanonicalUser();
        if (!refreshed) {
          keepPendingCheckoutSession = true;
          setMembershipNotice('Membership updated, but session refresh failed. Please sign in again.');
          setSignupModalOpen(false);
          setSigninModalOpen(true);
          return;
        }

        setSelectedTier(refreshed.tier || FREE_TIER_NAME);
        if (hasConfirmedMembership(refreshed)) {
          setStoredPendingCheckoutSessionId(null);
          setMembershipNotice('');
          setIsSelectingTier(false);
          setCurrentView(AppView.DASHBOARD, {}, { replace: true });
          if (window.innerWidth >= 1024) {
            setSidebarOpen(true);
          }
        } else {
          keepPendingCheckoutSession = true;
          setMembershipNotice('Checkout is complete, but membership is still syncing. Please retry shortly.');
          setCurrentView(AppView.VERIFY_SESSION, {}, { replace: true });
          setIsSelectingTier(true);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401) {
            keepPendingCheckoutSession = true;
            setGuestSession();
            setUser(null);
            setSignupModalOpen(false);
            setSigninModalOpen(true);
            setMembershipNotice('Session expired during checkout verification. Please sign in again.');
            setCurrentView(AppView.VERIFY_SESSION, {}, { replace: true });
            return;
          }
          setMembershipNotice(error.message || 'Unable to verify checkout. Please retry.');
          return;
        }
        console.error('Checkout confirmation failed:', error);
        setMembershipNotice('Unable to verify checkout due to a connection issue. Please retry.');
      } finally {
        setMembershipCheckoutPending(false);
        if (!keepPendingCheckoutSession) {
          setStoredPendingCheckoutSessionId(null);
          setPendingCheckoutSessionId(null);
        }
      }
    };

    void confirmCheckoutSession();
  }, [pendingCheckoutSessionId, user?.id]);

  const completeAdminPortalSignIn = async (token: string, canonicalUser: UserProfile): Promise<boolean> => {
    setUserAuthSession(token, canonicalUser);
    setUser(canonicalUser);
    setSelectedTier(canonicalUser.tier || 'Accelerated Tier');
    setIsSelectingTier(false);
    setMembershipCheckoutPending(false);
    setMembershipNotice('');
    setPendingCheckoutSessionId(null);

    const providerSession = await createNativeProviderControlSession();
    if (!providerSession?.token) {
      setError('Administrative controls could not be initialized.');
      return false;
    }

    setProviderControlSession(providerSession.token);
    void refreshUserCourses();
    resetSignInChallengeInputs();
    closeModals();
    setPasswordInput('');
    setCurrentView(AppView.PROVIDER_CRM, {}, { replace: true });
    setSidebarOpen(window.innerWidth >= 1024);
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = emailInput.trim().toLowerCase();
    const signInBody: Record<string, unknown> = {
      email: normalizedEmail,
      password: passwordInput,
    };

    try {
      const data = await api<any>('/user/signin', {
        method: 'POST',
        auth: false,
        body: signInBody,
      });

      const canonicalUser = toPlatformUser(data.user);
      if (hasApplicantRole(canonicalUser)) {
        setUserAuthSession(data.token, canonicalUser);
        setUser(canonicalUser);
        setSelectedTier(canonicalUser.tier || FREE_TIER_NAME);
        resetSignInChallengeInputs();
        setIsSelectingTier(false);
        setMembershipCheckoutPending(false);
        setMembershipNotice('');
        closeModals();
        routeApplicantToStatus(canonicalUser);
        return;
      }
      if (hasAdminRole(canonicalUser)) {
        await completeAdminPortalSignIn(data.token, canonicalUser);
        return;
      }
      const needsMembershipSelection = !hasConfirmedMembership(canonicalUser);
      const storedCheckoutSessionId = getStoredPendingCheckoutSessionId();
      const shouldVerifyStoredCheckout =
        Boolean(storedCheckoutSessionId) && needsMembershipSelection;
      const preserveCareersView = shouldPreserveNoTierViewAfterAuth(currentView);
      if (storedCheckoutSessionId && !shouldVerifyStoredCheckout) {
        setStoredPendingCheckoutSessionId(null);
      }
      setUserAuthSession(data.token, canonicalUser);
      setUser(canonicalUser);
      void refreshUserCourses();
      setSelectedTier(canonicalUser.tier || FREE_TIER_NAME);
      setIsSelectingTier(
        !preserveCareersView && (needsMembershipSelection || shouldVerifyStoredCheckout)
      );
      setMembershipCheckoutPending(shouldVerifyStoredCheckout);
      setMembershipNotice(
        shouldVerifyStoredCheckout
          ? 'Redirecting to your platform...'
          : preserveCareersView
          ? ''
          : needsMembershipSelection
          ? 'Select a membership tier to continue.'
          : ''
      );
      setPendingCheckoutSessionId(shouldVerifyStoredCheckout ? storedCheckoutSessionId : null);
      resetSignInChallengeInputs();
      closeModals();
      if (preserveCareersView) {
        setCurrentView(currentView, {}, { replace: true });
        setSidebarOpen(window.innerWidth >= 1024);
        return;
      }
      if (hasConfirmedMembership(canonicalUser)) {
        routeActiveMemberToDashboard(canonicalUser);
        return;
      }

      setCurrentView(
        shouldVerifyStoredCheckout
          ? AppView.VERIFY_SESSION
          : preserveCareersView
          ? currentView
          : needsMembershipSelection
          ? AppView.MEMBERSHIP_ACCESS
          : AppView.DASHBOARD,
        {},
        { replace: true }
      );
      setSidebarOpen(
        !needsMembershipSelection && !shouldVerifyStoredCheckout && window.innerWidth >= 1024
      );
    } catch (error) {
      if (error instanceof ApiError) {
        const data = error.data as any;
        if (error.status === 503 && data?.code === 'PROFILE_STORE_UNAVAILABLE') {
          setError(error.message || 'Profile service is currently unavailable. Please retry shortly.');
          return;
        }
        setError(error.message || 'Invalid credentials.');
        return;
      }
      console.error('Sign-in request failed:', error);
      setHealthStatus('offline');
      setError(backendConnectionErrorMessage('sign in'));
    }
  };

  const handleProviderApplicationSubmit = async (formData: FormData): Promise<void> => {
    const data = await api<any>('/provider-applicants/apply', {
      method: 'POST',
      auth: false,
      body: formData,
    });
    const canonicalUser = toPlatformUser(data.user);
    setUserAuthSession(data.token, canonicalUser);
    setUser(canonicalUser);
    setIsSelectingTier(false);
    setMembershipCheckoutPending(false);
    setMembershipNotice('');
    setPendingCheckoutSessionId(null);
    setSelectedTier(canonicalUser.tier || FREE_TIER_NAME);
    if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
      setOneTimeRecoveryCodes(data.recoveryCodes.map((code: unknown) => String(code)));
    }
  };

  const handleGrantApplicationSubmit = async (payload: Record<string, unknown>): Promise<void> => {
    await api('/conscious-careers/grant-applications', {
      method: 'POST',
      body: payload,
    });
  };

  const handleProviderApplicantSignIn = async (email: string, password: string): Promise<void> => {
    const data = await api<any>('/user/signin', {
      method: 'POST',
      auth: false,
      body: {
        email: email.trim().toLowerCase(),
        password,
      },
    });
    const canonicalUser = toPlatformUser(data.user);
    if (!hasApplicantRole(canonicalUser)) {
      throw new Error('This sign-in is only for provider applicants. Approved providers should use Provider Access sign-in.');
    }
    setUserAuthSession(data.token, canonicalUser);
    setUser(canonicalUser);
    routeApplicantToStatus(canonicalUser);
  };

  const handleAdministrativeSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = emailInput.trim().toLowerCase();

    try {
      const data = await api<any>('/user/signin', {
        method: 'POST',
        auth: false,
        body: {
          email: normalizedEmail,
          password: passwordInput,
        },
      });

      const canonicalUser = toPlatformUser(data.user);
      if (!hasAdminRole(canonicalUser)) {
        setError('Administrative Access is limited to administrator accounts.');
        return;
      }

      await completeAdminPortalSignIn(data.token, canonicalUser);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message || 'Invalid administrator credentials.');
        return;
      }
      console.error('Administrative sign-in request failed:', error);
      setHealthStatus('offline');
      setError(backendConnectionErrorMessage('sign in as an administrator'));
    }
  };

  const handleAdministrativeWalletVerification = async () => {
    setError('');
    setAdminWalletStatus('');
    const walletEnv = refreshWalletEnvironment();
    const ethereum = walletEnv.provider;
    if (!ethereum?.request) {
      setAdminWalletStatus(walletEnv.guidance);
      setError(walletEnv.guidance);
      return;
    }

    setAdminWalletVerifying(true);
    setAdminWalletStatus('Requesting the administrator wallet...');

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = Array.isArray(accounts) ? String(accounts[0] || '').trim() : '';
      if (!walletAddress) {
        setError('No wallet address was returned by MetaMask.');
        return;
      }

      setAdminWalletStatus('Creating an Administrative Access challenge...');
      const challenge = await api<ProviderWalletChallenge>('/provider/auth/admin/wallet/nonce', {
        method: 'POST',
        auth: false,
        body: { walletAddress },
      });
      const walletChainId = await readWalletChainId(ethereum).catch(() => null);
      if (walletChainId && challenge.chainId && walletChainId !== challenge.chainId) {
        const message = walletNetworkMismatchMessage(walletChainId, challenge.chainId);
        setError(message);
        setAdminWalletStatus(message);
        return;
      }

      const message = buildProviderSiweMessage(challenge);
      setAdminWalletStatus('Confirm the gasless administrative signature in MetaMask.');
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, challenge.address],
      });

      setAdminWalletStatus('Verifying administrator wallet and opening operations...');
      const result = await api<any>('/provider/auth/admin/wallet/verify', {
        method: 'POST',
        auth: false,
        body: {
          challengeId: challenge.challengeId,
          walletAddress: challenge.address,
          message,
          signature,
        },
      });

      const canonicalUser = toPlatformUser(result.user);
      if (!hasAdminRole(canonicalUser)) {
        setError('Administrative wallet verification did not return an administrator session.');
        return;
      }
      if (!result.adminElevation?.token) {
        setError('Administrative wallet verified, but elevated admin console access was not issued.');
        return;
      }

      setUserAuthSession(result.token, canonicalUser);
      setAdminElevationToken(result.adminElevation.token);
      setUser(canonicalUser);
      setSelectedTier(canonicalUser.tier || 'Accelerated Tier');
      setIsSelectingTier(false);
      setMembershipCheckoutPending(false);
      setMembershipNotice('');
      setPendingCheckoutSessionId(null);
      if (result.providerControl?.token) {
        setProviderControlSession(result.providerControl.token);
      }
      void refreshUserCourses();
      resetSignInChallengeInputs();
      closeModals();
      setCurrentView(AppView.PROVIDER_CRM, {}, { replace: true });
      setSidebarOpen(window.innerWidth >= 1024);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message || 'Administrative wallet verification failed.');
        return;
      }
      setError(walletErrorMessage(error, 'Administrative wallet verification failed.'));
    } finally {
      setAdminWalletVerifying(false);
    }
  };

  const handleApprovedProviderSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = emailInput.trim().toLowerCase();
    const providerSignInBody: Record<string, unknown> = {
      email: normalizedEmail,
      password: passwordInput,
    };

    try {
      const data = await api<any>('/user/signin', {
        method: 'POST',
        auth: false,
        body: providerSignInBody,
      });

      const canonicalUser = toPlatformUser(data.user);
      if (canonicalUser.role !== 'provider') {
        setError('This sign-in is only for approved CNH providers. Administrators should use Administrative Access.');
        return;
      }

      setUserAuthSession(data.token, canonicalUser);
      setUser(canonicalUser);
      setSelectedTier(canonicalUser.tier || 'Accelerated Tier');
      setIsSelectingTier(false);
      setMembershipCheckoutPending(false);
      setMembershipNotice('');
      setPendingCheckoutSessionId(null);

      if (!hasApprovedProviderProfile(canonicalUser)) {
        setProviderWalletVerificationRequired(false);
        setProviderWalletBindingRequired(false);
        setProviderWalletStatus('');
        setError('This account has a provider role but is not approved for provider tools. Provider access unlocks only after applicant approval.');
        setPasswordInput('');
        return;
      }

      if (!hasBoundProviderWallet(canonicalUser)) {
        setProviderWalletBindingRequired(true);
        setProviderWalletVerificationRequired(false);
        setProviderWalletStatus('Provider account confirmed. Bind your provider wallet before verification.');
      } else {
        setProviderWalletBindingRequired(false);
        setProviderWalletVerificationRequired(true);
        setProviderWalletStatus('Provider account confirmed. Complete wallet verification to open provider tools.');
      }
      setPasswordInput('');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message || 'Invalid provider credentials.');
        return;
      }
      console.error('Provider sign-in request failed:', error);
      setHealthStatus('offline');
      setError(backendConnectionErrorMessage('sign in as a provider'));
    }
  };

  const handleProviderWalletBinding = async () => {
    if (!user || !hasApprovedProviderProfile(user)) {
      setError('Sign in with an approved provider account before wallet binding.');
      return;
    }

    const walletEnv = refreshWalletEnvironment();
    const ethereum = walletEnv.provider;
    if (!ethereum?.request) {
      setProviderWalletStatus(walletEnv.guidance);
      setError(walletEnv.guidance);
      return;
    }

    setProviderWalletBinding(true);
    setError('');
    setProviderWalletStatus('Requesting the wallet you want to bind...');
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = Array.isArray(accounts) ? String(accounts[0] || '').trim() : '';
      if (!walletAddress) {
        setError('No wallet address was returned by MetaMask.');
        setProviderWalletStatus('');
        return;
      }

      setProviderWalletStatus('Preparing gasless wallet binding message...');
      const challenge = await api<ProviderWalletChallenge>('/provider/auth/wallet/bind/nonce', {
        method: 'POST',
        body: { walletAddress },
      });
      const walletChainId = await readWalletChainId(ethereum).catch(() => null);
      if (walletChainId && challenge.chainId && walletChainId !== challenge.chainId) {
        const message = walletNetworkMismatchMessage(walletChainId, challenge.chainId);
        setError(message);
        setProviderWalletStatus(message);
        return;
      }

      const message = buildProviderSiweMessage(challenge);
      setProviderWalletStatus('Confirm the gasless wallet binding signature in MetaMask.');
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, challenge.address],
      });

      setProviderWalletStatus('Binding wallet to your approved provider account...');
      const result = await api<any>('/provider/auth/wallet/bind/verify', {
        method: 'POST',
        body: {
          challengeId: challenge.challengeId,
          walletAddress: challenge.address,
          message,
          signature,
        },
      });

      if (!result?.walletBound) {
        setError('Wallet binding could not be confirmed.');
        setProviderWalletStatus('');
        return;
      }

      const updatedUser = { ...user, providerWalletAddressBound: true };
      const token = getAuthToken();
      setUser(updatedUser);
      if (token) {
        setUserAuthSession(token, updatedUser);
      }
      setProviderWalletBindingRequired(false);
      setProviderWalletVerificationRequired(true);
      setProviderWalletStatus('Wallet bound. Complete wallet verification to open Provider CRM.');
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message || 'Provider wallet binding failed.');
      } else {
        setError(walletErrorMessage(error, 'Provider wallet binding failed.'));
      }
      setProviderWalletStatus('');
    } finally {
      setProviderWalletBinding(false);
    }
  };

  const handleProviderWalletVerification = async () => {
    if (!user || !hasApprovedProviderProfile(user)) {
      setError('Sign in with an approved provider account before wallet verification.');
      return;
    }

    const walletEnv = refreshWalletEnvironment();
    const ethereum = walletEnv.provider;
    if (!ethereum?.request) {
      setProviderWalletStatus(walletEnv.guidance);
      setError(walletEnv.guidance);
      return;
    }

    setProviderWalletVerifying(true);
    setError('');
    setProviderWalletStatus('Requesting your provider wallet...');
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = Array.isArray(accounts) ? String(accounts[0] || '').trim() : '';
      if (!walletAddress) {
        setError('No wallet address was returned by MetaMask.');
        setProviderWalletStatus('');
        return;
      }

      setProviderWalletStatus('Preparing gasless provider verification message...');
      const challenge = await api<ProviderWalletChallenge>('/provider/auth/wallet/nonce', {
        method: 'POST',
        body: { walletAddress },
      });
      const walletChainId = await readWalletChainId(ethereum).catch(() => null);
      if (walletChainId && challenge.chainId && walletChainId !== challenge.chainId) {
        const message = walletNetworkMismatchMessage(walletChainId, challenge.chainId);
        setError(message);
        setProviderWalletStatus(message);
        return;
      }
      const message = buildProviderSiweMessage(challenge);

      setProviderWalletStatus('Confirm the gasless signature in MetaMask.');
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, challenge.address],
      });

      setProviderWalletStatus('Verifying provider wallet and opening tools...');
      const providerSession = await api<any>('/provider/auth/wallet/verify', {
        method: 'POST',
        body: {
          challengeId: challenge.challengeId,
          walletAddress: challenge.address,
          message,
          signature,
        },
      });

      if (!providerSession?.token) {
        setError('Wallet verified, but provider host controls could not be initialized.');
        setProviderWalletStatus('');
        return;
      }

      setProviderControlSession(providerSession.token);
      setProviderWalletVerificationRequired(false);
      setProviderWalletStatus('');
      setCurrentView(AppView.PROVIDER_CRM, {}, { replace: true });
      setSidebarOpen(window.innerWidth >= 1024);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message || 'Provider wallet verification failed.');
      } else {
        setError(walletErrorMessage(error, 'Provider wallet verification failed.'));
      }
      setProviderWalletStatus('');
    } finally {
      setProviderWalletVerifying(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = emailInput.trim().toLowerCase();
    if (passwordInput !== confirmPasswordInput) {
      setError('Passwords do not match.');
      return;
    }

    const passwordValidation = validatePasswordStrength(emailInput, passwordInput);
    if (passwordValidation) {
      setError(passwordValidation);
      return;
    }

    try {
      const identityName = normalizedEmail.split('@')[0] || 'Member';
      const data = await api<any>('/user/create', {
        method: 'POST',
        auth: false,
        body: {
          email: normalizedEmail,
          name: identityName,
          password: passwordInput,
        },
      });

      if (!data?.persistenceVerified) {
        setError('We could not confirm your profile was saved. Please try again.');
        return;
      }

      const canonicalUser = toPlatformUser(data.user);
      const needsMembershipSelection = !hasConfirmedMembership(canonicalUser);
      const preserveCareersView = shouldPreserveNoTierViewAfterAuth(currentView);
      setUserAuthSession(data.token, canonicalUser);
      setUser(canonicalUser);
      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
        setOneTimeRecoveryCodes(data.recoveryCodes.map((code: unknown) => String(code)));
      }
      void refreshUserCourses();
      setSelectedTier((currentTier) => currentTier || canonicalUser.tier || FREE_TIER_NAME);
      setMembershipCheckoutPending(false);
      setMembershipNotice(
        preserveCareersView
            ? ''
          : needsMembershipSelection
            ? 'Select a membership tier to continue.'
            : ''
      );
      closeModals();
      setCurrentView(
        preserveCareersView
          ? currentView
          : needsMembershipSelection
          ? AppView.MEMBERSHIP_ACCESS
          : AppView.DASHBOARD,
        {},
        { replace: true }
      );
      setIsSelectingTier(needsMembershipSelection && !preserveCareersView);
      setSidebarOpen(!needsMembershipSelection && window.innerWidth >= 1024);
    } catch (error) {
      if (error instanceof ApiError) {
        const data = error.data as any;
        if (error.status === 503 && data?.code === 'PROFILE_STORE_UNAVAILABLE') {
          setError(error.message || 'Profile service is currently unavailable. Please retry shortly.');
          return;
        }
        if (error.status === 503 && data?.code === 'PROFILE_SESSION_ESTABLISH_FAILED') {
          setSignupModalOpen(false);
          setSigninModalOpen(true);
          setPasswordInput('');
          setConfirmPasswordInput('');
          resetSignInChallengeInputs();
          setError(
            error.message ||
              'Profile was created, but session setup failed. Please sign in to continue.'
          );
          return;
        }
        setError(error.message || `Unable to create profile (HTTP ${error.status}).`);
        return;
      }
      console.error('Profile creation request failed:', error);
      setHealthStatus('offline');
      setError(backendConnectionErrorMessage('create profile'));
    }
  };

  const requestPasswordResetForEmail = async (email: string): Promise<string> => {
    const data = await api<any>('/user/password-reset/request', {
      method: 'POST',
      auth: false,
      body: { email: email.trim().toLowerCase() },
    });
    const message = data?.message || 'If an account exists for that email, recovery instructions are available.';
    return data?.devResetUrl ? `${message} Dev reset URL: ${data.devResetUrl}` : message;
  };

  const handlePasswordResetRequest = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPasswordResetPending(true);
    setPasswordResetNotice('');
    setError('');

    try {
      const notice = await requestPasswordResetForEmail(passwordResetEmailInput || emailInput);
      setPasswordResetNotice(notice);
    } catch (error) {
      setPasswordResetNotice(
        error instanceof Error ? error.message : 'Unable to start password reset. Please retry.'
      );
    } finally {
      setPasswordResetPending(false);
    }
  };

  const handleResetPasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordResetPending(true);
    setPasswordResetNotice('');
    setError('');

    const token = String(routeParams.token || '').trim();
    if (!token) {
      setPasswordResetNotice('Reset link is missing a token.');
      setPasswordResetPending(false);
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordResetNotice('Passwords do not match.');
      setPasswordResetPending(false);
      return;
    }

    const passwordValidation = validatePasswordStrength(emailInput, newPasswordInput);
    if (passwordValidation) {
      setPasswordResetNotice(passwordValidation);
      setPasswordResetPending(false);
      return;
    }

    try {
      const data = await api<any>('/user/password-reset/confirm', {
        method: 'POST',
        auth: false,
        body: { token, password: newPasswordInput },
      });
      setPasswordResetNotice(data?.message || 'Password reset complete. You can sign in now.');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setSigninModalOpen(true);
    } catch (error) {
      setPasswordResetNotice(
        error instanceof Error ? error.message : 'Unable to reset password. Please retry.'
      );
    } finally {
      setPasswordResetPending(false);
    }
  };

  const handleRecoveryCodeResetConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPasswordResetPending(true);
    setPasswordResetNotice('');
    setError('');

    const recoveryEmail = recoveryCodeEmailInput.trim().toLowerCase();
    if (!recoveryEmail || !recoveryCodeInput.trim() || !newPasswordInput) {
      setPasswordResetNotice('Enter your account email, recovery code, and new password.');
      setPasswordResetPending(false);
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordResetNotice('Passwords do not match.');
      setPasswordResetPending(false);
      return;
    }

    const passwordValidation = validatePasswordStrength(recoveryEmail, newPasswordInput);
    if (passwordValidation) {
      setPasswordResetNotice(passwordValidation);
      setPasswordResetPending(false);
      return;
    }

    try {
      const data = await api<any>('/user/password-reset/recovery-code/confirm', {
        method: 'POST',
        auth: false,
        body: {
          email: recoveryEmail,
          recoveryCode: recoveryCodeInput,
          password: newPasswordInput,
        },
      });
      setPasswordResetNotice(data?.message || 'Password reset complete. You can sign in now.');
      setRecoveryCodeInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setSigninModalOpen(true);
    } catch (error) {
      setPasswordResetNotice(
        error instanceof Error ? error.message : 'Unable to reset password. Please retry.'
      );
    } finally {
      setPasswordResetPending(false);
    }
  };

  const handleMembershipTierSelect = async (tier: string) => {
    if (isMembershipCheckoutPending) return;
    if (!user) {
      setSelectedTier(tier);
      setMembershipNotice('Sign in to continue membership selection.');
      setSignupModalOpen(false);
      setSigninModalOpen(true);
      resetSignInChallengeInputs();
      return;
    }

    setSelectedTier(tier);
    setMembershipNotice('');
    setError('');
    setMembershipCheckoutPending(true);

    try {
      const canonicalUser = await refreshCanonicalUser();
      if (!canonicalUser) {
        setMembershipNotice('Session expired. Please sign in again.');
        setSignupModalOpen(false);
        setSigninModalOpen(true);
        setMembershipCheckoutPending(false);
        return;
      }

      const data = await api<any>('/membership/stripe/create-checkout-session', {
        method: 'POST',
        body: { userId: canonicalUser.id, tier },
      });

      const checkoutSessionId = String(data?.sessionId || '').trim();
      if (checkoutSessionId) {
        setStoredPendingCheckoutSessionId(checkoutSessionId);
      }

      const checkoutUrl = String(data?.checkoutUrl || '').trim();
      if (!checkoutUrl) {
        setMembershipNotice('Checkout session created without a redirect URL. Please retry.');
        setMembershipCheckoutPending(false);
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503 && (err.data as any)?.code === 'STRIPE_UNAVAILABLE') {
        setMembershipNotice(
          err.message || 'Membership checkout is temporarily unavailable. Please retry shortly.'
        );
        setMembershipCheckoutPending(false);
        return;
      }
      setMembershipNotice('Failed to process tier selection. Please try again.');
      setMembershipCheckoutPending(false);
      console.error('Tier selection error:', err);
    }
  };

  const handleSignOut = () => {
    const finalizeSignOut = () => {
      setGuestSession();
      setUser(null);
      setEnrolledCourses([]);
      setIsSelectingTier(false);
      setMembershipCheckoutPending(false);
      setMembershipNotice('');
      setPendingCheckoutSessionId(null);
      setOneTimeRecoveryCodes([]);
      resetSignInChallengeInputs();
      setCurrentView(AppView.ENTRY);
      setSidebarOpen(false);
    };

    void (async () => {
      try {
        if (getAuthToken()) {
          await api('/user/logout', {
            method: 'POST',
          });
        }
      } catch {
        // Best-effort session revocation; local cleanup always executes.
      } finally {
        finalizeSignOut();
      }
    })();
  };

  const closeModals = () => {
    setSignupModalOpen(false); setSigninModalOpen(false);
    setError(''); setEmailInput(''); setPasswordInput(''); setConfirmPasswordInput('');
    resetSignInChallengeInputs();
    setPasswordResetRequestOpen(false); setPasswordResetEmailInput(''); setPasswordResetNotice('');
    setRecoveryCodeEmailInput(''); setRecoveryCodeInput('');
  };

  const getPolicyContent = (policy: string) => {
    switch (policy) {
      case 'privacy': return privacyPolicy;
      case 'terms': return termsOfService;
      case 'ai-transparency': return aiTransparencyPolicy;
      case 'blockchain': return blockchainDataPolicy;
      case 'vendor': return vendorApiGovernancePolicy;
      case 'nist': return nistMappingSummary;
      default: return '';
    }
  };

  const cleanPolicyContent = (content: string) => {
    return content
      .replace(/^#+\s*/gm, '') // remove headers
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // remove bold italic
      .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
      .replace(/\*(.*?)\*/g, '$1') // remove italic
      .replace(/^[-*+]\s+/gm, '') // remove list bullets
      .replace(/^\d+\.\s+/gm, '') // remove numbered lists
      .replace(/`([^`]+)`/g, '$1') // remove inline code
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links, keep text
      .replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1') // remove images, keep alt
      .replace(/\n\n+/g, '\n\n') // normalize newlines
      .trim();
  };

  const policies = ['privacy', 'terms', 'ai-transparency', 'blockchain', 'vendor', 'nist'];

  const getNextPolicy = (current: string) => {
    const index = policies.indexOf(current);
    return policies[(index + 1) % policies.length];
  };

  const enrollCourse = (course: Course) => {
    if (!user || !getAuthToken()) {
      setSigninModalOpen(true);
      return;
    }

    void (async () => {
      try {
        const data = await api<any>(`/courses/${course.id}/enroll`, {
          method: 'POST',
          body: {},
        });
        const enrolledCourse = normalizeCourse(data.course || course);
        setEnrolledCourses((current) => {
          const exists = current.some((item) => item.id === enrolledCourse.id);
          return exists
            ? current.map((item) => (item.id === enrolledCourse.id ? { ...item, ...enrolledCourse } : item))
            : [...current, enrolledCourse];
        });
        void refreshUserCourses();
        setCurrentView(AppView.MY_COURSES);
      } catch (enrollError) {
        console.error('Course enrollment error:', enrollError);
        setError(enrollError instanceof Error ? enrollError.message : 'Failed to enroll in course');
      }
    })();
  };

  const updateCourseProgress = async (courseId: string, progressScore: number): Promise<Course> => {
    const data = await api<any>(`/user/courses/${encodeURIComponent(courseId)}/progress`, {
      method: 'PATCH',
      body: { progressScore },
    });
    const updatedCourse = normalizeCourse(data.course || {});
    setEnrolledCourses((current) =>
      current.map((course) => (course.id === updatedCourse.id ? { ...course, ...updatedCourse } : course))
    );
    return updatedCourse;
  };

  const updateActiveUser = (updated: UserProfile) => {
    const token = getAuthToken();
    const canonicalUpdated = toPlatformUser({ ...user, ...updated });
    setUser(canonicalUpdated);
    if (token) {
      setUserAuthSession(token, canonicalUpdated);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { user: canonicalUpdated } }));
    }
  };

  const handleIdentityComplete = (profileData: Partial<UserProfile>) => {
    if (!user) return;

    const optimistic = { ...user, ...profileData, hasProfile: true };
    updateActiveUser(optimistic);

    void (async () => {
      try {
        const data = await api<any>(`/user/${user.id}`, {
          method: 'PUT',
          body: {
            name: profileData.name ?? user.name,
            handle: profileData.handle,
            bio: profileData.bio,
            location: profileData.location,
            dateOfBirth: profileData.dateOfBirth,
            avatarUrl: profileData.avatarUrl,
            bannerUrl: profileData.bannerUrl,
            profileMedia: profileData.profileMedia,
            interests: profileData.interests,
            twitterUrl: profileData.twitterUrl,
            githubUrl: profileData.githubUrl,
            websiteUrl: profileData.websiteUrl,
            privacySettings: profileData.privacySettings,
          },
        });

        const canonical = toCanonicalUser(data.user);
        updateActiveUser({ ...canonical, hasProfile: true });
      } catch (persistError) {
        console.error('Identity persistence error:', persistError);
        setError('Profile changes were not fully saved. Please try again.');
      }
    })();
  };

  const navViewMap: Record<string, AppView> = {
    dashboard: AppView.DASHBOARD,
    'social-learning': AppView.CONSCIOUS_SOCIAL_LEARNING,
    community: AppView.COMMUNITY,
    meetings: AppView.CONSCIOUS_MEETINGS,
    'provider-crm': AppView.PROVIDER_CRM,
    'my-courses': AppView.MY_COURSES,
    courses: AppView.KNOWLEDGE_PATHWAYS,
    providers: AppView.PROVIDERS,
    careers: AppView.ENTREPRENEURSHIP_SUPPORT,
    profile: AppView.MY_CONSCIOUS_IDENTITY,
    membership: AppView.MEMBERSHIP,
    admin: AppView.ADMIN_DASHBOARD,
  };

  const filteredNavigationItems = useMemo(() => {
    if (!user) {
      return NAVIGATION_ITEMS.filter((item) => {
        const view = navViewMap[item.id];
        return view ? isGuestAllowedView(view) : false;
      });
    }
    if (hasAdminRole(user)) {
      return NAVIGATION_ITEMS;
    }
    if (hasApprovedProviderProfile(user)) {
      return NAVIGATION_ITEMS.filter(
        (item) =>
          item.id !== 'admin' &&
          (item.id === 'provider-crm' || item.id === 'providers' || canTierAccessNavItem(user.tier, item.id))
      );
    }
    if (!hasConfirmedMembership(user)) {
      return NAVIGATION_ITEMS.filter((item) => item.id === 'membership' || item.id === 'careers');
    }
    return NAVIGATION_ITEMS.filter(
      (item) => item.id !== 'admin' && item.id !== 'provider-crm' && canTierAccessNavItem(user.tier, item.id)
    );
  }, [user]);

  const isPlatformSearchResultAllowed = (result: PlatformSearchResult): boolean => {
    const view = result.view;
    if (hasAdminRole(user)) return true;
    if (!user) return isGuestAllowedView(view);
    if (hasApplicantRole(user)) {
      return [
        AppView.PROVIDER_ACCESS,
        AppView.PROVIDER_APPLY,
        AppView.PROVIDER_APPLICANT_SIGN_IN,
        AppView.PROVIDER_APPLICATION_STATUS,
        AppView.NOTIFICATIONS,
        AppView.CONSCIOUS_CAREERS,
        AppView.ENTREPRENEURSHIP_SUPPORT,
        AppView.PRIVACY_POLICY,
        AppView.TERMS_OF_SERVICE,
        AppView.AI_TRANSPARENCY_POLICY,
      ].includes(view);
    }
    if (hasProviderOperationsAccess(user) && [AppView.PROVIDER_CRM, AppView.PROVIDERS].includes(view)) {
      return true;
    }
    if (!hasConfirmedMembership(user)) {
      return view === AppView.MEMBERSHIP || view === AppView.CONSCIOUS_CAREERS || isNoTierSignedInAllowedView(view);
    }
    return canTierAccessView(user.tier, view);
  };

  const globalSearchResults = useMemo(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return PLATFORM_SEARCH_CATALOG
      .filter((result) => isPlatformSearchResultAllowed(result))
      .filter((result) => {
        const searchable = `${result.title} ${result.description} ${result.keywords.join(' ')}`.toLowerCase();
        return searchable.includes(query);
      })
      .slice(0, 6);
  }, [globalSearchQuery, user]);

  const openPlatformSearchResult = (result: PlatformSearchResult) => {
    setCurrentView(result.view);
    setGlobalSearchQuery('');
    setGlobalSearchOpen(false);
  };

  const handleGlobalSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const firstResult = globalSearchResults[0];
    if (firstResult) {
      openPlatformSearchResult(firstResult);
    }
  };

  const openContactModal = () => {
    setContactName(user?.name || '');
    setContactEmail(user?.email || '');
    setContactSubject('');
    setContactMessage('');
    setContactStatus('');
    setContactModalOpen(true);
  };

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactSubmitting(true);
    setContactStatus('');
    try {
      const data = await api<{ ticketId?: string; delivery?: string }>('/support/contact', {
        method: 'POST',
        auth: false,
        body: {
          name: contactName.trim(),
          email: contactEmail.trim(),
          subject: contactSubject.trim() || 'Platform contact request',
          message: contactMessage.trim(),
          route: typeof window !== 'undefined' ? window.location.pathname : routePathForView(currentView, routeParams),
        },
      });
      setContactStatus(`Request received${data.ticketId ? `: ${data.ticketId}` : ''}.`);
      setContactMessage('');
      setContactSubject('');
    } catch (error) {
      setContactStatus(error instanceof Error ? error.message : 'Unable to send contact request.');
    } finally {
      setContactSubmitting(false);
    }
  };

  const renderProviderCrmAccessGate = () => {
    const role = user?.role || 'user';
    const approvalStatus = String(user?.providerApprovalStatus || '').trim().toLowerCase();
    const isProvider = role === 'provider';
    const isApplicant = role === 'applicant';
    const isApprovedProvider = hasApprovedProviderProfile(user);
    const hasProviderSession = hasActiveProviderControlSession();

    const title = isApplicant
      ? 'Provider Review In Progress'
      : isProvider && !isApprovedProvider
        ? approvalStatus === 'rejected'
          ? 'Provider Application Not Approved'
          : 'Provider Approval Required'
        : isApprovedProvider && !hasProviderSession
          ? 'Wallet Verification Required'
          : 'Approved Provider Required';

    const description = isApplicant
      ? 'Your application has not yet unlocked Provider CRM. View the applicant portal for status, requests, and next steps.'
      : isProvider && !isApprovedProvider
        ? 'This provider account is not in an active approved state. Provider CRM remains locked until admin approval is restored.'
        : isApprovedProvider && !hasProviderSession
          ? 'Your provider account is approved, but Provider CRM requires a fresh wallet-verified provider session before tools open.'
          : 'Provider CRM is available only to approved providers after wallet verification, or to an elevated administrator.';

    const actionLabel = isApplicant || (isProvider && !isApprovedProvider)
      ? 'View Application Status'
      : isApprovedProvider && !hasProviderSession
        ? 'Verify Provider Wallet'
        : 'Open Provider Access';

    const action = () => {
      if (isApplicant || (isProvider && !isApprovedProvider)) {
        setCurrentView(AppView.PROVIDER_APPLICATION_STATUS);
        return;
      }
      if (isApprovedProvider && !hasProviderSession) {
        resetSignInChallengeInputs();
        setCurrentView(AppView.PROVIDER_SIGN_IN);
        return;
      }
      setCurrentView(AppView.PROVIDER_ACCESS);
    };

    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20 bg-blue-500/[0.04]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
            <WalletCards className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
            {title}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">{description}</p>
          <button
            onClick={action}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderAdminAccessGate = () => (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-200/20 bg-amber-400/[0.04]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-400/10 text-amber-100">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
          Admin Access Required
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          This console is limited to the platform administrator. Use Administrative Access with the authorized admin wallet or account session.
        </p>
        <button
          onClick={() => setCurrentView(AppView.ADMINISTRATIVE_ACCESS)}
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          Administrative Access
        </button>
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (!user && currentView === AppView.PROVIDER_APPLICATION_STATUS) {
      return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-200/20 bg-amber-400/[0.04]">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Applicant Session Required
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Sign in with your provider applicant credentials to view application status.
            </p>
            <button
              onClick={() => setCurrentView(AppView.PROVIDER_APPLICANT_SIGN_IN)}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              Applicant Sign In
            </button>
          </div>
        </div>
      );
    }

    if (!user && !isGuestAllowedView(currentView)) {
      return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Session Required
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This platform area requires a signed user session before access.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  resetSignInChallengeInputs();
                  setSigninModalOpen(true);
                }}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => setCurrentView(AppView.MEMBERSHIP_ACCESS)}
                className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 transition-colors"
              >
                Membership Access
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (requiresStoredSession(currentView) && (!getAuthToken() || !user)) {
      return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Session Required
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This platform area requires a signed user session before access.
            </p>
            <button
              onClick={() => {
                resetSignInChallengeInputs();
                setSigninModalOpen(true);
              }}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      );
    }

    if (
      user &&
      [AppView.ADMIN_DASHBOARD, AppView.ADMIN_PROVIDER_APPLICANTS].includes(currentView) &&
      !hasAdminRole(user)
    ) {
      return renderAdminAccessGate();
    }

    if (user && currentView === AppView.PROVIDER_CRM && !canOpenProviderCrm(user)) {
      return renderProviderCrmAccessGate();
    }

    if (
      user &&
      hasApplicantRole(user) &&
      ![
        AppView.PROVIDER_ACCESS,
        AppView.PROVIDER_APPLY,
        AppView.PROVIDER_APPLICANT_SIGN_IN,
        AppView.PROVIDER_APPLICATION_STATUS,
        AppView.NOTIFICATIONS,
        AppView.NOT_FOUND,
      ].includes(currentView)
    ) {
      return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-200/20 bg-amber-400/[0.04]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-400/10 text-amber-100">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Provider Review In Progress
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Your provider application is still under review. This area unlocks after approval
              through native CNH provider sign-in.
            </p>
            <button
              onClick={() => setCurrentView(AppView.PROVIDER_APPLICATION_STATUS)}
              className="mt-6 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              View Application Status
            </button>
          </div>
        </div>
      );
    }

    if (user && !hasAdminRole(user) && !hasConfirmedMembership(user) && !isNoTierSignedInAllowedView(currentView)) {
      return (
        <div className="p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-8 rounded-3xl border border-blue-500/20">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Membership Activation Required
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Select a membership tier from Membership Access to unlock your account and enter the hub.
            </p>
            <button
              onClick={() => {
                setIsSelectingTier(true);
                setCurrentView(AppView.MEMBERSHIP_ACCESS);
              }}
              className="mt-6 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              Choose Membership
            </button>
          </div>
        </div>
      );
    }
    if (
      user &&
      !hasAdminRole(user) &&
      hasConfirmedMembership(user) &&
      currentView !== AppView.NOT_FOUND &&
      !(
        hasProviderOperationsAccess(user) &&
        [AppView.PROVIDER_CRM, AppView.PROVIDERS, AppView.PROVIDER_DETAIL].includes(currentView)
      ) &&
      !canTierAccessView(user.tier, currentView)
    ) {
      return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Tier Upgrade Required
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This feature is locked for your current tier. Choose a higher tier when you are ready to unlock it.
            </p>
            <button
              onClick={() => setCurrentView(AppView.MEMBERSHIP)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              View Memberships
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case AppView.RESET_PASSWORD: {
        const hasPasswordResetToken = Boolean(String(routeParams.token || '').trim());
        return (
          <div className="p-4 sm:p-8 max-w-xl mx-auto w-full">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20">
              <button onClick={() => setCurrentView(AppView.ENTRY)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Portal Entry</span>
              </button>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
                Reset Password
              </h2>
              <p className="text-sm leading-6 text-slate-400 mb-6">
                {hasPasswordResetToken
                  ? 'Create a new password for this account. Active sessions will be revoked after the reset.'
                  : 'Start account recovery. If email delivery is unavailable, use one of your saved recovery codes.'}
              </p>
              {hasPasswordResetToken ? (
                <form onSubmit={handleResetPasswordConfirm} className="space-y-5">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      New Password
                    </span>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(event) => setNewPasswordInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      required
                      placeholder="********"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Confirm Password
                    </span>
                    <input
                      type="password"
                      value={confirmNewPasswordInput}
                      onChange={(event) => setConfirmNewPasswordInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      required
                      placeholder="********"
                    />
                  </label>
                  {passwordResetNotice && (
                    <p className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100">
                      {passwordResetNotice}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isPasswordResetPending}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl"
                  >
                    {isPasswordResetPending ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </form>
              ) : (
                <div className="space-y-5">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Account Email
                    </span>
                    <input
                      type="email"
                      value={passwordResetEmailInput}
                      onChange={(event) => setPasswordResetEmailInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      placeholder="you@example.com"
                    />
                  </label>
                  {passwordResetNotice && (
                    <p className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100">
                      {passwordResetNotice}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handlePasswordResetRequest()}
                    disabled={isPasswordResetPending}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl"
                  >
                    {isPasswordResetPending ? 'Starting Recovery...' : 'Start Recovery'}
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-300">
                    Saved recovery code available? Reset your password below without waiting for email.
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">
                      Recovery Code Reset
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Use a recovery code you saved when your account was created. Codes are one-time use.
                    </p>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Account Email
                    </span>
                    <input
                      type="email"
                      value={recoveryCodeEmailInput}
                      onChange={(event) => setRecoveryCodeEmailInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      required
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Recovery Code
                    </span>
                    <input
                      type="text"
                      value={recoveryCodeInput}
                      onChange={(event) => setRecoveryCodeInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 font-mono text-sm uppercase text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      placeholder="CNH-XXXX-XXXX-XXXX"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      New Password
                    </span>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(event) => setNewPasswordInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      placeholder="********"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Confirm Password
                    </span>
                    <input
                      type="password"
                      value={confirmNewPasswordInput}
                      onChange={(event) => setConfirmNewPasswordInput(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                      placeholder="********"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleRecoveryCodeResetConfirm()}
                    disabled={isPasswordResetPending}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
                  >
                    {isPasswordResetPending ? 'Resetting Password...' : 'Reset With Recovery Code'}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentView(AppView.MEMBERSHIP_ACCESS);
                  setSignupModalOpen(false);
                  resetSignInChallengeInputs();
                  setSigninModalOpen(true);
                }}
                className="mt-4 w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
              >
                Return To Sign In
              </button>
            </div>
          </div>
        );
      }
      case AppView.VERIFY_EMAIL:
        return (
          <div className="p-4 sm:p-8 max-w-xl mx-auto w-full">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/20">
              <button onClick={() => setCurrentView(AppView.ENTRY)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Portal Entry</span>
              </button>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
                Account Access
              </h2>
              <p className="text-sm leading-6 text-slate-400 mb-6">
                Sign in with your email and password to continue.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCurrentView(user ? AppView.MEMBERSHIP_ACCESS : AppView.ENTRY);
                  if (!user) {
                    resetSignInChallengeInputs();
                    setSigninModalOpen(true);
                  }
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl"
              >
                Continue
              </button>
            </div>
          </div>
        );
      case AppView.VERIFY_SESSION:
        return (
          <div className="flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-8">
            <div className="glass-panel w-full max-w-xl rounded-3xl border border-blue-500/20 p-6 text-center shadow-2xl sm:p-8">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                Redirecting to your platform...
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                We are verifying your Stripe checkout and refreshing your membership session.
              </p>
              {membershipNotice && (
                <p className="mt-5 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs font-black uppercase tracking-widest text-blue-100">
                  {membershipNotice}
                </p>
              )}
              {!getAuthToken() && (
                <button
                  type="button"
                  onClick={openMemberLogin}
                  className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-colors hover:bg-blue-500"
                >
                  Member Login
                </button>
              )}
            </div>
          </div>
        );
      case AppView.ADMINISTRATIVE_ACCESS:
        return (
          <AdministrativeAccessPage
            onGoHome={() => setCurrentView(AppView.ENTRY)}
            onSignIn={() => {
              resetSignInChallengeInputs();
              setCurrentView(AppView.ADMIN_SIGN_IN);
            }}
          />
        );
      case AppView.ADMIN_SIGN_IN:
        return (
          <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#05070a] p-4 sm:p-8">
            <div className="glass-panel w-full max-w-xl rounded-3xl border border-amber-200/20 bg-amber-500/[0.04] p-6 shadow-2xl sm:p-8">
              <button
                type="button"
                onClick={() => setCurrentView(AppView.ADMINISTRATIVE_ACCESS)}
                className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-100/60 transition-colors hover:text-white"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Administrative Access
              </button>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-500/10 text-amber-100">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                Administrator Sign In
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sign in with an administrator account to enter provider operations and platform oversight.
              </p>
              <div className="mt-7 space-y-5">
                {error && (
                  <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] font-black uppercase tracking-widest text-red-200">
                    {error}
                  </p>
                )}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {isAdminAccessStatusLoading
                      ? 'Checking Administrative Access'
                      : adminAccessStatus
                        ? adminAccessStatus.walletConfigured
                          ? `Founder wallet ready${adminAccessStatus.walletAddressMasked ? `: ${adminAccessStatus.walletAddressMasked}` : ''}`
                          : 'Founder wallet is not configured'
                        : 'Unable to confirm Administrative Access readiness'}
                  </p>
                  {adminAccessStatus && !adminAccessStatus.adminAccountReady && (
                    <p className="mt-2 text-[10px] leading-5 text-amber-100/80">
                      The sole administrator account must exist before wallet entry can open the portal.
                    </p>
                  )}
                </div>
                <div className="space-y-4 rounded-3xl border border-amber-200/20 bg-amber-500/[0.04] p-5">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">
                      Wallet Verification
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      Verify the configured founder wallet with a gasless signature to open admin operations.
                    </p>
                  </div>
                  {adminWalletStatus && (
                    <p className="rounded-xl border border-amber-200/20 bg-amber-500/10 p-3 text-[10px] font-black uppercase tracking-widest text-amber-100">
                      {adminWalletStatus}
                    </p>
                  )}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-100/80">
                      {walletEnvironment.guidance}
                    </p>
                    {walletEnvironment.actionLabel && walletEnvironment.deepLinkUrl && (
                      <button
                        type="button"
                        onClick={openMetaMaskMobileBrowser}
                        className="mt-3 w-full rounded-xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-amber-100 transition hover:bg-amber-500/20"
                      >
                        {walletEnvironment.actionLabel}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAdministrativeWalletVerification()}
                    disabled={
                      isAdminWalletVerifying ||
                      isAdminAccessStatusLoading ||
                      !walletEnvironment.hasProvider ||
                      adminAccessStatus?.walletConfigured === false ||
                      adminAccessStatus?.adminAccountReady === false
                    }
                    className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 shadow-xl shadow-amber-950/30 transition hover:bg-amber-400 disabled:opacity-60"
                  >
                    {isAdminWalletVerifying
                      ? 'Verifying Wallet...'
                      : adminAccessStatus?.walletConfigured === false
                        ? 'Wallet Not Configured'
                        : adminAccessStatus?.adminAccountReady === false
                          ? 'Admin Account Not Ready'
                          : !walletEnvironment.hasProvider
                            ? 'Wallet Browser Required'
                        : 'Verify Wallet & Enter Portal'}
                  </button>
                </div>
                {adminAccessStatus?.passwordFallbackEnabled !== true ? (
                  <p className="rounded-2xl border border-amber-200/20 bg-amber-500/[0.04] p-4 text-[10px] font-black uppercase tracking-widest text-amber-100">
                    Emergency password access is disabled. Use wallet verification.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">
                      <span className="h-px flex-1 bg-white/10" />
                      Emergency Password Access
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <form onSubmit={handleAdministrativeSignIn} className="space-y-5">
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Administrator email
                        </span>
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(event) => setEmailInput(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-amber-400/40"
                          required
                          placeholder="admin@example.com"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Password
                        </span>
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={(event) => setPasswordInput(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-amber-400/40"
                          required
                          placeholder="********"
                        />
                      </label>
                      {ACCOUNT_RECOVERY_UI_ENABLED && (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                            Administrator Recovery
                          </p>
                          <p className="text-xs leading-5 text-amber-100/75">
                            Administrator password recovery is handled manually by operations. Use the configured founder wallet, or contact founder support if access is blocked.
                          </p>
                        </div>
                      )}
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 shadow-xl shadow-amber-950/30 transition hover:bg-amber-400"
                      >
                        Enter Administrative Portal
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      case AppView.PROVIDER_ACCESS:
        return (
          <ProviderAccessPage
            onGoHome={() => setCurrentView(AppView.ENTRY)}
            onSignIn={() => {
              resetSignInChallengeInputs();
              setCurrentView(AppView.PROVIDER_SIGN_IN);
            }}
            onApply={() => setCurrentView(AppView.PROVIDER_APPLY)}
            onApplicantSignIn={() => {
              resetSignInChallengeInputs();
              setCurrentView(AppView.PROVIDER_APPLICANT_SIGN_IN);
            }}
          />
        );
      case AppView.PROVIDER_SIGN_IN:
        return (
          <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#05070a] p-4 sm:p-8">
            <div className="glass-panel w-full max-w-xl rounded-3xl border border-blue-300/20 bg-blue-500/[0.04] p-6 shadow-2xl sm:p-8">
              <button
                type="button"
                onClick={() => setCurrentView(AppView.PROVIDER_ACCESS)}
                className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100/60 transition-colors hover:text-white"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Provider Access
              </button>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                <WalletCards className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                Approved Provider Sign In
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sign in with your approved Conscious Network Hub provider account to initialize
                native provider host controls.
              </p>
              <div className="mt-7 space-y-5">
                {error && (
                  <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] font-black uppercase tracking-widest text-red-200">
                    {error}
                  </p>
                )}
                {isProviderWalletBindingRequired ? (
                  <div className="space-y-5 rounded-3xl border border-blue-300/20 bg-blue-500/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">
                          Bind Provider Wallet
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          Bind one wallet to this approved provider account with a gasless signature. Provider tools stay locked until you verify that wallet for the active session.
                        </p>
                      </div>
                    </div>
                    {providerWalletStatus && (
                      <p className="rounded-xl border border-blue-300/20 bg-blue-500/10 p-3 text-[10px] font-black uppercase tracking-widest text-blue-100">
                        {providerWalletStatus}
                      </p>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/80">
                        {walletEnvironment.guidance}
                      </p>
                      {walletEnvironment.actionLabel && walletEnvironment.deepLinkUrl && (
                        <button
                          type="button"
                          onClick={openMetaMaskMobileBrowser}
                          className="mt-3 w-full rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-100 transition hover:bg-blue-500/20"
                        >
                          {walletEnvironment.actionLabel}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleProviderWalletBinding()}
                      disabled={isProviderWalletBinding || !walletEnvironment.hasProvider}
                      className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-950/40 transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {isProviderWalletBinding
                        ? 'Binding Wallet...'
                        : !walletEnvironment.hasProvider
                          ? 'Wallet Browser Required'
                          : 'Bind Wallet'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : isProviderWalletVerificationRequired ? (
                  <div className="space-y-5 rounded-3xl border border-blue-300/20 bg-blue-500/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">
                          Wallet Verification
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          Sign a gasless provider access message with your approved wallet. This does not submit a blockchain transaction.
                        </p>
                      </div>
                    </div>
                    {providerWalletStatus && (
                      <p className="rounded-xl border border-blue-300/20 bg-blue-500/10 p-3 text-[10px] font-black uppercase tracking-widest text-blue-100">
                        {providerWalletStatus}
                      </p>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/80">
                        {walletEnvironment.guidance}
                      </p>
                      {walletEnvironment.actionLabel && walletEnvironment.deepLinkUrl && (
                        <button
                          type="button"
                          onClick={openMetaMaskMobileBrowser}
                          className="mt-3 w-full rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-100 transition hover:bg-blue-500/20"
                        >
                          {walletEnvironment.actionLabel}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleProviderWalletVerification()}
                      disabled={isProviderWalletVerifying || !walletEnvironment.hasProvider}
                      className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-950/40 transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {isProviderWalletVerifying
                        ? 'Verifying Wallet...'
                        : !walletEnvironment.hasProvider
                          ? 'Wallet Browser Required'
                          : 'Verify Wallet & Open Tools'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApprovedProviderSignIn} className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Provider email
                      </span>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(event) => setEmailInput(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                        required
                        placeholder="you@example.com"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Password
                      </span>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(event) => setPasswordInput(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                        required
                        placeholder="********"
                      />
                    </label>
                    {ACCOUNT_RECOVERY_UI_ENABLED && (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordResetRequestOpen((open) => !open);
                            setPasswordResetEmailInput(emailInput);
                            setPasswordResetNotice('');
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-blue-200"
                        >
                          Forgot Provider Password?
                        </button>
                        {isPasswordResetRequestOpen && (
                          <div className="space-y-3">
                            <input
                              type="email"
                              value={passwordResetEmailInput}
                              onChange={(event) => setPasswordResetEmailInput(event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white outline-none transition focus:ring-2 focus:ring-blue-500/40"
                              required
                              placeholder="provider@example.com"
                            />
                            <button
                              type="button"
                              onClick={() => handlePasswordResetRequest()}
                              disabled={isPasswordResetPending}
                              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {isPasswordResetPending ? 'Starting...' : 'Start Recovery'}
                            </button>
                            {passwordResetNotice && (
                              <p className="text-[10px] leading-5 text-blue-100/80">{passwordResetNotice}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-950/40 transition hover:bg-blue-500"
                    >
                      Continue To Wallet Verification
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      case AppView.PROVIDER_APPLY:
        return (
          <ProviderApplicationPage
            onBack={() => setCurrentView(AppView.PROVIDER_ACCESS)}
            onSubmit={handleProviderApplicationSubmit}
            onViewStatus={() => setCurrentView(AppView.PROVIDER_APPLICATION_STATUS)}
          />
        );
      case AppView.PROVIDER_APPLICANT_SIGN_IN:
        return (
          <ProviderApplicantSignInPage
            onBack={() => setCurrentView(AppView.PROVIDER_ACCESS)}
            onSignIn={handleProviderApplicantSignIn}
            onPasswordReset={requestPasswordResetForEmail}
            onSignedIn={() => setCurrentView(AppView.PROVIDER_APPLICATION_STATUS, {}, { replace: true })}
          />
        );
      case AppView.PROVIDER_APPLICATION_STATUS:
        return (
          <ProviderApplicationStatusPage
            onBack={() => setCurrentView(AppView.PROVIDER_ACCESS)}
            onSignOut={handleSignOut}
          />
        );
      case AppView.CONSCIOUS_CAREERS:
      case AppView.ENTREPRENEURSHIP_SUPPORT:
        return (
          <EntrepreneurshipSupportPage
            user={user}
            onBack={() => setCurrentView(user ? AppView.DASHBOARD : AppView.ENTRY)}
            onMembershipAccess={() => setCurrentView(AppView.MEMBERSHIP_ACCESS)}
            onGrantApplication={() => setCurrentView(AppView.GRANT_APPLICATION)}
            onReturnToPortal={() => setCurrentView(user ? AppView.DASHBOARD : AppView.ENTRY)}
          />
        );
      case AppView.GRANT_APPLICATION:
        return (
          <GrantApplicationPage
            user={user}
            onBack={() => setCurrentView(AppView.ENTREPRENEURSHIP_SUPPORT)}
            onSubmit={handleGrantApplicationSubmit}
          />
        );
      case AppView.DASHBOARD:
        return (
          <Dashboard
            user={user}
            onEnroll={enrollCourse}
            onManageReputation={() => setCurrentView(AppView.MY_CONSCIOUS_IDENTITY)}
            insightRef={insightRef}
          />
        );
      case AppView.CONSCIOUS_SOCIAL_LEARNING:
        return (
          <SocialLearningHub
            user={user}
            deepLinkNodeId={routeParams.node}
            onSignInPrompt={() => {
              resetSignInChallengeInputs();
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.COMMUNITY:
        return (
          <CommunityMembers
            user={user}
            onSignInPrompt={() => {
              resetSignInChallengeInputs();
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.CONSCIOUS_MEETINGS:
      case AppView.CONSCIOUS_MEETINGS_UPCOMING:
        return (
          <ConsciousMeetingsUpcomingPage
            user={user}
            onOpenMeeting={(id) => setCurrentView(AppView.MEETING_DETAIL, { id })}
            onOpenPortal={() => setCurrentView(AppView.CONSCIOUS_MEETINGS_PORTAL)}
          />
        );
      case AppView.PROVIDER_CRM:
        return canOpenProviderCrm(user) ? (
          <ProviderCrmShell
            user={user}
            onOpenAdminConsole={() => setCurrentView(AppView.ADMIN_DASHBOARD)}
            onOpenAdministrativeAccess={() => setCurrentView(AppView.ADMINISTRATIVE_ACCESS)}
            onOpenProviderAccess={() => setCurrentView(AppView.PROVIDER_ACCESS)}
          />
        ) : (
          renderProviderCrmAccessGate()
        );
      case AppView.CONSCIOUS_MEETINGS_PORTAL:
        return (
          <React.Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">Loading meeting portal...</div>}>
            <LazyConsciousMeetingPortalPage
              user={user}
              onOpenUpcoming={() => setCurrentView(AppView.CONSCIOUS_MEETINGS_UPCOMING)}
            />
          </React.Suspense>
        );
      case AppView.MEETING_DETAIL:
        return (
          <React.Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">Loading meeting room...</div>}>
            <LazyConsciousMeetingRoomPage
              sessionId={routeParams.id}
              user={user}
              onBack={() => setCurrentView(AppView.CONSCIOUS_MEETINGS_UPCOMING)}
              onSignIn={() => {
                resetSignInChallengeInputs();
                setSigninModalOpen(true);
              }}
            />
          </React.Suspense>
        );
      case AppView.MY_CONSCIOUS_IDENTITY: 
        return (
          <ConsciousIdentity 
            user={user} 
            enrolledCourses={enrolledCourses}
            onComplete={handleIdentityComplete}
            onSignOut={handleSignOut}
            onGoBack={() => setCurrentView(AppView.DASHBOARD)}
            onSignInPrompt={() => {
              resetSignInChallengeInputs();
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.MY_COURSES: 
        return (
          <MyCourses
            enrolledCourses={enrolledCourses}
            onNavigateToUniversity={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)}
            onUpdateProgress={updateCourseProgress}
          />
        );
      case AppView.PROVIDERS:
        return (
          <ProvidersMarket
            onOpenProvider={(id) => setCurrentView(AppView.PROVIDER_DETAIL, { id })}
            onBackToList={() => setCurrentView(AppView.PROVIDERS)}
            onApplyAsProvider={() => setCurrentView(AppView.PROVIDER_APPLY)}
            onSignInRequired={() => {
              resetSignInChallengeInputs();
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.PROVIDER_DETAIL:
        return (
          <ProvidersMarket
            providerId={routeParams.id}
            onOpenProvider={(id) => setCurrentView(AppView.PROVIDER_DETAIL, { id })}
            onBackToList={() => setCurrentView(AppView.PROVIDERS)}
            onApplyAsProvider={() => setCurrentView(AppView.PROVIDER_APPLY)}
            onSignInRequired={() => {
              resetSignInChallengeInputs();
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.MEMBERSHIP:
        return (
          <MembershipPage
            user={user}
            selectedTier={selectedTier}
            isCheckoutPending={isMembershipCheckoutPending}
            notice={membershipNotice}
            onSelectTier={handleMembershipTierSelect}
            onSignIn={openMemberLogin}
          />
        );
      case AppView.NOTIFICATIONS:
        return <NotificationsCenter onBack={() => setCurrentView(AppView.DASHBOARD)} />;
      case AppView.ADMIN_DASHBOARD:
        return hasAdminRole(user) ? (
          <AdminDashboard />
        ) : (
          <NotFoundPage
            path={activePath}
            onGoHome={() => setCurrentView(AppView.ENTRY)}
            onGoDashboard={() => setCurrentView(AppView.DASHBOARD)}
          />
        );
      case AppView.ADMIN_PROVIDER_APPLICANTS:
        return hasAdminRole(user) ? (
          <AdminProviderApplicantsPage />
        ) : (
          <NotFoundPage
            path={activePath}
            onGoHome={() => setCurrentView(AppView.ENTRY)}
            onGoDashboard={() => setCurrentView(AppView.DASHBOARD)}
          />
        );
      case AppView.KNOWLEDGE_PATHWAYS:
        return (
          <KnowledgePathways
            onGoBack={() => setCurrentView(AppView.MY_COURSES)}
            onEnroll={enrollCourse}
            onOpenCourse={(id) => setCurrentView(AppView.COURSE_DETAIL, { id })}
            onBackToCatalog={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)}
          />
        );
      case AppView.COURSE_DETAIL:
        return (
          <KnowledgePathways
            courseId={routeParams.id}
            onGoBack={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)}
            onEnroll={enrollCourse}
            onOpenCourse={(id) => setCurrentView(AppView.COURSE_DETAIL, { id })}
            onBackToCatalog={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)}
          />
        );
      case AppView.PRIVACY_POLICY:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">Privacy Policy</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(privacyPolicy)}</pre>
            </div>
          </div>
        );
      case AppView.TERMS_OF_SERVICE:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">Terms of Service</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(termsOfService)}</pre>
            </div>
          </div>
        );
      case AppView.AI_TRANSPARENCY_POLICY:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">AI Transparency Policy</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(aiTransparencyPolicy)}</pre>
            </div>
          </div>
        );
      case AppView.BLOCKCHAIN_DATA_POLICY:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">Blockchain Data Policy</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(blockchainDataPolicy)}</pre>
            </div>
          </div>
        );
      case AppView.VENDOR_API_GOVERNANCE_POLICY:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">Vendor API Governance Policy</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(vendorApiGovernancePolicy)}</pre>
            </div>
          </div>
        );
      case AppView.NIST_MAPPING_SUMMARY:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-4 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white mb-6">NIST Mapping Summary</h1>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">{cleanPolicyContent(nistMappingSummary)}</pre>
            </div>
          </div>
        );
      case AppView.AI_SAFETY_GOVERNANCE:
        return (
          <div className="p-8 max-w-5xl mx-auto space-y-6">
            <button onClick={() => setCurrentView(AppView.DASHBOARD)} className="mb-2 text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Hub
            </button>
            <h1 className="text-3xl font-black text-white">AI Safety & Governance</h1>
            <p className="text-slate-300">We align Conscious Network agents with NIST AI RMF, EU AI Act, and GDPR. Security shifts from the perimeter to the agent’s actions, identity, and data integrity.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-lg font-black text-white">1) Identity & Access</h3>
                <ul className="text-slate-300 text-sm space-y-2">
                  <li>Unique traceable identities (e.g., workload IDs) per agent.</li>
                  <li>Least agency: minimal tools/data per task.</li>
                  <li>Zero Trust: re-auth every tool call/data request.</li>
                </ul>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-lg font-black text-white">2) Operational Guardrails</h3>
                <ul className="text-slate-300 text-sm space-y-2">
                  <li>Prompt shields & I/O filters for injections and data leakage.</li>
                  <li>Sandboxed tools + circuit breakers on policy deviation.</li>
                  <li>Human-in-the-loop for high-stakes actions.</li>
                </ul>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-lg font-black text-white">3) Data Integrity & Privacy</h3>
                <ul className="text-slate-300 text-sm space-y-2">
                  <li>Memory sanitization and periodic resets to remove poisoning.</li>
                  <li>Data lineage/provenance tracking across pipelines.</li>
                  <li>PETs (masking, differential privacy) before model access.</li>
                </ul>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-lg font-black text-white">4) Governance & Monitoring</h3>
                <ul className="text-slate-300 text-sm space-y-2">
                  <li>Immutable audit logs of inputs/outputs/decisions.</li>
                  <li>Real-time behavioral monitoring for anomalies.</li>
                  <li>Continuous adversarial testing/red teaming.</li>
                </ul>
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-blue-500/20">
              <h3 className="text-lg font-black text-white mb-3">Regulatory Mapping</h3>
              <div className="text-slate-300 text-sm space-y-2">
                <p><strong>NIST AI RMF:</strong> Govern, Map, Measure, Manage risks across the lifecycle.</p>
                <p><strong>EU AI Act:</strong> Transparency, human oversight, adversarial testing, incident reporting for high-risk systems.</p>
                <p><strong>GDPR:</strong> Data minimization, right to explanation, data subject rights protection.</p>
              </div>
            </div>
          </div>
        );
      case AppView.NOT_FOUND:
        return (
          <NotFoundPage
            path={activePath}
            onGoHome={() => setCurrentView(AppView.ENTRY)}
            onGoDashboard={() => setCurrentView(AppView.DASHBOARD)}
          />
        );
      default: 
        return (
          <Dashboard
            user={user}
            onManageReputation={() => setCurrentView(AppView.MY_CONSCIOUS_IDENTITY)}
          />
        );
    }
  };

  const isProviderPublicExperience = isProviderPublicView(currentView);
  const isAdministrativePublicExperience = isAdministrativePublicView(currentView);
  const isCareersPublicExperience = !user && isCareersPublicView(currentView);
  const shouldLoadImmersiveScene =
    currentView === AppView.CONSCIOUS_MEETINGS_PORTAL || currentView === AppView.MEETING_DETAIL;
  const navAvatarMedia = user ? getProfileAvatarMedia(user) : null;
  const navAvatarUrl = !navAvatarFailed ? navAvatarMedia?.url || '' : '';
  const navAvatarIsVideo = navAvatarMedia ? isVideoMediaAsset(navAvatarMedia) : false;

  return (
    <div className="app-scroll-root min-h-screen bg-[#05070a] text-slate-200 selection:bg-blue-500/30 flex relative">
      {currentView !== AppView.ENTRY && (
        <div className="fixed inset-0 z-0 overflow-hidden bg-[#05070a]" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(37,99,235,0.18),_transparent_32%),radial-gradient(circle_at_82%_68%,_rgba(20,184,166,0.13),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.86),_rgba(2,6,23,1))]" />
          <div className="absolute inset-0 animated-gradient opacity-10" />
        </div>
      )}
      {shouldLoadImmersiveScene && (
        <React.Suspense fallback={null}>
          <LazyThreeScene />
        </React.Suspense>
      )}

      {currentView === AppView.ENTRY && (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/home-video-fallback.svg"
            className="fixed inset-0 w-full h-full object-cover z-0"
          >
            <source src="/video/home-bg.mp4" type="video/mp4" />
          </video>
          <div className="fixed inset-0 bg-black/55 z-[1]"></div>
        </>
      )}

      <div className="relative z-10 w-full min-h-screen flex flex-col overflow-x-hidden">
        <MusicBox />
        
        {hasApiKey === false && (
          <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center overflow-y-auto custom-scrollbar bg-black/90 backdrop-blur-3xl p-4 sm:p-6">
            <div className="glass-panel max-w-md w-full p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] text-center border-blue-500/20 shadow-2xl my-4 sm:my-8">
              <Key className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Advanced Intelligence Access</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Advanced intelligence and image synthesis require an authorized access key before they can be used.
                <br /><br />
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View access requirements</a>
              </p>
              <button 
                onClick={handleOpenSelectKey}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl"
              >
                Select Access Key
              </button>
            </div>
          </div>
        )}

        {currentView === AppView.ENTRY && (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 pb-28 sm:pb-8 text-center animate-in fade-in zoom-in duration-1000 overflow-y-auto custom-scrollbar">
            <div className="portal-entry-card w-full max-w-[calc(100vw-2rem)] sm:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl space-y-6 sm:space-y-8 md:space-y-10 overflow-hidden backdrop-blur-[4px] p-6 sm:p-8 md:p-12 lg:p-14 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] lg:rounded-[4rem] border border-white/5 bg-white/[0.01] shadow-[0_0_100px_rgba(0,0,0,0.6)]">
              <div className="flex justify-center">
                <div className="p-4 sm:p-6 bg-blue-600/10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-blue-500/20 backdrop-blur-3xl shadow-[0_0_30px_rgba(37,99,235,0.2)] animate-pulse">
                  <img src={cnhLogo} alt="Conscious Network Hub Logo" className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" />
                </div>
              </div>
              
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <h1 className="portal-entry-title break-normal text-[clamp(2rem,5vw,4.25rem)] font-black leading-[0.92] tracking-tight text-white drop-shadow-2xl [overflow-wrap:normal] [word-break:normal]">
                  CONSCIOUS <br /> 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-teal-400 uppercase tracking-tighter drop-shadow-sm">
                    Network Hub
                  </span>
                </h1>
                <p className="portal-entry-copy break-words text-base xs:text-lg sm:text-xl md:text-2xl text-blue-100/70 max-w-3xl mx-auto leading-relaxed font-light drop-shadow-md px-2 sm:px-0">
                  Ethical infrastructure for a new era of human development, where spiritual, mental and educational growth are powered by data sovereignty.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 sm:gap-5 sm:pt-4 2xl:grid-cols-4 max-w-6xl 2xl:max-w-7xl mx-auto">
                <button
                  onClick={handleEnterHub}
                  className="portal-entry-primary group relative flex min-h-[8.75rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-blue-500/20 bg-white/[0.03] p-5 text-left shadow-[0_0_30px_rgba(37,99,235,0.12)] transition-all hover:-translate-y-1 hover:border-blue-400/40 hover:bg-blue-500/10 active:scale-[0.98] sm:min-h-[9.5rem] sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="whitespace-normal break-normal text-[clamp(0.875rem,1.1vw,1rem)] font-black uppercase leading-snug tracking-[0.12em] text-white [overflow-wrap:normal] [word-break:normal] sm:tracking-[0.14em] xl:tracking-[0.16em]">
                        Conscious Network Hub
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-blue-100/65">
                        Enter the live community platform
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-blue-300 flex-shrink-0 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleEnterProviderAccess}
                  className="group relative flex min-h-[8.75rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-5 text-left shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-emerald-500/10 active:scale-[0.98] sm:min-h-[9.5rem] sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-100/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="whitespace-normal break-normal text-[clamp(0.875rem,1.1vw,1rem)] font-black uppercase leading-snug tracking-[0.12em] text-white [overflow-wrap:normal] [word-break:normal] sm:tracking-[0.14em] xl:tracking-[0.16em]">
                        Provider Access
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-blue-100/65">
                        Sign in or apply to join as a service provider
                      </p>
                    </div>
                    <Building2 className="w-5 h-5 text-emerald-200 flex-shrink-0 group-hover:text-white transition-colors" />
                  </div>
                  <span className="mt-4 inline-flex w-fit whitespace-nowrap rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-emerald-100/70">
                    Provider Access
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleEnterConsciousCareers}
                  className="group relative flex min-h-[8.75rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-blue-500/20 bg-white/[0.03] p-5 text-left shadow-[0_0_30px_rgba(37,99,235,0.12)] transition-all hover:-translate-y-1 hover:border-teal-300/40 hover:bg-blue-500/10 active:scale-[0.98] sm:min-h-[9.5rem] sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="whitespace-normal break-normal text-[clamp(0.875rem,1.1vw,1rem)] font-black uppercase leading-snug tracking-[0.12em] text-white [overflow-wrap:normal] [word-break:normal] sm:tracking-[0.14em] xl:tracking-[0.16em]">
                        Conscious Careers
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-blue-100/65">
                        Grant applications & entrepreneurship support
                      </p>
                    </div>
                    <img
                      src={careersLogo}
                      alt="Conscious Careers logo"
                      className="h-11 w-11 flex-shrink-0 rounded-xl bg-white/95 object-contain p-1 shadow-lg shadow-blue-950/20 transition-transform group-hover:scale-105"
                    />
                  </div>
                  <span className="mt-4 inline-flex w-fit whitespace-nowrap rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-blue-100/70">
                    Conscious Careers
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleEnterAdministrativeAccess}
                  className="group relative flex min-h-[8.75rem] w-full flex-col justify-between overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-500/[0.04] p-5 text-left shadow-[0_0_30px_rgba(245,158,11,0.12)] transition-all hover:-translate-y-1 hover:border-amber-200/40 hover:bg-amber-500/10 active:scale-[0.98] sm:min-h-[9.5rem] sm:p-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-100/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="whitespace-normal break-normal text-[clamp(0.875rem,1.1vw,1rem)] font-black uppercase leading-snug tracking-[0.12em] text-white [overflow-wrap:normal] [word-break:normal] sm:tracking-[0.14em] xl:tracking-[0.16em]">
                        Administrative Access
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-blue-100/65">
                        Founder and administrator operations
                      </p>
                    </div>
                    <LockKeyhole className="w-5 h-5 text-amber-200 flex-shrink-0 group-hover:text-white transition-colors" />
                  </div>
                  <span className="mt-4 inline-flex w-fit whitespace-nowrap rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-amber-100/70">
                    Admin Access
                  </span>
                </button>
              </div>

              <div className="flex justify-center pt-1 sm:pt-2">
                <button 
                  onClick={() => window.open('https://calendly.com/randycofield/buildingconnections', '_blank', 'noopener,noreferrer')}
                  className="group relative px-5 sm:px-6 py-3 bg-white/[0.04] hover:bg-blue-600/20 text-blue-100 rounded-lg font-black text-xs sm:text-sm transition-all shadow-[0_0_30px_rgba(37,99,235,0.12)] hover:-translate-y-1 active:scale-95 flex items-center gap-2 border border-blue-500/20"
                >
                  Schedule a Briefing <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              
              <div className="pt-6 sm:pt-8 md:pt-10 lg:pt-12 flex flex-col xs:flex-row flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-16 opacity-30">
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  <span className="text-[9px] uppercase tracking-[0.6em] font-black">Encrypted</span>
                  <div className="h-0.5 w-12 sm:w-14 md:w-16 bg-blue-500/50" />
                </div>
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  <span className="text-[9px] uppercase tracking-[0.6em] font-black">Decentralized</span>
                  <div className="h-0.5 w-12 sm:w-14 md:w-16 bg-teal-500/50" />
                </div>
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  <span className="text-[9px] uppercase tracking-[0.6em] font-black">Sovereign</span>
                  <div className="h-0.5 w-12 sm:w-14 md:w-16 bg-indigo-500/50" />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === AppView.MEMBERSHIP_ACCESS && isMembershipAuthGuardChecking && (
          <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-8">
            <div className="glass-panel w-full max-w-xl rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-6 text-center shadow-2xl sm:p-8">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                Checking membership access...
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                We are refreshing your session against the membership record before showing tier selection.
              </p>
            </div>
          </div>
        )}

        {currentView === AppView.MEMBERSHIP_ACCESS && !isMembershipAuthGuardChecking && (
          <div className="min-h-[100dvh] animate-in fade-in duration-700 relative z-10 p-4 pt-20 sm:p-6 sm:pt-24 md:p-8 lg:p-10 xl:p-14">
            <svg
              className={`pointer-events-none absolute inset-0 z-0 hidden h-full w-full transition-opacity duration-500 lg:block ${
                hoveredMembershipPath ? 'opacity-100' : 'opacity-70'
              }`}
              viewBox="0 0 1200 760"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <filter id="membershipPathGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <marker id="membershipArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M2 2 L10 6 L2 10 Z" fill="#bfdbfe" />
                </marker>
              </defs>

              <path
                d="M600 40 C600 110 600 165 600 225"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="2"
                strokeDasharray="10 18"
                markerEnd="url(#membershipArrow)"
                filter="url(#membershipPathGlow)"
              >
                <animate attributeName="stroke-dashoffset" from="70" to="0" dur="3s" repeatCount="indefinite" />
              </path>
              {[
                'M600 225 C430 290 300 380 215 565',
                'M600 225 C600 330 600 430 600 565',
                'M600 225 C770 290 900 380 985 565',
              ].map((path) => (
                <path
                  key={path}
                  d={path}
                  fill="none"
                  stroke="#5eead4"
                  strokeWidth="2"
                  strokeDasharray="8 20"
                  filter="url(#membershipPathGlow)"
                >
                  <animate attributeName="stroke-dashoffset" from="90" to="0" dur="5s" repeatCount="indefinite" />
                </path>
              ))}
              <g className={hoveredMembershipPath === MEMBERSHIP_RETURN_PATH_ID ? 'opacity-100' : 'opacity-40'}>
                <path
                  d="M1060 70 C920 92 800 132 700 184 C650 210 625 225 600 247"
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth="3"
                  strokeDasharray="4 14"
                  filter="url(#membershipPathGlow)"
                >
                  <animate attributeName="stroke-dashoffset" from="80" to="0" dur="4s" repeatCount="indefinite" />
                </path>
              </g>
              <circle r="6" fill="#dbeafe" filter="url(#membershipPathGlow)">
                <animateMotion dur="3s" repeatCount="indefinite" path="M600 40 C600 110 600 165 600 225" />
              </circle>
              <circle r="4" fill="#99f6e4" filter="url(#membershipPathGlow)">
                <animateMotion dur="5s" begin="0.6s" repeatCount="indefinite" path="M600 225 C430 290 300 380 215 565" />
              </circle>
              <circle r="4" fill="#bfdbfe" filter="url(#membershipPathGlow)">
                <animateMotion dur="5s" begin="1s" repeatCount="indefinite" path="M600 225 C600 330 600 430 600 565" />
              </circle>
              <circle r="4" fill="#c7d2fe" filter="url(#membershipPathGlow)">
                <animateMotion dur="5s" begin="1.4s" repeatCount="indefinite" path="M600 225 C770 290 900 380 985 565" />
              </circle>
            </svg>

            <button
              type="button"
              onClick={openMemberLogin}
              onMouseEnter={() => setHoveredMembershipPath(MEMBERSHIP_RETURN_PATH_ID)}
              onMouseLeave={() => setHoveredMembershipPath(null)}
              onFocus={() => setHoveredMembershipPath(MEMBERSHIP_RETURN_PATH_ID)}
              onBlur={() => setHoveredMembershipPath(null)}
              className={`fixed right-4 top-4 z-30 rounded-2xl border border-cyan-200/30 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl transition-all hover:bg-cyan-500/20 sm:right-8 sm:top-8 sm:px-5 ${
                hoveredMembershipPath === MEMBERSHIP_RETURN_PATH_ID
                  ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
                  : ''
              }`}
            >
              Member Login
            </button>

            <div className="relative z-10 mx-auto max-w-7xl space-y-8 pb-6 sm:space-y-10 sm:pb-10 md:space-y-12">
              <button onClick={handleGoHome} className="flex items-center gap-2 sm:gap-3 text-slate-500 hover:text-white transition-colors group">
                <Home className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="font-bold uppercase tracking-[0.4em] text-[9px] sm:text-[10px]">Portal Entry</span>
              </button>

              <div className="lg:hidden sticky top-16 z-20 mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl backdrop-blur-xl sm:top-20">
                <div className="relative space-y-3 pl-6">
                  <div className="absolute bottom-2 left-1.5 top-2 w-px bg-white/10" />
                  <div
                    className="absolute left-1.5 top-2 w-px bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)] transition-all duration-500"
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(0, (membershipMobileStep / (MEMBERSHIP_MOBILE_STEPS.length - 1)) * 100)
                      )}%`,
                    }}
                  />
                  {MEMBERSHIP_MOBILE_STEPS.map((step, index) => {
                    const isActive = index <= membershipMobileStep;
                    return (
                      <div key={step} className="relative flex items-center gap-3">
                        <span
                          className={`absolute -left-[1.4rem] h-3 w-3 rounded-full border transition-all ${
                            isActive
                              ? 'border-cyan-200 bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)]'
                              : 'border-white/20 bg-slate-900'
                          }`}
                        />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center space-y-3 sm:space-y-4">
                <p className="hidden text-[9px] font-black uppercase tracking-[0.6em] text-blue-300/70 lg:block">
                  Start Here
                </p>
                <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl font-black text-white tracking-tighter leading-tight">Membership Access</h2>
                <p className="text-slate-400 text-sm sm:text-base md:text-lg font-light px-2 sm:px-0">Sign in or choose a membership tier to enter Conscious Network Hub.</p>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-3">
                  <div
                    className="relative inline-flex"
                    onMouseEnter={() => setHoveredMembershipPath(MEMBERSHIP_RETURN_PATH_ID)}
                    onMouseLeave={() => setHoveredMembershipPath(null)}
                    onFocus={() => setHoveredMembershipPath(MEMBERSHIP_RETURN_PATH_ID)}
                    onBlur={() => setHoveredMembershipPath(null)}
                  >
                    <button
                      onClick={openMemberLogin}
                      className={`px-6 sm:px-8 py-3 bg-slate-950/80 hover:bg-cyan-500/20 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl border border-cyan-200/30 ${
                        hoveredMembershipPath === MEMBERSHIP_RETURN_PATH_ID
                          ? 'animate-pulse ring-2 ring-cyan-200/40 shadow-cyan-400/30'
                          : ''
                      }`}
                    >
                      Existing Member Sign In
                    </button>
                    <div
                      className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 origin-top rounded-2xl border border-cyan-200/20 bg-slate-950/55 p-4 text-left text-cyan-50 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition-all duration-300 lg:block ${
                        hoveredMembershipPath === MEMBERSHIP_RETURN_PATH_ID
                          ? 'scale-100 opacity-100'
                          : 'scale-95 opacity-0'
                      }`}
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200/80">Insight</p>
                      <p className="mt-2 text-xs leading-5 text-cyan-50">{MEMBERSHIP_RETURN_INSIGHT}</p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider">
                  New users create accounts by selecting a tier below.
                </p>
                {membershipNotice && (
                  <p className="text-blue-300 text-[10px] sm:text-xs uppercase tracking-widest">
                    {membershipNotice}
                  </p>
                )}
              </div>

              {isMembershipHelpVisible && (
                <div className="glass-panel relative rounded-[1.5rem] border border-blue-500/20 bg-blue-500/5 p-5 sm:p-6 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => setMembershipHelpVisible(false)}
                    className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Dismiss membership guidance"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="max-w-3xl pr-10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">
                      Quick Start
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Existing members can sign in to continue. New users should choose a tier below to create an account and activate membership access.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-7 md:gap-8">
                {TIERS.map((tier, tierIndex) => {
                  const tierClasses =
                    MEMBERSHIP_TIER_COLOR_CLASSES[tier.color as keyof typeof MEMBERSHIP_TIER_COLOR_CLASSES] ||
                    MEMBERSHIP_TIER_COLOR_CLASSES.blue;
                  const isFocused = hoveredMembershipPath === tier.name;
                  const shouldDim = Boolean(hoveredMembershipPath && hoveredMembershipPath !== tier.name);
                  const tierInsight = MEMBERSHIP_INSIGHTS[tier.name] || MEMBERSHIP_INSIGHTS[FREE_TIER_NAME];

                  return (
                    <div
                      key={tier.name}
                      ref={(element) => {
                        membershipTierRefs.current[tierIndex] = element;
                      }}
                      onMouseEnter={() => setHoveredMembershipPath(tier.name)}
                      onMouseLeave={() => setHoveredMembershipPath(null)}
                      onFocus={() => setHoveredMembershipPath(tier.name)}
                      onBlur={() => setHoveredMembershipPath(null)}
                      className={`glass-panel group relative flex min-h-[22rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border-white/5 border-t-4 p-5 shadow-2xl transition-all duration-300 sm:min-h-[24rem] sm:rounded-[2.5rem] sm:p-8 lg:min-h-[25rem] lg:p-7 xl:p-10 ${
                        tierClasses.cardBorder
                      } ${
                        isFocused ? `scale-[1.02] ring-2 ${tierClasses.glow}` : ''
                      } ${
                        shouldDim ? 'scale-[0.98] opacity-45 blur-[1px]' : 'opacity-100'
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute left-4 right-4 top-4 z-20 hidden origin-top rounded-2xl border p-4 text-left shadow-2xl backdrop-blur-xl transition-all duration-300 lg:block ${
                          tierClasses.insight
                        } ${isFocused ? 'scale-100 opacity-100' : 'scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100'}`}
                      >
                        <p className="text-[9px] font-black uppercase tracking-[0.35em] opacity-80">Insight</p>
                        <p className="mt-2 text-xs leading-5">{tierInsight}</p>
                      </div>
                      <div className={`absolute top-0 right-0 p-4 sm:p-8 opacity-5 group-hover:opacity-10 transition-opacity ${tierClasses.icon}`}>
                        <Shield className="w-16 h-16 sm:w-24 sm:h-24" />
                      </div>
                      <div>
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h3 className="min-w-0 text-xl xl:text-2xl font-black text-white leading-tight uppercase tracking-tighter">{tier.name}</h3>
                          <span className={`cnh-status-badge shrink-0 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-widest ${tierClasses.price}`}>{tier.price}</span>
                        </div>
                        <p className="text-blue-400/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] mb-6 sm:mb-8">Membership Option</p>
                        
                        <div className="space-y-4 sm:space-y-6">
                          <div>
                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-light">{tier.description}</p>
                          </div>
                          <div>
                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Level</h4>
                            <div className="flex items-center gap-2 sm:gap-3 text-white text-[11px] sm:text-xs font-medium">
                              <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${tierClasses.check}`} />
                              {tier.access}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Ideal For</h4>
                            <p className="text-slate-400 text-[10px] sm:text-[11px] italic font-light">{tier.ideal}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (user) {
                            handleMembershipTierSelect(tier.name);
                          } else {
                            setSelectedTier(tier.name);
                            resetSignInChallengeInputs();
                            setSignupModalOpen(true);
                          }
                        }}
                        className={`mt-7 sm:mt-10 w-full py-4 sm:py-5 bg-white/5 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] leading-tight transition-all shadow-xl border border-white/5 ${tierClasses.button} ${
                          isFocused ? `animate-pulse bg-white/10 ring-2 ${tierClasses.glow}` : ''
                        }`}
                        disabled={isMembershipCheckoutPending || Boolean(pendingCheckoutSessionId)}
                      >
                        {isMembershipCheckoutPending
                          ? 'Redirecting to Checkout...'
                          : pendingCheckoutSessionId
                          ? 'Verifying Checkout...'
                          : 'Continue to Checkout'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currentView === AppView.VERIFY_SESSION && renderActiveView()}

        {isProviderPublicExperience && renderActiveView()}

        {isAdministrativePublicExperience && renderActiveView()}

        {isCareersPublicExperience && renderActiveView()}

        {(currentView !== AppView.ENTRY &&
          currentView !== AppView.MEMBERSHIP_ACCESS &&
          currentView !== AppView.VERIFY_SESSION &&
          !isProviderPublicExperience &&
          !isAdministrativePublicExperience &&
          !isCareersPublicExperience) && (
          <div className="flex min-h-[100dvh] w-full min-w-0 flex-1 overflow-hidden animate-in fade-in duration-500 relative z-10">
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[105] lg:hidden transition-opacity"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <aside
              aria-hidden={!isSidebarOpen}
              inert={!isSidebarOpen ? true : undefined}
              className={`fixed inset-y-0 left-0 z-[110] w-80 max-w-[calc(100vw-1rem)] transition-all duration-500 ease-in-out overflow-hidden lg:static lg:max-w-none lg:shrink-0 ${
                isSidebarOpen
                  ? 'translate-x-0 pointer-events-auto glass-panel border-r border-white/5'
                  : '-translate-x-full pointer-events-none border-0 bg-transparent shadow-none'
              } ${
                isSidebarOpen
                  ? 'lg:static lg:translate-x-0 lg:w-64 lg:opacity-100 xl:w-72 2xl:w-80'
                  : 'lg:static lg:translate-x-0 lg:w-0 xl:w-0 2xl:w-0 lg:opacity-0'
              }`}
            >
              <div className="h-full flex flex-col p-4 sm:p-5 xl:p-6 2xl:p-7 overflow-y-auto custom-scrollbar scrollable">
                <div className="mb-10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentView(AppView.DASHBOARD)}
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-1.5 shadow-xl shadow-blue-950/20 transition-all hover:scale-[1.03]"
                    aria-label="Open Conscious Network Hub home"
                    title="Conscious Network Hub"
                  >
                    <img src={cnhLogo} alt="" className="h-full w-full object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                    aria-label="Close platform menu"
                    title="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <nav className="flex-1 space-y-3 pr-1">
                  {filteredNavigationItems.map((item) => {
                    const view = navViewMap[item.id];
                    const parentView =
                      currentView === AppView.PROVIDER_DETAIL
                        ? AppView.PROVIDERS
                        : currentView === AppView.COURSE_DETAIL
                          ? AppView.KNOWLEDGE_PATHWAYS
                          : [
                              AppView.CONSCIOUS_MEETINGS_UPCOMING,
                              AppView.CONSCIOUS_MEETINGS_PORTAL,
                              AppView.MEETING_DETAIL,
                            ].includes(currentView)
                            ? AppView.CONSCIOUS_MEETINGS
                            : [
                                AppView.GRANT_APPLICATION,
                                AppView.ENTREPRENEURSHIP_SUPPORT,
                              ].includes(currentView)
                              ? AppView.CONSCIOUS_CAREERS
                            : currentView;
                    const isActive = parentView === view;
                    if (item.id === 'meetings') {
                      const meetingsSubItems = [
                        {
                          id: 'upcoming-sessions',
                          label: 'Upcoming Sessions',
                          view: AppView.CONSCIOUS_MEETINGS_UPCOMING,
                          badge: 'Live',
                        },
                        {
                          id: 'meeting-portal',
                          label: 'Meeting Portal',
                          view: AppView.CONSCIOUS_MEETINGS_PORTAL,
                          badge: 'Portal',
                        },
                      ];

                      return (
                        <div key={item.id} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMeetingsMenuOpen((open) => !open);
                              setCurrentView(AppView.CONSCIOUS_MEETINGS_UPCOMING);
                            }}
                            aria-expanded={isMeetingsMenuOpen}
                            className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl transition-all group ${isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                          >
                            <span className={`${isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'} transition-colors`}>{item.icon}</span>
                            <span className="min-w-0 flex-1 text-left text-[10px] font-black tracking-[0.3em] uppercase">{item.label}</span>
                            <ChevronRight className={`h-4 w-4 transition-transform ${isMeetingsMenuOpen ? 'rotate-90 text-blue-300' : 'text-slate-600'}`} />
                          </button>

                          {isMeetingsMenuOpen && (
                            <div className="ml-8 space-y-2 border-l border-white/10 pl-4">
                              {meetingsSubItems.map((subItem) => {
                                const isSubActive = currentView === subItem.view;
                                return (
                                  <button
                                    key={subItem.id}
                                    type="button"
                                    onClick={() => {
                                      setCurrentView(subItem.view);
                                      setMeetingsMenuOpen(true);
                                      closeSidebarOnMobile();
                                    }}
                                    className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                                      isSubActive
                                        ? 'border-cyan-300/30 bg-cyan-400/10 text-white'
                                        : 'border-white/5 bg-white/[0.03] text-slate-500 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    <span className="flex items-center justify-between gap-3">
                                      <span className="text-[9px] font-black uppercase tracking-[0.22em]">{subItem.label}</span>
                                      <span className={`rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-widest ${
                                        subItem.badge === 'Live'
                                          ? 'bg-emerald-400/10 text-emerald-200'
                                          : 'bg-blue-400/10 text-blue-200'
                                      }`}>
                                        {subItem.badge}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (item.id === 'careers') {
                      const isCareersActive = [
                        AppView.CONSCIOUS_CAREERS,
                        AppView.GRANT_APPLICATION,
                        AppView.ENTREPRENEURSHIP_SUPPORT,
                      ].includes(currentView);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setCurrentView(AppView.ENTREPRENEURSHIP_SUPPORT);
                            closeSidebarOnMobile();
                          }}
                          className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl transition-all group ${isCareersActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                        >
                          <span className={`${isCareersActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'} transition-colors`}>{item.icon}</span>
                          <span className="min-w-0 flex-1 text-left text-[10px] font-black tracking-[0.3em] uppercase">{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-blue-300" />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'profile') {
                            handleOpenIdentityFromSidebar();
                            return;
                          }
                          if (view) {
                            setCurrentView(view);
                            closeSidebarOnMobile();
                          }
                        }}
                        className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl transition-all group ${isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                      >
                        <span className={`${isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'} transition-colors`}>{item.icon}</span>
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="pt-10 border-t border-white/5 space-y-4">
                  {hasProviderOperationsAccess(user) && (
                    <button
                      onClick={() => {
                        setIdentitySecurityOpen(true);
                        closeSidebarOnMobile();
                      }}
                      className="w-full flex items-center justify-between p-4 bg-blue-600/5 hover:bg-blue-600/10 rounded-2xl border border-blue-500/10 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">Provider Trust</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                  <button onClick={handleSignOut} className="w-full flex items-center gap-4 px-6 py-4 text-slate-500 hover:text-red-400 transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Disconnect</span>
                  </button>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden relative">
              <header className="min-h-16 sm:min-h-20 flex min-w-0 items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 md:px-6 lg:px-5 xl:px-8 2xl:px-10 border-b border-white/5 z-20 backdrop-blur-3xl bg-black/20 overflow-x-hidden">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4">
                  {!isSidebarOpen && (
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      className="shrink-0 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/95 p-1.5 shadow-lg transition-all hover:scale-[1.03]"
                      aria-label="Open platform menu"
                      title="Open menu"
                    >
                      <img src={cnhLogo} alt="" className="h-full w-full object-contain" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView(AppView.DASHBOARD);
                      closeSidebarOnMobile();
                    }}
                    className="hidden min-w-0 shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-all hover:bg-white/[0.08] md:flex"
                    aria-label="Open Conscious Network Hub dashboard"
                    title="Conscious Network Hub"
                  >
                    {isSidebarOpen && (
                      <img
                        src={cnhLogo}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg bg-white/95 object-contain p-1 shadow-lg"
                      />
                    )}
                    <span className="flex min-w-0 flex-col leading-none">
                      <span className="text-[10px] font-black uppercase text-blue-200">Conscious</span>
                      <span className="mt-1 truncate text-xs font-black uppercase text-white">Network Hub</span>
                    </span>
                  </button>
                  <form onSubmit={handleGlobalSearchSubmit} className="relative group hidden min-w-0 flex-1 lg:block lg:max-w-[18rem] xl:max-w-sm 2xl:max-w-md">
                    <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      type="search"
                      value={globalSearchQuery}
                      onChange={(event) => {
                        setGlobalSearchQuery(event.target.value);
                        setGlobalSearchOpen(true);
                      }}
                      onFocus={() => setGlobalSearchOpen(true)}
                      onBlur={() => window.setTimeout(() => setGlobalSearchOpen(false), 140)}
                      placeholder="Search platform..."
                      className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-3.5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium placeholder:tracking-wider uppercase"
                    />
                    {isGlobalSearchOpen && globalSearchQuery.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
                        {globalSearchResults.length > 0 ? (
                          globalSearchResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => openPlatformSearchResult(result)}
                              className="block w-full border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/5"
                            >
                              <span className="block text-[10px] font-black uppercase tracking-widest text-white">{result.title}</span>
                              <span className="mt-1 block text-[10px] leading-4 text-slate-400">{result.description}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            No accessible results
                          </div>
                        )}
                      </div>
                    )}
                  </form>
                  <button
                    onClick={() => {
                      if (currentView !== AppView.DASHBOARD) {
                        setPendingScrollWisdom(true);
                        setCurrentView(AppView.DASHBOARD);
                      } else {
                        insightRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="hidden xl:inline-flex shrink-0 items-center gap-2 px-3 py-2 bg-blue-600/15 hover:bg-blue-600/25 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-blue-300" /> <span className="cnh-action-label">Latest Wisdom</span>
                  </button>
                </div>
                
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3 xl:gap-4">
                  <div
                    aria-label={`AI status: ${healthStatus === 'online' ? 'live' : healthStatus}`}
                    className={`flex items-center gap-2 px-2 py-2 xl:px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${
                    healthStatus === 'online'
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : healthStatus === 'checking'
                      ? 'border-slate-600 text-slate-400 bg-white/5'
                      : 'border-red-500/40 text-red-300 bg-red-500/10'
                  }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      healthStatus === 'online'
                        ? 'bg-emerald-400'
                        : healthStatus === 'checking'
                        ? 'bg-slate-400 animate-pulse'
                        : 'bg-red-400'
                    }`} />
                    <span className="hidden sm:inline">{healthStatus === 'online' ? 'AI Live' : healthStatus === 'checking' ? 'Checking' : 'Offline'}</span>
                  </div>
                  <button
                    onClick={() => setCurrentView(AppView.NOTIFICATIONS)}
                    className="shrink-0 p-2.5 sm:p-3 hover:bg-white/5 rounded-xl text-slate-500 relative transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black"></div>
                  </button>
                  <div className="h-8 w-px bg-white/10 mx-1 hidden xl:block"></div>
                  <button
                    onClick={() => { setCurrentView(AppView.MY_CONSCIOUS_IDENTITY); closeSidebarOnMobile(); }}
                    className="flex min-w-0 max-w-[15rem] items-center gap-2 xl:gap-3 px-2 xl:pl-3 xl:pr-4 py-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 2xl:max-w-[18rem]"
                    title={user?.name || 'Guest Node'}
                  >
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center font-black text-sm text-white shadow-xl overflow-hidden">
                      {navAvatarUrl ? (
                        navAvatarIsVideo ? (
                          <video
                            src={navAvatarUrl}
                            className="w-full h-full object-cover"
                            muted
                            autoPlay
                            loop
                            playsInline
                            onError={() => setNavAvatarFailed(true)}
                          />
                        ) : (
                          <img
                            src={navAvatarUrl}
                            alt={user?.name || 'Member avatar'}
                            className="w-full h-full object-cover"
                            onError={() => setNavAvatarFailed(true)}
                          />
                        )
                      ) : (
                        user ? user.name.charAt(0).toUpperCase() : 'G'
                      )}
                    </div>
                    <div className="hidden min-w-0 text-left xl:block">
                      <p className="cnh-person-name text-[11px] font-black text-white leading-tight uppercase tracking-tighter 2xl:text-xs">{user?.name || 'Guest Node'}</p>
                      <p className="cnh-action-label mt-1 text-[8px] text-slate-500 uppercase tracking-[0.24em]">{user?.tier || 'Explore'} Access</p>
                    </div>
                  </button>
                </div>
              </header>

              <main
                ref={primaryScrollRef}
                className={`app-main-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto custom-scrollbar scrollable p-4 sm:p-5 md:p-6 relative z-10 transition-[padding] duration-300 ${
                  isSidebarOpen ? 'lg:p-6 xl:p-8 2xl:p-10' : 'lg:p-8 xl:p-10 2xl:p-12'
                }`}
                data-page-scroll-root="true"
                tabIndex={0}
                aria-label="Scrollable page content"
              >
                {renderActiveView()}
              </main>
              <footer className="shrink-0 overflow-hidden p-3 sm:p-4 bg-black/20 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-4 text-xs">
                  <button onClick={() => setCurrentView(AppView.PRIVACY_POLICY)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">Privacy Policy</button>
                  <button onClick={() => setCurrentView(AppView.TERMS_OF_SERVICE)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">Terms of Service</button>
                  <button onClick={() => setCurrentView(AppView.AI_TRANSPARENCY_POLICY)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">AI Transparency Policy</button>
                  <button onClick={() => setCurrentView(AppView.BLOCKCHAIN_DATA_POLICY)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">Blockchain Data Policy</button>
                  <button onClick={() => setCurrentView(AppView.VENDOR_API_GOVERNANCE_POLICY)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">Vendor API Governance Policy</button>
                  <button onClick={() => setCurrentView(AppView.NIST_MAPPING_SUMMARY)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">NIST Mapping Summary</button>
                  <button onClick={() => setCurrentView(AppView.AI_SAFETY_GOVERNANCE)} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">AI Safety & Governance</button>
                  <button onClick={openContactModal} className="max-w-full whitespace-normal text-center leading-5 text-slate-400 hover:text-white transition-colors">Contact</button>
                </div>
              </footer>
            </div>
          </div>
        )}

        <IdentitySecurityPanel
          isOpen={isIdentitySecurityOpen}
          onClose={() => setIdentitySecurityOpen(false)}
          user={user}
        />

        {isIdentityGuestPromptOpen && !user && (
          <div className="fixed inset-0 z-[210] flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-lg p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] relative animate-in zoom-in duration-300 border-blue-500/20 my-4 sm:my-8 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => setIdentityGuestPromptOpen(false)}
                className="absolute top-4 right-4 p-2.5 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <div className="space-y-4 sm:space-y-5 mb-8 sm:mb-10">
                <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter">My Conscious Identity</h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Sign in to access your identity profile. New users can create a profile from Membership Access.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setIdentityGuestPromptOpen(false);
                    setSignupModalOpen(false);
                    setSigninModalOpen(true);
                    resetSignInChallengeInputs();
                    setError('');
                  }}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-xl"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setIdentityGuestPromptOpen(false);
                    setCurrentView(AppView.MEMBERSHIP_ACCESS);
                    setSelectedTier(FREE_TIER_NAME);
                    setIsSelectingTier(false);
                    setSigninModalOpen(false);
                    setSignupModalOpen(true);
                    resetSignInChallengeInputs();
                    setError('');
                  }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all border border-white/10"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}

        {oneTimeRecoveryCodes.length > 0 && (
          <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/95 p-4 backdrop-blur-3xl sm:items-center">
            <div className="glass-panel my-6 w-full max-w-lg rounded-[2rem] border border-blue-500/20 p-6 shadow-2xl sm:p-8">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                Save Recovery Codes
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                These codes are shown once. Store them somewhere private. Each code can reset your password one time without email.
              </p>
              <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                {oneTimeRecoveryCodes.map((code) => (
                  <code key={code} className="rounded-xl bg-white/5 px-3 py-2 font-mono text-sm text-blue-100">
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOneTimeRecoveryCodes([])}
                className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition hover:bg-blue-500"
              >
                I Saved These Codes
              </button>
            </div>
          </div>
        )}

        {(isSignupModalOpen || isSigninModalOpen) && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto custom-scrollbar bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20 my-4 sm:my-8 max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] overflow-y-auto custom-scrollbar scrollable">
              <button onClick={closeModals} className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2.5 sm:p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <h3 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-10 text-white uppercase tracking-tighter">{isSigninModalOpen ? 'Sign In' : 'Create Account'}</h3>
              <form onSubmit={isSigninModalOpen ? handleSignIn : handleCreateProfile} className="space-y-5 sm:space-y-6">
                {error && <p className="text-red-400 text-[9px] sm:text-[10px] bg-red-400/10 p-3 sm:p-4 rounded-xl border border-red-400/20 uppercase tracking-widest font-black">{error}</p>}
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Email</label>
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="you@example.com" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Password</label>
                  <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="••••••••" />
                </div>
                {ACCOUNT_RECOVERY_UI_ENABLED && isSigninModalOpen && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordResetRequestOpen((open) => !open);
                        setPasswordResetEmailInput(emailInput);
                        setPasswordResetNotice('');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-blue-200"
                    >
                      Forgot Password?
                    </button>
                    {isPasswordResetRequestOpen && (
                      <div className="space-y-3">
                        <input
                          type="email"
                          value={passwordResetEmailInput}
                          onChange={(e) => setPasswordResetEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handlePasswordResetRequest();
                            }
                          }}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                          required
                          placeholder="you@example.com"
                        />
                        <button
                          type="button"
                          onClick={() => handlePasswordResetRequest()}
                          disabled={isPasswordResetPending}
                          className="w-full py-3 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
                        >
                          {isPasswordResetPending ? 'Starting...' : 'Start Recovery'}
                        </button>
                        {passwordResetNotice && (
                          <p className="text-[10px] leading-5 text-blue-100/80">{passwordResetNotice}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!isSigninModalOpen && (
                  <>
                    <p className="text-[9px] text-blue-300/80 uppercase tracking-widest px-1">
                      Password rules: 12+ chars, upper/lowercase, number, symbol, and no email fragments.
                    </p>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Confirm Password</label>
                      <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="********" />
                    </div>
                    <p className="text-[9px] text-blue-300/80 uppercase tracking-widest px-1">
                      After account creation, choose a membership tier to activate platform access.
                    </p>
                  </>
                )}
                <button type="submit" className="w-full py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 mt-4 sm:mt-6">
                  {isSigninModalOpen ? 'Sign In' : 'Create Account'}
                </button>
              </form>
              <div className="mt-6 sm:mt-8 text-center text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                {isSigninModalOpen ? "New user?" : "Already have an account?"}
                <button onClick={() => { setSigninModalOpen(!isSigninModalOpen); setSignupModalOpen(!isSignupModalOpen); resetSignInChallengeInputs(); setError(''); }} className="ml-2 text-blue-400 hover:underline">
                  {isSigninModalOpen ? 'Create Account' : 'Sign In'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isContactModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20 my-4 sm:my-8 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar">
              <button onClick={() => setContactModalOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">Contact Support</h3>
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Name</label>
                  <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Email</label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Subject</label>
                  <input type="text" value={contactSubject} onChange={e => setContactSubject(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Message</label>
                  <textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required rows={4} minLength={10}></textarea>
                </div>
                {contactStatus && (
                  <p className="rounded-2xl border border-blue-300/20 bg-blue-600/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-100">
                    {contactStatus}
                  </p>
                )}
                <button type="submit" disabled={isContactSubmitting} className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 mt-6">
                  {isContactSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        )}

        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-4xl p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20 my-4 sm:my-8 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar">
              <button onClick={() => { setIsPolicyModalOpen(false); setSelectedPolicy(null); }} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              {!selectedPolicy ? (
                <div>
                  <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">Policies</h3>
                  <div className="space-y-4">
                    <button onClick={() => setSelectedPolicy('privacy')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Privacy Policy</button>
                    <button onClick={() => setSelectedPolicy('terms')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Terms of Service</button>
                    <button onClick={() => setSelectedPolicy('ai-transparency')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">AI Transparency Policy</button>
                    <button onClick={() => setSelectedPolicy('blockchain')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Blockchain Data Policy</button>
                    <button onClick={() => setSelectedPolicy('vendor')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Vendor API Governance Policy</button>
                    <button onClick={() => setSelectedPolicy('nist')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">NIST Mapping Summary</button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">{selectedPolicy.replace('-', ' ').toUpperCase()}</h3>
                  <div className="text-slate-300 leading-relaxed font-light whitespace-pre-line">
                    {cleanPolicyContent(getPolicyContent(selectedPolicy))}
                  </div>
                  <div className="flex justify-between mt-10">
                    <button onClick={() => { setIsPolicyModalOpen(false); setSelectedPolicy(null); }} className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium">Back to Home</button>
                    <button onClick={() => setSelectedPolicy(getNextPolicy(selectedPolicy))} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Next Policy</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ethical AI Insight Widget removed from floating mini panel. Kept in `Dashboard` only. */}
      </div>
    </div>
  );
};

export default App;



