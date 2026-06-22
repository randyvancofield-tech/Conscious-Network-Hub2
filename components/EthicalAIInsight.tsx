import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Sparkles, Globe, X, Loader2, Flag, MessageSquare,
  ArrowRight, Heart, Copy, Download, Mic, TrendingUp,
  ThumbsUp, ThumbsDown, RefreshCw, Settings, BarChart3,
  CheckCircle
} from 'lucide-react';
import backendAPI, {
  askEthicalAI, getDailyWisdom, processPlatformIssue, generateSuggestedQuestions,
  getTrendingInsights, type EnhancedResponse, type GroundingChunk
} from '../services/backendApiService';
import { ApiError } from '../services/apiClient';
import { securityService } from '../services/securityService';
import { cacheService, ConversationEntry } from '../services/cacheService';
import { analyticsService } from '../services/analyticsService';
import { downloadTextFile } from '../services/downloadService';

interface EthicalAIInsightProps {
  userEmail?: string;
  userId?: string;
}

type ViewMode = 'insight' | 'qa' | 'report' | 'analytics';

interface MessageWithMeta extends ConversationEntry {
  confidenceScore?: number;
  processingTime?: number;
  suggestedQuestions?: string[];
  reactions?: { [key: string]: number };
}

const getActionableAiErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    const data = error.data as any;
    const code = typeof data?.code === 'string' ? data.code : '';

    if (error.status === 401) {
      return 'Your session has expired. Please sign in again to use Ethical AI Insight.';
    }

    if (error.status === 403) {
      return 'Complete your account setup, including free membership activation if prompted, then try Ethical AI Insight again.';
    }

    if (error.status === 503 || code === 'AI_PROVIDER_UNAVAILABLE') {
      return 'Ethical AI Insight is temporarily unavailable while the AI provider is being configured. Please try again shortly.';
    }

    return error.message || `Ethical AI Insight request failed with HTTP ${error.status}.`;
  }

  const message = error instanceof Error ? error.message : String(error || '');
  const lowered = message.toLowerCase();
  if (
    lowered.includes('failed to fetch') ||
    lowered.includes('networkerror') ||
    lowered.includes('cors')
  ) {
    return 'Unable to reach Ethical AI Insight. Check your connection and try again.';
  }

  return message || 'Ethical AI Insight is temporarily unavailable. Please try again.';
};

const clampGroundingScore = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value || 0)));
};

const getSourceLabel = (source: GroundingChunk): string => {
  const raw = source.web?.title || source.text || 'Platform reference';
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
};

const hasSourceLabel = (source: GroundingChunk): boolean =>
  Boolean((source.web?.title || source.text || '').trim());

const getVisibleSources = (sources?: GroundingChunk[]): GroundingChunk[] =>
  (sources || []).filter(hasSourceLabel).slice(0, 4);

const GroundingMeter: React.FC<{ score?: number }> = ({ score }) => {
  const value = clampGroundingScore(score);

  return (
    <div
      className="flex items-center gap-2 text-[7px] text-slate-400"
      title="Grounding estimate reflects provider confidence and available CNH context. It is not a factual guarantee."
    >
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-teal-400"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="uppercase tracking-widest">Grounding estimate: {value}%</span>
    </div>
  );
};

