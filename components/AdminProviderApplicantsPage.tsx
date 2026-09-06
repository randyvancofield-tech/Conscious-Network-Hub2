import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, KeyRound, Mail, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import { BASE_URL, api, ApiError } from '../services/apiClient';
import {
  getAuthToken,
  getAdminElevationToken,
  getProviderControlSession,
  setAdminElevationToken,
} from '../services/sessionService';
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
  mimeType?: string;
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

type ApplicantDocumentKind = 'resume' | 'cover-letter';
type ApplicantDocumentDisposition = 'inline' | 'attachment';

const documentLabels: Record<ApplicantDocumentKind, string> = {
  resume: 'Resume',
  'cover-letter': 'Cover Letter',
};

const protectedApplicantBaseUrl = String(BASE_URL || '').replace(/\/+$/, '');
const previewableDocumentMimeTypes = new Set(['application/pdf', 'text/plain']);

const mimeEssence = (mimeType?: string): string =>
  String(mimeType || '').split(';')[0].trim().toLowerCase();

const canPreviewDocument = (file?: ApplicantFileRef): boolean =>
  previewableDocumentMimeTypes.has(mimeEssence(file?.mimeType));

const buildApplicantDocumentUrl = (
  applicantId: string,
  documentKind: ApplicantDocumentKind,
  disposition: ApplicantDocumentDisposition
): string =>
  `${protectedApplicantBaseUrl}/api/admin/provider-applicants/${encodeURIComponent(applicantId)}/documents/${encodeURIComponent(documentKind)}?disposition=${encodeURIComponent(disposition)}`;

const filenameFromContentDisposition = (value: string | null): string | null => {
  const header = String(value || '').trim();
  if (!header) return null;

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(header);
  if (quotedMatch?.[1]) return quotedMatch[1];
  return null;
};

const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'download';
  anchor.rel = 'noopener noreferrer';
  anchor.style.position = 'fixed';
  anchor.style.left = '-9999px';
  anchor.style.top = '0';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};

