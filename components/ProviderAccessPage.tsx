import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Globe2,
  HandHeart,
  Home,
  KeyRound,
  Landmark,
  Library,
  Sparkles,
  Users,
  Video,
  WalletCards,
} from 'lucide-react';
import logo from '../src/assets/brand/logo.png';

interface ProviderAccessPageProps {
  onGoHome: () => void;
  onSignIn: () => void;
  onApply: () => void;
  onApplicantSignIn: () => void;
}

type PathwayClickKey = 'signin' | 'apply' | 'applicant';
type ProviderGroupId =
  | 'religious-leaders'
  | 'spiritual-leaders'
  | 'career-life-coaches'
  | 'holistic-experts'
  | 'mental-health-providers'
  | 'cultural-enthusiasts';
type GuidedPath = 'metrics' | 'content';
type ToolId = 'clients' | 'sessions' | 'llm' | 'content' | 'revenue' | 'impact';

const pathways: Array<{
  eyebrow: string;
  title: string;
  description: string;
  tooltip: string;
  icon: typeof WalletCards;
  tone: 'blue' | 'teal' | 'indigo';
  onClickKey: PathwayClickKey;
}> = [
  {
    eyebrow: 'Existing Approved Provider',
    title: 'Approved Provider Sign In',
    description:
      'For verified providers who have already been approved to access the Conscious Network Hub provider system.',
    tooltip: 'Existing approved providers sign in here to access the CNH Provider CRM.',
    icon: WalletCards,
    tone: 'blue',
    onClickKey: 'signin',
  },
  {
    eyebrow: 'New Provider Applicant',
    title: 'Apply to Join',
    description:
      'Start here to become a verified provider. Submit your application, upload your resume and cover letter, and schedule a discovery interview.',
    tooltip:
      'Start here to become a verified provider. Once submitted, you can track your status and book a discovery call.',
    icon: FileText,
    tone: 'teal',
    onClickKey: 'apply',
  },
  {
    eyebrow: 'Returning Applicant',
    title: 'Applicant Sign In',
    description:
      'Already submitted an application? Sign in here to view your application status and update your profile information.',
    tooltip: 'Return to your restricted applicant area to review status, materials, and next steps.',
    icon: KeyRound,
    tone: 'indigo',
    onClickKey: 'applicant',
  },
];

const providerGroups: Array<{
  id: ProviderGroupId;
  label: string;
  icon: typeof Landmark;
  value: string;
  focus: string;
  priorityTools: ToolId[];
}> = [
  {
    id: 'religious-leaders',
    label: 'Religious Leaders',
    icon: Landmark,
    value: 'Protect the sanctity of your community in a secure, non-extractive digital sanctuary.',
    focus: 'Community trust, event continuity, protected teachings, and member care pathways.',
    priorityTools: ['sessions', 'clients', 'content'],
  },
  {
    id: 'spiritual-leaders',
    label: 'Spiritual Leaders',
    icon: Sparkles,
    value: 'Protect the sanctity of your community in a secure, non-extractive digital sanctuary.',
    focus: 'Sacred practice delivery, lineage-aware content, and consent-centered guidance.',
    priorityTools: ['content', 'sessions', 'llm'],
  },
  {
    id: 'career-life-coaches',
    label: 'Career & Life Coaches',
    icon: Briefcase,
    value: 'Scale your impact with professional CRM tools that prioritize client transformation over ad-revenue.',
    focus: 'Client transformation plans, follow-up discipline, measurable outcomes, and booking flow.',
    priorityTools: ['clients', 'impact', 'revenue'],
  },
  {
    id: 'holistic-experts',
    label: 'Holistic Experts',
    icon: HandHeart,
    value: 'Verified ownership of your IP and content, free from opaque algorithmic suppression.',
    focus: 'Service catalogs, protected education, private cohorts, and content ownership.',
    priorityTools: ['content', 'llm', 'revenue'],
  },
  {
    id: 'mental-health-providers',
    label: 'Mental Health Providers',
    icon: Brain,
    value: 'HIPAA-informed privacy principles integrated into a community-first ecosystem.',
    focus: 'Boundaries, privacy-forward intake, session continuity, and ethical referral flows.',
    priorityTools: ['clients', 'sessions', 'impact'],
  },
  {
    id: 'cultural-enthusiasts',
    label: 'Cultural Enthusiasts',
    icon: Globe2,
    value: 'A global stage for cultural preservation that rewards your expertise fairly.',
    focus: 'Cultural knowledge preservation, fair recognition, public programs, and global reach.',
    priorityTools: ['content', 'impact', 'revenue'],
  },
];

