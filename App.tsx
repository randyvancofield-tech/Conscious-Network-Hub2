
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ThreeScene from './components/ThreeScene';
import Profile from './components/Profile';
import Dashboard from './components/Dashboard';
import WalletPopout from './components/WalletPopout';
import MyCourses from './components/MyCourses';
import ProvidersMarket from './components/ProvidersMarket';
import KnowledgePathways from './components/KnowledgePathways';
import CommunityMembers from './components/CommunityMembers';
import SocialLearningHub from './components/SocialLearningHub';
import ConsciousMeetings from './components/ConsciousMeetings';
import MusicBox from './components/MusicBox';
import EthicalAIInsight from './components/EthicalAIInsight';
import PaymentConfirmation from './components/PaymentConfirmation';
import { ConsciousIdentity } from './components/community/CommunityLayout';
import { AppView, UserProfile, Course } from './types';
import { NAVIGATION_ITEMS } from './constants';
import { 
  Shield, Brain, Menu, X, Search, Bell, Settings, 
  ChevronRight, ChevronDown, Wallet, LogIn, Home, LogOut, Compass, UserCircle, Building2, CheckCircle2, Sparkles, Key, Video
} from 'lucide-react';
import logo from './src/assets/brand/logo.png';
import privacyPolicy from './docs/compliance/privacy-policy-draft.md?raw';
import aiTransparencyPolicy from './docs/compliance/ai-transparency-policy-draft.md?raw';
import blockchainDataPolicy from './docs/compliance/blockchain-data-policy-draft.md?raw';
import vendorApiGovernancePolicy from './docs/compliance/vendor-api-governance-policy-draft.md?raw';
import nistMappingSummary from './docs/compliance/nist-mapping-summary.md?raw';
import { buildAuthHeaders, clearAuthSession, getAuthToken, setAuthSession } from './services/sessionService';
import { canTierAccessNavItem, canTierAccessView } from './services/tierAccess';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.ENTRY);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);
  const [isSigninModalOpen, setSigninModalOpen] = useState(false);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('Free / Community Tier');
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [twoFactorMethodInput, setTwoFactorMethodInput] = useState<'none' | 'phone' | 'wallet'>('none');
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [walletDidInput, setWalletDidInput] = useState('');
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState('');
  const [providerTokenInput, setProviderTokenInput] = useState('');
  const [pendingTwoFactorMethod, setPendingTwoFactorMethod] = useState<'phone' | 'wallet' | null>(null);

  const [isConnectDropdownOpen, setConnectDropdownOpen] = useState(false);
  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  // Membership and payment states
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [isSelectingTier, setIsSelectingTier] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [isIdentityGuestPromptOpen, setIdentityGuestPromptOpen] = useState(false);

  const insightRef = useRef<HTMLDivElement>(null);
  const [pendingScrollWisdom, setPendingScrollWisdom] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const TIERS = [
    {
      name: "Free / Community Tier",
      price: "Free",
      description: "Provides basic access to community discussions, public posts, and selected events.",
      access: "Limited; no provider sessions.",
      ideal: "Individuals exploring the platform; early engagement.",
      color: "blue"
    },
    {
      name: "Guided Tier",
      price: "$22/month",
      description: "Structured access to curated content, thematic learning pathways, and selected provider-led sessions.",
      access: "Moderate; guided growth experience.",
      ideal: "Individuals seeking clarity, emotional wellness, or spiritual development.",
      color: "teal"
    },
    {
      name: "Accelerated Tier",
      price: "$44/month",
      description: "Full access to expert-led sessions, live programs, collaborations, and advanced thematic content.",
      access: "High; personalized growth support.",
      ideal: "Users committed to intentional development and consistent practice.",
      color: "indigo"
    }
  ];

  const isLocalBackendUrl = (value: string): boolean => {
    if (!value) return false;
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.endsWith('.localhost')
      );
    } catch {
      return false;
    }
  };

  const allowRemoteBackendInDev =
    String(import.meta.env.VITE_ALLOW_REMOTE_BACKEND_IN_DEV || '').toLowerCase() === 'true';
  const signupTwoFactorEnabled =
    String(import.meta.env.VITE_ENABLE_SIGNUP_2FA || '').toLowerCase() === 'true';

  const resolveBackendUrl = () => {
    const configured = String(import.meta.env.VITE_BACKEND_URL || '').trim();
    if (configured) {
      const normalized = configured.replace(/\/+$/, '');
      if (import.meta.env.DEV && !isLocalBackendUrl(normalized) && !allowRemoteBackendInDev) {
        if (typeof window !== 'undefined') {
          return window.location.origin.replace(/\/+$/, '');
        }
        return '';
      }
      return normalized;
    }
    if (typeof window !== 'undefined') {
      return window.location.origin.replace(/\/+$/, '');
    }
    return '';
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

  const toCanonicalUser = (rawUser: any): UserProfile => ({
    id: rawUser.id,
    name: rawUser.name || (rawUser.email ? rawUser.email.split('@')[0] : 'Node'),
    handle: rawUser.handle,
    email: rawUser.email,
    tier: rawUser.tier || 'Free / Community Tier',
    createdAt: rawUser.createdAt || new Date().toISOString(),
    hasProfile: rawUser.hasProfile ?? false,
    identityVerified: true,
    reputationScore: rawUser.reputationScore ?? 100,
    walletBalanceTokens: rawUser.walletBalanceTokens ?? 200,
    avatarUrl: rawUser.avatarUrl,
    bannerUrl: rawUser.bannerUrl,
    location: rawUser.location ?? null,
    dateOfBirth: rawUser.dateOfBirth ?? null,
    profileMedia: rawUser.profileMedia,
    profileBackgroundVideo: rawUser.profileBackgroundVideo || null,
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
  });

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
    const savedCourses = localStorage.getItem('hcn_enrolled_courses');
    if (savedCourses) setEnrolledCourses(JSON.parse(savedCourses));

    const initializeSession = async () => {
      const token = getAuthToken();
      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${resolveBackendUrl()}/api/user/current`, {
          headers: buildAuthHeaders(),
        });
        if (!response.ok) {
          clearAuthSession();
          setUser(null);
          return;
        }

        const data = await response.json();
        const canonicalUser = toCanonicalUser(data.user);
        setUser(canonicalUser);
        setAuthSession(token, canonicalUser);
        setCurrentView(AppView.DASHBOARD);
      } catch {
        clearAuthSession();
        setUser(null);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    if (!signupTwoFactorEnabled && twoFactorMethodInput !== 'none') {
      setTwoFactorMethodInput('none');
      setPhoneNumberInput('');
      setWalletDidInput('');
    }
  }, [signupTwoFactorEnabled, twoFactorMethodInput]);

  useEffect(() => {
    if (isConnectDropdownOpen && connectButtonRef.current) {
      const rect = connectButtonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left });
    }
  }, [isConnectDropdownOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const ping = async () => {
      try {
        const res = await fetch(`${resolveBackendUrl()}/health`, { signal: controller.signal });
        setHealthStatus(res.ok ? 'online' : 'offline');
      } catch {
        setHealthStatus('offline');
      }
    };
    ping();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (pendingScrollWisdom && currentView === AppView.DASHBOARD) {
      insightRef.current?.scrollIntoView({ behavior: 'smooth' });
      setPendingScrollWisdom(false);
    }
  }, [pendingScrollWisdom, currentView]);

  useEffect(() => {
    if (user && !canTierAccessView(user.tier, currentView)) {
      setCurrentView(AppView.DASHBOARD);
    }
  }, [user, currentView]);

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
  
  const handleGoHome = () => setCurrentView(AppView.ENTRY);
  
  const handleExploreAsGuest = () => {
    clearAuthSession();
    setUser(null);
    setCurrentView(AppView.DASHBOARD);
    if (window.innerWidth >= 1024) setSidebarOpen(true);
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
      const response = await fetch(`${resolveBackendUrl()}/api/user/current`, {
        headers: buildAuthHeaders(),
      });
      if (!response.ok) {
        clearAuthSession();
        setUser(null);
        return null;
      }
      const data = await response.json();
      const canonicalUser = toCanonicalUser(data.user);
      setUser(canonicalUser);
      const token = getAuthToken();
      if (token) {
        setAuthSession(token, canonicalUser);
      }
      return canonicalUser;
    } catch {
      clearAuthSession();
      setUser(null);
      return null;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${resolveBackendUrl()}/api/user/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
          twoFactorCode: twoFactorCodeInput,
          providerToken: providerTokenInput,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.status === 202 && data?.requiresTwoFactor) {
        const method = data?.method === 'wallet' ? 'wallet' : 'phone';
        setPendingTwoFactorMethod(method);
        setError(data?.message || 'Additional verification is required.');
        return;
      }

      if (!response.ok) {
        setError(data?.error || 'Invalid credentials.');
        return;
      }

      const canonicalUser = toCanonicalUser(data.user);
      setAuthSession(data.token, canonicalUser);
      setUser(canonicalUser);
      setIsSelectingTier(false);
      setPendingTwoFactorMethod(null);
      setTwoFactorCodeInput('');
      setProviderTokenInput('');
      closeModals();
      setCurrentView(AppView.DASHBOARD);
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    } catch {
      setError('Unable to sign in. Please try again.');
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!signupTwoFactorEnabled && twoFactorMethodInput !== 'none') {
      setError(
        'Signup 2FA enrollment is temporarily disabled. Create your profile first, then enable 2FA in Profile Security.'
      );
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setError('Passwords match error.');
      return;
    }

    const passwordValidation = validatePasswordStrength(emailInput, passwordInput);
    if (passwordValidation) {
      setError(passwordValidation);
      return;
    }

    if (twoFactorMethodInput === 'phone' && !phoneNumberInput.trim()) {
      setError('Phone number is required when phone 2FA is selected.');
      return;
    }

    if (twoFactorMethodInput === 'wallet' && !walletDidInput.trim()) {
      setError('Wallet DID is required when wallet 2FA is selected.');
      return;
    }

    try {
      const identityName = emailInput.split('@')[0] || 'Node';
      const response = await fetch(`${resolveBackendUrl()}/api/user/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          name: identityName,
          password: passwordInput,
          twoFactorMethod: twoFactorMethodInput,
          phoneNumber: twoFactorMethodInput === 'phone' ? phoneNumberInput : undefined,
          walletDid: twoFactorMethodInput === 'wallet' ? walletDidInput : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'Unable to create profile.');
        return;
      }
      if (!data?.persistenceVerified) {
        setError('Profile persistence verification failed.');
        return;
      }

      const canonicalUser = toCanonicalUser(data.user);
      setAuthSession(data.token, canonicalUser);
      setUser(canonicalUser);
      closeModals();
      setCurrentView(AppView.MEMBERSHIP_ACCESS);
      setIsSelectingTier(true);
    } catch {
      setError('Unable to create profile. Please try again.');
    }
  };

  const handleMembershipTierSelect = async (tier: string) => {
    if (!user) return;
    setSelectedTier(tier);
    
    try {
      const canonicalUser = await refreshCanonicalUser();
      if (!canonicalUser) {
        setError('Session expired. Please sign in again.');
        return;
      }

      // Call backend to select tier and create membership
      const response = await fetch(`${resolveBackendUrl()}/api/membership/select-tier`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: canonicalUser.id, tier })
      });

      if (!response.ok) {
        throw new Error('Failed to select tier');
      }

      const data = await response.json();
      
      // Only mutate local membership state from backend-confirmed data.
      if (data?.user?.tier) {
        const updatedUser = { ...canonicalUser, tier: data.user.tier };
        setUser(updatedUser);
        const token = getAuthToken();
        if (token) {
          setAuthSession(token, updatedUser);
        }
      }
      
      // Show payment confirmation
      setShowPaymentConfirmation(true);
    } catch (err) {
      setError('Failed to process tier selection. Please try again.');
      console.error('Tier selection error:', err);
    }
  };

  const handlePaymentSuccess = () => {
    const finalize = async () => {
      const refreshed = await refreshCanonicalUser();
      if (!refreshed) {
        setError('Unable to verify membership state. Please sign in again.');
        handleSignOut();
        return;
      }
      setShowPaymentConfirmation(false);
      setIsSelectingTier(false);
      setCurrentView(AppView.DASHBOARD);
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    };

    void finalize();
  };

  const handleSignOut = () => {
    const finalizeSignOut = () => {
      clearAuthSession();
      setUser(null);
      setIsSelectingTier(false);
      setShowPaymentConfirmation(false);
      setPendingTwoFactorMethod(null);
      setTwoFactorCodeInput('');
      setProviderTokenInput('');
      setCurrentView(AppView.ENTRY);
      setSidebarOpen(false);
    };

    void (async () => {
      try {
        if (getAuthToken()) {
          await fetch(`${resolveBackendUrl()}/api/user/logout`, {
            method: 'POST',
            headers: buildAuthHeaders(),
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
    setTwoFactorMethodInput('none'); setPhoneNumberInput(''); setWalletDidInput('');
    setTwoFactorCodeInput(''); setProviderTokenInput(''); setPendingTwoFactorMethod(null);
  };

  const getPolicyContent = (policy: string) => {
    switch (policy) {
      case 'privacy': return privacyPolicy;
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

  const policies = ['privacy', 'ai-transparency', 'blockchain', 'vendor', 'nist'];

  const getNextPolicy = (current: string) => {
    const index = policies.indexOf(current);
    return policies[(index + 1) % policies.length];
  };

  const enrollCourse = (course: Course) => {
    if (!enrolledCourses.find(c => c.id === course.id)) {
      const updated = [...enrolledCourses, { ...course, progress: 12 }];
      setEnrolledCourses(updated);
      localStorage.setItem('hcn_enrolled_courses', JSON.stringify(updated));
    }
    setCurrentView(AppView.MY_COURSES);
  };

  const updateActiveUser = (updated: UserProfile) => {
    const canonicalUpdated = toCanonicalUser({ ...user, ...updated });
    setUser(canonicalUpdated);
    const token = getAuthToken();
    if (token) {
      setAuthSession(token, canonicalUpdated);
    }
  };

  const handleIdentityComplete = (profileData: Partial<UserProfile>) => {
    if (!user) return;

    const optimistic = { ...user, ...profileData, hasProfile: true };
    updateActiveUser(optimistic);

    void (async () => {
      try {
        const response = await fetch(`${resolveBackendUrl()}/api/user/${user.id}`, {
          method: 'PUT',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
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
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to persist profile');
        }

        const canonical = toCanonicalUser(data.user);
        updateActiveUser({ ...canonical, hasProfile: true });
      } catch (persistError) {
        console.error('Identity persistence error:', persistError);
        setError('Profile changes were not fully saved to backend. Please retry.');
      }
    })();
  };

  const navViewMap: Record<string, AppView> = {
    dashboard: AppView.DASHBOARD,
    'social-learning': AppView.CONSCIOUS_SOCIAL_LEARNING,
    meetings: AppView.CONSCIOUS_MEETINGS,
    'my-courses': AppView.MY_COURSES,
    providers: AppView.PROVIDERS,
    profile: AppView.MY_CONSCIOUS_IDENTITY,
    membership: AppView.MEMBERSHIP,
  };

  const filteredNavigationItems = useMemo(() => {
    if (!user) return NAVIGATION_ITEMS;
    return NAVIGATION_ITEMS.filter((item) => canTierAccessNavItem(user.tier, item.id));
  }, [user]);

  const renderActiveView = () => {
    if (user && !canTierAccessView(user.tier, currentView)) {
      return <Dashboard user={user} onEnroll={enrollCourse} insightRef={insightRef} />;
    }

    switch (currentView) {
      case AppView.DASHBOARD: 
        return <Dashboard user={user} onEnroll={enrollCourse} insightRef={insightRef} />;
      case AppView.CONSCIOUS_SOCIAL_LEARNING:
        return <SocialLearningHub user={user} />;
      case AppView.CONSCIOUS_MEETINGS:
        return <ConsciousMeetings user={user} onUpdateUser={updateActiveUser} />;
      case AppView.PROFILE:
        return user ? <Profile user={user} onUserUpdate={updateActiveUser} /> : null;
      case AppView.MY_CONSCIOUS_IDENTITY: 
        return (
          <ConsciousIdentity 
            user={user} 
            enrolledCourses={enrolledCourses}
            onComplete={handleIdentityComplete}
            onSignOut={handleSignOut}
            onGoBack={() => setCurrentView(AppView.DASHBOARD)}
            onSignInPrompt={() => {
              setPendingTwoFactorMethod(null);
              setTwoFactorCodeInput('');
              setProviderTokenInput('');
              setSigninModalOpen(true);
            }}
          />
        );
      case AppView.MY_COURSES: 
        return <MyCourses enrolledCourses={enrolledCourses} onNavigateToUniversity={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)} />;
      case AppView.PROVIDERS:
        return <ProvidersMarket />;
      case AppView.MEMBERSHIP:
        return <CommunityMembers />;
      case AppView.KNOWLEDGE_PATHWAYS:
        return <KnowledgePathways onGoBack={() => setCurrentView(AppView.MY_COURSES)} onEnroll={enrollCourse} />;
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
      default: 
        return <Dashboard user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 selection:bg-blue-500/30 flex relative">
      {currentView !== AppView.ENTRY && <ThreeScene />}
      <MusicBox />

      {showPaymentConfirmation && user && (
        <PaymentConfirmation
          tier={selectedTier}
          userId={user.id}
          onSuccess={handlePaymentSuccess}
          onCancel={() => {
            setShowPaymentConfirmation(false);
            setCurrentView(AppView.MEMBERSHIP_ACCESS);
          }}
        />
      )}

      {currentView === AppView.ENTRY && (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="fixed inset-0 w-full h-full object-cover z-0"
          >
            <source src="/video/home-bg.mp4" type="video/mp4" />
          </video>
          <div className="fixed inset-0 bg-black/55 z-1"></div>
        </>
      )}

      <div className="relative z-10 w-full h-full flex flex-col overflow-hidden">
        
        {hasApiKey === false && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6">
            <div className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-blue-500/20 shadow-2xl">
              <Key className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">API Node Required</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                To access advanced intelligence and image synthesis, you must connect a paid Google Cloud Project API Key. 
                <br /><br />
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View Billing Documentation</a>
              </p>
              <button 
                onClick={handleOpenSelectKey}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl"
              >
                Select API Key
              </button>
            </div>
          </div>
        )}

        {currentView === AppView.ENTRY && (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 text-center animate-in fade-in zoom-in duration-1000">
            <div className="w-full max-w-4xl space-y-6 sm:space-y-8 md:space-y-12 backdrop-blur-[4px] p-6 sm:p-8 md:p-12 lg:p-16 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] lg:rounded-[4rem] border border-white/5 bg-white/[0.01] shadow-[0_0_100px_rgba(0,0,0,0.6)]">
              <div className="flex justify-center">
                <div className="p-4 sm:p-6 bg-blue-600/10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-blue-500/20 backdrop-blur-3xl shadow-[0_0_30px_rgba(37,99,235,0.2)] animate-pulse">
                  <img src={logo} alt="Conscious Network Hub Logo" className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" />
                </div>
              </div>
              
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[0.9] drop-shadow-2xl">
                  CONSCIOUS <br /> 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-teal-400 uppercase tracking-tighter drop-shadow-sm">
                    Network Hub
                  </span>
                </h1>
                <p className="text-base xs:text-lg sm:text-xl md:text-2xl text-blue-100/70 max-w-2xl mx-auto leading-relaxed font-light drop-shadow-md px-2 sm:px-0">
                  Restoring autonomy and protecting identity through a community-centered decentralized social learning infrastructure.
                </p>
              </div>

              <div className="flex justify-center pt-6 sm:pt-8 md:pt-10">
                <button 
                  onClick={handleEnterHub}
                  className="group relative w-full sm:w-auto px-6 sm:px-12 md:px-16 lg:px-20 py-4 sm:py-5 md:py-6 lg:py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl md:rounded-[1.5rem] lg:rounded-[2rem] font-black text-base sm:text-lg md:text-xl lg:text-2xl transition-all shadow-[0_0_60px_rgba(37,99,235,0.3)] hover:-translate-y-2 active:scale-95 flex items-center justify-center gap-3 sm:gap-4 overflow-hidden tracking-wider"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  ENTER PORTAL <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
              
              <div className="flex justify-center pt-4">
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => window.open('https://calendly.com/randycofield/buildingconnections', '_blank', 'noopener,noreferrer')}
                    className="group relative px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-sm transition-all shadow-[0_0_30px_rgba(37,99,235,0.2)] hover:-translate-y-1 active:scale-95 flex items-center gap-2 border border-blue-500/20"
                  >
                    Schedule a Briefing <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
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

        {currentView === AppView.MEMBERSHIP_ACCESS && (
          <div className="h-[100dvh] p-4 sm:p-6 md:p-8 lg:p-12 xl:p-20 overflow-y-auto overscroll-y-contain custom-scrollbar animate-in fade-in duration-700 relative z-10">
            <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10 md:space-y-12 pb-6 sm:pb-10">
              <button onClick={handleGoHome} className="flex items-center gap-2 sm:gap-3 text-slate-500 hover:text-white transition-colors group">
                <Home className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="font-bold uppercase tracking-[0.4em] text-[9px] sm:text-[10px]">Portal Entry</span>
              </button>
              
              <div className="text-center space-y-3 sm:space-y-4">
                <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter">Membership Access</h2>
                <p className="text-slate-400 text-sm sm:text-base md:text-lg font-light px-2 sm:px-0">Select your level of integration within the decentralized ecosystem.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7 md:gap-8">
                {TIERS.map((tier) => (
                  <div key={tier.name} className={`glass-panel p-5 sm:p-8 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] border-white/5 hover:border-${tier.color}-500/30 transition-all flex flex-col justify-between group shadow-2xl relative overflow-hidden border-t-4 border-t-${tier.color}-500/20 min-h-[25rem] sm:min-h-[27rem]`}>
                    <div className={`absolute top-0 right-0 p-4 sm:p-8 opacity-5 group-hover:opacity-10 transition-opacity text-${tier.color}-400`}><Shield className="w-16 h-16 sm:w-24 sm:h-24" /></div>
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase tracking-tighter">{tier.name}</h3>
                        <span className={`px-3 sm:px-4 py-1 sm:py-1.5 bg-${tier.color}-500/20 text-${tier.color}-400 rounded-full text-[9px] sm:text-[10px] font-black whitespace-nowrap tracking-widest`}>{tier.price}</span>
                      </div>
                      <p className="text-blue-400/60 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] mb-6 sm:mb-8">Sovereign Node Package</p>
                      
                      <div className="space-y-4 sm:space-y-6">
                        <div>
                          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-light">{tier.description}</p>
                        </div>
                        <div>
                          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Level</h4>
                          <div className="flex items-center gap-2 sm:gap-3 text-white text-[11px] sm:text-xs font-medium">
                            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-${tier.color}-400 shrink-0`} />
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
                        if (isSelectingTier && user) {
                          // User just created profile, process tier selection
                          handleMembershipTierSelect(tier.name);
                        } else {
                          // User is exploring, show signup modal
                          setSelectedTier(tier.name);
                          setPendingTwoFactorMethod(null);
                          setTwoFactorCodeInput('');
                          setProviderTokenInput('');
                          setSignupModalOpen(true);
                        }
                      }}
                      className={`mt-7 sm:mt-10 w-full py-4 sm:py-5 bg-white/5 hover:bg-${tier.color}-600 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-all shadow-xl border border-white/5 hover:border-${tier.color}-500/50`}
                      disabled={showPaymentConfirmation}
                    >
                      Anchor as {tier.name.split(' ')[0]}
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 md:gap-8 pt-6 sm:pt-8 md:pt-10">
                <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-8 border-l-8 border-cyan-500 shadow-2xl">
                  <div className="flex items-center gap-6">
                    <div className="p-5 bg-cyan-500/10 rounded-3xl">
                      <Building2 className="w-10 h-10 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white leading-none uppercase tracking-tighter">Institutional Plan</h4>
                      <p className="text-[9px] text-cyan-400/60 font-black uppercase tracking-[0.3em] mt-3 mb-4">Enterprise Leadership</p>
                      <p className="text-sm text-slate-400 max-w-xs leading-relaxed font-light">
                        Organization-wide leadership development, emotional resilience, and specialized provider cohorts.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.open('https://calendly.com/randycofield/buildingconnections', '_blank')}
                    className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap shadow-lg flex items-center gap-2 group"
                  >
                    Contact <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-8 border-l-8 border-orange-500 shadow-2xl">
                  <div className="flex items-center gap-6">
                    <div className="p-5 bg-orange-500/10 rounded-3xl">
                      <Compass className="w-10 h-10 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Explore Platform</h4>
                      <p className="text-[9px] text-orange-400/60 font-black uppercase tracking-[0.3em] mt-3 mb-4">Guest Access</p>
                      <p className="text-sm text-slate-400 max-w-xs leading-relaxed font-light">
                        View the hub as a guest node without a profile. Limited observation only.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleExploreAsGuest}
                    className="px-10 py-4 bg-orange-600/10 hover:bg-orange-600 text-orange-200 rounded-2xl font-black text-xs uppercase tracking-widest border border-orange-500/30 transition-all flex items-center gap-2 group shadow-xl"
                  >
                    Browse Hub <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(currentView !== AppView.ENTRY && currentView !== AppView.MEMBERSHIP_ACCESS) && (
          <div className="flex flex-1 overflow-hidden animate-in fade-in duration-500 relative z-10">
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[105] lg:hidden transition-opacity"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <aside className={`fixed inset-y-0 left-0 z-[110] w-80 glass-panel border-r border-white/5 transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
              <div className="h-full flex flex-col p-10">
                <button 
                  onClick={() => setSidebarOpen(false)} 
                  className="lg:hidden absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl text-slate-500"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-5 mb-16">
                  <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/40">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white tracking-tighter leading-none uppercase">CONSCIOUS<br /><span className="text-blue-400 text-[10px] tracking-[0.4em] font-black">NODE</span></h1>
                  </div>
                </div>
                
                <nav className="flex-1 space-y-4">
                  {filteredNavigationItems.map((item) => {
                    const view = navViewMap[item.id];
                    const isActive = currentView === view;
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
                  <button 
                    onClick={() => {
                      if (!user) {
                        setError('Sign in required for wallet access.');
                        setPendingTwoFactorMethod(null);
                        setTwoFactorCodeInput('');
                        setProviderTokenInput('');
                        setSigninModalOpen(true);
                        closeSidebarOnMobile();
                        return;
                      }
                      setWalletOpen(true);
                      closeSidebarOnMobile();
                    }} 
                    className="w-full flex items-center justify-between p-4 bg-blue-600/5 hover:bg-blue-600/10 rounded-2xl border border-blue-500/10 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">Vault</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-4 px-6 py-4 text-slate-500 hover:text-red-400 transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Disconnect</span>
                  </button>
                </div>
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              <header className="h-20 sm:h-24 flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 border-b border-white/5 z-20 backdrop-blur-3xl bg-black/20">
                <div className="flex items-center gap-6">
                  {!isSidebarOpen && (
                    <button onClick={toggleSidebar} className="lg:hidden p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 border border-white/10 shadow-lg">
                      <Menu className="w-5 h-5" />
                    </button>
                  )}
                  <div className="relative group hidden md:block">
                    <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
                    <input type="text" placeholder="Search..." className="pl-12 sm:pl-14 pr-6 sm:pr-8 py-3 sm:py-3.5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/30 w-56 sm:w-72 md:w-80 transition-all font-medium placeholder:tracking-wider uppercase" />
                  </div>
                  <button
                    onClick={() => {
                      if (currentView !== AppView.DASHBOARD) {
                        setPendingScrollWisdom(true);
                        setCurrentView(AppView.DASHBOARD);
                      } else {
                        insightRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="hidden md:inline-flex items-center gap-2 px-3 py-2 bg-blue-600/15 hover:bg-blue-600/25 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-blue-300" /> Latest Wisdom
                  </button>
                </div>
                
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${
                    healthStatus === 'online'
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : healthStatus === 'checking'
                      ? 'border-slate-600 text-slate-400 bg-white/5'
                      : 'border-red-500/40 text-red-300 bg-red-500/10'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      healthStatus === 'online'
                        ? 'bg-emerald-400'
                        : healthStatus === 'checking'
                        ? 'bg-slate-400 animate-pulse'
                        : 'bg-red-400'
                    }`} />
                    <span>{healthStatus === 'online' ? 'AI Live' : healthStatus === 'checking' ? 'Checking' : 'Offline'}</span>
                  </div>
                  <button className="p-3 hover:bg-white/5 rounded-xl text-slate-500 relative transition-colors">
                    <Bell className="w-5 h-5" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black"></div>
                  </button>
                  <div className="h-8 w-px bg-white/10 mx-2 hidden md:block"></div>
                  <button onClick={() => { setCurrentView(AppView.MY_CONSCIOUS_IDENTITY); closeSidebarOnMobile(); }} className="flex items-center gap-4 pl-3 pr-6 py-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center font-black text-sm text-white shadow-xl overflow-hidden">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user ? user.name.charAt(0).toUpperCase() : 'G'
                      )}
                    </div>
                    <div className="text-left hidden md:block">
                      <p className="text-xs font-black text-white leading-none uppercase tracking-tighter">{user?.name || 'Guest Node'}</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-[0.3em] mt-1">{user?.tier || 'Explore'} Access</p>
                    </div>
                  </button>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
                {renderActiveView()}
              </main>
              <footer className="p-4 bg-black/20 backdrop-blur-sm border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-4 text-xs">
                  <button onClick={() => setCurrentView(AppView.PRIVACY_POLICY)} className="text-slate-400 hover:text-white transition-colors">Privacy Policy</button>
                  <button onClick={() => setCurrentView(AppView.AI_TRANSPARENCY_POLICY)} className="text-slate-400 hover:text-white transition-colors">AI Transparency Policy</button>
                  <button onClick={() => setCurrentView(AppView.BLOCKCHAIN_DATA_POLICY)} className="text-slate-400 hover:text-white transition-colors">Blockchain Data Policy</button>
                  <button onClick={() => setCurrentView(AppView.VENDOR_API_GOVERNANCE_POLICY)} className="text-slate-400 hover:text-white transition-colors">Vendor API Governance Policy</button>
                  <button onClick={() => setCurrentView(AppView.NIST_MAPPING_SUMMARY)} className="text-slate-400 hover:text-white transition-colors">NIST Mapping Summary</button>
                  <button onClick={() => setCurrentView(AppView.AI_SAFETY_GOVERNANCE)} className="text-slate-400 hover:text-white transition-colors">AI Safety & Governance</button>
                </div>
              </footer>
            </div>
          </div>
        )}

        <WalletPopout isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} />

        {isIdentityGuestPromptOpen && !user && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-lg p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] relative animate-in zoom-in duration-300 border-blue-500/20">
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
                    setPendingTwoFactorMethod(null);
                    setTwoFactorCodeInput('');
                    setProviderTokenInput('');
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
                    setSelectedTier('Free / Community Tier');
                    setIsSelectingTier(false);
                    setSigninModalOpen(false);
                    setSignupModalOpen(true);
                    setPendingTwoFactorMethod(null);
                    setTwoFactorCodeInput('');
                    setProviderTokenInput('');
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

        {(isSignupModalOpen || isSigninModalOpen) && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20 my-4 sm:my-8 max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] overflow-y-auto">
              <button onClick={closeModals} className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2.5 sm:p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <h3 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-10 text-white uppercase tracking-tighter">{isSigninModalOpen ? 'Sync Node' : 'Initialize Identity'}</h3>
              <form onSubmit={isSigninModalOpen ? handleSignIn : handleCreateProfile} className="space-y-5 sm:space-y-6">
                {error && <p className="text-red-400 text-[9px] sm:text-[10px] bg-red-400/10 p-3 sm:p-4 rounded-xl border border-red-400/20 uppercase tracking-widest font-black">{error}</p>}
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Node Identifier</label>
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="email@nexus.node" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Secure Passkey</label>
                  <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="••••••••" />
                </div>
                {!isSigninModalOpen && (
                  <>
                    <p className="text-[9px] text-blue-300/80 uppercase tracking-widest px-1">
                      Password rules: 12+ chars, upper/lowercase, number, symbol, and no email fragments.
                    </p>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Verify Key</label>
                      <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="********" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">2FA Preference</label>
                      <select
                        value={twoFactorMethodInput}
                        onChange={(e) => setTwoFactorMethodInput(e.target.value as 'none' | 'phone' | 'wallet')}
                        className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                      >
                        <option value="none">Password only</option>
                        <option value="phone" disabled={!signupTwoFactorEnabled}>
                          {signupTwoFactorEnabled
                            ? 'Password + Phone OTP'
                            : 'Password + Phone OTP (temporarily disabled)'}
                        </option>
                        <option value="wallet" disabled={!signupTwoFactorEnabled}>
                          {signupTwoFactorEnabled
                            ? 'Password + Wallet Token'
                            : 'Password + Wallet Token (temporarily disabled)'}
                        </option>
                      </select>
                    </div>
                    {signupTwoFactorEnabled && twoFactorMethodInput === 'phone' && (
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Phone Number</label>
                        <input
                          type="tel"
                          value={phoneNumberInput}
                          onChange={(e) => setPhoneNumberInput(e.target.value)}
                          className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                          placeholder="+1 555 123 4567"
                          required
                        />
                      </div>
                    )}
                    {signupTwoFactorEnabled && twoFactorMethodInput === 'wallet' && (
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Wallet DID</label>
                        <input
                          type="text"
                          value={walletDidInput}
                          onChange={(e) => setWalletDidInput(e.target.value)}
                          className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                          placeholder="did:hcn:ed25519:..."
                          required
                        />
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest px-1">
                          Sign in later by providing a valid provider session token from wallet verification.
                        </p>
                      </div>
                    )}
                    {!signupTwoFactorEnabled && (
                      <p className="text-[9px] text-amber-300/90 uppercase tracking-widest px-1">
                        Signup 2FA enrollment is temporarily disabled to prevent lockouts. Enable 2FA after sign-in from Profile Security.
                      </p>
                    )}
                  </>
                )}
                {isSigninModalOpen && pendingTwoFactorMethod === 'phone' && (
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Phone OTP Code</label>
                    <input
                      type="text"
                      value={twoFactorCodeInput}
                      onChange={(e) => setTwoFactorCodeInput(e.target.value)}
                      className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                      placeholder="6-digit code"
                      required
                    />
                  </div>
                )}
                {isSigninModalOpen && pendingTwoFactorMethod === 'wallet' && (
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Wallet Provider Token</label>
                    <input
                      type="text"
                      value={providerTokenInput}
                      onChange={(e) => setProviderTokenInput(e.target.value)}
                      className="w-full px-5 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm"
                      placeholder="Paste provider token"
                      required
                    />
                  </div>
                )}
                <button type="submit" className="w-full py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 mt-4 sm:mt-6">
                  {isSigninModalOpen ? (pendingTwoFactorMethod ? 'Verify & Initialize Session' : 'Initialize Session') : 'Create Identity Hash'}
                </button>
              </form>
              <div className="mt-6 sm:mt-8 text-center text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                {isSigninModalOpen ? "New Node?" : "Already Anchored?"}
                <button onClick={() => { setSigninModalOpen(!isSigninModalOpen); setSignupModalOpen(!isSignupModalOpen); setPendingTwoFactorMethod(null); setTwoFactorCodeInput(''); setProviderTokenInput(''); setError(''); }} className="ml-2 text-blue-400 hover:underline">
                  {isSigninModalOpen ? 'Register Identity' : 'Sync Existing'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isContactModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-12 rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20">
              <button onClick={() => setContactModalOpen(false)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">Contact Us</h3>
              <form onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); setContactModalOpen(false); setContactName(''); setContactEmail(''); setContactMessage(''); }} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Name</label>
                  <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Email</label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Message</label>
                  <textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required rows={4}></textarea>
                </div>
                <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 mt-6">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        )}

        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-4xl p-12 rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20 max-h-[80vh] overflow-y-auto">
              <button onClick={() => { setIsPolicyModalOpen(false); setSelectedPolicy(null); }} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              {!selectedPolicy ? (
                <div>
                  <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">Policies</h3>
                  <div className="space-y-4">
                    <button onClick={() => setSelectedPolicy('privacy')} className="w-full text-left py-3 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium">Privacy Policy</button>
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