const parseDocumentError = async (response: Response): Promise<string> => {
  const fallback = `Document request failed with HTTP ${response.status}`;
  try {
    const text = await response.text();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    return String(parsed.error || parsed.message || fallback);
  } catch {
    return fallback;
  }
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
  const [elevationCode, setElevationCode] = useState('');
  const [filter, setFilter] = useState('');
  const [applicants, setApplicants] = useState<ProviderApplicantAdminRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Array<{ id: string; message: string; createdAt: string }>>([]);
  const [selected, setSelected] = useState<ProviderApplicantAdminRecord | null>(null);
  const [statusDraft, setStatusDraft] = useState('submitted');
  const [notesDraft, setNotesDraft] = useState('');
  const [applicantMessageDraft, setApplicantMessageDraft] = useState('');
  const [communicationNotice, setCommunicationNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [documentAction, setDocumentAction] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState('');
  const [error, setError] = useState('');

  const isElevated = useMemo(() => Boolean(getAdminElevationToken()), [applicants, error]);

  const elevateWithProviderControl = async (showError = true): Promise<boolean> => {
    const providerControlToken = getProviderControlSession();
    if (!providerControlToken) {
      if (showError) setError('Open Administrative Access with the founder wallet before reviewing applicants.');
      return false;
    }

    setElevating(true);
    setError('');
    try {
      const data = await api<{ elevationToken: string }>('/admin/elevate', {
        method: 'POST',
        headers: { 'X-Provider-Control-Token': providerControlToken },
        body: { providerControlToken },
      });
      setAdminElevationToken(data.elevationToken);
      await loadApplicants();
      return true;
    } catch (error) {
      if (showError) {
        setError(error instanceof Error ? error.message : 'Unable to use wallet admin session.');
      }
      return false;
    } finally {
      setElevating(false);
    }
  };

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
      const data = await api<{ applicant: ProviderApplicantAdminRecord; replies?: Array<{ id: string; message: string; createdAt: string }> }>(`/admin/provider-applicants/${encodeURIComponent(id)}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      setSelected(data.applicant);
      setReplies(data.replies || []);
      setStatusDraft(data.applicant.status || 'submitted');
      setNotesDraft(data.applicant.adminNotes || '');
      setApplicantMessageDraft('');
      setCommunicationNotice('');
      setDocumentError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load applicant detail.');
    }
  };

  useEffect(() => {
    if (getAdminElevationToken()) {
      void loadApplicants();
      return;
    }
    void elevateWithProviderControl(false);
  }, [filter]);

  useEffect(() => {
    if (selectedId && getAdminElevationToken()) void loadSelected(selectedId);
  }, [selectedId]);

  const elevate = async (event: React.FormEvent) => {
    event.preventDefault();
    const providerControlToken = getProviderControlSession();
    if (!password.trim() && !elevationCode.trim() && !providerControlToken) {
      setError('Enter an admin password, operations elevation code, or re-enter through wallet Administrative Access.');
      return;
    }
    setElevating(true);
    setError('');
    try {
      const data = await api<{ elevationToken: string }>('/admin/elevate', {
        method: 'POST',
        headers: providerControlToken ? { 'X-Provider-Control-Token': providerControlToken } : {},
        body: { password, elevationCode, providerControlToken },
      });
      setAdminElevationToken(data.elevationToken);
      setPassword('');
      setElevationCode('');
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
    setCommunicationNotice('');
    try {
      const data = await api<{
        applicant: ProviderApplicantAdminRecord;
        communication?: { internalDelivered?: boolean };
      }>(`/admin/provider-applicants/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: {
          status: statusDraft,
          adminNotes: notesDraft,
          applicantMessage: applicantMessageDraft,
        },
      });
      setSelected(data.applicant);
      setApplicantMessageDraft('');
      setCommunicationNotice(data.communication?.internalDelivered
        ? 'Status saved and correspondence delivered to the applicant mailbox.'
        : 'Status saved, but mailbox delivery could not be confirmed. Use the admin mailbox to send the update again.');
      await loadApplicants();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update applicant.');
    } finally {
      setSaving(false);
    }
  };

  const fetchApplicantDocument = async (
    applicantId: string,
    documentKind: ApplicantDocumentKind,
    disposition: ApplicantDocumentDisposition,
    file: ApplicantFileRef
  ): Promise<{ blob: Blob; filename: string; mimeType: string; contentDisposition: string }> => {
    const authToken = getAuthToken();
    const elevationToken = getAdminElevationToken();
    if (!authToken || !elevationToken) {
      throw new Error('Admin authorization and elevation are required to open applicant documents.');
    }

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${authToken}`);
    headers.set('X-Admin-Elevation-Token', elevationToken);

    const response = await fetch(buildApplicantDocumentUrl(applicantId, documentKind, disposition), {
      cache: 'no-store',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      throw new Error(await parseDocumentError(response));
    }

    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const filename =
      filenameFromContentDisposition(contentDisposition) ||
      file.originalName ||
      documentLabels[documentKind];
    const mimeType = response.headers.get('Content-Type') || file.mimeType || 'application/octet-stream';
    return {
      blob: await response.blob(),
      filename,
      mimeType,
      contentDisposition,
    };
  };

  const openApplicantDocument = async (
    documentKind: ApplicantDocumentKind,
    disposition: ApplicantDocumentDisposition,
    file?: ApplicantFileRef
  ): Promise<void> => {
    if (!selected || !file) return;

    const actionKey = `${documentKind}:${disposition}`;
    let previewWindow: Window | null = null;
    if (disposition === 'inline') {
      previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        setDocumentError('Unable to open the preview tab. Allow pop-ups for this site and try again.');
        return;
      }
      previewWindow.opener = null;
    }

    setDocumentAction(actionKey);
    setDocumentError('');
    setError('');

    try {
      const document = await fetchApplicantDocument(selected.id, documentKind, disposition, file);
      const responseDisposition = document.contentDisposition.toLowerCase();
      const shouldPreview =
        disposition === 'inline' &&
        previewWindow &&
        !responseDisposition.startsWith('attachment') &&
        previewableDocumentMimeTypes.has(mimeEssence(document.mimeType));

      if (shouldPreview && previewWindow) {
        const objectUrl = URL.createObjectURL(document.blob);
        previewWindow.location.href = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        return;
      }

      if (previewWindow) {
        previewWindow.close();
      }
      triggerBlobDownload(document.blob, document.filename);
    } catch (error) {
      if (previewWindow) {
        previewWindow.close();
      }
      setDocumentError(error instanceof Error ? error.message : 'Unable to open applicant document.');
    } finally {
      setDocumentAction(null);
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
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase text-slate-500">Elevation code</span>
              <input
                type="password"
                value={elevationCode}
                onChange={(event) => setElevationCode(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <ActionButton type="submit" disabled={elevating} icon={<ShieldCheck className="h-4 w-4" />}>
              {elevating ? 'Verifying' : 'Elevate Session'}
            </ActionButton>
            {getProviderControlSession() && (
              <ActionButton
                type="button"
                variant="secondary"
                disabled={elevating}
                onClick={() => void elevateWithProviderControl(true)}
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                Use Wallet Session
              </ActionButton>
            )}
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
                  <div className="min-w-0">
                    <p className="cnh-person-name font-bold text-white">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">{applicant.email}</p>
                  </div>
                  <span className="cnh-status-badge shrink-0 rounded-full border border-amber-200/15 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase text-amber-100">
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
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {selected.providerCategory}
                  </p>
                  <h2 className="cnh-person-name mt-2 text-2xl font-black uppercase text-white">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <p className="mt-2 break-words text-sm text-slate-400">{selected.email}</p>
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
                {documentError && <p className="mt-3 text-sm text-amber-200">{documentError}</p>}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    ['resume', selected.resumeFile],
                    ['cover-letter', selected.coverLetterFile],
                  ].map(([kind, file]) => {
                    const documentKind = kind as ApplicantDocumentKind;
                    const label = documentLabels[documentKind];
                    const ref = file as ApplicantFileRef | undefined;
                    const canPreview = canPreviewDocument(ref);
                    const previewAction = `${documentKind}:inline`;
                    const downloadAction = `${documentKind}:attachment`;
                    return (
                      <div
                        key={documentKind}
                        className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-amber-100" />
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                            <p className="mt-1 break-words leading-5">{ref?.originalName || label}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            type="button"
                            variant="secondary"
                            disabled={!ref || !canPreview || documentAction === previewAction}
                            onClick={() => void openApplicantDocument(documentKind, 'inline', ref)}
                            icon={<Eye className="h-4 w-4" />}
                            className="min-h-10 px-3 py-2"
                          >
                            {documentAction === previewAction ? 'Opening' : 'Preview'}
                          </ActionButton>
                          <ActionButton
                            type="button"
                            variant="ghost"
                            disabled={!ref || documentAction === downloadAction}
                            onClick={() => void openApplicantDocument(documentKind, 'attachment', ref)}
                            icon={<Download className="h-4 w-4" />}
                            className="min-h-10 px-3 py-2"
                          >
                            {documentAction === downloadAction ? 'Saving' : 'Download'}
                          </ActionButton>
                        </div>
                      </div>
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

              <section className="rounded-2xl border border-white/10 p-4">
                <h2 className="text-lg font-bold text-white">Applicant follow-ups</h2>
                <p className="mt-2 text-sm text-slate-300">Replies do not change approval. Review the response, then choose the next status and write an applicant-facing message below. Keep private assessments in Internal Admin Notes.</p>
                {replies.length === 0 && <p className="mt-3 text-sm text-slate-400">No replies received.</p>}
                {replies.map((reply) => <article key={reply.id} className="mt-3 rounded-xl bg-white/5 p-4">
                  <time className="text-xs text-slate-400">{new Date(reply.createdAt).toLocaleString()}</time>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white">{reply.message}</p>
                </article>)}
              </section>

              <label className="block space-y-2">
                <span className="text-sm font-black uppercase text-white">Internal Admin Notes</span>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-slate-200">Status updates are delivered inside the applicant mailbox. Use the admin mailbox for replies and attachments.</p>
                <label className="mt-4 block space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Applicant correspondence (visible in their HCN mailbox)
                  </span>
                  <textarea
                    value={applicantMessageDraft}
                    onChange={(event) => setApplicantMessageDraft(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="State what is needed, why, and the next step. Add a concise applicant-facing update."
                    className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                  />
                </label>
                {communicationNotice && (
                  <p className="mt-3 text-xs font-bold text-blue-100">{communicationNotice}</p>
                )}
              </div>
            </div>
          )}
        </SurfacePanel>
      </div>
    </PageShell>
  );
};

export default AdminProviderApplicantsPage;
