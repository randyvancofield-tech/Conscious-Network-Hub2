import React, { RefObject } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import EthicalAIInsight from './EthicalAIInsight';
import { UserProfile, Course } from '../types';

interface DashboardProps {
  user?: UserProfile | null;
  onEnroll?: (course: Course) => void;
  onManageReputation?: () => void;
  onOpenCourses?: () => void;
  onOpenMeetings?: () => void;
  onOpenProviderTools?: () => void;
  onOpenProviderApply?: () => void;
  onOpenSupport?: () => void;
  onOpenNotifications?: () => void;
  insightRef?: RefObject<HTMLDivElement>;
}

interface DashboardAction {
  label: string;
  description: string;
  status: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const normalizeLabel = (value: unknown, fallback: string): string => {
  const normalized = String(value || '').replace(/[_-]+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const isApprovedProvider = (user?: UserProfile | null): boolean =>
  Boolean(
    user?.role === 'provider' &&
      user.providerApproved === true &&
      String(user.providerApprovalStatus || '').trim().toLowerCase() === 'approved' &&
      !user.providerRevokedAt
  );

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onEnroll: _onEnroll,
  onManageReputation,
  onOpenCourses,
  onOpenMeetings,
  onOpenProviderTools,
  onOpenProviderApply,
  onOpenSupport,
  onOpenNotifications,
  insightRef,
}) => {
  const signedIn = Boolean(user);
  const roleLabel = normalizeLabel(user?.role, signedIn ? 'Member' : 'Guest');
  const tierLabel = normalizeLabel(user?.tier || user?.membershipStatus, signedIn ? 'No Active Tier Detected' : 'Public Visitor');
  const approvedProvider = isApprovedProvider(user);
  const providerStatus = user?.role === 'admin'
    ? 'Founder admin'
    : approvedProvider
      ? user?.providerWalletAddressBound
        ? 'Approved provider with wallet bound'
        : 'Approved provider; wallet verification required for CRM access'
      : user?.role === 'applicant'
        ? normalizeLabel(user?.providerApprovalStatus, 'Provider applicant')
        : 'Provider access not active';

  const actions: DashboardAction[] = [
    {
      label: 'Profile And Identity',
      description: 'Review your public profile, media, privacy posture, and account identity details.',
      status: signedIn ? 'Available' : 'Sign-in required',
      icon: <UserCircle className="h-5 w-5" />,
      onClick: onManageReputation,
      disabled: !signedIn,
    },
    {
      label: 'Courses And Learning',
      description: 'Browse published learning pathways and continue enrolled courses where access is active.',
      status: 'Published catalog',
      icon: <BookOpen className="h-5 w-5" />,
      onClick: onOpenCourses,
    },
    {
      label: 'Meetings',
      description: 'Open Conscious Meetings for provider-hosted session readiness, upcoming sessions, and signed access.',
      status: 'Pilot ready',
      icon: <CalendarDays className="h-5 w-5" />,
      onClick: onOpenMeetings,
    },
    {
      label: approvedProvider || user?.role === 'admin' ? 'Provider Tools' : 'Provider Pathway',
      description: approvedProvider || user?.role === 'admin'
        ? 'Enter provider operations when approval, wallet, and session controls permit access.'
        : 'Apply or review provider pathway requirements before supporting members through CNH.',
      status: approvedProvider || user?.role === 'admin' ? 'Restricted operations' : 'Application path',
      icon: <Briefcase className="h-5 w-5" />,
      onClick: approvedProvider || user?.role === 'admin' ? onOpenProviderTools : onOpenProviderApply,
    },
    {
      label: 'Support And Contact',
      description: 'Send questions, technical reports, or launch support needs into the admin review pipeline.',
      status: 'Admin inbox',
      icon: <HelpCircle className="h-5 w-5" />,
      onClick: onOpenSupport,
    },
    {
      label: 'Notifications',
      description: 'Review platform messages, status changes, and account notices when signed in.',
      status: signedIn ? 'Account notices' : 'Sign-in required',
      icon: <Bell className="h-5 w-5" />,
      onClick: onOpenNotifications,
      disabled: !signedIn,
    },
  ];

  const statusRows = [
    ['Account', signedIn ? 'Signed in' : 'Guest view'],
    ['Role', roleLabel],
    ['Membership', tierLabel],
    ['Provider State', providerStatus],
  ];

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-700 pb-12">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)] gap-6">
        <div className="min-w-0" id="latest-wisdom" ref={insightRef}>
          {user ? (
            <EthicalAIInsight userEmail={user.email} userId={user.id} />
          ) : (
            <div className="glass-panel flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-white/10 p-6 text-center shadow-2xl lg:p-8">
              <ShieldCheck className="h-10 w-10 text-blue-400" />
              <h3 className="mt-4 text-lg font-black uppercase tracking-widest text-white">AI Insight Locked</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Sign in with a canonical hub identity to access the platform assistant and personalized guidance.
              </p>
            </div>
          )}
        </div>

        <aside className="glass-panel rounded-2xl border border-blue-500/10 p-6 shadow-2xl lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-blue-200">Operational Snapshot</p>
              <h3 className="mt-3 text-xl font-black uppercase leading-tight text-white">Your Current Access</h3>
            </div>
            <ClipboardCheck className="h-6 w-6 shrink-0 text-teal-300" />
          </div>
          <div className="mt-6 space-y-3">
            {statusRows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onManageReputation}
            disabled={!signedIn || !onManageReputation}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/15 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-blue-100 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Manage Profile
            <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-teal-200">Next Steps</p>
            <h2 className="mt-2 text-[clamp(1.35rem,2.2vw,2rem)] font-black uppercase leading-tight text-white">
              Launch-Ready Actions
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            This dashboard prioritizes real operational pathways: identity, learning, meetings, provider access, support, and notifications.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled || !action.onClick}
              className="group min-h-[12rem] rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-left shadow-xl transition-colors hover:border-blue-300/35 hover:bg-blue-500/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-200 ring-1 ring-blue-300/10">
                  {action.icon}
                </div>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-300">
                  {action.status}
                </span>
              </div>
              <h3 className="mt-5 text-base font-black uppercase leading-tight text-white">{action.label}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{action.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200 opacity-80 transition-opacity group-hover:opacity-100">
                Open
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel rounded-2xl border border-white/10 p-6 shadow-2xl lg:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-teal-300" />
            <h2 className="text-lg font-black uppercase leading-tight text-white">Provider Dignity</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <p>Providers are the service layer of the ecosystem.</p>
            <p>Providers control their profiles, offerings, and direct revenue pathways.</p>
            <p>Providers contribute the professional, spiritual, educational, and wellness support that powers the network.</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-white/10 p-6 shadow-2xl lg:p-8">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-blue-300" />
            <h2 className="text-lg font-black uppercase leading-tight text-white">Support Pipeline</h2>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            Questions and issue reports route to the internal admin message pipeline. Outbound email notification depends on configured server mail credentials and is never claimed unless the backend confirms delivery.
          </p>
          <button
            type="button"
            onClick={onOpenSupport}
            disabled={!onOpenSupport}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-teal-300/25 bg-teal-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Contact Support
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
