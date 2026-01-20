import React, { useState, useEffect, useRef } from 'react';
import {
  Send, AlertCircle, FileText, Sparkles, Globe, 
  X, Loader2, ChevronDown, Flag, MessageSquare, ArrowRight
} from 'lucide-react';
import { getDailyWisdom, askEthicalAI, processPlatformIssue, GroundingChunk } from '../services/geminiService';

interface EthicalAIInsightProps {
  userEmail?: string;
}

type ViewMode = 'insight' | 'qa' | 'report';

const EthicalAIInsight: React.FC<EthicalAIInsightProps> = ({ userEmail }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('insight');
  const [dailyWisdom, setDailyWisdom] = useState<string>('Initializing daily wisdom stream...');
  const [wisdomSources, setWisdomSources] = useState<GroundingChunk[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Q&A State
  const [qaMessages, setQaMessages] = useState<{ role: 'user' | 'ai'; content: string; sources?: GroundingChunk[] }[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [selectedQACategory, setSelectedQACategory] = useState<'platform' | 'wellness' | 'general'>('general');
  
  // Issue Report State
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  
  const qaEndRef = useRef<HTMLDivElement>(null);

  // Load daily wisdom on mount
  useEffect(() => {
    const loadDailyWisdom = async () => {
      setLoading(true);
      const { text, groundingChunks } = await getDailyWisdom();
      setDailyWisdom(text);
      setWisdomSources(groundingChunks || []);
      setLoading(false);
    };
    loadDailyWisdom();
  }, []);

  // Auto-scroll Q&A
  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages]);

  // Handle Q&A submission
  const handleQASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;

    const userMessage = qaInput;
    setQaInput('');
    setQaMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setQaLoading(true);

    const { text, groundingChunks } = await askEthicalAI(userMessage, { category: selectedQACategory });
    setQaMessages(prev => [...prev, { role: 'ai', content: text, sources: groundingChunks }]);
    setQaLoading(false);
  };

  // Handle issue report submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDescription.trim()) return;

    setReportLoading(true);
    const result = await processPlatformIssue({
      title: reportTitle,
      description: reportDescription,
      category: reportCategory,
      userEmail
    });
    
    setReportResult(result);
    setReportTitle('');
    setReportDescription('');
    setReportLoading(false);
  };

  return (
    <div className="glass-panel p-8 rounded-[2.5rem] border-blue-500/10 shadow-2xl space-y-6 animate-in fade-in duration-500">
      {/* Header with Mode Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400">Ethical AI Insight</span>
          </div>
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active</div>
        </div>

        {/* Mode Selector Buttons */}
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
              }}
              className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${
                viewMode === btn.mode
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* INSIGHT VIEW - Daily Wisdom */}
      {viewMode === 'insight' && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/10 p-6 rounded-[1.5rem] backdrop-blur-xl">
            <p className="text-slate-200 italic leading-relaxed text-base font-light">
              {loading ? "Decrypting mission data..." : dailyWisdom}
            </p>
          </div>

          {!loading && wisdomSources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Globe className="w-3 h-3" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Grounded In:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {wisdomSources.map((s, idx) => s.web && (
                  <a
                    key={idx}
                    href={s.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-all border border-blue-500/10 hover:border-blue-400/50 font-bold uppercase tracking-widest flex items-center gap-1"
                  >
                    {s.web.title.substring(0, 30)}... <ArrowRight className="w-2 h-2" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q&A VIEW */}
      {viewMode === 'qa' && (
        <div className="space-y-4 flex flex-col h-[500px]">
          {/* Category Selector */}
          <div className="flex gap-2">
            {[
              { val: 'platform' as const, label: 'Platform' },
              { val: 'wellness' as const, label: 'Wellness' },
              { val: 'general' as const, label: 'General' }
            ].map((cat) => (
              <button
                key={cat.val}
                onClick={() => setSelectedQACategory(cat.val)}
                className={`px-3 py-1 rounded text-[8px] font-bold uppercase transition-all ${
                  selectedQACategory === cat.val
                    ? 'bg-teal-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {qaMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-center">
                <div>
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-[10px] font-bold uppercase">Ask me anything about the platform, your wellness, or consciousness</p>
                </div>
              </div>
            ) : (
              qaMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs p-4 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-slate-200 border border-white/10'
                    }`}
                  >
                    <p className="text-[10px] leading-relaxed">{msg.content}</p>
                    {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 text-[7px] text-slate-400 italic">
                        Sources: {msg.sources.map((s, i) => s.web?.title).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {qaLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={qaEndRef} />
          </div>

          {/* Q&A Input */}
          <form onSubmit={handleQASubmit} className="flex gap-2">
            <input
              type="text"
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder="Ask your question..."
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-600"
              disabled={qaLoading}
            />
            <button
              type="submit"
              disabled={qaLoading || !qaInput.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* REPORT ISSUE VIEW */}
      {viewMode === 'report' && (
        <div className="space-y-4">
          {!reportResult ? (
            <form onSubmit={handleReportSubmit} className="space-y-4">
              {/* Category */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Issue Category
                </label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                  <option value="performance">Performance Issue</option>
                  <option value="usability">Usability Concern</option>
                  <option value="security">Security Concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Issue Title
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-600"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Description
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Detailed description, steps to reproduce, expected behavior..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-600 resize-none h-[150px]"
                  required
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={reportLoading}
                className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" /> Submit Report
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-teal-500/10 border border-teal-500/30 p-6 rounded-[1.5rem]">
                <div className="flex items-start gap-3 mb-4">
                  <FileText className="w-5 h-5 text-teal-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-sm font-bold text-teal-400 mb-2">Report Received</h4>
                    <p className="text-[10px] text-slate-300 leading-relaxed">{reportResult.analysis}</p>
                  </div>
                </div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                  Status: {reportResult.status} • {new Date(reportResult.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <button
                onClick={() => {
                  setReportResult(null);
                  setReportTitle('');
                  setReportDescription('');
                }}
                className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Submit Another Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EthicalAIInsight;