const toolModules: Array<{
  id: ToolId;
  title: string;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: 'clients',
    title: 'Client CRM',
    label: 'Manage clients',
    description: 'Centralize intake, relationship history, service boundaries, follow-ups, and provider notes.',
    icon: Users,
  },
  {
    id: 'sessions',
    title: 'Live Sessions',
    label: 'Host live sessions',
    description: 'Coordinate hosted sessions, event flow, attendance visibility, and post-session continuity.',
    icon: Video,
  },
  {
    id: 'llm',
    title: 'Ethical LLM Tools',
    label: 'Sponsored intelligence',
    description:
      'Use in-platform LLM support for planning, content drafting, and summaries without data-extractive targeting.',
    icon: Brain,
  },
  {
    id: 'content',
    title: 'Content & IP',
    label: 'Own your work',
    description: 'Organize offerings, courses, articles, resources, and protected intellectual property surfaces.',
    icon: Library,
  },
  {
    id: 'revenue',
    title: 'Revenue Transparency',
    label: 'Track ROI',
    description: 'See session demand, service performance, payout context, and sponsored reach in one view.',
    icon: BarChart3,
  },
  {
    id: 'impact',
    title: 'Impact Metrics',
    label: 'Measure outcomes',
    description: 'Connect client progress, engagement, social impact, and investor-ready reporting signals.',
    icon: CheckCircle2,
  },
];

const pathPriority: Record<GuidedPath, ToolId[]> = {
  metrics: ['revenue', 'impact', 'clients'],
  content: ['content', 'llm', 'sessions'],
};

const toneClasses = {
  blue: {
    border: 'border-blue-300/20 hover:border-blue-200/50 focus:ring-blue-200/40',
    bg: 'bg-blue-500/[0.08] hover:bg-blue-500/15',
    text: 'text-blue-100',
    muted: 'text-blue-50/70',
    shadow: 'shadow-blue-950/25',
    tooltip: 'border-blue-200/15 text-blue-50 shadow-blue-950/30',
  },
  teal: {
    border: 'border-teal-200/20 hover:border-teal-100/50 focus:ring-teal-100/40',
    bg: 'bg-teal-400/[0.08] hover:bg-teal-400/15',
    text: 'text-teal-100',
    muted: 'text-teal-50/70',
    shadow: 'shadow-teal-950/20',
    tooltip: 'border-teal-200/15 text-teal-50 shadow-teal-950/25',
  },
  indigo: {
    border: 'border-indigo-200/20 hover:border-indigo-100/50 focus:ring-indigo-100/40',
    bg: 'bg-indigo-400/[0.08] hover:bg-indigo-400/15',
    text: 'text-indigo-100',
    muted: 'text-indigo-50/70',
    shadow: 'shadow-indigo-950/20',
    tooltip: 'border-indigo-200/15 text-indigo-50 shadow-indigo-950/25',
  },
};

const getToolWeight = (
  toolId: ToolId,
  activeGroup: (typeof providerGroups)[number],
  guidedPath: GuidedPath
): number => {
  const groupIndex = activeGroup.priorityTools.indexOf(toolId);
  const pathIndex = pathPriority[guidedPath].indexOf(toolId);
  const groupWeight = groupIndex === -1 ? 0 : 20 - groupIndex * 4;
  const pathWeight = pathIndex === -1 ? 0 : 12 - pathIndex * 3;
  return groupWeight + pathWeight;
};

