
import React, { useState, useEffect, useMemo } from 'react';
import ThreeScene from './components/ThreeScene';
import Dashboard from './components/Dashboard';
import WalletPopout from './components/WalletPopout';
import WisdomNode from './components/AIChatbot';
import MyCourses from './components/MyCourses';
import ProvidersMarket from './components/ProvidersMarket';
import KnowledgePathways from './components/KnowledgePathways';
import CommunityMembers from './components/CommunityMembers';
import SocialLearningHub from './components/SocialLearningHub';
import ConsciousMeetings from './components/ConsciousMeetings';
import MusicBox from './components/MusicBox';
import { ConsciousIdentity } from './components/community/CommunityLayout';
import { AppView, UserProfile, Course } from './types';
import { NAVIGATION_ITEMS } from './constants';
import { 
  Shield, Brain, Menu, X, Search, Bell, Settings, 
  ChevronRight, ChevronDown, Wallet, LogIn, Home, LogOut, Compass, UserCircle, Building2, CheckCircle2, Sparkles, Key, Video
} from 'lucide-react';
import logo from './assets/brand/logo.png';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.ENTRY);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);
  const [isSigninModalOpen, setSigninModalOpen] = useState(false);
  const [isWalletOpen, setWalletOpen] = useState(false);
  const [isAiOpen, setAiOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('Free / Community');
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [error, setError] = useState('');

  const [isConnectDropdownOpen, setConnectDropdownOpen] = useState(false);
  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

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

    const savedUser = localStorage.getItem('hcn_active_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setCurrentView(AppView.DASHBOARD);
    }
    const savedCourses = localStorage.getItem('hcn_enrolled_courses');
    if (savedCourses) setEnrolledCourses(JSON.parse(savedCourses));
  }, []);

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
    setUser(null);
    setCurrentView(AppView.DASHBOARD);
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const existingProfiles: UserProfile[] = JSON.parse(localStorage.getItem('hcn_profiles') || '[]');
    const foundUser = existingProfiles.find(p => p.email === emailInput.toLowerCase());
    if (foundUser) {
      const inputHash = await hashPassword(passwordInput);
      if (foundUser.passwordHash === inputHash) {
        localStorage.setItem('hcn_active_user', JSON.stringify(foundUser));
        setUser(foundUser);
        closeModals();
        setCurrentView(AppView.DASHBOARD);
        if (window.innerWidth >= 1024) setSidebarOpen(true);
      } else setError('Invalid credentials.');
    } else setError('Invalid credentials.');
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordInput !== confirmPasswordInput) { setError('Passwords match error.'); return; }
    
    const identityName = emailInput.split('@')[0];
    const passwordHash = await hashPassword(passwordInput);

    const newUser: UserProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: identityName,
      email: emailInput.toLowerCase(),
      passwordHash: passwordHash,
      tier: selectedTier,
      identityVerified: true,
      reputationScore: 100,
      walletBalanceTokens: 200, // Seed with some tokens for testing
      createdAt: new Date().toISOString(),
      hasProfile: false
    };

    const existingProfiles: UserProfile[] = JSON.parse(localStorage.getItem('hcn_profiles') || '[]');
    existingProfiles.push(newUser);
    localStorage.setItem('hcn_profiles', JSON.stringify(existingProfiles));
    localStorage.setItem('hcn_active_user', JSON.stringify(newUser));
    setUser(newUser);
    closeModals();
    setCurrentView(AppView.DASHBOARD);
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem('hcn_active_user');
    setUser(null);
    setCurrentView(AppView.ENTRY);
    setSidebarOpen(false);
  };

  const hashPassword = async (p: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(p);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const closeModals = () => {
    setSignupModalOpen(false); setSigninModalOpen(false);
    setError(''); setEmailInput(''); setPasswordInput(''); setConfirmPasswordInput('');
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
    setUser(updated);
    localStorage.setItem('hcn_active_user', JSON.stringify(updated));
  };

  const renderActiveView = () => {
    switch (currentView) {
      case AppView.DASHBOARD: 
        return <Dashboard user={user} onEnroll={enrollCourse} />;
      case AppView.CONSCIOUS_SOCIAL_LEARNING:
        return <SocialLearningHub user={user} />;
      case AppView.CONSCIOUS_MEETINGS:
        return <ConsciousMeetings user={user} onUpdateUser={updateActiveUser} />;
      case AppView.MY_CONSCIOUS_IDENTITY: 
        return (
          <ConsciousIdentity 
            user={user} 
            enrolledCourses={enrolledCourses}
            onComplete={(p) => {
              if (user) {
                const updated = { ...user, ...p, hasProfile: true };
                updateActiveUser(updated);
              }
            }}
            onSignOut={handleSignOut}
            onGoBack={() => setCurrentView(AppView.DASHBOARD)}
            onSignInPrompt={() => setSigninModalOpen(true)}
          />
        );
      case AppView.MY_COURSES: 
        return <MyCourses enrolledCourses={enrolledCourses} onNavigateToUniversity={() => setCurrentView(AppView.KNOWLEDGE_PATHWAYS)} />;
      case AppView.PROVIDERS:
        return <ProvidersMarket />;
      case AppView.MEMBERSHIP:
        return <CommunityMembers />;
      case AppView.AI_CONSULT:
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="glass-panel p-12 rounded-[3rem] text-center max-w-2xl border-blue-500/20 shadow-2xl">
              <Sparkles className="w-16 h-16 text-blue-400 mx-auto mb-6 animate-pulse" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">The Wisdom Node</h2>
              <p className="text-slate-400 leading-relaxed font-light mb-8">
                Access multimodal intelligence designed to expand your consciousness. From deep reasoning to real-time search and visualization synthesis.
              </p>
              <button 
                onClick={() => setAiOpen(true)}
                className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl"
              >
                Open Interface
              </button>
            </div>
          </div>
        );
      case AppView.KNOWLEDGE_PATHWAYS:
        return <KnowledgePathways onGoBack={() => setCurrentView(AppView.MY_COURSES)} onEnroll={enrollCourse} />;
      default: 
        return <Dashboard user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 selection:bg-blue-500/30 flex relative">
      <ThreeScene />
      <MusicBox />

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
              <img src={logo} alt="Conscious Network Hub Logo" className="h-20 w-auto mx-auto mb-4" />
              <div className="flex justify-center">
                <div className="p-4 sm:p-6 bg-blue-600/10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-blue-500/20 backdrop-blur-3xl shadow-[0_0_30px_rgba(37,99,235,0.2)] animate-pulse">
                  <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-blue-400" />
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
                <div className="relative">
                  <button 
                    onClick={() => setConnectDropdownOpen(!isConnectDropdownOpen)}
                    onBlur={() => setTimeout(() => setConnectDropdownOpen(false), 100)}
                    className="group relative px-6 py-3 bg-transparent hover:bg-white/5 text-blue-300 hover:text-blue-200 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border border-blue-500/20 hover:border-blue-400/40"
                    aria-haspopup="true"
                    aria-expanded={isConnectDropdownOpen}
                  >
                    Connect with us <ChevronDown className={`w-4 h-4 transition-transform ${isConnectDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isConnectDropdownOpen && (
                    <div className="absolute top-full mt-2 w-80 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-6 z-20">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-white font-semibold mb-2">Local</h4>
                          <ul className="text-slate-400 text-sm space-y-1">
                            <li>• Partnerships</li>
                            <li>• Providers</li>
                            <li>• Institutions</li>
                            <li>• Community</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-2">National</h4>
                          <ul className="text-slate-400 text-sm space-y-1">
                            <li>• Partnerships</li>
                            <li>• Providers</li>
                            <li>• Institutions</li>
                            <li>• Community</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-2">International</h4>
                          <ul className="text-slate-400 text-sm space-y-1">
                            <li>• Partnerships</li>
                            <li>• Providers</li>
                            <li>• Institutions</li>
                            <li>• Community</li>
                          </ul>
                        </div>
                        <button 
                          onClick={() => { setContactModalOpen(true); setConnectDropdownOpen(false); }}
                          className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                        >
                          Get in Touch
                        </button>
                      </div>
                    </div>
                  )}
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
          <div className="min-h-screen p-4 sm:p-6 md:p-8 lg:p-12 xl:p-20 overflow-y-auto custom-scrollbar animate-in fade-in duration-700 relative z-10">
            <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10 md:space-y-12">
              <button onClick={handleGoHome} className="flex items-center gap-2 sm:gap-3 text-slate-500 hover:text-white transition-colors group">
                <Home className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="font-bold uppercase tracking-[0.4em] text-[9px] sm:text-[10px]">Portal Entry</span>
              </button>
              
              <div className="text-center space-y-3 sm:space-y-4">
                <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter">Membership Access</h2>
                <p className="text-slate-400 text-sm sm:text-base md:text-lg font-light px-2 sm:px-0">Select your level of integration within the decentralized ecosystem.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
                {TIERS.map((tier) => (
                  <div key={tier.name} className={`glass-panel p-10 rounded-[2.5rem] border-white/5 hover:border-${tier.color}-500/30 transition-all flex flex-col justify-between group shadow-2xl relative overflow-hidden border-t-4 border-t-${tier.color}-500/20`}>
                    <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-${tier.color}-400`}><Shield className="w-24 h-24" /></div>
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tighter">{tier.name}</h3>
                        <span className={`px-4 py-1.5 bg-${tier.color}-500/20 text-${tier.color}-400 rounded-full text-[10px] font-black whitespace-nowrap tracking-widest`}>{tier.price}</span>
                      </div>
                      <p className="text-blue-400/60 text-[9px] font-black uppercase tracking-[0.3em] mb-8">Sovereign Node Package</p>
                      
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-slate-300 text-sm leading-relaxed font-light">{tier.description}</p>
                        </div>
                        <div>
                          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Level</h4>
                          <div className="flex items-center gap-3 text-white text-xs font-medium">
                            <CheckCircle2 className={`w-4 h-4 text-${tier.color}-400 shrink-0`} />
                            {tier.access}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Ideal For</h4>
                          <p className="text-slate-400 text-[11px] italic font-light">{tier.ideal}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setSelectedTier(tier.name); setSignupModalOpen(true); }}
                      className={`mt-10 w-full py-5 bg-white/5 hover:bg-${tier.color}-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl border border-white/5 hover:border-${tier.color}-500/50`}
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
                  {NAVIGATION_ITEMS.map((item) => {
                    const viewMap: any = {
                      'dashboard': AppView.DASHBOARD,
                      'social-learning': AppView.CONSCIOUS_SOCIAL_LEARNING,
                      'meetings': AppView.CONSCIOUS_MEETINGS,
                      'my-courses': AppView.MY_COURSES,
                      'providers': AppView.PROVIDERS,
                      'ai-consult': AppView.AI_CONSULT,
                      'profile': AppView.MY_CONSCIOUS_IDENTITY,
                      'membership': AppView.MEMBERSHIP,
                    };
                    const isActive = currentView === viewMap[item.id];
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (viewMap[item.id]) {
                            setCurrentView(viewMap[item.id]);
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
                    onClick={() => { setWalletOpen(true); closeSidebarOnMobile(); }} 
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
                </div>
                
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                  <button className="p-3 hover:bg-white/5 rounded-xl text-slate-500 relative transition-colors">
                    <Bell className="w-5 h-5" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black"></div>
                  </button>
                  <div className="h-8 w-px bg-white/10 mx-2 hidden md:block"></div>
                  <button onClick={() => { setCurrentView(AppView.MY_CONSCIOUS_IDENTITY); closeSidebarOnMobile(); }} className="flex items-center gap-4 pl-3 pr-6 py-2 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center font-black text-sm text-white shadow-xl">
                      {user ? user.name.charAt(0).toUpperCase() : 'G'}
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
            </div>
          </div>
        )}

        <WalletPopout isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} />
        <WisdomNode isOpen={isAiOpen} onClose={() => setAiOpen(false)} />

        {(isSignupModalOpen || isSigninModalOpen) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-12 rounded-[3rem] relative animate-in zoom-in duration-300 border-blue-500/20">
              <button onClick={closeModals} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
              <h3 className="text-3xl font-black mb-10 text-white uppercase tracking-tighter">{isSigninModalOpen ? 'Sync Node' : 'Initialize Identity'}</h3>
              <form onSubmit={isSigninModalOpen ? handleSignIn : handleCreateProfile} className="space-y-6">
                {error && <p className="text-red-400 text-[10px] bg-red-400/10 p-4 rounded-xl border border-red-400/20 uppercase tracking-widest font-black">{error}</p>}
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Node Identifier</label>
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="email@nexus.node" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Secure Passkey</label>
                  <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="••••••••" />
                </div>
                {!isSigninModalOpen && (
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Verify Key</label>
                    <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-sm" required placeholder="••••••••" />
                  </div>
                )}
                <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 mt-6">
                  {isSigninModalOpen ? 'Initialize Session' : 'Create Identity Hash'}
                </button>
              </form>
              <div className="mt-8 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest">
                {isSigninModalOpen ? "New Node?" : "Already Anchored?"}
                <button onClick={() => { setSigninModalOpen(!isSigninModalOpen); setSignupModalOpen(!isSignupModalOpen); setError(''); }} className="ml-2 text-blue-400 hover:underline">
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

        {(currentView !== AppView.ENTRY && currentView !== AppView.MEMBERSHIP_ACCESS) && (
          <button 
            onClick={() => setAiOpen(true)}
            className="fixed bottom-10 right-10 z-[100] w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-[0_15px_40px_rgba(37,99,235,0.4)] flex items-center justify-center transition-all hover:-translate-y-2 group active:scale-95 border-b-4 border-blue-800"
          >
            <Sparkles className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-400 rounded-full border-2 border-black"></div>
          </button>
        )}
      </div>
    </div>
  );
};

export default App;


