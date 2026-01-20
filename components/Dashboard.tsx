
import React, { useState, useEffect } from 'react';
import { Search, Bell, ShieldCheck, TrendingUp, Users, ExternalLink, PlayCircle, BookOpen, Layers, Globe, Plus, Target, Rocket, BarChart3, HeartHandshake, HelpCircle, AlertTriangle, CheckCircle, XCircle, Send, MessageSquare } from 'lucide-react';
import { CORE_COMPONENTS } from '../constants';
// Fixed: Changed getEthicalAIAdvice to getWisdomSearch as getEthicalAIAdvice is not exported from geminiService
import { getWisdomSearch, GroundingChunk } from '../services/geminiService';
import { getHCNKnowledge, buildHCNSystemContext, isQuestionInScope, getClosedKnowledgeResponse } from '../services/hcnKnowledge';
import { UserProfile, Course } from '../types';

interface DashboardProps {
  user?: UserProfile | null;
  onEnroll?: (course: Course) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onEnroll }) => {
  const [assistantTab, setAssistantTab] = useState<'help' | 'support'>('help');
  const [aiMessage, setAiMessage] = useState<string>("Welcome to Conscious Network Hub. How can I help you navigate the platform?");
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{question: string, answer: string, timestamp: string}>>([]);
  const [hcnKnowledge, setHcnKnowledge] = useState<any>(null);
  
  // System status (mock for now)
  const [systemStatus, setSystemStatus] = useState({
    online: true,
    services: {
      database: 'healthy',
      api: 'healthy', 
      meetings: 'healthy',
      payments: 'degraded'
    }
  });

  // Support ticket state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    category: '',
    description: '',
    screenshot: null as File | null
  });

  // Load HCN knowledge
  useEffect(() => {
    const loadHCNKnowledge = async () => {
      const knowledge = await getHCNKnowledge();
      setHcnKnowledge(knowledge);
    };
    loadHCNKnowledge();
  }, []);

  // Load persisted assistant state
  useEffect(() => {
    const savedTab = localStorage.getItem('portal_assistant_tab');
    const savedMessage = localStorage.getItem('portal_assistant_message');
    const savedHistory = localStorage.getItem('portal_assistant_history');
    if (savedTab) setAssistantTab(savedTab as 'help' | 'support');
    if (savedMessage) setAiMessage(savedMessage);
    if (savedHistory) setConversationHistory(JSON.parse(savedHistory));
  }, []);

  // Save assistant state
  useEffect(() => {
    localStorage.setItem('portal_assistant_tab', assistantTab);
    localStorage.setItem('portal_assistant_message', aiMessage);
    localStorage.setItem('portal_assistant_history', JSON.stringify(conversationHistory));
  }, [assistantTab, aiMessage, conversationHistory]);

  // Auto-refresh system data
  useEffect(() => {
    const refreshData = () => {
      // Mock system status updates
      setSystemStatus(prev => ({
        ...prev,
        services: {
          ...prev.services,
          // Randomly change status for demo
          payments: Math.random() > 0.8 ? 'degraded' : 'healthy'
        }
      }));
    };

    const interval = setInterval(refreshData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAskQuestion = async () => {
    if (!userQuestion.trim()) return;
    
    setLoading(true);
    try {
      // RBAC Check
      const userRole = user?.tier || 'Guest';
      const isProvider = user?.tier === 'Provider' || user?.tier === 'Accelerated Tier';
      const isAdmin = user?.tier === 'Admin'; // Mock admin check
      
      // Audit logging
      const auditLog = {
        userId: user?.id || 'guest',
        role: userRole,
        timestamp: new Date().toISOString(),
        action: 'assistant_query',
        question: userQuestion,
        source: 'platform_help'
      };
      console.log('Audit Log:', auditLog);
      
      // Check if question is in scope for platform help
      const inScope = isQuestionInScope(userQuestion, hcnKnowledge);
      
      if (!inScope) {
        setAiMessage("I can only answer questions about Conscious Network Hub and the information it provides. For topics outside the platform, please use the Explore Learning section (if available) or ask a provider.");
      } else {
        // Role-based response filtering
        let contextPrompt = userQuestion;
        
        if (userRole === 'Guest') {
          contextPrompt += " (Respond with general platform information only, no personal data)";
        } else if (isProvider) {
          contextPrompt += " (Include provider-specific features and scheduling help)";
        } else if (isAdmin) {
          contextPrompt += " (Include system administration context)";
        }
        
        // Use platform knowledge only
        const systemContext = buildHCNSystemContext(hcnKnowledge);
        const result = await getWisdomSearch(`${contextPrompt}. Answer using only Conscious Network Hub platform knowledge.`);
        const answer = result.text || "I'm having trouble accessing the knowledge base right now.";
        setAiMessage(answer);
        setSources(result.groundingChunks || []);
        
        // Add to conversation history
        const newEntry = {
          question: userQuestion,
          answer,
          timestamp: new Date().toISOString()
        };
        setConversationHistory(prev => [newEntry, ...prev.slice(0, 9)]); // Keep last 10
      }
    } catch (error) {
      setAiMessage("Unable to process your question. Please try again.");
    }
    setLoading(false);
    setUserQuestion('');
  };

  const handleReportIssue = async () => {
    // Create ticket
    const ticket = {
      id: Date.now().toString(),
      userId: user?.id || 'guest',
      userName: user?.name || 'Guest',
      category: ticketForm.category,
      description: ticketForm.description,
      screenshot: ticketForm.screenshot?.name || null,
      timestamp: new Date().toISOString(),
      status: 'open',
      route: window.location.pathname,
      browser: navigator.userAgent,
      device: navigator.platform
    };

    // Store ticket (in real app, send to backend)
    const existingTickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    existingTickets.push(ticket);
    localStorage.setItem('support_tickets', JSON.stringify(existingTickets));

    // Audit log
    const auditLog = {
      userId: user?.id || 'guest',
      role: user?.tier || 'Guest',
      timestamp: new Date().toISOString(),
      action: 'create_support_ticket',
      ticketId: ticket.id,
      category: ticketForm.category
    };
    console.log('Audit Log:', auditLog);

    alert('Issue reported successfully! We will get back to you soon.');
    setIsReportModalOpen(false);
    setTicketForm({ category: '', description: '', screenshot: null });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'down': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
  };

  return (
    <>
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Welcome Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group shadow-2xl border-blue-500/10">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
             <ShieldCheck className="w-48 h-48 text-blue-400" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tighter uppercase leading-none">PROTOCOL ACTIVE, <span className="text-blue-400">{user?.name || 'SOVEREIGN'}</span></h1>
            <p className="text-blue-200/60 mb-8 text-lg max-w-2xl leading-relaxed font-light">
              Your decentralized identity node is secure. Accessing {user?.tier || 'Explore'} level knowledge layers.
            </p>
            
            <div className="bg-blue-900/20 border border-blue-500/10 p-6 rounded-[1.5rem] shadow-inner backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400">Portal Assistant</span>
                </div>
                <div className="flex bg-white/5 rounded-lg p-1">
                  <button 
                    onClick={() => setAssistantTab('help')}
                    className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded transition-all ${assistantTab === 'help' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Platform Help
                  </button>
                  <button 
                    onClick={() => setAssistantTab('support')}
                    className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded transition-all ${assistantTab === 'support' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    System & Support
                  </button>
                </div>
              </div>
              
              {assistantTab === 'help' ? (
                <div className="space-y-4">
                  <p className="text-slate-200 leading-relaxed text-sm font-light">
                    {aiMessage}
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="Ask about the platform..."
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <button 
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-all"
                      title="View conversation history"
                    >
                      📚
                    </button>
                    <button 
                      onClick={handleAskQuestion}
                      disabled={loading || !userQuestion.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {loading && <div className="text-xs text-slate-400">Processing...</div>}
                  
                  {!loading && sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-black">Sources:</span>
                      {sources.slice(0, 3).map((s, idx) => s.web && (
                        <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded transition-all">
                          {s.web.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-xs text-slate-300">System Status</span>
                      {systemStatus.online ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-xs text-slate-300">Database</span>
                      {getStatusIcon(systemStatus.services.database)}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-xs text-slate-300">API</span>
                      {getStatusIcon(systemStatus.services.api)}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-xs text-slate-300">Meetings</span>
                      {getStatusIcon(systemStatus.services.meetings)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>• Recording is enabled only if all participants consent.</p>
                    <p>• Your calendar is private. Only you can view full availability.</p>
                    <p>• Tokens/wallet usage requires confirmation.</p>
                    <p>• Community guidelines apply in sessions and chat.</p>
                  </div>
                  
                  <button 
                    onClick={() => setIsReportModalOpen(true)}
                    className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Report an Issue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col justify-between border-blue-500/10 shadow-2xl">
          <div>
            <h3 className="text-sm font-black mb-8 flex items-center gap-3 uppercase tracking-widest">
              <TrendingUp className="text-teal-400 w-5 h-5" /> Network Integrity
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Active Nodes', value: '14,202' },
                { label: 'Sovereign Providers', value: '842' },
                { label: 'Reputation Score', value: `${user?.reputationScore || 100} PTS` }
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                  <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">{stat.label}</span>
                  <span className="text-white font-mono text-base font-bold">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="mt-8 w-full py-4 bg-gradient-to-r from-blue-600/10 to-blue-600/20 hover:from-blue-600/30 hover:to-blue-600/40 border border-blue-500/30 text-blue-100 rounded-xl font-black transition-all shadow-xl text-[10px] uppercase tracking-[0.3em]">
            Manage Reputation
          </button>
        </div>
      </section>

      {/* Strategic Protocol */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <Target className="w-7 h-7 text-blue-400" />
          <h2 className="text-xl font-black text-white tracking-widest uppercase">STRATEGIC PROTOCOL</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-10 rounded-[2.5rem] border-l-4 border-blue-500 shadow-2xl">
            <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-6">MISSION STATEMENT</h3>
            <p className="text-lg font-light text-slate-300 leading-relaxed italic opacity-80">
              "Higher Conscious Network exists to empower individuals, providers, and institutions with ethical technology that restores autonomy, protects identity, and creates equitable economic opportunity through a community-centered decentralized social learning infrastructure."
            </p>
          </div>
          <div className="glass-panel p-10 rounded-[2.5rem] border-l-4 border-teal-500 shadow-2xl">
            <h3 className="text-[9px] font-black text-teal-400 uppercase tracking-[0.4em] mb-6">VISION STATEMENT</h3>
            <p className="text-lg font-light text-slate-300 leading-relaxed italic opacity-80">
              "We envision a global, community-centered ecosystem where data ownership, economic mobility, and values-aligned human development are accessible to all—especially those historically excluded from the digital and economic landscape."
            </p>
          </div>
        </div>

        {/* Conscious Careers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 glass-panel p-10 rounded-[2.5rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <Rocket className="w-7 h-7 text-orange-400" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Conscious Careers: Entrepreneurship</h3>
            </div>
            <p className="text-slate-400 leading-relaxed text-base font-light">
              Designed to help individuals and providers pursue business ownership. Through partnerships like Entrepreneurs Resource, members gain access to franchising and business matching. A dedicated 5% revenue savings fund provides grants to engaged participants, supported by SBDCs to promote long-term success.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <h4 className="font-black text-white text-xs uppercase tracking-widest mb-3 flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blue-400" /> Minority Empowerment</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Equipping mission-driven providers with secure, outcomes-based revenue models and IP protection.</p>
              </div>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                <h4 className="font-black text-white text-xs uppercase tracking-widest mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-teal-400" /> Community Resilience</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Scaling minority entrepreneurship to build sustainable digital businesses without algorithmic suppression.</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[2.5rem] border-white/5 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
              <BarChart3 className="w-7 h-7 text-purple-400" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Impact KPIs</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Provider income growth",
                "Minority provider retention",
                "Well-being improvements",
                "Grant distribution totals",
                "Entrepreneurship placements"
              ].map((kpi, i) => (
                <li key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border border-white/5 group hover:bg-white/10 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 group-hover:scale-150 transition-transform"></div>
                  {kpi}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Ecosystem Layers */}
      <section>
        <h2 className="text-xl font-black mb-8 flex items-center gap-3 uppercase tracking-widest">
          <Layers className="text-blue-400 w-7 h-7" /> Ecosystem Components
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CORE_COMPONENTS.map((comp, idx) => (
            <div key={idx} className="glass-panel p-8 rounded-[2rem] border-t-2 border-blue-500/20 hover:bg-blue-900/10 transition-all cursor-pointer group shadow-2xl hover:-translate-y-2">
              <div className="bg-blue-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                {comp.icon}
              </div>
              <h4 className="text-sm font-black mb-3 text-white uppercase tracking-tight leading-tight">{comp.title}</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed font-light">{comp.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>

    {/* Report Issue Modal */}
    {isReportModalOpen && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="glass-panel max-w-md w-full p-6 rounded-[2rem] border-blue-500/20 shadow-2xl">
          <h3 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">Report an Issue</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({...ticketForm, category: e.target.value})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="">Select category</option>
                <option value="login">Login</option>
                <option value="profile">Profile</option>
                <option value="scheduling">Scheduling</option>
                <option value="video">Video</option>
                <option value="billing">Billing</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
              <textarea
                value={ticketForm.description}
                onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              />
            </div>
            
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Screenshot (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTicketForm({...ticketForm, screenshot: e.target.files?.[0] || null})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg font-medium text-sm transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleReportIssue}
              disabled={!ticketForm.category || !ticketForm.description.trim()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg font-medium text-sm transition-all"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Conversation History Modal */}
    {isHistoryModalOpen && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="glass-panel max-w-lg w-full p-6 rounded-[2rem] border-blue-500/20 shadow-2xl max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">Conversation History</h3>
          
          {conversationHistory.length === 0 ? (
            <p className="text-slate-400 text-sm">No conversation history yet.</p>
          ) : (
            <div className="space-y-4">
              {conversationHistory.map((entry, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-2">{new Date(entry.timestamp).toLocaleString()}</div>
                  <div className="text-sm text-blue-400 font-medium mb-1">Q: {entry.question}</div>
                  <div className="text-sm text-slate-300">A: {entry.answer}</div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end mt-6">
            <button 
              onClick={() => setIsHistoryModalOpen(false)}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  </>
);

export default Dashboard;
