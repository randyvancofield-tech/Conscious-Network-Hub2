import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Handshake,
  LifeBuoy,
  Link2,
  Loader2,
  MessageSquare,
  Network,
  PanelLeft,
  Save,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  createNativeProviderControlSession,
  createProviderCrmCollaboration,
  createProviderCrmContent,
  createProviderCrmFollowUp,
  createProviderCrmNote,
  createProviderCrmRecord,
  createProviderRoundtableReservation,
  deleteProviderCrmCollaboration,
  deleteProviderCrmFollowUp,
  deleteProviderCrmNote,
  getProviderCrmAdminTools,
  getProviderCrmAnalytics,
  getProviderCrmSummary,
  getProviderCrmTools,
  getProviderCrmWorkspace,
  listProviderCrmCollaborations,
  listProviderCrmContent,
  listProviderCrmFollowUps,
  listProviderCrmNotes,
  ProviderCrmAnalytics,
  ProviderCrmCollaboration,
  ProviderCrmContentItem,
  ProviderCrmContentStatus,
  ProviderCrmFollowUp,
  ProviderCrmFollowUpStatus,
  ProviderCrmNote,
  ProviderCrmPriority,
  ProviderCrmRecordKind,
  ProviderCrmRecordStatus,
  ProviderCrmTool,
  ProviderCrmToolId,
  ProviderCrmWorkspace,
  ProviderRoundtableReservation,
  updateProviderCrmCollaboration,
  updateProviderCrmContent,
  updateProviderCrmFollowUp,
  updateProviderCrmNote,
  updateProviderCrmToolVisibility,
} from '../services/backendApiService';
import {
  getProviderControlSession,
  PROVIDER_SESSION_TOKEN_EVENT,
  setProviderControlSession,
} from '../services/sessionService';
import VisualRenderBoundary from './ui/VisualRenderBoundary';

interface ProviderCrmShellProps {
  user: UserProfile | null;
  onOpenAdministrativeAccess: () => void;
  onOpenProviderAccess: () => void;
}

type NoteForm = {
  title: string;
  body: string;
  category: string;
  status: ProviderCrmNote['status'];
};

type ContentForm = {
  title: string;
  description: string;
  fullDescription: string;
  category: string;
  estimatedDuration: string;
  learningObjectivesText: string;
  contentSectionsText: string;
  tier: string;
  status: ProviderCrmContentStatus;
};

type CollaborationForm = {
  title: string;
  description: string;
  status: ProviderCrmCollaboration['status'];
};

type FollowUpForm = {
  title: string;
  details: string;
  dueAt: string;
  status: ProviderCrmFollowUpStatus;
  priority: ProviderCrmPriority;
};

const emptyNoteForm: NoteForm = {
  title: '',
  body: '',
  category: 'general',
  status: 'active',
};

const emptyContentForm: ContentForm = {
  title: '',
  description: '',
  fullDescription: '',
  category: '',
  estimatedDuration: '',
  learningObjectivesText: '',
  contentSectionsText: '',
  tier: 'Professional',
  status: 'draft',
};

const emptyCollaborationForm: CollaborationForm = {
  title: '',
  description: '',
  status: 'open',
};

