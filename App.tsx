
import React, { useState, useEffect } from 'react';
import ThreeScene from './components/ThreeScene';
import Dashboard from './components/Dashboard';
import WalletPopout from './components/WalletPopout';
import AIChatbot from './components/AIChatbot';
import MyCourses from './components/MyCourses';
import { ConsciousIdentity } from './components/community/CommunityLayout';
import { AppView, UserProfile, Course } from './types';
import { NAVIGATION_ITEMS } from './constants';
import { 
  Shield, Brain, Menu, X, Search, Bell, Settings, 
  ChevronRight, Wallet, LogIn, Home, LogOut, Compass, UserCircle, Building2, CheckCircle2
} from 'lucide-react';

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
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [error, setError] = useState('');

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
    if (window.innerWidth >= 1024) setSidebarOpen(true);

    const savedUser = localStorage.getItem('hcn_active_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setCurrentView(AppView.DASHBOARD);
    }
    const savedCourses = localStorage.getItem('hcn_enrolled_courses');
    if (savedCourses) setEnrolledCourses(JSON.parse(savedCourses));
  }, []);

  const handleEnterHub = () => setCurrentView(AppView.MEMBERSHIP_ACCESS);
  const handleGoHome = () => setCurrentView(AppView.ENTRY);
  
  const handleExploreAsGuest = () => {
    setUser(null);
    setCurrentView(AppView.DASHBOARD);
    setSidebarOpen(window.innerWidth >= 1024);
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

  const renderActiveView = () => {
    switch (currentView) {
      case AppView.DASHBOARD: 
        return <Dashboard user={user} onEnroll={c => { setEnrolledCourses([...enrolledCourses, c]); setCurrentView(AppView.MY_COURSES); }} />;
      case AppView.MY_CONSCIOUS_IDENTITY: 
        return (
          <ConsciousIdentity 
            user={user} 
            enrolledCourses={enrolledCourses}
            onComplete={(p) => {
              if (user) {
                const updated = { ...user, ...p, hasProfile: true };
                setUser(updated);
                localStorage.setItem('hcn_active_user', JSON.stringify(updated));
              }
            }}
            onSignOut={handleSignOut}
            onGoBack={() => setCurrentView(AppView.DASHBOARD)}
            onSignInPrompt={() => setSigninModalOpen(true)}
          />
        );
      case AppView.MY_COURSES: 
        return <MyCourses enrolledCourses={enrolledCourses} onNavigateToUniversity={() => setCurrentView(AppView.DASHBOARD)} />;
      default: 
        return <Dashboard user={user} />;
    }
  };

  if (currentView === AppView.ENTRY) {
    return (
      <div className="min-h-screen bg-[#05070a] text-slate-200 overflow-hidden relative">
        <ThreeScene />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="flex justify-center">
              <div className="p-5 bg-blue-600/20 rounded-[2rem] border border-blue-500/30 backdrop-blur-2xl shadow-2xl">
                <Shield className="w-14 h-14 text-blue-400" />
              </div>
            </div>
            <h1 className="text-6xl sm:text-9xl font-bold text-white tracking-tighter leading-none">
              CONSCIOUS <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 uppercase">Network Hub</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed font-light">
              Restoring autonomy and protecting identity through a community-centered decentralized social learning infrastructure.
            </p>
            <div className="flex justify-center pt-8">
              <button 
                onClick={handleEnterHub}
                className="px-20 py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-bold text-3xl transition-all shadow-[0_0_50px_rgba(37,99,235,0.4)] hover:-translate-y-2 active:scale-95 flex items-center gap-4"
              >
                Enter the Hub <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === AppView.MEMBERSHIP_ACCESS) {
    return (
      <div className="min-h-screen bg-[#05070a] text-slate-200 p-6 sm:p-12 lg:p-20 relative overflow-hidden">
        <ThreeScene />
        <div className="relative z-10 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
          <button onClick={handleGoHome} className="flex items-center gap-3 text-slate-500 hover:text-white transition-colors group">
            <Home className="w-5 h-5" /> <span className="font-bold uppercase tracking-[0.3em] text-[10px]">Portal Entry</span>
          </button>
          
          <div className="text-center space-y-4">
            <h2 className="text-5xl sm:text-7xl font-bold text-white tracking-tight">Membership Access</h2>
            <p className="text-slate-400 text-xl font-light">Select your level of integration within the decentralized ecosystem.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`glass-panel p-10 rounded-[3rem] border-white/5 hover:border-${tier.color}-500/30 transition-all flex flex-col justify-between group shadow-2xl relative overflow-hidden border-t-4 border-t-${tier.color}-500/20`}>
                <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-${tier.color}-400`}><Shield className="w-24 h-24" /></div>
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-3xl font-bold text-white leading-tight">{tier.name}</h3>
                    <span className={`px-4 py-1.5 bg-${tier.color}-500/20 text-${tier.color}-400 rounded-full text-xs font-bold whitespace-nowrap`}>{tier.price}</span>
                  </div>
                  <p className="text-blue-400/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Sovereign Node Package</p>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Description</h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{tier.description}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Access Level</h4>
                      <div className="flex items-center gap-2 text-white text-sm font-medium">
                        <CheckCircle2 className={`w-4 h-4 text-${tier.color}-400`} />
                        {tier.access}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ideal For</h4>
                      <p className="text-slate-400 text-xs italic">{tier.ideal}</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedTier(tier.name); setSignupModalOpen(true); }}
                  className={`mt-10 w-full py-5 bg-white/5 hover:bg-${tier.color}-600 text-white rounded-2xl font-bold transition-all shadow-xl border border-white/5 hover:border-${tier.color}-500/50`}
                >
                  Anchor as {tier.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
            <div className="glass-panel p-10 rounded-[3rem] flex flex-col sm:flex-row items-center justify-between gap-8 border-l-8 border-cyan-500 shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-cyan-500/10 rounded-3xl">
                  <Building2 className="w-10 h-10 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-white leading-none">Institutional / Organizational Plan</h4>
                  <p className="text-[10px] text-cyan-400/60 font-bold uppercase tracking-widest mt-2 mb-3">Enterprise Leadership</p>
                  <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                    Organization-wide leadership development, emotional resilience, and specialized provider cohorts.
                  </p>
                  <p className="text-[10px] text-slate-500 italic mt-2">For Corporations, Ministries, Nonprofits, Schools.</p>
                </div>
              </div>
              <button 
                onClick={() => window.open('https://calendly.com/randycofield/buildingconnections', '_blank')}
                className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold transition-all whitespace-nowrap shadow-lg flex items-center gap-2 group"
              >
                Contact <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="glass-panel p-10 rounded-[3rem] flex flex-col sm:flex-row items-center justify-between gap-8 border-l-8 border-orange-500 shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-orange-500/10 rounded-3xl">
                  <Compass className="w-10 h-10 text-orange-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-white">Explore Platform</h4>
                  <p className="text-[10px] text-orange-400/60 font-bold uppercase tracking-widest mt-2 mb-3">Guest Access</p>
                  <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                    View the hub as a guest node without a profile. Limited observation only.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleExploreAsGuest}
                className="px-10 py-4 bg-orange-600/10 hover:bg-orange-600 text-orange-200 rounded-2xl font-bold border border-orange-500/30 transition-all flex items-center gap-2 group shadow-xl"
              >
                Browse Hub <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Auth Modals */}
        {(isSignupModalOpen || isSigninModalOpen) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <div className="glass-panel w-full max-w-md p-12 rounded-[4rem] relative animate-in zoom-in duration-300 border-blue-500/20">
              <button onClick={closeModals} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
              <h3 className="text-4xl font-bold mb-8 text-white">{isSigninModalOpen ? 'Sync Session' : 'Anchor Identity'}</h3>
              <form onSubmit={isSigninModalOpen ? handleSignIn : handleCreateProfile} className="space-y-6">
                {error && <p className="text-red-400 text-xs bg-red-400/10 p-4 rounded-2xl border border-red-400/20">{error}</p>}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Node Identifier</label>
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" required placeholder="Email Address" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Secure Passkey</label>
                  <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" required placeholder="Password" />
                </div>
                {!isSigninModalOpen && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Verify Key</label>
                    <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" required placeholder="Confirm Password" />
                  </div>
                )}
                <button type="submit" className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-bold text-xl transition-all shadow-2xl shadow-blue-900/40 mt-8">
                  {isSigninModalOpen ? 'Connect Node' : 'Initialize Identity'}
                </button>
              </form>
              <div className="mt-8 text-center text-slate-500 font-medium">
                {isSigninModalOpen ? "New to the hub?" : "Already anchored?"}
                <button onClick={() => { setSigninModalOpen(!isSigninModalOpen); setSignupModalOpen(!isSignupModalOpen); setError(''); }} className="ml-2 text-blue-400 font-bold hover:underline">
                  {isSigninModalOpen ? 'Create Identity' : 'Sign In'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-blue-500/30 flex overflow-hidden">
      <ThreeScene />

      {/* Responsive Toggleable Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[105] lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`fixed inset-y-0 left-0 z-[110] w-80 glass-panel border-r border-white/5 transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="h-full flex flex-col p-10">
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl text-slate-500"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-5 mb-16">
            <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-900/40">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tighter leading-tight uppercase">Conscious<br /><span className="text-blue-400 text-sm tracking-[0.2em]">Hub</span></h1>
            </div>
          </div>
          
          <nav className="flex-1 space-y-4">
            {NAVIGATION_ITEMS.map((item) => {
              const viewMap: any = {
                'dashboard': AppView.DASHBOARD,
                'my-courses': AppView.MY_COURSES,
                'profile': AppView.MY_CONSCIOUS_IDENTITY,
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
                  className={`w-full flex items-center gap-5 px-6 py-5 rounded-[2rem] transition-all group ${isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-900/10' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className={`${isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'} transition-colors`}>{item.icon}</span>
                  <span className="text-sm font-bold tracking-[0.2em] uppercase">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-10 border-t border-white/5 space-y-5">
            <button 
              onClick={() => { setWalletOpen(true); closeSidebarOnMobile(); }} 
              className="w-full flex items-center justify-between p-5 bg-blue-600/5 hover:bg-blue-600/10 rounded-3xl border border-blue-500/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <Wallet className="w-6 h-6 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Sovereign Vault</span>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handleSignOut} className="w-full flex items-center gap-4 px-6 py-5 text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-24 flex items-center justify-between px-8 sm:px-12 border-b border-white/5 z-20 backdrop-blur-2xl bg-black/10">
          <div className="flex items-center gap-6">
            {!isSidebarOpen && (
              <button onClick={toggleSidebar} className="lg:hidden p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 border border-white/10 shadow-lg">
                <Menu className="w-6 h-6" />
              </button>
            )}
            <div className="relative group hidden sm:block">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
              <input type="text" placeholder="Search knowledge layers..." className="pl-14 pr-8 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/30 w-80 transition-all font-medium" />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 relative transition-colors">
              <Bell className="w-6 h-6" />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-500 rounded-full ring-4 ring-[#05070a]"></div>
            </button>
            <div className="h-10 w-px bg-white/10 mx-2 hidden md:block"></div>
            <button onClick={() => { setCurrentView(AppView.MY_CONSCIOUS_IDENTITY); closeSidebarOnMobile(); }} className="flex items-center gap-4 pl-3 pr-6 py-2 hover:bg-white/5 rounded-3xl transition-all border border-transparent hover:border-white/5">
              <div className="w-10 h-10 rounded-[1rem] bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center font-bold text-lg text-white shadow-xl">
                {user ? user.name.charAt(0).toUpperCase() : 'G'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-bold text-white leading-none">{user?.name || 'Guest'}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em] mt-1">{user?.tier || 'Explore'} Access</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-8 sm:p-12 relative z-10">
          {renderActiveView()}
        </main>
      </div>

      <WalletPopout isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} user={user} />
      <AIChatbot isOpen={isAiOpen} onClose={() => setAiOpen(false)} />

      {/* Floating AI Trigger */}
      <button 
        onClick={() => setAiOpen(true)}
        className="fixed bottom-10 right-10 z-[100] w-20 h-20 bg-blue-600 hover:bg-blue-500 rounded-[2rem] shadow-[0_20px_60px_rgba(37,99,235,0.4)] flex items-center justify-center transition-all hover:-translate-y-3 group active:scale-95 border-b-4 border-blue-800"
      >
        <Brain className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-teal-400 rounded-full border-4 border-[#05070a]"></div>
      </button>
    </div>
  );
};

export default App;
