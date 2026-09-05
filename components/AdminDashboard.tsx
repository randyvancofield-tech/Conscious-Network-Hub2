import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, Download, Eye, EyeOff, FileArchive, FileText, Inbox, KeyRound, LockKeyhole, MessageSquare, RefreshCw, ShieldCheck, Trash2, UnlockKeyhole, UserPlus, Users } from 'lucide-react';
import { BASE_URL, api, ApiError } from '../services/apiClient';
import {
  getAuthToken,
  getAdminElevationToken,
  getCachedAuthUser,
  getProviderControlSession,
  setAdminElevationToken,
} from '../services/sessionService';
import {
  isVideoMediaAsset,
  normalizeMediaAsset,
  type NormalizedMediaAsset,
} from '../services/mediaAssets';
import { ActionButton, EmptyState, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type AdminRole = 'user' | 'provider' | 'admin';

interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  tier: string | null;
  subscriptionStatus: string | null;
  providerApproved: boolean;
  providerApprovalStatus: string | null;
  twoFactorMethod: string;
  lockoutUntil: string | null;
  locked?: boolean;
  createdAt: string;
}

interface AdminDashboardPayload {
  soleAdminEmail?: string;
  summary: {
    usersTotal: number;
    roleCounts: Record<AdminRole, number>;
    activeMemberships: number;
    providerApproved: number;
    coursesTotal?: number;
    courseEnrollmentsTotal?: number;
    adminMessagesTotal?: number;
    adminMessagesOpen?: number;
    adminMessagesUrgent?: number;
    providerApplicationsTotal?: number;
    providerApplicationsPending?: number;
    grantApplicationsTotal?: number;
    grantApplicationsPending?: number;
    submissionsTotal?: number;
    auditEventsRecent?: number;
    auditDeniedRecent?: number;
    auditErrorsRecent?: number;
  };
  recentUsers: AdminUserSummary[];
  recentSocialPosts?: AdminSocialPostSummary[];
  courseGovernance?: AdminCourseGovernance;
  adminInbox?: AdminInboxPayload;
  submissions?: AdminSubmissionsPayload;
  recentAuditEvents?: AdminAuditEventRecord[];
}

type AdminMessageStatus = 'new' | 'reviewing' | 'in_progress' | 'resolved' | 'archived';
type AdminMessagePriority = 'low' | 'normal' | 'high' | 'urgent';
type AdminConsoleSection = 'overview' | 'submissions' | 'messages' | 'courses' | 'users' | 'content' | 'audit';

interface AdminMessageSummary {
  total: number;
  new: number;
  reviewing: number;
  inProgress: number;
  resolved: number;
  archived: number;
  high: number;
  urgent: number;
}

interface AdminMessageRecord {
  id: string;
  type: string;
  status: AdminMessageStatus;
  priority: AdminMessagePriority;
  subject: string;
  message: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterUserId: string | null;
  route: string | null;
  category: string | null;
  source: string;
  recipientEmail: string;
  metadata: Record<string, unknown> | null;
  aiAnalysis: string | null;
  adminNotes: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminInboxPayload {
  recipientEmail: string;
  summary: AdminMessageSummary;
  recent: AdminMessageRecord[];
}

interface AdminSubmissionFileSummary {
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageProvider?: string | null;
}

interface AdminSubmissionRecord {
  id: string;
  type: 'provider_application' | 'grant_application';
  status: string;
  submittedAt: string | null;
  updatedAt: string | null;
  title: string;
  applicantName: string | null;
  applicantEmail: string | null;
  category: string | null;
  summary: Record<string, unknown>;
  files?: Record<string, AdminSubmissionFileSummary | null | unknown>;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: AdminRole;
    tier: string | null;
  } | null;
}

interface AdminSubmissionsPayload {
  providerApplications: AdminSubmissionRecord[];
  grantApplications: AdminSubmissionRecord[];
  adminMessages: AdminMessageRecord[];
}

interface AdminAuditEventRecord {
  at: string;
  domain: string;
  action: string;
  outcome: 'success' | 'deny' | 'error';
  actorUserId: string | null;
  targetUserId: string | null;
  statusCode: number | null;
  request?: {
    method?: string;
    path?: string;
    ipHash?: string | null;
    origin?: string | null;
    userAgentHash?: string | null;
    requestId?: string | null;
  };
  metadata?: Record<string, unknown>;
}

interface AdminSocialPostSummary {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string | null;
  authorRole?: string | null;
  authorTier?: string | null;
  authorAvatarUrl?: string | null;
  authorAvatarMedia?: {
    url?: string | null;
    storageProvider?: string | null;
    objectKey?: string | null;
    mimeType?: string | null;
    mediaType?: string | null;
  } | null;
  text: string;
  visibility: 'public' | 'private';
  mediaCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminCourseEnrollmentSummary {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userRole: AdminRole;
  userTier: string | null;
  status: string;
  progressScore: number;
}

interface AdminCourseSummary {
  id: string;
  title: string;
  provider: string;
  tier: string;
  requiredMembershipTier: string;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  enrolledCount: number;
  actualEnrollmentCount: number;
  enrollments: AdminCourseEnrollmentSummary[];
}

interface AdminCourseAssignableUser {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  tier: string | null;
  membershipStatus: string | null;
  providerApproved: boolean;
}

interface AdminCourseGovernance {
  courses: AdminCourseSummary[];
  providers: AdminCourseAssignableUser[];
  assignableUsers: AdminCourseAssignableUser[];
}

const adminHeaders = (): HeadersInit => {
  const token = getAdminElevationToken();
  return token ? { 'X-Admin-Elevation-Token': token } : {};
};

type ProviderApplicantDocumentKind = 'resume' | 'cover-letter';
type ProviderApplicantDocumentDisposition = 'inline' | 'attachment';

const PROVIDER_APPLICANT_DELETE_CONFIRMATION = 'DELETE PROVIDER SUBMISSION';
const protectedAdminBaseUrl = String(BASE_URL || '').replace(/\/+$/, '');
const providerApplicantDocumentLabels: Record<ProviderApplicantDocumentKind, string> = {
  resume: 'Resume',
  'cover-letter': 'Cover Letter',
};
const previewableProviderApplicantDocumentMimeTypes = new Set(['application/pdf', 'text/plain']);

const mimeEssence = (mimeType?: string | null): string =>
  String(mimeType || '').split(';')[0].trim().toLowerCase();

const authorInitials = (value: string): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const AdminAuthorAvatar: React.FC<{ media: NormalizedMediaAsset; name: string }> = ({ media, name }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [media.url]);