const ProviderAccessPage: React.FC<ProviderAccessPageProps> = ({
  onGoHome,
  onSignIn,
  onApply,
  onApplicantSignIn,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<ProviderGroupId>('career-life-coaches');
  const [guidedPath, setGuidedPath] = useState<GuidedPath>('metrics');

  const activeGroup = providerGroups.find((group) => group.id === selectedGroupId) || providerGroups[0];
  const ActiveGroupIcon = activeGroup.icon;
  const prioritizedTools = useMemo(
    () =>
      [...toolModules].sort(
        (a, b) =>
          getToolWeight(b.id, activeGroup, guidedPath) - getToolWeight(a.id, activeGroup, guidedPath)
      ),
    [activeGroup, guidedPath]
  );

  const handlers: Record<PathwayClickKey, () => void> = {
    signin: onSignIn,
    apply: onApply,
    applicant: onApplicantSignIn,
  };

  return (
    <div className="relative z-10 min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-y-auto custom-scrollbar bg-[#05070a] p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-12 xl:p-20">
      <svg
        className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full opacity-70 lg:block"
        viewBox="0 0 1200 820"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="providerPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="providerArrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M2 2 L10 6 L2 10 Z" fill="#bfdbfe" />
          </marker>
        </defs>
        {[
          'M130 145 C300 175 415 235 520 330',
          'M1070 115 C890 160 765 230 650 335',
          'M600 360 C515 445 405 505 250 615',
          'M600 360 C610 470 690 560 925 670',
        ].map((path, index) => (
          <path
            key={path}
            d={path}
            fill="none"
            stroke={index % 2 === 0 ? '#60a5fa' : '#5eead4'}
            strokeWidth="2"
            strokeDasharray="8 20"
            markerEnd={index > 1 ? 'url(#providerArrow)' : undefined}
            filter="url(#providerPathGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="90" to="0" dur={index > 1 ? '5s' : '4s'} repeatCount="indefinite" />
          </path>
        ))}
      </svg>

      <button
        type="button"
        onClick={onSignIn}
        className="fixed right-4 top-4 z-30 rounded-2xl border border-cyan-200/30 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl transition-all hover:bg-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-200/40 sm:right-8 sm:top-8 sm:px-5"
      >
        Approved Provider Sign In
      </button>

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 pb-8 sm:space-y-10 md:space-y-12">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 text-slate-500 transition-colors hover:text-white sm:gap-3"
        >
          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[9px] font-bold uppercase sm:text-[10px]">Portal Entry</span>
        </button>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/10 shadow-[0_0_35px_rgba(59,130,246,0.2)]">
                <img src={logo} alt="Conscious Network Hub Logo" className="h-9 w-9" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-blue-300/70">
                  Conscious Network Hub
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-cyan-100/55">
                  Conscious Network Hub Business Command Center
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <p className="hidden text-[9px] font-black uppercase text-blue-300/70 lg:block">
                Provider Access
              </p>
              <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.95] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Provider Access
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                Reclaim your professional sovereignty. Move beyond extractive algorithms into a
                decentralized ecosystem built on integrity, revenue transparency, and intellectual
                property ownership.
              </p>
              <p className="max-w-3xl text-sm leading-7 text-slate-400">
                Our platform is built on principles of integrity and service, ensuring accessibility
                to a diverse user base while delivering measurable social impact and a strong ROI for
                investors.
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-[1.75rem] border border-blue-500/20 bg-blue-500/[0.04] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-teal-200/15 bg-teal-400/10 p-3 text-teal-100">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-teal-200/70">
                  Mission Alignment
                </p>
                <h2 className="mt-2 text-lg font-black uppercase text-white">
                  Secure Global Purpose Space
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  To create a secure global space where people, providers, organizations, and
                  institutions connect, learn, and align with purpose-driven values.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              eyebrow: 'What is this?',
              title: 'The Gateway to Your Purpose-Driven Business.',
              description: 'A provider entry point for approved professionals and new applicants.',
            },
            {
              eyebrow: 'Why is this here?',
              title: 'Dismantle centralized suppression.',
              description: 'Built in response to data-extractive platforms that bury holistic and spiritual expertise.',
            },
            {
              eyebrow: 'What do we do?',
              title: 'Operate without data extraction.',
              description: 'Manage clients, host live sessions, and use ethical LLM tools inside one business hub.',
            },
          ].map((item) => (
            <div
              key={item.eyebrow}
              className="glass-panel rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl sm:p-6"
            >
              <p className="text-[10px] font-black uppercase text-blue-300/70">{item.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black uppercase leading-tight text-white">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-blue-300/70">
                Provider-Specific Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase text-white sm:text-3xl">
                Choose your provider lens
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-1.5">
              <button
                type="button"
                onClick={() => setGuidedPath('metrics')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase transition ${
                  guidedPath === 'metrics'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Business Metrics
              </button>
              <button
                type="button"
                onClick={() => setGuidedPath('content')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase transition ${
                  guidedPath === 'content'
                    ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-950/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Content Management
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {providerGroups.map((group) => {
              const Icon = group.icon;
              const isSelected = group.id === selectedGroupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`group flex min-h-[8.5rem] flex-col justify-between rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-200/40 ${
                    isSelected
                      ? 'border-blue-300/50 bg-blue-500/15 text-white shadow-2xl shadow-blue-950/30'
                      : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-teal-200/30 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-cyan-100' : 'text-slate-500 group-hover:text-teal-200'}`} />
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-cyan-100" />}
                  </div>
                  <span className="text-sm font-black uppercase leading-tight">{group.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="glass-panel rounded-[1.75rem] border border-blue-500/20 bg-blue-500/[0.04] p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-cyan-200/20 bg-cyan-400/10 p-3 text-cyan-100">
                  <ActiveGroupIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-cyan-200/70">
                    Active Provider Profile
                  </p>
                  <h3 className="mt-2 text-2xl font-black uppercase text-white">
                    {activeGroup.label}
                  </h3>
                </div>
              </div>
              <p className="mt-5 text-base leading-7 text-slate-200">{activeGroup.value}</p>
              <p className="mt-4 text-sm leading-6 text-slate-400">{activeGroup.focus}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {prioritizedTools.map((tool, index) => {
                const Icon = tool.icon;
                const isPriority = index < 3;
                return (
                  <div
                    key={tool.id}
                    className={`glass-panel rounded-[1.5rem] border p-5 shadow-2xl transition-all ${
                      isPriority
                        ? 'border-teal-300/25 bg-teal-400/[0.07]'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-[10px] font-black uppercase ${isPriority ? 'text-teal-100/75' : 'text-slate-500'}`}>
                          {isPriority ? 'Prioritized' : tool.label}
                        </p>
                        <h3 className="mt-2 text-lg font-black uppercase text-white">{tool.title}</h3>
                      </div>
                      <Icon className={`h-5 w-5 ${isPriority ? 'text-teal-100' : 'text-blue-300/60'}`} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">{tool.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {pathways.map((pathway) => {
            const Icon = pathway.icon;
            const tone = toneClasses[pathway.tone];
            return (
              <div className="group relative" key={pathway.title}>
                <button
                  type="button"
                  onClick={handlers[pathway.onClickKey]}
                  className={`flex min-h-[15rem] w-full flex-col justify-between overflow-hidden rounded-[1.75rem] border p-6 text-left shadow-2xl transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 active:scale-[0.99] sm:p-7 ${tone.border} ${tone.bg} ${tone.shadow}`}
                >
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-[10px] font-black uppercase opacity-70 ${tone.text}`}>
                        {pathway.eyebrow}
                      </p>
                      <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                        {pathway.title}
                      </h2>
                    </div>
                    <Icon className={`h-7 w-7 ${tone.text}`} />
                  </div>
                  <div className="relative z-10 flex items-end justify-between gap-4 pt-8">
                    <p className={`max-w-sm text-sm leading-6 ${tone.muted}`}>{pathway.description}</p>
                    <ChevronRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${tone.text}`} />
                  </div>
                </button>
                <div className={`pointer-events-none absolute bottom-full left-4 right-4 z-20 mb-3 origin-bottom rounded-2xl border bg-slate-950/85 p-4 text-xs leading-5 opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 md:left-6 md:right-auto md:w-80 ${tone.tooltip}`}>
                  {pathway.tooltip}
                </div>
              </div>
            );
          })}
        </section>

        <div className="flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100/70" />
          Application access is separate from provider CRM access. Review status does not grant
          approved-provider permissions.
        </div>
      </div>
    </div>
  );
};

export default ProviderAccessPage;