const buildDefaultFollowUpForm = (): FollowUpForm => {
  const due = new Date();
  due.setDate(due.getDate() + 2);
  due.setMinutes(0, 0, 0);
  return {
    title: '',
    details: '',
    dueAt: toDateTimeLocalValue(due),
    status: 'open',
    priority: 'normal',
  };
};

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

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${toDateInputValue(date)}T${hours}:${minutes}`;
}

function formatLocalDateTime(value: string | null, timezone: string): string {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(date);
}

function buildRoundtableStartIso(dateValue: string, hourValue: number): string {
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
}

function toAbsoluteAppUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined' || !window.location?.origin) return normalizedPath;
  return `${window.location.origin}${normalizedPath}`;
}

function isReservationForSlot(
  reservation: ProviderRoundtableReservation,
  dateValue: string,
  hourValue: number
): boolean {
  const start = new Date(reservation.startAt);
  return (
    toDateInputValue(start) === dateValue &&
    start.getHours() === hourValue &&
    reservation.status !== 'cancelled'
  );
}

function isRelationshipKind(kind: ProviderCrmRecordKind): boolean {
  return kind === 'client' || kind === 'organization' || kind === 'institution';
}

function linesFromText(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sectionsFromText(value: string): Array<{ title: string; body: string }> {
  return linesFromText(value).map((line, index) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0) {
      return {
        title: line.slice(0, separatorIndex).trim() || `Section ${index + 1}`,
        body: line.slice(separatorIndex + 1).trim(),
      };
    }
    return {
      title: `Section ${index + 1}`,
      body: line,
    };
  }).filter((section) => section.body);
}

function contentItemToForm(item: ProviderCrmContentItem): ContentForm {
  return {
    title: item.title,
    description: item.description,
    fullDescription: item.fullDescription || '',
    category: item.category || '',
    estimatedDuration: item.estimatedDuration || '',
    learningObjectivesText: (item.learningObjectives || []).join('\n'),
    contentSectionsText: (item.contentSections || [])
      .map((section) => `${section.title}: ${section.body}`)
      .join('\n'),
    tier: item.tier,
    status: item.status,
  };
}

function buildContentPayload(form: ContentForm) {
  return {
    title: form.title,
    description: form.description,
    fullDescription: form.fullDescription,
    category: form.category,
    estimatedDuration: form.estimatedDuration,
    learningObjectives: linesFromText(form.learningObjectivesText),
    contentSections: sectionsFromText(form.contentSectionsText),
    tier: form.tier,
    status: form.status,
  };
}

const controlClass =
  'min-w-0 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30';
const actionClass =
  'inline-flex max-w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest leading-4 text-white transition hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500';
const secondaryActionClass =
  'inline-flex max-w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest leading-4 text-slate-200 transition hover:bg-white/10 disabled:opacity-50';

const ProviderCrmShellContent: React.FC<ProviderCrmShellProps> = ({
  user,
  onOpenAdministrativeAccess,
  onOpenProviderAccess,
}) => {
  const [providerToken, setProviderToken] = useState(readProviderToken);
  const [tools, setTools] = useState<ProviderCrmTool[]>([]);
  const [adminTools, setAdminTools] = useState<ProviderCrmTool[]>([]);
  const [soleAdminEmail, setSoleAdminEmail] = useState('');
  const [activeToolId, setActiveToolId] = useState<ProviderCrmToolId>('home');
  const [status, setStatus] = useState('Loading provider CRM workspace...');
  const [isLoading, setLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [workspace, setWorkspace] = useState<ProviderCrmWorkspace | null>(null);
  const [notes, setNotes] = useState<ProviderCrmNote[]>([]);
  const [contentItems, setContentItems] = useState<ProviderCrmContentItem[]>([]);
  const [collaborations, setCollaborations] = useState<ProviderCrmCollaboration[]>([]);
  const [followUps, setFollowUps] = useState<ProviderCrmFollowUp[]>([]);
  const [analytics, setAnalytics] = useState<ProviderCrmAnalytics | null>(null);

  const [recordKindInput, setRecordKindInput] = useState<ProviderCrmRecordKind>('client');
  const [recordTitleInput, setRecordTitleInput] = useState('');
  const [recordClientInput, setRecordClientInput] = useState('');
  const [recordOrganizationInput, setRecordOrganizationInput] = useState('');
  const [recordTreatmentInput, setRecordTreatmentInput] = useState('');
  const [recordBusinessInput, setRecordBusinessInput] = useState('');
  const [recordStatusInput, setRecordStatusInput] = useState<ProviderCrmRecordStatus>('active');
  const [recordPriorityInput, setRecordPriorityInput] = useState<ProviderCrmPriority>('normal');

  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<NoteForm>(emptyNoteForm);
  const [contentEditId, setContentEditId] = useState<string | null>(null);
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContentForm);
  const [collaborationEditId, setCollaborationEditId] = useState<string | null>(null);
  const [collaborationForm, setCollaborationForm] = useState<CollaborationForm>(emptyCollaborationForm);
  const [followUpEditId, setFollowUpEditId] = useState<string | null>(null);
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>(() => buildDefaultFollowUpForm());

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
  const relationshipRecords = useMemo(
    () => (workspace?.records || []).filter((record) => isRelationshipKind(record.kind)),
    [workspace]
  );
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

  const refreshCrmData = async (tokenOverride?: string): Promise<void> => {
    const token = String(tokenOverride || providerToken).trim();
    if (!token) return;
    const [workspaceResult, noteResult, contentResult, collaborationResult, followUpResult, analyticsResult] =
      await Promise.all([
        getProviderCrmWorkspace(token, localTimezone),
        listProviderCrmNotes(token),
        listProviderCrmContent(token),
        listProviderCrmCollaborations(token),
        listProviderCrmFollowUps(token),
        getProviderCrmAnalytics(token),
      ]);
    setWorkspace(workspaceResult);
    setNotes(noteResult);
    setContentItems(contentResult);
    setCollaborations(collaborationResult);
    setFollowUps(followUpResult);
    setAnalytics(analyticsResult);
  };

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
        setNotes([]);
        setContentItems([]);
        setCollaborations([]);
        setFollowUps([]);
        setAnalytics(null);
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
        await refreshCrmData(token);
        if (cancelled) return;

        const nextTools = toolResult?.tools || [];
        setTools(nextTools);
        setAdminTools(adminToolResult?.tools || []);
        setSoleAdminEmail(adminToolResult?.soleAdminEmail || '');
        if (!nextTools.some((tool) => tool.id === activeToolId)) {
          setActiveToolId((nextTools[0]?.id || 'home') as ProviderCrmToolId);
        }
        setSummaryText(
          summaryResult?.summary
            ? `${summaryResult.summary.activeToolCount} CRM tools active | ${summaryResult.summary.shellStatus}`
            : 'Provider CRM workspace active'
        );
        setStatus(nextTools.length > 0 ? 'Provider CRM workspace active.' : 'No CRM tools are currently enabled.');
      } catch {
        if (!cancelled) setStatus('Provider CRM could not be loaded. Verify your provider session and try again.');
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
      setAdminTools((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      const refreshed = await getProviderCrmTools(token);
      setTools(refreshed?.tools || []);
      setStatus(`${updated.label} visibility saved.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async () => {
    const token = providerToken.trim();
    const title = recordTitleInput.trim();
    if (!token) return;
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
      await refreshCrmData(token);
      setStatus('CRM relationship record saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    const token = providerToken.trim();
    if (!token) return;
    if (!noteForm.title.trim() || !noteForm.body.trim()) {
      setStatus('Add a note title and body before saving.');
      return;
    }
    setLoading(true);
    try {
      const saved = noteEditId
        ? await updateProviderCrmNote(token, noteEditId, noteForm)
        : await createProviderCrmNote(token, noteForm);
      if (!saved) {
        setStatus('CRM note could not be saved.');
        return;
      }
      setNoteEditId(null);
      setNoteForm(emptyNoteForm);
      await refreshCrmData(token);
      setStatus('CRM note saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContent = async () => {
    const token = providerToken.trim();
    if (!token) return;
    if (!contentForm.title.trim() || !contentForm.description.trim()) {
      setStatus('Add a content title and description before saving.');
      return;
    }
    setLoading(true);
    try {
      const saved = contentEditId
        ? await updateProviderCrmContent(token, contentEditId, buildContentPayload(contentForm))
        : await createProviderCrmContent(token, buildContentPayload(contentForm));
      if (!saved) {
        setStatus('Content item could not be saved.');
        return;
      }
      setContentEditId(null);
      setContentForm(emptyContentForm);
      await refreshCrmData(token);
      setStatus('Content item saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCollaboration = async () => {
    const token = providerToken.trim();
    if (!token) return;
    if (!collaborationForm.title.trim() || !collaborationForm.description.trim()) {
      setStatus('Add a collaboration title and description before saving.');
      return;
    }
    setLoading(true);
    try {
      const saved = collaborationEditId
        ? await updateProviderCrmCollaboration(token, collaborationEditId, collaborationForm)
        : await createProviderCrmCollaboration(token, collaborationForm);
      if (!saved) {
        setStatus('Collaboration item could not be saved.');
        return;
      }
      setCollaborationEditId(null);
      setCollaborationForm(emptyCollaborationForm);
      await refreshCrmData(token);
      setStatus('Collaboration item saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFollowUp = async () => {
    const token = providerToken.trim();
    if (!token) return;
    if (!followUpForm.title.trim()) {
      setStatus('Add a follow-up title before saving.');
      return;
    }
    setLoading(true);
    try {
      const input = {
        ...followUpForm,
        dueAt: followUpForm.dueAt ? new Date(followUpForm.dueAt).toISOString() : null,
      };
      const saved = followUpEditId
        ? await updateProviderCrmFollowUp(token, followUpEditId, input)
        : await createProviderCrmFollowUp(token, input);
      if (!saved) {
        setStatus('Follow-up could not be saved.');
        return;
      }
      setFollowUpEditId(null);
      setFollowUpForm(buildDefaultFollowUpForm());
      await refreshCrmData(token);
      setStatus('Follow-up saved.');
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
      await refreshCrmData(token);
      setStatus(`Conscious Roundtable Room ${reservation.roomNumber} reserved.`);
    } finally {
      setLoading(false);
    }
  };

  const renderMetric = (
    icon: React.ReactNode,
    label: string,
    value: number | string,
    tone: 'blue' | 'amber' | 'teal' | 'indigo' | 'emerald' | 'red' = 'blue'
  ): React.ReactNode => {
    const toneClass =
      tone === 'amber'
        ? 'border-amber-300/20 bg-amber-500/[0.05] text-amber-100'
        : tone === 'teal'
          ? 'border-teal-300/20 bg-teal-500/[0.05] text-teal-100'
          : tone === 'indigo'
            ? 'border-indigo-300/20 bg-indigo-500/[0.05] text-indigo-100'
            : tone === 'emerald'
              ? 'border-emerald-300/20 bg-emerald-500/[0.05] text-emerald-100'
              : tone === 'red'
                ? 'border-red-300/20 bg-red-500/[0.05] text-red-100'
                : 'border-blue-300/20 bg-blue-500/[0.05] text-blue-100';
    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20">
          {icon}
        </div>
        <p className="cnh-profile-field text-2xl font-black text-white">{value}</p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 leading-4">{label}</p>
      </div>
    );
  };

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
          <span className="cnh-status-badge rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300">
            {localTimezone}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {renderMetric(<Users className="h-4 w-4" />, 'Active care relationships', workspace?.metrics.treatment.activeClientRecords || 0)}
          {renderMetric(<ClipboardList className="h-4 w-4" />, 'Open follow-ups', analytics?.followUps.open || 0, 'amber')}
          {renderMetric(<Building2 className="h-4 w-4" />, 'Organizations / institutions', workspace?.metrics.businessGrowth.organizationsTracked || 0, 'teal')}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {renderMetric(<CalendarClock className="h-4 w-4" />, 'Upcoming Roundtables', workspace?.metrics.treatment.upcomingRoundtables || 0, 'indigo')}
          {renderMetric(<Handshake className="h-4 w-4" />, 'Contract opportunities', workspace?.metrics.businessGrowth.institutionContractOpportunities || 0, 'emerald')}
          {renderMetric(<Target className="h-4 w-4" />, 'Urgent opportunities', workspace?.metrics.businessGrowth.urgentOpportunities || 0, 'red')}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Actionable Guidance</h3>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {(workspace?.guidanceAlerts || []).map((alert) => (
            <div key={alert.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">{alert.severity}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-widest text-white">{alert.title}</p>
              <p className="mt-2 text-xs leading-6 text-slate-300">{alert.detail}</p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{alert.action}</p>
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

  const renderRelationshipWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-500/10 text-teal-100">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Add Treatment / Business Record</h3>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
              Provider records are server-scoped to the owner. Admin sees the holistic view.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <select value={recordKindInput} onChange={(event) => setRecordKindInput(event.target.value as ProviderCrmRecordKind)} className={`lg:col-span-2 ${controlClass}`}>
            <option value="client">User / Client</option>
            <option value="organization">Organization</option>
            <option value="institution">Institution</option>
          </select>
          <input value={recordTitleInput} onChange={(event) => setRecordTitleInput(event.target.value)} placeholder="Record title" className={`lg:col-span-4 ${controlClass}`} />
          <input value={recordClientInput} onChange={(event) => setRecordClientInput(event.target.value)} placeholder="User/client name or handle" className={`lg:col-span-3 ${controlClass}`} />
          <input value={recordOrganizationInput} onChange={(event) => setRecordOrganizationInput(event.target.value)} placeholder="Organization / institution" className={`lg:col-span-3 ${controlClass}`} />
          <textarea value={recordTreatmentInput} onChange={(event) => setRecordTreatmentInput(event.target.value)} placeholder="Treatment focus / service delivery notes" className={`lg:col-span-3 min-h-[110px] ${controlClass}`} />
          <textarea value={recordBusinessInput} onChange={(event) => setRecordBusinessInput(event.target.value)} placeholder="Business growth / contract opportunity notes" className={`lg:col-span-3 min-h-[110px] ${controlClass}`} />
          <select value={recordStatusInput} onChange={(event) => setRecordStatusInput(event.target.value as ProviderCrmRecordStatus)} className={`lg:col-span-2 ${controlClass}`}>
            <option value="active">Active</option>
            <option value="watching">Watching</option>
            <option value="contracting">Contracting</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <select value={recordPriorityInput} onChange={(event) => setRecordPriorityInput(event.target.value as ProviderCrmPriority)} className={`lg:col-span-2 ${controlClass}`}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button type="button" onClick={() => void handleCreateRecord()} disabled={isLoading} className={`lg:col-span-2 ${actionClass}`}>
            <Save className="h-3.5 w-3.5" />
            Save Record
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Connected Records</h3>
        <div className="mt-4 space-y-3">
          {relationshipRecords.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No CRM relationship records yet. Add the first user, organization, or institution interaction above.
            </p>
          )}
          {relationshipRecords.map((record) => (
            <div key={record.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{record.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {record.kind} | {record.status} | {record.priority}
                  </p>
                </div>
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

  const renderNotesWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          {noteEditId ? 'Edit Private Note' : 'Create Private Note'}
        </h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <input value={noteForm.title} onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })} placeholder="Note title" className={`lg:col-span-3 ${controlClass}`} />
          <input value={noteForm.category} onChange={(event) => setNoteForm({ ...noteForm, category: event.target.value })} placeholder="Category" className={`lg:col-span-2 ${controlClass}`} />
          <select value={noteForm.status} onChange={(event) => setNoteForm({ ...noteForm, status: event.target.value as ProviderCrmNote['status'] })} className={`lg:col-span-1 ${controlClass}`}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <textarea value={noteForm.body} onChange={(event) => setNoteForm({ ...noteForm, body: event.target.value })} placeholder="Private note body" className={`lg:col-span-6 min-h-[140px] ${controlClass}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSaveNote()} disabled={isLoading} className={actionClass}>
            <Save className="h-3.5 w-3.5" />
            {noteEditId ? 'Update Note' : 'Save Note'}
          </button>
          {noteEditId && (
            <button type="button" onClick={() => { setNoteEditId(null); setNoteForm(emptyNoteForm); }} className={secondaryActionClass}>
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Private Notes</h3>
        <div className="mt-4 space-y-3">
          {notes.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No private CRM notes yet.
            </p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{note.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {note.category} | {note.status} | {formatLocalDateTime(note.updatedAt, localTimezone)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" className={secondaryActionClass} onClick={() => { setNoteEditId(note.id); setNoteForm({ title: note.title, body: note.body, category: note.category, status: note.status }); }}>
                    Edit
                  </button>
                  <button type="button" className={secondaryActionClass} onClick={async () => { const token = providerToken.trim(); if (!token) return; setLoading(true); try { await deleteProviderCrmNote(token, note.id); await refreshCrmData(token); setStatus('CRM note deleted.'); } finally { setLoading(false); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{note.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderContentWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          {contentEditId ? 'Edit Course / Content Item' : 'Create Draft Course / Content Item'}
        </h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <input value={contentForm.title} onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })} placeholder="Title" className={`lg:col-span-3 ${controlClass}`} />
          <select value={contentForm.tier} onChange={(event) => setContentForm({ ...contentForm, tier: event.target.value })} className={`lg:col-span-1 ${controlClass}`}>
            <option value="Basic">Basic</option>
            <option value="Professional">Professional</option>
            <option value="Elite">Elite</option>
          </select>
          <select value={contentForm.status} onChange={(event) => setContentForm({ ...contentForm, status: event.target.value as ProviderCrmContentStatus })} className={`lg:col-span-2 ${controlClass}`}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <input value={contentForm.category} onChange={(event) => setContentForm({ ...contentForm, category: event.target.value })} placeholder="Category / topic" className={`lg:col-span-3 ${controlClass}`} />
          <input value={contentForm.estimatedDuration} onChange={(event) => setContentForm({ ...contentForm, estimatedDuration: event.target.value })} placeholder="Estimated duration" className={`lg:col-span-3 ${controlClass}`} />
          <textarea value={contentForm.description} onChange={(event) => setContentForm({ ...contentForm, description: event.target.value })} placeholder="Short catalog description" className={`lg:col-span-6 min-h-[100px] ${controlClass}`} />
          <textarea value={contentForm.fullDescription} onChange={(event) => setContentForm({ ...contentForm, fullDescription: event.target.value })} placeholder="Full course description / body" className={`lg:col-span-6 min-h-[150px] ${controlClass}`} />
          <textarea value={contentForm.learningObjectivesText} onChange={(event) => setContentForm({ ...contentForm, learningObjectivesText: event.target.value })} placeholder="Learning objectives, one per line" className={`lg:col-span-3 min-h-[130px] ${controlClass}`} />
          <textarea value={contentForm.contentSectionsText} onChange={(event) => setContentForm({ ...contentForm, contentSectionsText: event.target.value })} placeholder="Content sections, one per line. Use Title: body" className={`lg:col-span-3 min-h-[130px] ${controlClass}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSaveContent()} disabled={isLoading} className={actionClass}>
            <Save className="h-3.5 w-3.5" />
            {contentEditId ? 'Update Content' : 'Save Draft'}
          </button>
          {contentEditId && (
            <button type="button" onClick={() => { setContentEditId(null); setContentForm(emptyContentForm); }} className={secondaryActionClass}>
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Course / Content Items</h3>
        <div className="mt-4 space-y-3">
          {contentItems.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No provider-owned course or content items yet.
            </p>
          )}
          {contentItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{item.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {item.status} | {item.tier} | enrolled {item.enrolledCount}
                  </p>
                </div>
                <button type="button" className={secondaryActionClass} onClick={() => { setContentEditId(item.id); setContentForm(contentItemToForm(item)); }}>
                  Edit
                </button>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-300">{item.description}</p>
              {(item.category || item.estimatedDuration) && (
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {[item.category, item.estimatedDuration].filter(Boolean).join(' | ')}
                </p>
              )}
              {item.fullDescription && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-400">{item.fullDescription}</p>
              )}
              {(item.learningObjectives || []).length > 0 && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Learning Objectives</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-6 text-slate-300">
                    {(item.learningObjectives || []).map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(item.contentSections || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(item.contentSections || []).map((section, index) => (
                    <div key={`${section.title}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">{section.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-300">{section.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderCollaborationWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          {collaborationEditId ? 'Edit Collaboration Record' : 'Create Collaboration Record'}
        </h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <input value={collaborationForm.title} onChange={(event) => setCollaborationForm({ ...collaborationForm, title: event.target.value })} placeholder="Topic / title" className={`lg:col-span-4 ${controlClass}`} />
          <select value={collaborationForm.status} onChange={(event) => setCollaborationForm({ ...collaborationForm, status: event.target.value as ProviderCrmCollaboration['status'] })} className={`lg:col-span-2 ${controlClass}`}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <textarea value={collaborationForm.description} onChange={(event) => setCollaborationForm({ ...collaborationForm, description: event.target.value })} placeholder="Coordination message or handoff description" className={`lg:col-span-6 min-h-[130px] ${controlClass}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSaveCollaboration()} disabled={isLoading} className={actionClass}>
            <Save className="h-3.5 w-3.5" />
            {collaborationEditId ? 'Update Collaboration' : 'Save Collaboration'}
          </button>
          {collaborationEditId && (
            <button type="button" onClick={() => { setCollaborationEditId(null); setCollaborationForm(emptyCollaborationForm); }} className={secondaryActionClass}>
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Collaboration Records</h3>
        <div className="mt-4 space-y-3">
          {collaborations.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No provider collaboration records yet.
            </p>
          )}
          {collaborations.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{item.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {item.status} | {formatLocalDateTime(item.updatedAt, localTimezone)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" className={secondaryActionClass} onClick={() => { setCollaborationEditId(item.id); setCollaborationForm({ title: item.title, description: item.description, status: item.status }); }}>
                    Edit
                  </button>
                  <button type="button" className={secondaryActionClass} onClick={async () => { const token = providerToken.trim(); if (!token) return; setLoading(true); try { await deleteProviderCrmCollaboration(token, item.id); await refreshCrmData(token); setStatus('Collaboration item deleted.'); } finally { setLoading(false); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderFollowUpsWorkspace = (): React.ReactNode => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          {followUpEditId ? 'Edit Follow-Up' : 'Create Follow-Up'}
        </h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <input value={followUpForm.title} onChange={(event) => setFollowUpForm({ ...followUpForm, title: event.target.value })} placeholder="Follow-up title" className={`lg:col-span-3 ${controlClass}`} />
          <input type="datetime-local" value={followUpForm.dueAt} onChange={(event) => setFollowUpForm({ ...followUpForm, dueAt: event.target.value })} className={`lg:col-span-1 ${controlClass}`} />
          <select value={followUpForm.status} onChange={(event) => setFollowUpForm({ ...followUpForm, status: event.target.value as ProviderCrmFollowUpStatus })} className={`lg:col-span-1 ${controlClass}`}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <select value={followUpForm.priority} onChange={(event) => setFollowUpForm({ ...followUpForm, priority: event.target.value as ProviderCrmPriority })} className={`lg:col-span-1 ${controlClass}`}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <textarea value={followUpForm.details} onChange={(event) => setFollowUpForm({ ...followUpForm, details: event.target.value })} placeholder="Follow-up details" className={`lg:col-span-6 min-h-[120px] ${controlClass}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSaveFollowUp()} disabled={isLoading} className={actionClass}>
            <Save className="h-3.5 w-3.5" />
            {followUpEditId ? 'Update Follow-Up' : 'Save Follow-Up'}
          </button>
          {followUpEditId && (
            <button type="button" onClick={() => { setFollowUpEditId(null); setFollowUpForm(buildDefaultFollowUpForm()); }} className={secondaryActionClass}>
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">Follow-Ups</h3>
        <div className="mt-4 space-y-3">
          {followUps.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-400">
              No follow-ups yet.
            </p>
          )}
          {followUps.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white">{item.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {item.status} | {item.priority} | due {formatLocalDateTime(item.dueAt, localTimezone)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" className={secondaryActionClass} onClick={() => { setFollowUpEditId(item.id); setFollowUpForm({ title: item.title, details: item.details || '', dueAt: item.dueAt ? toDateTimeLocalValue(new Date(item.dueAt)) : '', status: item.status, priority: item.priority }); }}>
                    Edit
                  </button>
                  <button type="button" className={secondaryActionClass} onClick={async () => { const token = providerToken.trim(); if (!token) return; setLoading(true); try { await deleteProviderCrmFollowUp(token, item.id); await refreshCrmData(token); setStatus('Follow-up deleted.'); } finally { setLoading(false); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
              {item.details && <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{item.details}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderAnalyticsWorkspace = (): React.ReactNode => {
    const membershipEntries = Object.entries(analytics?.admin?.membershipsByTier || {});
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Operational Analytics</h3>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                These metrics are aggregate counts from the provider workspace areas available to the current role.
              </p>
            </div>
            <span className="cnh-status-badge rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300">
              {analytics?.scope.visibility || 'scoped'}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {renderMetric(<Users className="h-4 w-4" />, 'Relationship records', analytics?.relationships.total || 0)}
            {renderMetric(<ClipboardList className="h-4 w-4" />, 'Notes', analytics?.notes.total || 0, 'teal')}
            {renderMetric(<Network className="h-4 w-4" />, 'Collaboration records', analytics?.collaboration.total || 0, 'indigo')}
            {renderMetric(<CalendarClock className="h-4 w-4" />, 'Follow-ups due', analytics?.followUps.due || 0, 'amber')}
            {renderMetric(<BookOpen className="h-4 w-4" />, 'Content items', analytics?.content.total || 0, 'emerald')}
            {renderMetric(<CalendarClock className="h-4 w-4" />, 'Meetings', analytics?.meetings.total || 0, 'blue')}
          </div>
        </section>

        {analytics?.admin && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Administrator Aggregates</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {renderMetric(<Users className="h-4 w-4" />, 'Provider applicants', analytics.admin.providerApplicants.total)}
              {renderMetric(<Target className="h-4 w-4" />, 'Pending applicants', analytics.admin.providerApplicants.pending, 'amber')}
              {renderMetric(<CheckCircle2 className="h-4 w-4" />, 'Approved providers', analytics.admin.approvedProviders, 'emerald')}
              {renderMetric(<MessageSquare className="h-4 w-4" />, 'AI interactions tracked', analytics.admin.aiInteractions.total, 'indigo')}
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Membership tiers</p>
              {membershipEntries.length === 0 ? (
                <p className="mt-3 text-xs leading-6 text-slate-400">No membership aggregate rows are available yet.</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {membershipEntries.map(([tier, count]) => (
                    <div key={tier} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-sm font-black text-white">{count}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{tier}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    );
  };

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
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Conscious Roundtable</p>
              <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">Reserve 1 of 12 Private Rooms</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Each reservation creates a CNH-native meeting session and branded room link for providers,
                users, administrators, and institutional partners.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-100">
              {localTimezone}
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-6">
            <input value={roundtableTitleInput} onChange={(event) => setRoundtableTitleInput(event.target.value)} placeholder="Roundtable title" className={`lg:col-span-2 ${controlClass}`} />
            <input type="date" value={roundtableDateInput} onChange={(event) => setRoundtableDateInput(event.target.value)} className={`lg:col-span-1 ${controlClass}`} />
            <select value={roundtableHourInput} onChange={(event) => setRoundtableHourInput(Number(event.target.value))} className={`lg:col-span-1 ${controlClass}`}>
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {`${hour}`.padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <select value={roundtableRoomInput} onChange={(event) => setRoundtableRoomInput(Number(event.target.value))} className={`lg:col-span-1 ${controlClass}`}>
              {rooms.map((room) => (
                <option key={room} value={room} disabled={reservedRoomsForSelectedHour.has(room)}>
                  Room {room}{reservedRoomsForSelectedHour.has(room) ? ' reserved' : ''}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void handleReserveRoundtable()} disabled={isLoading || reservedRoomsForSelectedHour.has(roundtableRoomInput)} className={actionClass}>
              Reserve
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">12-Room Hour Grid</h3>
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
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Branded Room Frame</h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {selectedReservationUrl ? (
                <iframe title="Conscious Roundtable" src={selectedReservationUrl} className="h-[320px] w-full" />
              ) : (
                <div className="flex h-[320px] items-center justify-center p-6 text-center text-xs leading-6 text-slate-400">
                  Reserve a room to generate the private Conscious Roundtable frame.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Reserved Roundtables</h3>
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
                      className={secondaryActionClass}
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
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Best Practices & Knowledge Center</h3>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
            Standardized provider operating guidance for consistent service delivery.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {(workspace?.resources || []).map((resource) => (
          <div key={resource.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">{resource.category}</p>
            <h4 className="mt-2 text-sm font-black uppercase tracking-widest text-white">{resource.title}</h4>
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

  const renderFallbackPanel = (): React.ReactNode => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        Select a CRM tool to begin.
      </p>
    </div>
  );

  const renderActiveToolPanel = (): React.ReactNode => {
    if (!activeTool) return renderFallbackPanel();
    if (activeTool.id === 'home') return renderBusinessHome();
    if (activeTool.id === 'members' || activeTool.id === 'referrals') return renderRelationshipWorkspace();
    if (activeTool.id === 'notes') return renderNotesWorkspace();
    if (activeTool.id === 'content-courses') return renderContentWorkspace();
    if (activeTool.id === 'collaboration') return renderCollaborationWorkspace();
    if (activeTool.id === 'follow-ups') return renderFollowUpsWorkspace();
    if (activeTool.id === 'analytics') return renderAnalyticsWorkspace();
    if (activeTool.id === 'sessions' || activeTool.id === 'roundtable') return renderRoundtable();
    if (activeTool.id === 'resources' || activeTool.id === 'knowledge-center') return renderKnowledgeCenter();
    return renderFallbackPanel();
  };

  if (!user || (user.role !== 'provider' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.04] p-6 sm:p-8">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Provider CRM Unavailable</h2>
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
    <div className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-300">
            {isAdmin ? 'Administrative Portal' : 'Provider Portal'}
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
            {isAdmin ? 'Provider CRM / Admin Operations' : 'Provider CRM'}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            {isAdmin
              ? 'Founder and administrator workspace for provider operations, CRM controls, tool visibility, and platform oversight.'
              : 'Approved-provider workspace for relationships, notes, content, collaboration, follow-ups, sessions, resources, and impact metrics.'}
          </p>
        </div>
        <div className="max-w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {isLoading ? 'Syncing' : summaryText || status}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[260px_1fr] 2xl:grid-cols-[280px_1fr]">
        <aside className="grid gap-3 sm:grid-cols-2 xl:block xl:space-y-3">
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
                <span className="cnh-action-label min-w-0 flex-1 text-[10px] font-black uppercase tracking-widest leading-4">
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

        <main className="min-w-0 space-y-6">
          {renderActiveToolPanel()}

          {isAdmin && adminTools.length > 0 && (
            <section className="rounded-2xl border border-teal-300/20 bg-teal-500/[0.04] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Provider CRM Admin Controls</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-300">
                    Tool visibility controls for the sole Provider CRM administrator.
                  </p>
                </div>
                <span className="cnh-status-badge max-w-full rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-teal-100">
                  {soleAdminEmail || 'Administrative Access'}
                </span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {adminTools.map((tool) => (
                  <div key={tool.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 xs:flex-row xs:items-center xs:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white">{tool.label}</p>
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

const ProviderCrmShell: React.FC<ProviderCrmShellProps> = (props) => (
  <VisualRenderBoundary moduleName="ProviderCrmShell" fallbackTitle="Provider CRM could not render.">
    <ProviderCrmShellContent {...props} />
  </VisualRenderBoundary>
);

export default ProviderCrmShell;