const SourceReferences: React.FC<{ sources?: GroundingChunk[] }> = ({ sources }) => {
  const visibleSources = getVisibleSources(sources);
  if (visibleSources.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-white/10 pt-2 text-[7px] text-slate-400">
      <div className="flex items-center gap-2">
        <Globe className="h-3 w-3 text-teal-400" />
        <span className="font-black uppercase tracking-[0.2em] text-slate-400">
          Grounding references ({visibleSources.length})
        </span>
      </div>
      <p className="leading-relaxed text-slate-500">
        Public or internal-safe CNH context labels. Private user data is not shown as a source.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visibleSources.map((source, idx) => {
          const label = getSourceLabel(source);
          if (source.web?.uri) {
            return (
              <a
                key={`${label}-${idx}`}
                href={source.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 font-bold uppercase tracking-widest text-blue-300 transition-all hover:border-blue-400/50 hover:text-blue-200"
              >
                <span className="min-w-0 truncate">{label}</span>
                <ArrowRight className="h-2 w-2 shrink-0" />
              </a>
            );
          }

          return (
            <span
              key={`${label}-${idx}`}
              className="min-w-0 rounded border border-white/10 bg-white/5 px-2 py-1 font-bold uppercase tracking-widest text-slate-300"
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const EthicalAIInsight: React.FC<EthicalAIInsightProps> = ({ userEmail, userId = 'default-user' }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('insight');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Daily Wisdom
  const [dailyWisdom, setDailyWisdom] = useState<EnhancedResponse | null>(null);
  const [wisdomLoading, setWisdomLoading] = useState(true);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [insightError, setInsightError] = useState('');
  const [trendingError, setTrendingError] = useState('');

  // Q&A
  const [qaMessages, setQaMessages] = useState<MessageWithMeta[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [selectedQACategory, setSelectedQACategory] = useState<'platform' | 'wellness' | 'general'>('general');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  const [voiceSupported] = useState(typeof (window as any).webkitSpeechRecognition !== 'undefined');

  // Report
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [reportError, setReportError] = useState('');

  // Analytics
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [engagementScore, setEngagementScore] = useState(0);

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const qaEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    analyticsService.setUserId(userId);
    cacheService.clearConversationHistory(userId);
    backendAPI.clearHistory(userId);
    loadConversationHistory();
  }, [userId]);

  useEffect(() => {
    loadDailyWisdom();
    loadTrendingTopics();
  }, []);

  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages]);

  const loadConversationHistory = () => {
    const history = cacheService.getConversationHistory(userId);
    if (history.length > 0) {
      setQaMessages(history as MessageWithMeta[]);
    }
  };

  const loadDailyWisdom = async () => {
    setWisdomLoading(true);
    setInsightError('');
    try {
      const wisdom = await getDailyWisdom();
      setDailyWisdom(wisdom);
    } catch (error) {
      console.error('Error loading wisdom:', error);
      const message = getActionableAiErrorMessage(error);
      setInsightError(message);
      setDailyWisdom({
        text: message,
        groundingChunks: [],
        confidenceScore: 0,
        sourceCount: 0,
        processingTimeMs: 0,
      });
    } finally {
      setWisdomLoading(false);
    }
  };

  const loadTrendingTopics = async () => {
    setTrendingError('');
    try {
      const insights = await getTrendingInsights();
      setTrendingTopics(insights.topics);
    } catch (error) {
      console.error('Error loading trending:', error);
      setTrendingTopics([]);
      setTrendingError(getActionableAiErrorMessage(error));
    }
  };

  const handleQASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;

    const rateLimitCheck = securityService.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      setInsightError(`Rate limited. Wait ${Math.ceil(rateLimitCheck.resetIn / 1000)}s before asking again.`);
      return;
    }

    const sanitized = securityService.sanitizeInput(qaInput, 5000);
    const suspicious = securityService.detectSuspiciousInput(sanitized);
    if (suspicious.suspicious) {
      setInsightError('Suspicious input detected. Please rephrase.');
      return;
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: sanitized,
      timestamp: Date.now()
    };

    setQaInput('');
    setQaMessages(prev => [...prev, userMessage]);
    cacheService.addConversationEntry(userId, {
      id: userMessage.id,
      role: 'user',
      content: userMessage.content,
      sources: []
    });
    setQaLoading(true);

    const startTime = Date.now();
    try {
      const response = await askEthicalAI(sanitized, {
        category: selectedQACategory,
        userId,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        pageTitle: typeof document !== 'undefined' ? document.title : undefined,
        viewMode: 'dashboard-ai-insight',
      });
      const responseTime = Date.now() - startTime;

      const aiMessage: MessageWithMeta = {
        id: `msg_${Date.now()}`,
        role: 'ai',
        content: response.text,
        timestamp: Date.now(),
        sources: response.groundingChunks,
        confidenceScore: response.confidenceScore,
        processingTime: responseTime,
        reactions: {}
      };

      setQaMessages(prev => [...prev, aiMessage]);
      cacheService.addConversationEntry(userId, {
        id: aiMessage.id,
        role: 'ai',
        content: response.text,
        sources: response.groundingChunks
      });

      const suggested = await generateSuggestedQuestions(sanitized, response.text);
      setSuggestedQuestions(suggested);

      analyticsService.trackQuestion(sanitized, selectedQACategory, responseTime);
    } catch (error) {
      console.error('Q&A Error:', error);
      const errorMessage = getActionableAiErrorMessage(error);
      setQaMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'ai',
        content: errorMessage,
        timestamp: Date.now()
      }]);
    } finally {
      setQaLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!voiceSupported) {
      setInsightError('Voice input is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.onstart = () => setIsVoiceInput(true);
    recognition.onend = () => setIsVoiceInput(false);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setQaInput(transcript);
    };

    recognition.start();
  };

  const toggleFavorite = (messageId: string) => {
    const message = qaMessages.find(m => m.id === messageId);
    if (!message) return;

    if (message.favorite) {
      cacheService.removeFavorite(userId, messageId);
    } else {
      cacheService.addFavorite(userId, messageId);
    }

    setQaMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, favorite: !msg.favorite } : msg
    ));
    analyticsService.trackFavoriteAction(messageId, !message.favorite);
  };

  const rateMessage = (messageId: string, rating: number) => {
    cacheService.rateEntry(userId, messageId, rating);
    setQaMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, rating } : msg
    ));
    analyticsService.trackResponseRating(messageId, rating);
  };

  const copyMessage = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(messageId);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDescription.trim()) return;

    const validation = securityService.validateRequest({
      title: reportTitle,
      description: reportDescription
    }, ['title', 'description']);

    if (!validation.valid) {
      setReportError(validation.errors.join(' '));
      return;
    }

    setReportLoading(true);
    setReportError('');
    try {
      const result = await processPlatformIssue({
        title: reportTitle,
        description: reportDescription,
        category: reportCategory,
        userEmail
      });

      setReportResult({
        ...result,
        analysis: (result as any).analysis ?? result.text
      });
      analyticsService.trackIssueReport(reportCategory, result.priority);

      securityService.createAuditLog('issue_reported', userId, {
        category: reportCategory,
        priority: result.priority
      });

      setReportTitle('');
      setReportDescription('');
    } catch (error) {
      console.error('Report Error:', error);
      setReportError(getActionableAiErrorMessage(error));
    } finally {
      setReportLoading(false);
    }
  };

  const loadAnalytics = () => {
    const summary = analyticsService.getAnalyticsSummary();
    const score = analyticsService.getUserEngagementScore(userId);
    setAnalyticsData(summary);
    setEngagementScore(score);
  };

  const exportConversation = (format: 'markdown' | 'json') => {
    const data = format === 'markdown'
      ? cacheService.exportConversationMarkdown(userId)
      : cacheService.exportConversationJSON(userId);

    downloadTextFile({
      content: data,
      filename: `conversation.${format === 'markdown' ? 'md' : 'json'}`,
      mimeType: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    });

    analyticsService.trackExport(format);
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-teal-600 shadow-2xl transition-transform hover:scale-105 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        <Sparkles className="h-6 w-6 text-white sm:h-7 sm:w-7" />
      </button>
    );
  }

  return (
    <div className="glass-panel min-w-0 p-5 sm:p-6 md:p-8 rounded-[1.75rem] sm:rounded-[2rem] border-blue-500/10 shadow-2xl space-y-6 animate-in fade-in duration-500 overflow-visible flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-3 bg-black/20 px-5 pt-5 pb-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 md:-mx-8 md:px-8">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 w-2.5 h-2.5 shrink-0 rounded-full bg-gradient-to-r from-teal-400 to-blue-500 animate-pulse shadow-lg"></div>
          <div className="min-w-0">
            <h2 className="break-words text-xs font-black uppercase tracking-[0.24em] text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text sm:text-sm">
              Ethical AI Insight
            </h2>
            <p className="text-[7px] text-slate-500 uppercase tracking-widest">Enhanced Hub v2.0</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
          <button
            onClick={() => { loadAnalytics(); setViewMode('analytics'); setShowSettings(false); }}
            className="w-full px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4 shrink-0" /> <span className="cnh-action-label">Analytics</span>
          </button>
          <button
            onClick={() => exportConversation('markdown')}
            className="w-full px-3 py-2 bg-teal-600/10 hover:bg-teal-600/20 text-teal-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4 shrink-0" /> <span className="cnh-action-label">Export MD</span>
          </button>
          <button
            onClick={() => exportConversation('json')}
            className="w-full px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4 shrink-0" /> <span className="cnh-action-label">Export JSON</span>
          </button>
          <button
            onClick={() => {
              cacheService.clearConversationHistory(userId);
              backendAPI.clearHistory(userId);
              setQaMessages([]);
              setSuggestedQuestions([]);
            }}
            className="w-full px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4 shrink-0" /> <span className="cnh-action-label">Clear History</span>
          </button>
        </div>
      )}

      {/* Mode Selector */}
      <div className="flex flex-wrap gap-2">
        {[
          { mode: 'insight' as ViewMode, label: 'Daily Wisdom', icon: '✨' },
          { mode: 'qa' as ViewMode, label: 'Ask AI', icon: '💭' },
          { mode: 'report' as ViewMode, label: 'Report Issue', icon: '⚠️' }
        ].map((btn) => (
          <button
            key={btn.mode}
            onClick={() => {
              setViewMode(btn.mode);
              setReportResult(null);
              if (btn.mode !== 'report') setReportError('');
              analyticsService.trackViewChange(btn.mode);
            }}
            className={`min-w-0 px-3 md:px-4 py-2 rounded-lg font-bold text-[9px] md:text-[10px] uppercase tracking-widest leading-tight transition-all ${
              viewMode === btn.mode
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span aria-hidden="true">{btn.icon}</span> <span className="cnh-action-label">{btn.label}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] leading-relaxed text-slate-300">
        AI responses are reflective support only. Use qualified professionals or emergency services for medical, mental health, legal, financial, or safety-critical issues.
      </div>

      {viewMode === 'insight' && insightError && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-100 px-4 py-3 rounded-xl text-[10px] leading-relaxed">
          {insightError}
        </div>
      )}

      {viewMode === 'report' && reportError && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-100 px-4 py-3 rounded-xl text-[10px] leading-relaxed">
          {reportError}
        </div>
      )}

      {/* INSIGHT VIEW */}
      {viewMode === 'insight' && (
        <div className="space-y-4 flex-1">
          <div className="bg-gradient-to-br from-blue-900/40 to-teal-900/40 border border-blue-500/20 p-6 rounded-[1.5rem] backdrop-blur-xl">
            <p className="text-slate-100 italic leading-relaxed text-sm md:text-base font-light">
              {wisdomLoading ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</span>
              ) : (
                dailyWisdom?.text
              )}
            </p>

            {dailyWisdom && !wisdomLoading && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-1 text-[8px] xs:flex-row xs:items-center xs:justify-between">
                  <GroundingMeter score={dailyWisdom.confidenceScore} />
                  <span className="text-slate-500">⏱️ {dailyWisdom.processingTimeMs}ms</span>
                </div>

                <SourceReferences sources={dailyWisdom.groundingChunks} />
              </div>
            )}
          </div>

          {trendingTopics.length > 0 && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <h4 className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Trending</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingTopics.slice(0, 3).map(topic => (
                  <span key={topic} className="px-2.5 py-1 bg-orange-500/10 text-orange-300 rounded-lg text-[8px] font-bold uppercase tracking-wider">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {trendingError && trendingTopics.length === 0 && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-[9px] text-slate-300 leading-relaxed">
              {trendingError}
            </div>
          )}

          <button
            onClick={() => loadDailyWisdom()}
            className="w-full px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      {/* Q&A VIEW */}
      {viewMode === 'qa' && (
        <div className="space-y-4 flex-1 flex flex-col">
          <div className="flex flex-wrap gap-2">
            {[
              { val: 'platform' as const, label: 'Platform', icon: '🏢' },
              { val: 'wellness' as const, label: 'Wellness', icon: '💚' },
              { val: 'general' as const, label: 'General', icon: '🌍' }
            ].map((cat) => (
              <button
                key={cat.val}
                onClick={() => setSelectedQACategory(cat.val)}
                className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase leading-tight transition-all ${
                  selectedQACategory === cat.val
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[14rem] max-h-[55dvh] overflow-y-auto space-y-3 pr-2 custom-scrollbar scrollable">
            {qaMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center py-8">
                <MessageSquare className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Ask anything about the platform or wellness</p>
              </div>
            ) : (
              qaMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                  onMouseEnter={() => setSelectedMessage(msg.id)}
                  onMouseLeave={() => setSelectedMessage(null)}
                >
                  <div
                    className={`max-w-[min(100%,32rem)] p-3 md:p-4 rounded-2xl transition-all ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-slate-200 border border-white/10'
                    }`}
                  >
                    <p className="break-words text-[9px] md:text-[10px] leading-relaxed">{msg.content}</p>

                    {msg.role === 'ai' && (
                      <div className="mt-2">
                        <SourceReferences sources={msg.sources as GroundingChunk[] | undefined} />
                      </div>
                    )}

                    {msg.role === 'ai' && msg.confidenceScore !== undefined && (
                      <div className="mt-2">
                        <GroundingMeter score={msg.confidenceScore} />
                      </div>
                    )}

                    {selectedMessage === msg.id && msg.role === 'ai' && (
                      <div className="flex gap-1 mt-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => copyMessage(msg.content, msg.id)}
                          className="p-1 hover:bg-white/10 rounded transition-all"
                        >
                          <Copy className={`w-3 h-3 ${copiedMessage === msg.id ? 'text-green-400' : 'text-slate-400'}`} />
                        </button>
                        <button
                          onClick={() => toggleFavorite(msg.id)}
                          className="p-1 hover:bg-white/10 rounded transition-all"
                        >
                          <Heart className={`w-3 h-3 ${msg.favorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
                        </button>
                        <button
                          onClick={() => rateMessage(msg.id, 5)}
                          className="p-1 hover:bg-white/10 rounded transition-all"
                        >
                          <ThumbsUp className={`w-3 h-3 ${msg.rating === 5 ? 'fill-green-400 text-green-400' : 'text-slate-400'}`} />
                        </button>
                        <button
                          onClick={() => rateMessage(msg.id, 1)}
                          className="p-1 hover:bg-white/10 rounded transition-all"
                        >
                          <ThumbsDown className={`w-3 h-3 ${msg.rating === 1 ? 'fill-red-400 text-red-400' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {qaLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-[9px] text-slate-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={qaEndRef} />
          </div>

          {suggestedQuestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">Follow-ups</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.slice(0, 2).map(q => (
                  <button
                    key={q}
                    onClick={() => setQaInput(q)}
                    className="max-w-full px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-[8px] text-blue-400 rounded-lg transition-all"
                  >
                    💡 {q.substring(0, 40)}...
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleQASubmit} className="flex min-w-0 gap-2">
            <input
              type="text"
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder="Ask..."
              className="min-w-0 flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] md:text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-600"
              disabled={qaLoading}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all ${
                  isVoiceInput ? 'bg-red-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={qaLoading}
              className="px-3 md:px-4 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* REPORT VIEW */}
      {viewMode === 'report' && (
        <div className="space-y-4 flex-1">
          {!reportResult ? (
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="bug">🐛 Bug</option>
                  <option value="feature">✨ Feature</option>
                  <option value="performance">⚡ Performance</option>
                  <option value="usability">🎯 Usability</option>
                  <option value="security">🔒 Security</option>
                  <option value="other">❓ Other</option>
                </select>
              </div>

              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Title..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-600"
                required
              />

              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Description..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-600 resize-none h-[100px]"
                required
              />

              <button
                type="submit"
                disabled={reportLoading}
                className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" /> Submit
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 p-4 md:p-6 rounded-[1.5rem]">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-teal-400 mb-2">Received</h4>
                    <p className="text-[9px] text-slate-300 leading-relaxed">{reportResult.analysis || reportResult.text}</p>
                    {reportResult.priority && (
                      <div className="mt-3 text-[8px] font-bold uppercase tracking-widest">
                        <span className="inline-block px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                          {reportResult.priority}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setReportResult(null);
                  setReportTitle('');
                  setReportDescription('');
                }}
                className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all"
              >
                Submit Another
              </button>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {viewMode === 'analytics' && (
        <div className="space-y-4 flex-1 max-h-[60dvh] overflow-y-auto custom-scrollbar scrollable">
          {analyticsData ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold mb-1">Questions</p>
                  <p className="text-lg font-black text-blue-400">{analyticsData.questionsAsked}</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold mb-1">Issues</p>
                  <p className="text-lg font-black text-orange-400">{analyticsData.issuesReported}</p>
                </div>
                <div className="bg-teal-500/10 border border-teal-500/20 p-3 rounded-lg">
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold mb-1">Response Time</p>
                  <p className="text-lg font-black text-teal-400">{analyticsData.averageResponseTime}ms</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg">
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold mb-1">Engagement</p>
                  <p className="text-lg font-black text-purple-400">{engagementScore}/100</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                <h4 className="text-[9px] font-black text-white uppercase tracking-widest mb-3">Session</h4>
                <div className="space-y-2 text-[8px] text-slate-400">
                  <p>📊 Events: {analyticsData.totalEvents}</p>
                  <p>👥 Users: {analyticsData.uniqueUsers}</p>
                  <p>⏱️ Duration: {analyticsData.sessionDuration}s</p>
                  <p>⭐ Rating: {analyticsData.averageRating}/5</p>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={loadAnalytics}
              className="w-full px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all"
            >
              Load Analytics
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EthicalAIInsight;
