import React, { useEffect, useMemo, useState } from 'react';
import { FileText, KeyRound, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import { api, ApiError } from '../services/apiClient';
import { getAdminElevationToken, setAdminElevationToken } from '../services/sessionService';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

const statuses = [
  'submitted',
  'under_review',
  'discovery_scheduled',
  'approved',
  'rejected',
  'needs_more_info',
];

interface ApplicantFileRef {
  originalName?: string;
  url?: string;
  objectKey?: string;
}

interface ProviderApplicantAdminRecord {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  providerCategory: string;
  organizationName?: string | null;
  professionalTitle?: string | null;
  serviceArea?: string | null;
  servicesOffered?: string[] | string | null;
  targetAudience?: string | null;
  credentialsText?: string | null;
  resumeFile?: ApplicantFileRef;
  coverLetterFile?: ApplicantFileRef;
  alignmentAnswers?: Record<string, string>;
  status: string;
  adminNotes?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
  calendlyShownAt?: string | null;
}

const adminHeaders = (): HeadersInit => {
  const token = getAdminElevationToken();
  return token ? { 'X-Admin-Elevation-Token': token } : {};
};

const formatLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
};

const AdminProviderApplicantsPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [filter, setFilter] = useState('');
  const [applicants, setApplicants] = useState<ProviderApplicantAdminRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderApplicantAdminRecord | null>(null);
  const [statusDraft, setStatusDraft] = useState('submitted');
  const [notesDraft, setNotesDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [error, setError] = useState('');

  const isElevated = useMemo(() => Boolean(getAdminElevationToken()), [applicants, error]);

  const loadApplicants = async () => {
    setLoading(true);
    setError('');
    try {
      const query = filter ? `?status=${encodeURIComponent(filter)}` : '';
      const data = await api<{ applicants: ProviderApplicantAdminRecord[] }>(`/admin/provider-applicants${query}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      setApplicants(data.applicants || []);
      if (!selectedId && data.applicants?.[0]) {
        setSelectedId(data.applicants[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setAdminElevationToken('');
        setError('Admin elevation is required to manage provider applicants.');
        return;
      }
      setError(error instanceof Error ? error.message : 'Unable to load provider applicants.');
    } finally {
      setLoading(false);
    }
  };

  const loadSelected = async (id: string) => {
    setError('');
    try {
      const data = await api<{ applicant: ProviderApplicantAdminRecord }>(`/admin/provider-applicants/${encodeURIComponent(id)}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      setSelected(data.applicant);
      setStatusDraft(data.applicant.status || 'submitted');
      setNotesDraft(data.applicant.adminNotes || '');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load applicant detail.');
    }
  };

  useEffect(() => {
    if (getAdminElevationToken()) void loadApplicants();
  }, [filter]);

  useEffect(() => {
    if (selectedId && getAdminElevationToken()) void loadSelected(selectedId);
  }, [selectedId]);

  const elevate = async (event: React.FormEvent) => {
    event.preventDefault();
    setElevating(true);
    setError('');
    try {
      const data = await api<{ elevationToken: string }>('/admin/elevate', {
        method: 'POST',
        body: { password },
      });
      setAdminElevationToken(data.elevationToken);
      setPassword('');
      await loadApplicants();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to elevate admin session.');
    } finally {
      setElevating(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const data = await api<{ applicant: ProviderApplicantAdminRecord }>(`/admin/provider-applicants/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: {
          status: statusDraft,
          adminNotes: notesDraft,
        },
      });
      setSelected(data.applicant);
      await loadApplicants();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update applicant.');
    } finally {
      setSaving(false);
    }
  };

  if (!isElevated) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Admin Review"
          title="Provider Applicants"
          description="Applicant submissions require elevated admin access before review materials are shown."
        />
        <SurfacePanel className="max-w-xl">
          <form onSubmit={elevate} className="space-y-5">
            <div className="flex items-center gap-3 text-blue-200">
              <KeyRound className="h-5 w-5" />
              <span className="text-xs font-black uppercase">Elevated Authentication</span>
            </div>
            {error && <p className="text-sm text-amber-200">{error}</p>}
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase text-slate-500">Admin password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                required
              />
            </label>
            <ActionButton type="submit" disabled={elevating} icon={<ShieldCheck className="h-4 w-4" />}>
              {elevating ? 'Verifying' : 'Elevate Session'}
            </ActionButton>
          </form>
        </SurfacePanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin Review"
        title="Provider Applicants"
        description="Review native CNH provider applications, add internal notes, and update applicant status."
        actions={
          <ActionButton type="button" variant="secondary" onClick={loadApplicants} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </ActionButton>
        }
      />

      {error && <EmptyState title="Applicant management notice" description={error} />}

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <SurfacePanel className="overflow-hidden">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-amber-200" />
              <h2 className="text-sm font-black uppercase text-white">Applicant Queue</h2>
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{formatLabel(status)}</option>
              ))}
            </select>
          </div>

          {loading && <p className="text-sm text-slate-400">Loading applicants...</p>}
          {!loading && applicants.length === 0 && (
            <p className="text-sm text-slate-400">No provider applicants match this filter.</p>
          )}
          <div className="space-y-3">
            {applicants.map((applicant) => (
              <button
                key={applicant.id}
                type="button"
                onClick={() => setSelectedId(applicant.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedId === applicant.id
                    ? 'border-amber-200/40 bg-amber-400/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{applicant.email}</p>
                  </div>
                  <span className="rounded-full border border-amber-200/15 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase text-amber-100">
                    {formatLabel(applicant.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase text-slate-400">{applicant.providerCategory}</p>
              </button>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel>
          {!selected && (
            <EmptyState title="Select an applicant" description="Open a provider applicant to review credentials, files, answers, and internal notes." />
          )}

          {selected && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {selected.providerCategory}
                  </p>
                  <h2 className="mt-2 text-2xl font-black uppercase text-white">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">{selected.email}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-xs text-white"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>{formatLabel(status)}</option>
                    ))}
                  </select>
                  <ActionButton type="button" onClick={save} disabled={saving} icon={<Save className="h-4 w-4" />}>
                    {saving ? 'Saving' : 'Save'}
                  </ActionButton>
                </div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Submitted</p>
                  <p className="mt-1 text-slate-200">
                    {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Title</p>
                  <p className="mt-1 text-slate-200">{selected.professionalTitle || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Service Area</p>
                  <p className="mt-1 text-slate-200">{selected.serviceArea || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Organization</p>
                  <p className="mt-1 text-slate-200">{selected.organizationName || 'Not provided'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-white">Documents</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    ['Resume', selected.resumeFile],
                    ['Cover Letter', selected.coverLetterFile],
                  ].map(([label, file]) => {
                    const ref = file as ApplicantFileRef | undefined;
                    return (
                      <a
                        key={String(label)}
                        href={ref?.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        <FileText className="h-5 w-5 text-amber-100" />
                        <span className="min-w-0 truncate">{ref?.originalName || String(label)}</span>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-white">Services</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{selected.targetAudience || 'Target audience not provided.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {toList(selected.servicesOffered).map((service) => (
                    <span key={service} className="rounded-full border border-amber-200/15 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-white">Credentials</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {selected.credentialsText || 'No credential summary provided.'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-white">Mission Answers</h3>
                <div className="mt-3 space-y-4">
                  {Object.entries(selected.alignmentAnswers || {}).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {formatLabel(key)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-black uppercase text-white">Internal Admin Notes</span>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
            </div>
          )}
        </SurfacePanel>
      </div>
    </PageShell>
  );
};

export default AdminProviderApplicantsPage;
