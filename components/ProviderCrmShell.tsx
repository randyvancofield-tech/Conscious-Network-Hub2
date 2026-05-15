import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Handshake,
  LifeBuoy,
  Link2,
  Loader2,
  MessageSquare,
  Network,
  PanelLeft,
  Target,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  createProviderCrmRecord,
  createNativeProviderControlSession,
  createProviderRoundtableReservation,
  getProviderCrmAdminTools,
  getProviderCrmSummary,
  getProviderCrmTools,
  getProviderCrmWorkspace,
  ProviderCrmPriority,
  ProviderCrmRecordKind,
  ProviderCrmRecordStatus,
  ProviderCrmTool,
  ProviderCrmToolId,
  ProviderCrmWorkspace,
  ProviderRoundtableReservation,
  updateProviderCrmToolVisibility,
} from '../services/backendApiService';
import {
  getProviderControlSession,
  PROVIDER_SESSION_TOKEN_EVENT,
  setProviderControlSession,
} from '../services/sessionService';

interface ProviderCrmShellProps {
  user: UserProfile | null;
  onOpenAdministrativeAccess: () => void;
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
  roundtable: <CalendarClock className="h-4 w-4" />,
  'knowledge-center': <BookOpen className="h-4 w-4" />,
  'admin-support': <LifeBuoy className="h-4 w-4" />,
};

const readProviderToken = (): string => getProviderControlSession() || '';

const getLocalTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTimeLocalValue = (date: Date): string => {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${toDateInputValue(date)}T${hours}:${minutes}`;
};

const formatLocalDateTime = (value: string, timezone: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(date);
};

const buildRoundtableStartIso = (dateValue: string, hourValue: number): string => {
  const [year, month, day] = dateValue.split('-').map((entry) => Number.parseInt(entry, 10));
  const date = new Date(
    Number.isFinite(year) ? year : new Date().getFullYear(),
    Number.isFinite(month) ? month - 1 : new Date().getMonth(),
    Number.isFinite(day) ? day : new Date().getDate(),
    hourValue,
    0,
    0,
    0
  );
  return date.toISOString();
};

const toAbsoluteAppUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined' || !window.location?.origin) return normalizedPath;
  return `${window.location.origin}${normalizedPath}`;
};

const isReservationForSlot = (
  reservation: ProviderRoundtableReservation,
  dateValue: string,
  hourValue: number
): boolean => {
  const start = new Date(reservation.startAt);
  return (
    toDateInputValue(start) === dateValue &&
    start.getHours() === hourValue &&
    reservation.status !== 'cancelled'
  );
};

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

const ProviderCrmShell: React.FC<ProviderCrmShellProps> = ({
  user,
  onOpenAdministrativeAccess,
  onOpenProviderAccess,
}) => {
  const [providerToken, setProviderToken] = useState(readProviderToken);
  const [tools, setTools] = useState<ProviderCrmTool[]>([]);
  const [adminTools, setAdminTools] = useState<ProviderCrmTool[]>([]);
  const [soleAdminEmail, setSoleAdminEmail] = useState('');
  const [activeToolId, setActiveToolId] = useState<ProviderCrmToolId>('home');
  const [status, setStatus] = useState('Loading provider CRM shell...');
  const [isLoading, setLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [workspace, setWorkspace] = useState<ProviderCrmWorkspace | null>(null);
  const [recordKindInput, setRecordKindInput] = useState<ProviderCrmRecordKind>('client');
  const [recordTitleInput, setRecordTitleInput] = useState('');
  const [recordClientInput, setRecordClientInput] = useState('');
  const [recordOrganizationInput, setRecordOrganizationInput] = useState('');
  const [recordTreatmentInput, setRecordTreatmentInput] = useState('');
  const [recordBusinessInput, setRecordBusinessInput] = useState('');
  const [recordStatusInput, setRecordStatusInput] = useState<ProviderCrmRecordStatus>('active');
  const [recordPriorityInput, setRecordPriorityInput] = useState<ProviderCrmPriority>('normal');
  const [recordNextActionInput, setRecordNextActionInput] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    date.setMinutes(0, 0, 0);
    return toDateTimeLocalValue(date);
  });
  const [roundtableDateInput, setRoundtableDateInput] = useState(() => toDateInputValue(new Date()));
  const [roundtableHourInput, setRoundtableHourInput] = useState(9);
  const [roundtableRoomInput, setRoundtableRoomInput] = useState(1);
  const [roundtableTitleInput, setRoundtableTitleInput] = useState('Conscious Roundtable');

  const isAdmin = user?.role === 'admin';
  const localTimezone = useMemo(() => getLocalTimezone(), []);
  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === activeToolId) || tools[0] || null,
    [activeToolId, tools]
  );
  const visibleRecords = workspace?.records || [];
  const roundtableReservations = workspace?.roundtable.reservations || [];
  const latestRoundtableReservation = roundtableReservations[0] || null;
  const reservedRoomsForSelectedHour = useMemo(
    () =>
      new Set(
        roundtableReservations
          .filter((reservation) => isReservationForSlot(reservation, roundtableDateInput, roundtableHourInput))
          .map((reservation) => reservation.roomNumber)
      ),
    [roundtableDateInput, roundtableHourInput, roundtableReservations]
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
        setWorkspace(null);
        setStatus('Provider CRM requires an active native provider session.');
        return;
      }

      setLoading(true);
      setStatus('Loading provider CRM tools...');
      try {
        const [toolResult, summaryResult, workspaceResult, adminToolResult] = await Promise.all([
          getProviderCrmTools(token),
          getProviderCrmSummary(token),
          getProviderCrmWorkspace(token, localTimezone),
          isAdmin ? getProviderCrmAdminTools(token) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const nextTools = toolResult?.tools || [];
        setTools(nextTools);
        setWorkspace(workspaceResult);
        setAdminTools(adminToolResult?.tools || []);
        setSoleAdminEmail(adminToolResult?.soleAdminEmail || '');
        if (!nextTools.some((tool) => tool.id === activeToolId)) {
          setActiveToolId((nextTools[0]?.id || 'home') as ProviderCrmToolId);
        }
        setSummaryText(
          summaryResult?.summary
            ? `${summaryResult.summary.activeToolCount} CRM tools active | ${workspaceResult?.scope.visibility || 'scoped'}`
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
  }, [activeToolId, isAdmin, localTimezone, providerToken]);

  useEffect(() => {
    if (!isAdmin || providerToken.trim()) return;

    let cancelled = false;
    const initializeAdminProviderSession = async () => {
      setLoading(true);
      setStatus('Initializing administrative control session...');
      try {
        const session = await createNativeProviderControlSession();
        if (cancelled) return;
        if (session?.token) {
          setProviderControlSession(session.token);
          setStatus('Administrative control session initialized.');
          return;
        }
        setStatus('Administrative control session could not be initialized. Re-enter through Administrative Access.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initializeAdminProviderSession();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, providerToken]);

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

  const refreshWorkspace = async (tokenOverride?: string) => {
    const token = String(tokenOverride || providerToken).trim();
    if (!token) return;
    const nextWorkspace = await getProviderCrmWorkspace(token, localTimezone);
    setWorkspace(nextWorkspace);
  };

  const handleCreateRecord = async () => {
    const token = providerToken.trim();
    if (!token) return;
    const title = recordTitleInput.trim();
    if (!title) {
      setStatus('Add a record title before saving.');
      return;
    }

    setLoading(true);
    setStatus('Saving provider CRM relationship record...');
    try {
      const created = await createProviderCrmRecord(token, {
        kind: recordKindInput,
        title,
        clientDisplayName: recordClientInput.trim() || undefined,
        organizationName: recordOrganizationInput.trim() || undefined,
        treatmentFocus: recordTreatmentInput.trim() || undefined,
        businessFocus: recordBusinessInput.trim() || undefined,
        status: recordStatusInput,
        priority: recordPriorityInput,
        nextActionAt: recordNextActionInput ? new Date(recordNextActionInput).toISOString() : null,
        timezone: localTimezone,
      });
      if (!created) {
        setStatus('CRM record could not be saved.');
        return;
      }
      setRecordTitleInput('');
      setRecordClientInput('');
      setRecordOrganizationInput('');
      setRecordTreatmentInput('');
      setRecordBusinessInput('');
      await refreshWorkspace(token);
      setStatus('CRM relationship record saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleReserveRoundtable = async () => {
    const token = providerToken.trim();
    if (!token) return;

    setLoading(true);
    setStatus('Reserving Conscious Roundtable room...');
    try {
      const reservation = await createProviderRoundtableReservation(token, {
        roomNumber: roundtableRoomInput,
        startAt: buildRoundtableStartIso(roundtableDateInput, roundtableHourInput),
        timezone: localTimezone,
        title: roundtableTitleInput.trim() || 'Conscious Roundtable',
      });
      if (!reservation) {
        setStatus('Roundtable room could not be reserved. Select another room or hour.');
        return;
      }
      await refreshWorkspace(token);
      setStatus(`Conscious Roundtable Room ${reservation.roomNumber} reserved.`);
    } finally {
      setLoading(false);
    }
  };

  const renderMetric = (
    icon: React.ReactNode,
    label: string,
    value: number | string,
    tone = 'blue'
  ): React.ReactNode => (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'amber'
          ? 'border-amber-300/20 bg-amber-500/[0.05]'
          : tone === 'teal'
          ? 'border-teal-300/20 bg-teal-500/[0.05]'
          : tone === 'indigo'
          ? 'border-indigo-300/20 bg-indigo-500/[0.05]'
          : tone === 'emerald'
          ? 'border-emerald-300/20 bg-emerald-500/[0.05]'
          : tone === 'red'
          ? 'border-red-300/20 bg-red-500/[0.05]'
          : 'border-blue-300/20 bg-blue-500/[0.05]'
      }`}
    >
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${
          tone === 'amber'
            ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
            : tone === 'teal'
            ? 'border-teal-300/20 bg-teal-500/10 text-teal-100'
            : tone === 'indigo'
            ? 'border-indigo-300/20 bg-indigo-500/10 text-indigo-100'
            : tone === 'emerald'
            ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100'
            : tone === 'red'
            ? 'border-red-300/20 bg-red-500/10 text-red-100'
            : 'border-blue-300/20 bg-blue-500/10 text-blue-100'
        }`}
      >
        {icon}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );

  const renderBusinessHome = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
              {workspace?.scope.visibility === 'administrator-holistic' ? 'Administrator Holistic View' : 'Provider-Owned View'}
            </p>
            <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">
              Treatment + Business Growth Command Center
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300">
            {localTimezone}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {renderMetric(<Users className="h-4 w-4" />, 'Active care relationships', workspace?.metrics.treatment.activeClientRecords || 0)}
          {renderMetric(<Clock3 className="h-4 w-4" />, 'Follow-ups due', workspace?.metrics.treatment.dueFollowUps || 0, 'amber')}
          {renderMetric(<Building2 className="h-4 w-4" />, 'Organizations / institutions', workspace?.metrics.businessGrowth.organizationsTracked || 0, 'teal')}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {renderMetric(<CalendarClock className="h-4 w-4" />, 'Upcoming Roundtables', workspace?.metrics.treatment.upcomingRoundtables || 0, 'indigo')}
          {renderMetric(<Handshake className="h-4 w-4" />, 'Contract opportunities', workspace?.metrics.businessGrowth.institutionContractOpportunities || 0, 'emerald')}
          {renderMetric(<Target className="h-4 w-4" />, 'Urgent opportunities', workspace?.metrics.businessGrowth.urgentOpportunities || 0, 'red')}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          Actionable Guidance
        </h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(workspace?.guidanceAlerts || []).map((alert) => (
            <div key={alert.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">
                {alert.severity}
              </p>
              <p className="mt-2 text-sm font-black uppercase tracking-widest text-white">
                {alert.title}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300">{alert.detail}</p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                {alert.action}
              </p>
            </div>
          ))}
          {(workspace?.guidanceAlerts || []).length === 0 && (
            <div className="rounded-xl border border-teal-300/20 bg-teal-400/[0.05] p-4 text-xs leading-6 text-teal-50">
              No urgent provider actions. Keep documenting treatment progress and institution opportunities.
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderRecordWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-500/10 text-teal-100">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">
              Add Treatment / Business Record
            </h3>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
              Provider records are server-scoped to the owner. Admin sees the holistic view.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <select
            value={recordKindInput}
            onChange={(event) => setRecordKindInput(event.target.value as ProviderCrmRecordKind)}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="client">User / Client</option>
            <option value="organization">Organization</option>
            <option value="institution">Institution</option>
            <option value="follow_up">Follow-Up</option>
          </select>
          <input
            value={recordTitleInput}
            onChange={(event) => setRecordTitleInput(event.target.value)}
            placeholder="Record title"
            className="md:col-span-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <input
            value={recordClientInput}
            onChange={(event) => setRecordClientInput(event.target.value)}
            placeholder="User/client name or handle"
            className="md:col-span-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <input
            value={recordOrganizationInput}
            onChange={(event) => setRecordOrganizationInput(event.target.value)}
            placeholder="Organization / institution"
            className="md:col-span-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <textarea
            value={recordTreatmentInput}
            onChange={(event) => setRecordTreatmentInput(event.target.value)}
            placeholder="Treatment focus / service delivery notes"
            className="md:col-span-3 min-h-[110px] rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <textarea
            value={recordBusinessInput}
            onChange={(event) => setRecordBusinessInput(event.target.value)}
            placeholder="Business growth / contract opportunity notes"
            className="md:col-span-3 min-h-[110px] rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <select
            value={recordStatusInput}
            onChange={(event) => setRecordStatusInput(event.target.value as ProviderCrmRecordStatus)}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="active">Active</option>
            <option value="watching">Watching</option>
            <option value="contracting">Contracting</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={recordPriorityInput}
            onChange={(event) => setRecordPriorityInput(event.target.value as ProviderCrmPriority)}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            type="datetime-local"
            value={recordNextActionInput}
            onChange={(event) => setRecordNextActionInput(event.target.value)}
            className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleCreateRecord()}
          disabled={isLoading}
          className="mt-4 rounded-xl bg-teal-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500"
        >
          Save CRM Record
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          Connected Records
        </h3>
        <div className="mt-4 space-y-3">
          {visibleRecords.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No CRM records yet. Add the first user, organization, or institution interaction above.
            </p>
          )}
          {visibleRecords.map((record) => (
            <div key={record.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{record.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {record.kind} | {record.status} | {record.priority}
                  </p>
                </div>
                {record.nextActionAt && (
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-amber-100">
                    {formatLocalDateTime(record.nextActionAt, localTimezone)}
                  </span>
                )}
              </div>
              {(record.clientDisplayName || record.organizationName) && (
                <p className="mt-3 text-xs leading-6 text-slate-300">
                  {[record.clientDisplayName, record.organizationName].filter(Boolean).join(' | ')}
                </p>
              )}
              {(record.treatmentFocus || record.businessFocus) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {record.treatmentFocus && (
                    <p className="rounded-lg border border-blue-300/10 bg-blue-400/[0.04] p-3 text-xs leading-6 text-blue-50">
                      {record.treatmentFocus}
                    </p>
                  )}
                  {record.businessFocus && (
                    <p className="rounded-lg border border-teal-300/10 bg-teal-400/[0.04] p-3 text-xs leading-6 text-teal-50">
                      {record.businessFocus}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderRoundtable = (): React.ReactNode => {
    const hours = Array.from({ length: workspace?.roundtable.hourCount || 12 }, (_, index) => (
      (workspace?.roundtable.dayStartHour || 8) + index
    ));
    const rooms = Array.from({ length: workspace?.roundtable.roomCount || 12 }, (_, index) => index + 1);
    const selectedReservationUrl = latestRoundtableReservation
      ? toAbsoluteAppUrl(latestRoundtableReservation.roomUrl)
      : '';

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.04] p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">
                Conscious Roundtable
              </p>
              <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">
                Reserve 1 of 12 Private Rooms
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Each reservation creates a CNH-native meeting session and branded room link for providers,
                users, administrators, and institutional partners.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-100">
              {localTimezone}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-6">
            <input
              value={roundtableTitleInput}
              onChange={(event) => setRoundtableTitleInput(event.target.value)}
              placeholder="Roundtable title"
              className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
            <input
              type="date"
              value={roundtableDateInput}
              onChange={(event) => setRoundtableDateInput(event.target.value)}
              className="md:col-span-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
            <select
              value={roundtableHourInput}
              onChange={(event) => setRoundtableHourInput(Number(event.target.value))}
              className="md:col-span-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {`${hour}`.padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <select
              value={roundtableRoomInput}
              onChange={(event) => setRoundtableRoomInput(Number(event.target.value))}
              className="md:col-span-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              {rooms.map((room) => (
                <option key={room} value={room} disabled={reservedRoomsForSelectedHour.has(room)}>
                  Room {room}{reservedRoomsForSelectedHour.has(room) ? ' reserved' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleReserveRoundtable()}
              disabled={isLoading || reservedRoomsForSelectedHour.has(roundtableRoomInput)}
              className="md:col-span-1 rounded-xl bg-cyan-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500"
            >
              Reserve
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">
              12-Room Hour Grid
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {rooms.map((room) => {
                const reserved = reservedRoomsForSelectedHour.has(room);
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setRoundtableRoomInput(room)}
                    disabled={reserved}
                    className={`rounded-xl border px-3 py-4 text-[10px] font-black uppercase tracking-widest transition ${
                      roundtableRoomInput === room
                        ? 'border-cyan-300/40 bg-cyan-500/20 text-white'
                        : reserved
                        ? 'border-red-300/20 bg-red-500/[0.05] text-red-200 opacity-60'
                        : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Room {room}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">
              Branded Room Frame
            </h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {selectedReservationUrl ? (
                <iframe
                  title="Conscious Roundtable"
                  src={selectedReservationUrl}
                  className="h-[320px] w-full"
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center p-6 text-center text-xs leading-6 text-slate-400">
                  Reserve a room to generate the private Conscious Roundtable frame.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            Reserved Roundtables
          </h3>
          <div className="mt-4 space-y-3">
            {roundtableReservations.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
                No Conscious Roundtable reservations yet.
              </p>
            )}
            {roundtableReservations.map((reservation) => {
              const url = toAbsoluteAppUrl(reservation.roomUrl);
              return (
                <div key={reservation.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest text-white">
                        Room {reservation.roomNumber} | {reservation.title}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
                        {formatLocalDateTime(reservation.startAt, localTimezone)} | {reservation.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          setStatus('Conscious Roundtable link copied.');
                        } catch {
                          setStatus('Copy failed. Open the room link and copy it from the browser.');
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Copy Link
                    </button>
                  </div>
                  <p className="mt-3 break-all rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] text-slate-400">
                    {url}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderKnowledgeCenter = (): React.ReactNode => (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            Best Practices & Knowledge Center
          </h3>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
            Standardized provider operating guidance for consistent service delivery.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {(workspace?.resources || []).map((resource) => (
          <div key={resource.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">
              {resource.category}
            </p>
            <h4 className="mt-2 text-sm font-black uppercase tracking-widest text-white">
              {resource.title}
            </h4>
            <p className="mt-3 text-xs leading-6 text-slate-300">{resource.summary}</p>
            <div className="mt-4 space-y-2">
              {resource.checklist.map((item) => (
                <p key={item} className="flex gap-2 text-xs leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-300" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderCollaboration = (): React.ReactNode => (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-500/10 text-indigo-100">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            Collaborative Chat & Directional Work
          </h3>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
            Native room signals power live Roundtable collaboration without adding a paid chat vendor.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-white">Provider Direction</p>
          <p className="mt-2 text-xs leading-6 text-slate-300">
            Action alerts are generated from due follow-ups, urgent opportunities, and missing Roundtable reservations.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-white">Shared Context</p>
          <p className="mt-2 text-xs leading-6 text-slate-300">
            Administrators can see the holistic data picture while providers stay limited to their own records.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-white">Room Signals</p>
          <p className="mt-2 text-xs leading-6 text-slate-300">
            Conscious Roundtable rooms use the internal CNH signaling layer for immediate interactive communication.
          </p>
        </div>
      </div>
    </section>
  );

  const renderActiveToolPanel = (): React.ReactNode => {
    if (!activeTool) return renderPlaceholder(null);
    if (activeTool.id === 'home' || activeTool.id === 'analytics') return renderBusinessHome();
    if (activeTool.id === 'members' || activeTool.id === 'follow-ups' || activeTool.id === 'referrals') {
      return renderRecordWorkspace();
    }
    if (activeTool.id === 'sessions' || activeTool.id === 'roundtable') return renderRoundtable();
    if (activeTool.id === 'resources' || activeTool.id === 'knowledge-center') return renderKnowledgeCenter();
    if (activeTool.id === 'collaboration') return renderCollaboration();
    return renderPlaceholder(activeTool);
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
            {isAdmin ? 'Administrative Control Session Required' : 'Provider CRM Requires Provider Access'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {isAdmin
              ? 'Re-enter through Administrative Access to initialize the admin provider-operations session.'
              : 'Sign in through Provider Access and complete the provider entry boundary before CRM tools unlock.'}
          </p>
          {isLoading && (
            <p className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100">
              <Loader2 className="h-3 w-3 animate-spin" />
              {status}
            </p>
          )}
          <button
            type="button"
            onClick={isAdmin ? onOpenAdministrativeAccess : onOpenProviderAccess}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
          >
            {isAdmin ? 'Open Administrative Access' : 'Open Provider Access'}
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
            {isAdmin ? 'Administrative Portal' : 'Provider Portal'}
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
            {isAdmin ? 'Provider CRM / Admin Operations' : 'Provider CRM'}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            {isAdmin
              ? 'Founder and administrator workspace for provider operations, CRM controls, tool visibility, and platform oversight.'
              : 'Phase 1 shell for approved-provider relationship, session, follow-up, referral, resource, and impact workflows.'}
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
          {renderActiveToolPanel()}

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
                  {soleAdminEmail || 'Administrative Access'}
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