  const className = 'h-11 w-11 shrink-0 rounded-xl object-cover object-center ring-1 ring-white/10';

  if (media.url && !failed) {
    return isVideoMediaAsset(media) ? (
      <video
        src={media.url}
        className={className}
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
      />
    ) : (
      <img
        src={media.url}
        className={className}
        alt={name}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${className} grid place-items-center bg-slate-950 text-xs font-black text-blue-200`}>
      {authorInitials(name)}
    </div>
  );
};

const asAdminSubmissionFileSummary = (value: unknown): AdminSubmissionFileSummary | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const file = value as AdminSubmissionFileSummary;
  if (!file.originalName && !file.mimeType && file.sizeBytes === undefined && !file.storageProvider) {
    return null;
  }
  return file;
};

const canPreviewProviderApplicantDocument = (file: AdminSubmissionFileSummary | null): boolean =>
  previewableProviderApplicantDocumentMimeTypes.has(mimeEssence(file?.mimeType));

const providerApplicantDocumentsForSubmission = (submission: AdminSubmissionRecord): Array<{
  kind: ProviderApplicantDocumentKind;
  label: string;
  file: AdminSubmissionFileSummary | null;
}> => {
  if (submission.type !== 'provider_application') return [];
  return ([
    ['resume', providerApplicantDocumentLabels.resume, asAdminSubmissionFileSummary(submission.files?.resumeFile)],
    [
      'cover-letter',
      providerApplicantDocumentLabels['cover-letter'],
      asAdminSubmissionFileSummary(submission.files?.coverLetterFile),
    ],
  ] as const).map(([kind, label, file]) => ({ kind, label, file }));
};

const buildProtectedAdminUrl = (path: string): string =>
  `${protectedAdminBaseUrl}/api${path.startsWith('/') ? path : `/${path}`}`;

const buildProviderApplicantDocumentUrl = (
  submissionId: string,
  documentKind: ProviderApplicantDocumentKind,
  disposition: ProviderApplicantDocumentDisposition
): string =>
  buildProtectedAdminUrl(
    `/admin/provider-applicants/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(documentKind)}?disposition=${encodeURIComponent(disposition)}`
  );

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

const sanitizeDownloadFilename = (value: string, fallback: string): string => {
  const filename = String(value || '')
    .replace(/[\x00-\x1f\x7f\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return filename || fallback;
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

const parseProtectedBlobError = async (response: Response): Promise<string> => {
  const fallback = `Protected document request failed with HTTP ${response.status}`;
  try {
    const text = await response.text();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    return String(parsed.error || parsed.message || fallback);
  } catch {
    return fallback;
  }
};

const fetchProtectedAdminBlob = async (
  url: string,
  fallbackFilename: string
): Promise<{ blob: Blob; filename: string; mimeType: string; contentDisposition: string }> => {
  const authToken = getAuthToken();
  const elevationToken = getAdminElevationToken();
  if (!authToken || !elevationToken) {
    throw new Error('Admin authorization and elevation are required for protected submission documents.');
  }

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${authToken}`);
  headers.set('X-Admin-Elevation-Token', elevationToken);

  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseProtectedBlobError(response));
  }

  const contentDisposition = response.headers.get('Content-Disposition') || '';
  return {
    blob: await response.blob(),
    filename: filenameFromContentDisposition(contentDisposition) || fallbackFilename,
    mimeType: response.headers.get('Content-Type') || 'application/octet-stream',
    contentDisposition,
  };
};

