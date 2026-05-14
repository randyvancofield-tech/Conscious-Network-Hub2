import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Handshake,
  LifeBuoy,
  Loader2,
  Network,
  PanelLeft,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getProviderCrmAdminTools,
  getProviderCrmSummary,
  getProviderCrmTools,
  ProviderCrmTool,
  ProviderCrmToolId,
  updateProviderCrmToolVisibility,
} from '../services/backendApiService';
import {
  getProviderControlSession,
  PROVIDER_SESSION_TOKEN_EVENT,
} from '../services/sessionService';

interface ProviderCrmShellProps {
  user: UserProfile | null;
  onOpenProviderAccess: () => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  home: <PanelLeft className="h-4 w-4" />,
  members: <Users className="h-4 w-4" />,
  sessions: <ClipboardList className="h-4 w-4" />,
  'follow-ups': <ClipboardList className="h-4 w-4" />,
  referrals: <Handshake className="h-4 w-4" />,
  resources: <BookOpen className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  notes: <ClipboardList className="h-4 w-4" />,
  'content-courses': <BookOpen className="h-4 w-4" />,
  collaboration: <Network className="h-4 w-4" />,
  'admin-support': <LifeBuoy className="h-4 w-4" />,
};

const readProviderToken = (): string => getProviderControlSession() || '';

const renderPlaceholder = (tool: ProviderCrmTool | null): React.ReactNode => {
  if (!tool) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Select a CRM tool to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
          {TOOL_ICONS[tool.id] || <PanelLeft className="h-4 w-4" />}
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            {tool.label}
          </h3>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {tool.phase}
          </p>
        </div>
      </div>
      <p className="text-sm leading-7 text-slate-300">{tool.description}</p>
      <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">
          Placeholder shell only. Workflow data, notes, referrals, analytics, and relationship
          management are not enabled in Phase 1.
        </p>
      </div>
    </div>
  );
};

const ProviderCrmShell: React.FC<ProviderCrmShellProps> = ({ user, onOpenProviderAccess }) => {
  const [providerToken, setProviderToken] = useState(readProviderToken);
  const [tools, setTools] = useState<ProviderCrmTool[]>([]);
  const [adminTools, setAdminTools] = useState<ProviderCrmTool[]>([]);
  const [activeToolId, setActiveToolId] = useState<ProviderCrmToolId>('home');
  const [status, setStatus] = useState('Loading provider CRM shell...');
  const [isLoading, setLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const isAdmin = user?.role === 'admin';
  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === activeToolId) || tools[0] || null,
    [activeToolId, tools]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncToken = (event?: Event) => {
      const customEvent = event as CustomEvent<{ token?: string }> | undefined;
      setProviderToken(String(customEvent?.detail?.token || readProviderToken()).trim());
    };
    window.addEventListener(PROVIDER_SESSION_TOKEN_EVENT, syncToken as EventListener);
    return () => {
      window.removeEventListener(PROVIDER_SESSION_TOKEN_EVENT, syncToken as EventListener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCrm = async () => {
      const token = providerToken.trim();
      if (!token) {
        setTools([]);
        setAdminTools([]);
        setSummaryText('');
        setStatus('Provider CRM requires an active native provider session.');
        return;
      }

      setLoading(true);
      setStatus('Loading provider CRM tools...');
      try {
        const [toolResult, summaryResult, adminToolResult] = await Promise.all([
          getProviderCrmTools(token),
          getProviderCrmSummary(token),
          isAdmin ? getProviderCrmAdminTools(token) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const nextTools = toolResult?.tools || [];
        setTools(nextTools);
        setAdminTools(adminToolResult?.tools || []);
        if (!nextTools.some((tool) => tool.id === activeToolId)) {
          setActiveToolId((nextTools[0]?.id || 'home') as ProviderCrmToolId);
        }
        setSummaryText(
          summaryResult?.summary
            ? `${summaryResult.summary.activeToolCount} CRM tools active`
            : 'Provider CRM shell active'
        );
        setStatus(nextTools.length > 0 ? 'Provider CRM shell active.' : 'No CRM tools are currently enabled.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCrm();
    return () => {
      cancelled = true;
    };
  }, [activeToolId, isAdmin, providerToken]);

  const handleToggleAdminTool = async (tool: ProviderCrmTool) => {
    const token = providerToken.trim();
    if (!token) return;
    setLoading(true);
    setStatus(`Updating ${tool.label} visibility...`);
    try {
      const updated = await updateProviderCrmToolVisibility(token, tool.id, !tool.enabled);
      if (!updated) {
        setStatus('Tool visibility could not be updated.');
        return;
      }
      setAdminTools((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      const refreshed = await getProviderCrmTools(token);
      setTools(refreshed?.tools || []);
      setStatus(`${updated.label} visibility updated for this runtime.`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'provider' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.04] p-6 sm:p-8">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">
            Provider CRM Unavailable
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This workspace is limited to approved providers and the Provider CRM administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!providerToken.trim()) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <div className="rounded-3xl border border-blue-300/20 bg-blue-500/[0.04] p-6 sm:p-8">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">
            Provider CRM Requires Provider Access
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Sign in through Provider Access and complete the provider entry boundary before CRM tools
            unlock.
          </p>
          <button
            type="button"
            onClick={onOpenProviderAccess}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
          >
            Open Provider Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-300">
            Provider Portal
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
            Provider CRM
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Phase 1 shell for approved-provider relationship, session, follow-up, referral,
            resource, and impact workflows.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {isLoading ? 'Syncing' : summaryText || status}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          {tools.map((tool) => {
            const active = activeTool?.id === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveToolId(tool.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-blue-300/30 bg-blue-500/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className={active ? 'text-blue-200' : 'text-slate-500'}>
                  {TOOL_ICONS[tool.id] || <PanelLeft className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-widest">
                  {tool.label}
                </span>
              </button>
            );
          })}
          {isLoading && (
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating
            </p>
          )}
        </aside>

        <main className="space-y-6">
          {renderPlaceholder(activeTool)}

          {isAdmin && adminTools.length > 0 && (
            <section className="rounded-2xl border border-teal-300/20 bg-teal-500/[0.04] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">
                    Provider CRM Admin Controls
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-slate-300">
                    Tool visibility controls for the sole Provider CRM administrator.
                  </p>
                </div>
                <span className="rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-teal-100">
                  guidance@higherconscious.network
                </span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {adminTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white">
                        {tool.label}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">
                        {tool.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleAdminTool(tool)}
                      disabled={isLoading || tool.adminOnly}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {tool.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProviderCrmShell;
