import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronRight, FileText, LockKeyhole, RefreshCw } from 'lucide-react';
import { api } from '../services/apiClient';

const CALENDLY_URL = 'https://calendly.com/randycofield/buildingconnections';

interface ProviderApplicationStatusPageProps {
  onBack: () => void;
  onSignOut: () => void;
}

interface ApplicantFileRef {
  originalName?: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface ProviderApplicantRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  communicationPreference?: string | null;
  providerCategory: string;
  organizationName?: string | null;
  professionalTitle?: string | null;
  serviceArea?: string | null;
  availabilityMode?: string | null;
  servicesOffered?: string[] | string | null;
  targetAudience?: string | null;
  populationsServed?: string[] | string | null;
  experienceLevel?: string | null;
  yearsExperience?: number | null;
  practiceStatus?: string | null;
  availabilityToServe?: string | null;
  credentialsText?: string | null;
  resumeFile?: ApplicantFileRef;
  coverLetterFile?: ApplicantFileRef;
  alignmentAnswers?: Record<string, string>;
  status: string;
  submittedAt?: string;
  calendlyShownAt?: string | null;
}

const formatStatus = (status: string): string =>
  String(status || 'submitted')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
};

const FileLink: React.FC<{ label: string; file?: ApplicantFileRef }> = ({ label, file }) => {
  if (!file) return null;
  const name = file.originalName || label;
  return (
    <a
      href={file.url || '#'}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200 transition hover:bg-white/[0.08]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-amber-100" />
        <span className="truncate">{name}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
    </a>
  );
};

const ProviderApplicationStatusPage: React.FC<ProviderApplicationStatusPageProps> = ({
  onBack,
  onSignOut,
}) => {
  const [applicant, setApplicant] = useState<ProviderApplicantRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ applicant: ProviderApplicantRecord; calendlyUrl?: string }>('/provider-applicants/current', {
        cache: 'no-store',
      });
      setApplicant(data.applicant);
      if (['submitted', 'under_review'].includes(String(data.applicant?.status || '').toLowerCase())) {
        void api('/provider-applicants/current/calendly-shown', { method: 'POST', body: {} }).catch(() => undefined);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load provider application status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const nextStep = useMemo(() => {
    const status = String(applicant?.status || '').toLowerCase();
    if (status === 'submitted') return 'Schedule your discovery interview and watch for review updates.';
    if (status === 'under_review') return 'Your materials are under review. The discovery link remains available.';
    if (status === 'discovery_scheduled') return 'Your discovery interview is scheduled or being coordinated.';
    if (status === 'needs_more_info') return 'CNH needs additional information before a decision can be made.';
    if (status === 'approved') return 'Approval is recorded. Sign in through Provider Access to enter provider tools.';
    if (status === 'rejected') return 'This application was not approved for the current provider cohort.';
    return 'Your application is pending review.';
  }, [applicant?.status]);

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#100f0a] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-100/60 transition-colors hover:text-white"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Provider Access
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10"
          >
            Sign Out
          </button>
        </div>

        <div className="glass-panel mb-6 rounded-3xl border border-amber-200/20 bg-amber-400/[0.04] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-100/60">
                Provider Applicant Status
              </p>
              <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">
                Application Review Portal
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Your provider application is currently under review. Provider CRM tools unlock only
                after approval through native CNH provider sign-in.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-sm text-slate-300">
            Loading application status...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-sm leading-6 text-red-100">
            {error}
          </div>
        )}

        {applicant && (
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  Current Status
                </p>
                <h2 className="mt-3 text-3xl font-black uppercase text-white">
                  {formatStatus(applicant.status)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{nextStep}</p>
              </div>

              {['submitted', 'under_review'].includes(String(applicant.status || '').toLowerCase()) && (
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Schedule Discovery Interview
                </a>
              )}

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-3 flex items-center gap-2 text-amber-100">
                  <LockKeyhole className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Restricted Access</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">
                  Applicants can view application status and submitted information only. Dashboard,
                  CRM, client, collaboration, calendar, message, revenue, course, and provider
                  settings areas remain locked.
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-lg font-black uppercase tracking-tight text-white">
                  Submitted Provider Profile
                </h2>
                <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Name</p>
                    <p className="mt-1 text-slate-200">{applicant.firstName} {applicant.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Email</p>
                    <p className="mt-1 text-slate-200">{applicant.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Submitted</p>
                    <p className="mt-1 text-slate-200">
                      {applicant.submittedAt ? new Date(applicant.submittedAt).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Provider Category</p>
                    <p className="mt-1 text-slate-200">{applicant.providerCategory}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Title</p>
                    <p className="mt-1 text-slate-200">{applicant.professionalTitle || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Service Area</p>
                    <p className="mt-1 text-slate-200">{applicant.serviceArea || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-lg font-black uppercase tracking-tight text-white">Services</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{applicant.targetAudience || 'Target audience not provided.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {toList(applicant.servicesOffered).map((service) => (
                    <span key={service} className="rounded-full border border-amber-200/15 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-lg font-black uppercase tracking-tight text-white">Documents</h2>
                <div className="mt-4 grid gap-3">
                  <FileLink label="Resume" file={applicant.resumeFile} />
                  <FileLink label="Cover Letter" file={applicant.coverLetterFile} />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-lg font-black uppercase tracking-tight text-white">Mission Alignment</h2>
                <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                  {Object.entries(applicant.alignmentAnswers || {}).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {formatStatus(key)}
                      </p>
                      <p className="mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderApplicationStatusPage;