const adminMessageStatusOptions: Array<{ value: AdminMessageStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

const adminMessagePriorityOptions: AdminMessagePriority[] = ['low', 'normal', 'high', 'urgent'];

const formatAdminLabel = (value: unknown): string =>
  String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatAdminDateTime = (value: string | null): string => {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unscheduled';
  return date.toLocaleString();
};

const formatAdminValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (Array.isArray(value)) {
    return value.length ? value.map((entry) => formatAdminValue(entry)).join(', ') : 'None';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const renderDetailMap = (details: Record<string, unknown> | null | undefined): React.ReactNode => {
  const entries = Object.entries(details || {}).filter(([, value]) => {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  });
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">No detail fields were supplied.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {formatAdminLabel(key)}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">
            {formatAdminValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
};

const isUserLocked = (user: AdminUserSummary): boolean => {
  if (user.locked === true) return true;
  if (!user.lockoutUntil) return false;
  const lockedUntil = new Date(user.lockoutUntil);
  return Number.isFinite(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now();
};

const AdminDashboard: React.FC<{ onApplicantPreview: () => void; onApplicantReview: () => void }> = ({ onApplicantPreview, onApplicantReview }) => {
  const [password, setPassword] = useState('');
  const [elevationCode, setElevationCode] = useState('');
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [error, setError] = useState('');
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);
  const [accountActionUserId, setAccountActionUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [contentActionPostId, setContentActionPostId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [courseActionId, setCourseActionId] = useState<string | null>(null);
  const [courseOwnerDrafts, setCourseOwnerDrafts] = useState<Record<string, string>>({});
  const [courseEnrollmentDrafts, setCourseEnrollmentDrafts] = useState<Record<string, string>>({});
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [messageStatusFilter, setMessageStatusFilter] = useState<AdminMessageStatus | 'all'>('all');
  const [messageStatusDrafts, setMessageStatusDrafts] = useState<Record<string, AdminMessageStatus>>({});
  const [messagePriorityDrafts, setMessagePriorityDrafts] = useState<Record<string, AdminMessagePriority>>({});
  const [messageNoteDrafts, setMessageNoteDrafts] = useState<Record<string, string>>({});
  const [messageResolutionDrafts, setMessageResolutionDrafts] = useState<Record<string, string>>({});
  const [submissionDocumentAction, setSubmissionDocumentAction] = useState<string | null>(null);
  const [submissionExportActionId, setSubmissionExportActionId] = useState<string | null>(null);
  const [submissionDeleteActionId, setSubmissionDeleteActionId] = useState<string | null>(null);
  const [deleteConfirmSubmissionId, setDeleteConfirmSubmissionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AdminConsoleSection>('overview');

  const isElevated = useMemo(() => Boolean(getAdminElevationToken()), [dashboard, error]);
  const currentAdminId = getCachedAuthUser()?.id || null;
  const adminInbox = dashboard?.adminInbox;
  const allSubmissionRecords = useMemo(
    () => [
      ...(dashboard?.submissions?.providerApplications || []),
      ...(dashboard?.submissions?.grantApplications || []),
    ].sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    }),
    [dashboard?.submissions?.providerApplications, dashboard?.submissions?.grantApplications]
  );
  const visibleAdminMessages = useMemo(
    () =>
      (adminInbox?.recent || []).filter((message) =>
        messageStatusFilter === 'all' ? true : message.status === messageStatusFilter
      ),
    [adminInbox?.recent, messageStatusFilter]
  );

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<AdminDashboardPayload>('/admin/dashboard', {
        headers: adminHeaders(),
      });
      setDashboard(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setAdminElevationToken('');
        setDashboard(null);
        setError('Admin elevation is required to open the console.');
        return;
      }
      setError(error instanceof Error ? error.message : 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const elevateWithProviderControl = async (showError = true): Promise<boolean> => {
    const providerControlToken = getProviderControlSession();
    if (!providerControlToken) {
      if (showError) setError('Open Administrative Access with the founder wallet before opening Admin Console.');
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
      await loadDashboard();
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

  useEffect(() => {
    if (getAdminElevationToken()) {
      void loadDashboard();
      return;
    }
    void elevateWithProviderControl(false);
  }, []);

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
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to elevate admin session.');
    } finally {
      setElevating(false);
    }
  };

  const hidePost = async (postId: string) => {
    setContentActionPostId(postId);
    setDeleteConfirmPostId(null);
    setError('');
    try {
      await api(`/admin/social/posts/${encodeURIComponent(postId)}/hide`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { reason: 'Admin console content moderation' },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to hide post.');
    } finally {
      setContentActionPostId(null);
    }
  };

  const deletePost = async (postId: string) => {
    if (deleteConfirmPostId !== postId) {
      setDeleteConfirmPostId(postId);
      setError('');
      return;
    }

    setContentActionPostId(postId);
    setError('');
    try {
      await api(`/admin/social/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
        body: {
          confirm: 'DELETE POST',
          reason: 'Admin console content removal',
        },
      });
      setDeleteConfirmPostId(null);
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to delete post.');
    } finally {
      setContentActionPostId(null);
    }
  };

  const openProviderApplicantDocument = async (
    submission: AdminSubmissionRecord,
    documentKind: ProviderApplicantDocumentKind,
    disposition: ProviderApplicantDocumentDisposition,
    file: AdminSubmissionFileSummary | null
  ): Promise<void> => {
    const label = providerApplicantDocumentLabels[documentKind];
    if (submission.type !== 'provider_application' || !file) {
      setError(`${label} is not available for this provider submission.`);
      return;
    }

    const actionKey = `${submission.id}:${documentKind}:${disposition}`;
    let previewWindow: Window | null = null;
    if (disposition === 'inline') {
      previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        setError('Unable to open the preview tab. Allow pop-ups for this site and try again.');
        return;
      }
      previewWindow.opener = null;
    }

    setSubmissionDocumentAction(actionKey);
    setDeleteConfirmSubmissionId(null);
    setError('');

    try {
      const document = await fetchProtectedAdminBlob(
        buildProviderApplicantDocumentUrl(submission.id, documentKind, disposition),
        sanitizeDownloadFilename(String(file.originalName || label), label)
      );
      const shouldPreview =
        disposition === 'inline' &&
        previewWindow &&
        !document.contentDisposition.toLowerCase().startsWith('attachment') &&
        previewableProviderApplicantDocumentMimeTypes.has(mimeEssence(document.mimeType));

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
      setError(error instanceof Error ? error.message : `Unable to open ${label.toLowerCase()}.`);
    } finally {
      setSubmissionDocumentAction(null);
    }
  };

  const exportProviderApplicantSubmission = async (submission: AdminSubmissionRecord): Promise<void> => {
    if (submission.type !== 'provider_application') return;

    setSubmissionExportActionId(submission.id);
    setDeleteConfirmSubmissionId(null);
    setError('');
    try {
      const exportBlob = await fetchProtectedAdminBlob(
        buildProtectedAdminUrl(`/admin/provider-applicants/${encodeURIComponent(submission.id)}/export`),
        sanitizeDownloadFilename(`${submission.title || 'provider'}-provider-submission.zip`, 'provider-submission.zip')
      );
      triggerBlobDownload(exportBlob.blob, exportBlob.filename);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to export provider submission.');
    } finally {
      setSubmissionExportActionId(null);
    }
  };

  const deleteProviderApplicantSubmission = async (submission: AdminSubmissionRecord): Promise<void> => {
    if (submission.type !== 'provider_application') return;

    if (deleteConfirmSubmissionId !== submission.id) {
      setDeleteConfirmSubmissionId(submission.id);
      setError(
        `Click Delete Submission again to permanently remove ${submission.title || 'this provider submission'} and its uploaded documents.`
      );
      return;
    }

    setSubmissionDeleteActionId(submission.id);
    setError('');
    try {
      await api(`/admin/provider-applicants/${encodeURIComponent(submission.id)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
        body: {
          confirm: PROVIDER_APPLICANT_DELETE_CONFIRMATION,
        },
      });
      setDeleteConfirmSubmissionId(null);
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to delete provider submission.');
    } finally {
      setSubmissionDeleteActionId(null);
    }
  };

  const updateAdminInboxMessage = async (message: AdminMessageRecord) => {
    setMessageActionId(message.id);
    setError('');
    try {
      await api(`/admin/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: {
          status: messageStatusDrafts[message.id] || message.status,
          priority: messagePriorityDrafts[message.id] || message.priority,
          adminNotes: messageNoteDrafts[message.id] ?? message.adminNotes ?? '',
          resolutionSummary: messageResolutionDrafts[message.id] ?? message.resolutionSummary ?? '',
        },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update admin message.');
    } finally {
      setMessageActionId(null);
    }
  };

  const lockUser = async (userId: string) => {
    setAccountActionUserId(userId);
    setDeleteConfirmUserId(null);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/lock`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { reason: 'Admin console profile lock' },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to lock user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const unlockUser = async (userId: string) => {
    setAccountActionUserId(userId);
    setDeleteConfirmUserId(null);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/unlock`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { reason: 'Admin console profile unlock' },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to unlock user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (deleteConfirmUserId !== userId) {
      setDeleteConfirmUserId(userId);
      setError('');
      return;
    }

    setAccountActionUserId(userId);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
        body: {
          confirm: 'DELETE USER',
          reason: 'Admin console account removal',
        },
      });
      setDeleteConfirmUserId(null);
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to delete user profile.');
    } finally {
      setAccountActionUserId(null);
    }
  };

  const updateRole = async (userId: string, role: AdminRole) => {
    setRoleChangeUserId(userId);
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: {
          role,
          reason:
            role === 'provider'
              ? 'Admin dashboard role management. Provider access is finalized through provider application approval.'
              : 'Admin dashboard role management',
        },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update role.');
    } finally {
      setRoleChangeUserId(null);
    }
  };

  const updateCourseOwner = async (courseId: string) => {
    setCourseActionId(courseId);
    setError('');
    try {
      const ownerId = courseOwnerDrafts[courseId] || null;
      await api(`/admin/courses/${encodeURIComponent(courseId)}/owner`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: { ownerId },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update course owner.');
    } finally {
      setCourseActionId(null);
    }
  };

  const assignCourseEnrollment = async (courseId: string) => {
    const userId = courseEnrollmentDrafts[courseId] || '';
    if (!userId) {
      setError('Choose a user before assigning a course.');
      return;
    }
    setCourseActionId(courseId);
    setError('');
    try {
      await api(`/admin/courses/${encodeURIComponent(courseId)}/enrollments`, {
        method: 'POST',
        headers: adminHeaders(),
        body: { userId },
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to assign course.');
    } finally {
      setCourseActionId(null);
    }
  };

  const removeCourseEnrollment = async (courseId: string, userId: string) => {
    setCourseActionId(courseId);
    setError('');
    try {
      await api(`/admin/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      await loadDashboard();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to remove course enrollment.');
    } finally {
      setCourseActionId(null);
    }
  };

  if (!isElevated || !dashboard) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Superuser Access"
          title="Admin Console"
          description="Administrative visibility requires a short-lived elevation token before platform-wide data is shown."
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

  const openMessageCount = dashboard.summary.adminMessagesOpen || 0;
  const urgentMessageCount = dashboard.summary.adminMessagesUrgent || 0;
  const courseEnrollmentCount = dashboard.summary.courseEnrollmentsTotal || 0;
  const contentPostCount = dashboard.recentSocialPosts?.length || 0;
  const pendingProviderApplicationCount = dashboard.summary.providerApplicationsPending || 0;
  const grantApplicationCount = dashboard.summary.grantApplicationsTotal || dashboard.submissions?.grantApplications.length || 0;
  const submissionCount = dashboard.summary.submissionsTotal || allSubmissionRecords.length + openMessageCount;
  const auditAttentionCount = (dashboard.summary.auditDeniedRecent || 0) + (dashboard.summary.auditErrorsRecent || 0);
  const soleAdminEmail = String(dashboard.soleAdminEmail || 'higherconscious.network1@gmail.com').toLowerCase();
  const sectionNavItems: Array<{
    id: AdminConsoleSection;
    label: string;
    description: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Platform pulse',
      count: urgentMessageCount + pendingProviderApplicationCount,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: 'messages',
      label: 'Messages',
      description: 'Contact and reports',
      count: openMessageCount,
      icon: <Inbox className="h-4 w-4" />,
    },
    {
      id: 'submissions',
      label: 'Submissions',
      description: 'Applications and grants',
      count: submissionCount,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: 'courses',
      label: 'Courses',
      description: 'Governance and access',
      count: courseEnrollmentCount,
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'users',
      label: 'Users',
      description: 'Roles and profiles',
      count: dashboard.summary.usersTotal,
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'content',
      label: 'Content',
      description: 'Social moderation',
      count: contentPostCount,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: 'audit',
      label: 'Audit',
      description: 'Security trail',
      count: auditAttentionCount,
      icon: <Activity className="h-4 w-4" />,
    },
  ];
  const overviewSignals: Array<{ label: string; value: number; section: AdminConsoleSection }> = [
    { label: 'Open messages', value: openMessageCount, section: 'messages' },
    { label: 'Urgent reports', value: urgentMessageCount, section: 'messages' },
    { label: 'Provider applications', value: pendingProviderApplicationCount, section: 'submissions' },
    { label: 'Grant applications', value: grantApplicationCount, section: 'submissions' },
    { label: 'Course enrollments', value: courseEnrollmentCount, section: 'courses' },
    { label: 'Audit attention', value: auditAttentionCount, section: 'audit' },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Superuser Access"
        title="Admin Console"
        description="Full platform visibility for user roles, memberships, provider approval state, and governance checks."
        actions={
          <ActionButton type="button" variant="secondary" onClick={loadDashboard} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </ActionButton>
        }
      />

      {error && <EmptyState title="Admin action failed" description={error} />}

      <SurfacePanel className="p-3">
        <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6" aria-label="Admin console sections">
          {sectionNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                activeSection === item.id
                  ? 'border-blue-300/30 bg-blue-500/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/20 text-blue-200">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black uppercase">{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-bold uppercase text-slate-500">
                  {item.description}
                </span>
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black text-slate-200">
                {item.count}
              </span>
            </button>
          ))}
        </nav>
      </SurfacePanel>

      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ['Users', dashboard.summary.usersTotal],
              ['Members', dashboard.summary.roleCounts.user],
              ['Providers', dashboard.summary.roleCounts.provider],
              ['Submissions', submissionCount],
              ['Grant Apps', grantApplicationCount],
              ['Messages', openMessageCount],
            ].map(([label, value]) => (
              <SurfacePanel key={label} className="space-y-2">
                <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                <p className="text-3xl font-black text-white">{value}</p>
              </SurfacePanel>
            ))}
          </div>

          <SurfacePanel className="overflow-hidden">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-300" />
              <div>
                <h2 className="text-sm font-black uppercase text-white">Operations Overview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  High-priority admin signals are grouped here, then routed to the focused workspace that owns the task.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {overviewSignals.map((signal) => (
                <button
                  key={signal.label}
                  type="button"
                  onClick={() => setActiveSection(signal.section)}
                  className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-blue-300/25 hover:bg-blue-500/10"
                >
                  <p className="text-[10px] font-black uppercase text-slate-500">{signal.label}</p>
                  <p className="mt-2 text-3xl font-black text-white">{signal.value}</p>
                </button>
              ))}
            </div>
          </SurfacePanel>
        </>
      )}

      <SurfacePanel className="mb-5">
        <h2 className="text-sm font-bold text-white">Applicant follow-up workspace</h2>
        <p className="mt-2 text-sm text-slate-300">Review replies, request information, and record decisions in administrative review. Preview opens sample applicant screens with no approval or applicant submission actions.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionButton type="button" onClick={onApplicantReview}>Review applications and follow-ups</ActionButton>
          <ActionButton type="button" variant="secondary" onClick={onApplicantPreview}>View applicant portal (read-only)</ActionButton>
        </div>
      </SurfacePanel>

      {activeSection === 'submissions' && (
        <SurfacePanel className="overflow-hidden">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
              <div className="min-w-0">
                <h2 className="text-sm font-black uppercase text-white">Submitted Work</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Provider applications, grant applications, contact forms, reports, and admin-routed submissions are collected here for founder review.
                </p>
              </div>
            </div>
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => setActiveSection('messages')}
              icon={<Inbox className="h-4 w-4" />}
              className="min-h-10 px-3 py-2 text-[10px]"
            >
              Manage Inbox
            </ActionButton>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Provider Apps', dashboard.submissions?.providerApplications.length || 0],
              ['Grant Apps', dashboard.submissions?.grantApplications.length || 0],
              ['Inbox Items', dashboard.submissions?.adminMessages.length || 0],
              ['Pending Provider Review', pendingProviderApplicationCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          {allSubmissionRecords.length === 0 && (dashboard.submissions?.adminMessages.length || 0) === 0 ? (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              No submitted applications, grants, contact forms, or reports are available yet.
            </p>
          ) : (
            <div className="space-y-4">
              {allSubmissionRecords.map((submission) => {
                const providerDocuments = providerApplicantDocumentsForSubmission(submission);
                const isProviderSubmission = submission.type === 'provider_application';

                return (
                <article key={`${submission.type}-${submission.id}`} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="cnh-status-badge rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[9px] font-black uppercase text-blue-100">
                          {formatAdminLabel(submission.type)}
                        </span>
                        <span className="cnh-status-badge rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase text-slate-300">
                          {formatAdminLabel(submission.status)}
                        </span>
                        {submission.category && (
                          <span className="cnh-status-badge rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase text-slate-400">
                            {submission.category}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 break-words text-base font-black uppercase text-white">{submission.title}</h3>
                      <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                        Submitted by {submission.applicantName || submission.user?.name || 'Unknown applicant'}
                        {submission.applicantEmail || submission.user?.email ? ` / ${submission.applicantEmail || submission.user?.email}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-left lg:text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Submitted</p>
                      <p className="mt-1 text-xs font-bold text-slate-300">{formatAdminDateTime(submission.submittedAt)}</p>
                      {submission.updatedAt && (
                        <p className="mt-1 text-[10px] text-slate-600">Updated {formatAdminDateTime(submission.updatedAt)}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Submitted Details</p>
                    {renderDetailMap(submission.summary)}
                  </div>

                  {isProviderSubmission && (
                    <div className="mt-4 rounded-xl border border-blue-300/15 bg-blue-500/[0.06] p-4">
                      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                            Provider Submission Documents
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Protected retrieval uses the applicant record and admin elevation.
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <ActionButton
                            type="button"
                            variant="secondary"
                            onClick={() => void exportProviderApplicantSubmission(submission)}
                            disabled={submissionExportActionId === submission.id}
                            icon={<FileArchive className="h-4 w-4" />}
                            className="min-h-10 px-3 py-2 text-[10px]"
                          >
                            {submissionExportActionId === submission.id ? 'Exporting' : 'Export Submission'}
                          </ActionButton>
                          <ActionButton
                            type="button"
                            variant="ghost"
                            onClick={() => void deleteProviderApplicantSubmission(submission)}
                            disabled={submissionDeleteActionId === submission.id}
                            icon={<Trash2 className="h-4 w-4" />}
                            className={`min-h-10 px-3 py-2 text-[10px] ${
                              deleteConfirmSubmissionId === submission.id
                                ? 'border-red-300/40 bg-red-500/15 text-red-100'
                                : 'text-red-200 hover:bg-red-500/10'
                            }`}
                          >
                            {submissionDeleteActionId === submission.id
                              ? 'Deleting'
                              : deleteConfirmSubmissionId === submission.id
                                ? 'Confirm Delete'
                                : 'Delete Submission'}
                          </ActionButton>
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {providerDocuments.map(({ kind, label, file }) => {
                          const previewActionKey = `${submission.id}:${kind}:inline`;
                          const downloadActionKey = `${submission.id}:${kind}:attachment`;
                          const canPreview = canPreviewProviderApplicantDocument(file);
                          return (
                            <div
                              key={`${submission.id}:${kind}`}
                              className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-black uppercase text-slate-300">{label}</p>
                                  <p className="mt-1 break-words text-xs font-bold text-white">
                                    {file?.originalName || 'Missing file'}
                                  </p>
                                  <p className="mt-1 break-words text-[10px] text-slate-500">
                                    {file?.mimeType || 'No MIME type recorded'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                <ActionButton
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void openProviderApplicantDocument(submission, kind, 'inline', file)}
                                  disabled={!file || !canPreview || submissionDocumentAction === previewActionKey}
                                  icon={<Eye className="h-4 w-4" />}
                                  className="min-h-10 px-3 py-2 text-[10px]"
                                  title={canPreview ? `Preview ${label}` : `${label} must be downloaded`}
                                >
                                  {submissionDocumentAction === previewActionKey ? 'Opening' : 'Preview'}
                                </ActionButton>
                                <ActionButton
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void openProviderApplicantDocument(submission, kind, 'attachment', file)}
                                  disabled={!file || submissionDocumentAction === downloadActionKey}
                                  icon={<Download className="h-4 w-4" />}
                                  className="min-h-10 px-3 py-2 text-[10px]"
                                  title={`Download ${label}`}
                                >
                                  {submissionDocumentAction === downloadActionKey ? 'Saving' : 'Download'}
                                </ActionButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isProviderSubmission && submission.files && Object.keys(submission.files).length > 0 && (
                    <div className="mt-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Attached File Summary</p>
                      {renderDetailMap(submission.files)}
                    </div>
                  )}
                </article>
                );
              })}

              {(dashboard.submissions?.adminMessages || []).map((message) => (
                <article key={`submission-message-${message.id}`} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="cnh-status-badge rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[9px] font-black uppercase text-cyan-100">
                          {formatAdminLabel(message.type)}
                        </span>
                        <span className="cnh-status-badge rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase text-slate-300">
                          {formatAdminLabel(message.status)}
                        </span>
                        <span className={`cnh-status-badge rounded-full border px-3 py-1 text-[9px] font-black uppercase ${
                          message.priority === 'urgent'
                            ? 'border-red-300/30 bg-red-400/10 text-red-100'
                            : message.priority === 'high'
                              ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                              : 'border-white/10 bg-white/5 text-slate-300'
                        }`}>
                          {formatAdminLabel(message.priority)}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-base font-black uppercase text-white">{message.subject}</h3>
                      <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                        From {message.submitterName || 'Unknown'}{message.submitterEmail ? ` / ${message.submitterEmail}` : ''}
                      </p>
                      {message.route && <p className="mt-1 break-all text-[10px] leading-4 text-slate-600">{message.route}</p>}
                    </div>
                    <p className="shrink-0 text-xs font-bold text-slate-300">{formatAdminDateTime(message.createdAt)}</p>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200">
                    {message.message}
                  </p>
                  {message.metadata && (
                    <div className="mt-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Submission Metadata</p>
                      {renderDetailMap(message.metadata)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </SurfacePanel>
      )}

      {activeSection === 'messages' && (
        <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase text-white">Messages & Reports</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Contact requests and issue reports are received here for {adminInbox?.recipientEmail || 'admin review'}.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {adminMessageStatusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMessageStatusFilter(option.value)}
                className={`rounded-full border px-3 py-2 text-[9px] font-black uppercase transition ${
                  messageStatusFilter === option.value
                    ? 'border-blue-300/30 bg-blue-500/15 text-blue-100'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {adminInbox && (
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['New', adminInbox.summary.new],
              ['In Progress', adminInbox.summary.reviewing + adminInbox.summary.inProgress],
              ['Urgent', adminInbox.summary.urgent],
              ['Resolved', adminInbox.summary.resolved],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        {!adminInbox || visibleAdminMessages.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            No messages match this view.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleAdminMessages.map((message) => {
              const busy = messageActionId === message.id;
              const statusDraft = messageStatusDrafts[message.id] || message.status;
              const priorityDraft = messagePriorityDrafts[message.id] || message.priority;
              const noteDraft = messageNoteDrafts[message.id] ?? message.adminNotes ?? '';
              const resolutionDraft = messageResolutionDrafts[message.id] ?? message.resolutionSummary ?? '';
              return (
                <article key={message.id} className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cnh-status-badge rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[9px] font-black uppercase text-blue-100">
                        {formatAdminLabel(message.type)}
                      </span>
                      <span className={`cnh-status-badge rounded-full border px-3 py-1 text-[9px] font-black uppercase ${
                        message.priority === 'urgent'
                          ? 'border-red-300/30 bg-red-400/10 text-red-100'
                          : message.priority === 'high'
                            ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                            : 'border-white/10 bg-white/5 text-slate-300'
                      }`}>
                        {formatAdminLabel(message.priority)}
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-600">
                        {formatAdminDateTime(message.createdAt)}
                      </span>
                    </div>
                    <h3 className="mt-3 break-words text-base font-black uppercase text-white">{message.subject}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      From {message.submitterName || 'Unknown'}{message.submitterEmail ? ` / ${message.submitterEmail}` : ''}
                    </p>
                    {message.route && (
                      <p className="mt-1 break-all text-[10px] leading-4 text-slate-600">{message.route}</p>
                    )}
                    <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200">
                      {message.message}
                    </p>
                    {message.aiAnalysis && (
                      <div className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.04] p-3">
                        <p className="text-[10px] font-black uppercase text-cyan-200">AI Triage</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{message.aiAnalysis}</p>
                      </div>
                    )}
                    {message.metadata && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Submission Details</p>
                        {renderDetailMap(message.metadata)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="min-w-0 space-y-2">
                        <span className="text-[10px] font-black uppercase text-slate-500">Status</span>
                        <select
                          value={statusDraft}
                          onChange={(event) =>
                            setMessageStatusDrafts((current) => ({
                              ...current,
                              [message.id]: event.target.value as AdminMessageStatus,
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        >
                          {adminMessageStatusOptions.filter((option) => option.value !== 'all').map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="min-w-0 space-y-2">
                        <span className="text-[10px] font-black uppercase text-slate-500">Priority</span>
                        <select
                          value={priorityDraft}
                          onChange={(event) =>
                            setMessagePriorityDrafts((current) => ({
                              ...current,
                              [message.id]: event.target.value as AdminMessagePriority,
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        >
                          {adminMessagePriorityOptions.map((option) => (
                            <option key={option} value={option}>{formatAdminLabel(option)}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block min-w-0 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500">Admin Notes</span>
                      <textarea
                        value={noteDraft}
                        onChange={(event) =>
                          setMessageNoteDrafts((current) => ({ ...current, [message.id]: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs leading-5 text-white"
                      />
                    </label>
                    <label className="block min-w-0 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500">Resolution Summary</span>
                      <textarea
                        value={resolutionDraft}
                        onChange={(event) =>
                          setMessageResolutionDrafts((current) => ({ ...current, [message.id]: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs leading-5 text-white"
                      />
                    </label>
                    <ActionButton
                      type="button"
                      variant="secondary"
                      disabled={busy || loading}
                      onClick={() => void updateAdminInboxMessage(message)}
                      icon={<ShieldCheck className="h-4 w-4" />}
                      className="w-full min-h-10 px-3 py-2 text-[10px]"
                    >
                      Save Message
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfacePanel>
      )}

      {activeSection === 'courses' && (
        <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-blue-300" />
            <div>
              <h2 className="text-sm font-black uppercase text-white">Course Governance</h2>
              <p className="mt-1 text-xs text-slate-500">
                View enrolled users, provider/course leaders, and assign or reassign courses.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
            {dashboard.summary.courseEnrollmentsTotal || 0} enrollments
          </span>
        </div>
        {!dashboard.courseGovernance || dashboard.courseGovernance.courses.length === 0 ? (
          <p className="text-sm text-slate-400">No course records are currently present.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.courseGovernance.courses.map((course) => {
              const busy = courseActionId === course.id;
              const ownerDraft = courseOwnerDrafts[course.id] ?? course.ownerId ?? '';
              const userDraft = courseEnrollmentDrafts[course.id] ?? '';
              return (
                <article
                  key={course.id}
                  className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm lg:grid-cols-2 2xl:grid-cols-[minmax(12rem,1.05fr)_minmax(10rem,0.85fr)_minmax(7rem,0.5fr)_minmax(15rem,1.2fr)_minmax(14rem,1fr)_minmax(14rem,1fr)]"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Course</p>
                    <p className="mt-2 font-bold text-white">{course.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {course.tier} / requires {course.requiredMembershipTier}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Leader</p>
                    <p className="mt-2 font-bold text-slate-200">{course.ownerName || course.provider}</p>
                    <p className="break-words text-xs text-slate-500">{course.ownerEmail || 'Admin curriculum'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Visibility</p>
                    <span
                      className={`cnh-status-badge mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        course.status === 'published'
                          ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                          : 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Enrolled Users</p>
                    <div className="mt-2 max-h-44 min-w-0 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                      {course.enrollments.length === 0 ? (
                        <p className="text-xs text-slate-500">No enrolled users.</p>
                      ) : (
                        course.enrollments.map((enrollment) => (
                          <div key={enrollment.userId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-bold text-white">{enrollment.userName || enrollment.userEmail}</p>
                                <p className="break-words text-xs text-slate-500">{enrollment.userEmail || enrollment.userId}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                  {enrollment.userTier || 'No tier'} / {enrollment.progressScore}% / {enrollment.status}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={busy || loading}
                                onClick={() => void removeCourseEnrollment(course.id, enrollment.userId)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-slate-300 hover:bg-white/10 disabled:opacity-50 sm:w-auto"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Reassign Leader</p>
                    <div className="mt-2 flex min-w-0 flex-col gap-2">
                      <select
                        value={ownerDraft}
                        disabled={busy || loading}
                        onChange={(event) =>
                          setCourseOwnerDrafts((current) => ({ ...current, [course.id]: event.target.value }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="">Admin Curriculum</option>
                        {dashboard.courseGovernance?.providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name || provider.email} ({provider.role})
                          </option>
                        ))}
                      </select>
                      <ActionButton
                        type="button"
                        variant="secondary"
                        disabled={busy || loading}
                        onClick={() => void updateCourseOwner(course.id)}
                        icon={<ShieldCheck className="h-4 w-4" />}
                        className="w-full min-h-10 px-3 py-2 text-[10px]"
                      >
                        Save Leader
                      </ActionButton>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Assign User</p>
                    <div className="mt-2 flex min-w-0 flex-col gap-2">
                      <select
                        value={userDraft}
                        disabled={busy || loading || course.status !== 'published'}
                        onChange={(event) =>
                          setCourseEnrollmentDrafts((current) => ({ ...current, [course.id]: event.target.value }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="">Choose user</option>
                        {dashboard.courseGovernance?.assignableUsers.map((targetUser) => (
                          <option key={targetUser.id} value={targetUser.id}>
                            {targetUser.name || targetUser.email} / {targetUser.tier || 'no tier'}
                          </option>
                        ))}
                      </select>
                      <ActionButton
                        type="button"
                        variant="secondary"
                        disabled={busy || loading || course.status !== 'published'}
                        onClick={() => void assignCourseEnrollment(course.id)}
                        icon={<UserPlus className="h-4 w-4" />}
                        className="w-full min-h-10 px-3 py-2 text-[10px]"
                      >
                        Assign Course
                      </ActionButton>
                      {course.status !== 'published' && (
                        <p className="text-[10px] leading-4 text-amber-200">
                          Draft courses cannot be assigned to members.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfacePanel>
      )}

      {activeSection === 'users' && (
      <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-black uppercase text-white">Platform Users</h2>
        </div>
        <div className="space-y-3">
          {dashboard.recentUsers.map((user) => {
            const locked = isUserLocked(user);
            const isSoleAdminProfile = user.email.toLowerCase() === soleAdminEmail;
            const roleChangeProtected = user.id === currentAdminId || isSoleAdminProfile;
            const protectedProfile = user.role === 'admin' || user.id === currentAdminId;
            const actionBusy = accountActionUserId === user.id;
            return (
              <article
                key={user.id}
                className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm md:grid-cols-2 xl:grid-cols-[minmax(13rem,1.2fr)_minmax(6rem,0.55fr)_minmax(6rem,0.5fr)_minmax(7rem,0.55fr)_minmax(8rem,0.7fr)_minmax(6rem,0.5fr)_minmax(12rem,0.95fr)_minmax(13rem,1fr)]"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Identity</p>
                  <p className="cnh-person-name mt-2 font-bold text-white">{user.name || user.email}</p>
                  <p className="break-words text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Status</p>
                  <span
                    className={`cnh-status-badge mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      locked
                        ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                        : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                    }`}
                  >
                    {locked ? 'Locked' : 'Active'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Role</p>
                  <p className="mt-2 text-slate-200">{user.role}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Tier</p>
                  <p className="mt-2 text-slate-400">{user.tier || 'None'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Provider Approval</p>
                  <span
                    className={`cnh-status-badge mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      user.providerApproved
                        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    {user.providerApproved ? 'Approved' : user.providerApprovalStatus || 'Not approved'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">2FA</p>
                  <p className="mt-2 text-slate-400">{user.twoFactorMethod}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Role Change</p>
                  <select
                    value={user.role}
                    onChange={(event) => updateRole(user.id, event.target.value as AdminRole)}
                    disabled={roleChangeProtected || roleChangeUserId === user.id || loading}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="user">Member</option>
                    <option value="provider">Provider</option>
                    <option value="admin" disabled={!isSoleAdminProfile}>Admin</option>
                  </select>
                  {user.role === 'provider' && !user.providerApproved && (
                    <p className="mt-2 text-[10px] leading-4 text-amber-200">
                      Provider role is not the same as approved provider access. Approve through Provider Applicants to unlock provider tools.
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Profile Control</p>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                    {locked ? (
                      <ActionButton
                        type="button"
                        variant="secondary"
                        disabled={protectedProfile || actionBusy || loading}
                        onClick={() => void unlockUser(user.id)}
                        icon={<UnlockKeyhole className="h-4 w-4" />}
                        className="min-h-10 flex-1 px-3 py-2 text-[10px]"
                      >
                        Unlock
                      </ActionButton>
                    ) : (
                      <ActionButton
                        type="button"
                        variant="secondary"
                        disabled={protectedProfile || actionBusy || loading}
                        onClick={() => void lockUser(user.id)}
                        icon={<LockKeyhole className="h-4 w-4" />}
                        className="min-h-10 flex-1 px-3 py-2 text-[10px]"
                      >
                        Lock
                      </ActionButton>
                    )}
                    <ActionButton
                      type="button"
                      variant="ghost"
                      disabled={protectedProfile || actionBusy || loading}
                      onClick={() => void deleteUser(user.id)}
                      icon={<Trash2 className="h-4 w-4" />}
                      className="min-h-10 flex-1 px-3 py-2 text-[10px]"
                    >
                      {deleteConfirmUserId === user.id ? 'Confirm Delete' : 'Delete'}
                    </ActionButton>
                  </div>
                  {protectedProfile && (
                    <p className="mt-2 text-[10px] leading-4 text-slate-500">
                      Protected admin profile.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SurfacePanel>
      )}

      {activeSection === 'content' && (
      <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-black uppercase text-white">Content Moderation</h2>
        </div>
        {(dashboard.recentSocialPosts || []).length === 0 ? (
          <p className="text-sm text-slate-400">No social posts are currently present.</p>
        ) : (
          <div className="space-y-3">
            {(dashboard.recentSocialPosts || []).map((post) => {
              const actionBusy = contentActionPostId === post.id;
              const authorAvatarMedia = normalizeMediaAsset(
                post.authorAvatarMedia || { url: post.authorAvatarUrl }
              );
              return (
                <article
                  key={post.id}
                  className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.45fr)_minmax(12rem,1fr)_minmax(7rem,0.55fr)_minmax(9rem,0.7fr)_minmax(13rem,0.95fr)]"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Post</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
                      {post.text || post.mediaCount > 0 ? post.text || 'Media post' : 'Empty post'}
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Author</p>
                    <div className="mt-2 flex min-w-0 items-center gap-3">
                      <AdminAuthorAvatar media={authorAvatarMedia} name={post.authorName} />
                      <div className="min-w-0">
                        <p className="cnh-person-name truncate font-bold text-white">{post.authorName}</p>
                        <p className="break-words text-xs text-slate-500">{post.authorEmail || post.authorId}</p>
                        {(post.authorRole || post.authorTier) && (
                          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-blue-300/70">
                            {[post.authorRole, post.authorTier].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Visibility</p>
                    <span
                      className={`cnh-status-badge mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        post.visibility === 'public'
                          ? 'border-blue-300/25 bg-blue-300/10 text-blue-100'
                          : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                    >
                      {post.visibility}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Signals</p>
                    <p className="mt-2 text-slate-400">
                      {post.likeCount} resonances / {post.mediaCount} media
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-500">Moderation</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                      <ActionButton
                        type="button"
                        variant="secondary"
                        disabled={post.visibility === 'private' || actionBusy || loading}
                        onClick={() => void hidePost(post.id)}
                        icon={<EyeOff className="h-4 w-4" />}
                        className="min-h-10 flex-1 px-3 py-2 text-[10px]"
                      >
                        Hide
                      </ActionButton>
                      <ActionButton
                        type="button"
                        variant="ghost"
                        disabled={actionBusy || loading}
                        onClick={() => void deletePost(post.id)}
                        icon={<Trash2 className="h-4 w-4" />}
                        className="min-h-10 flex-1 px-3 py-2 text-[10px]"
                      >
                        {deleteConfirmPostId === post.id ? 'Confirm Delete' : 'Delete'}
                      </ActionButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfacePanel>
      )}

      {activeSection === 'audit' && (
      <SurfacePanel className="overflow-hidden">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-300" />
            <div>
              <h2 className="text-sm font-black uppercase text-white">Audit & Security Trail</h2>
              <p className="mt-1 text-xs text-slate-500">
                Recent protected-route activity, denials, and admin actions for the solo founder console.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
              {dashboard.summary.auditDeniedRecent || 0} denials
            </span>
            <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-100">
              {dashboard.summary.auditErrorsRecent || 0} errors
            </span>
          </div>
        </div>
        {(dashboard.recentAuditEvents || []).length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            No persisted audit events are available in this environment.
          </p>
        ) : (
          <div className="space-y-3">
            {(dashboard.recentAuditEvents || []).map((event, index) => (
              <article
                key={`${event.at}-${event.action}-${index}`}
                className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase ${
                      event.outcome === 'error'
                        ? 'border-red-300/30 bg-red-400/10 text-red-100'
                        : event.outcome === 'deny'
                          ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                          : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                    }`}>
                      {event.outcome}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase text-slate-300">
                      {event.domain}
                    </span>
                  </div>
                  <h3 className="mt-3 break-words text-sm font-black uppercase text-white">
                    {formatAdminLabel(event.action)}
                  </h3>
                  <p className="mt-1 break-all text-[10px] text-slate-500">
                    {event.request?.method || 'REQUEST'} {event.request?.path || 'unknown path'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Actor / Target</p>
                  <p className="mt-2 break-all text-xs text-slate-300">{event.actorUserId || 'system'}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{event.targetUserId || 'no target'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-500">Recorded</p>
                  <p className="mt-2 text-xs text-slate-300">{formatAdminDateTime(event.at)}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-600">
                    {event.statusCode || 'no status'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfacePanel>
      )}
    </PageShell>
  );
};

export default AdminDashboard;
