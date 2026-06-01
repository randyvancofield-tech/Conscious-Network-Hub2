import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  HeartHandshake,
  Landmark,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Network,
  Recycle,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { UserProfile } from '../types';
import { api } from '../services/apiClient';
import careersLogo from '../src/assets/brand/conscious-careers-logo.png';

interface EntrepreneurshipSupportPageProps {
  user: UserProfile | null;
  onBack: () => void;
  onSignInPrompt: () => void;
  onApplyAsProvider: () => void;
}

type StageOption =
  | 'I have an idea'
  | 'I am exploring entrepreneurship'
  | 'I have started but need structure'
  | 'I need help stabilizing'
  | 'I need help growing'
  | 'I am preparing for funding or capital readiness';

type SupportNeed =
  | 'Purpose and alignment'
  | 'Business plan'
  | 'Legal/entity formation'
  | 'Funding readiness'
  | 'Marketing/sales'
  | 'Financial management'
  | 'Operations'
  | 'Technology support'
  | 'Coaching/accountability'
  | 'Community support';

type RegionOption = 'San Diego / Imperial' | 'Greater New Orleans / Louisiana' | 'Other';
type AlignmentOption = 'Yes' | 'Somewhat' | 'Not sure' | 'No';

interface ResourceLane {
  id: RegionOption;
  label: string;
  resource: string;
  url: string;
  focus: string;
  cta: string;
  tone: string;
  icon: React.ReactNode;
}

interface AssessmentState {
  stage: StageOption | '';
  supportNeeds: SupportNeed[];
  region: RegionOption | '';
  alignment: AlignmentOption | '';
  goal: string;
  barrier: string;
  readiness: string;
}

interface ExecutiveInquiryState {
  name: string;
  email: string;
  organization: string;
  role: string;
  inquiryType: string;
  region: string;
  message: string;
}

const stageOptions: StageOption[] = [
  'I have an idea',
  'I am exploring entrepreneurship',
  'I have started but need structure',
  'I need help stabilizing',
  'I need help growing',
  'I am preparing for funding or capital readiness',
];

const supportNeedOptions: SupportNeed[] = [
  'Purpose and alignment',
  'Business plan',
  'Legal/entity formation',
  'Funding readiness',
  'Marketing/sales',
  'Financial management',
  'Operations',
  'Technology support',
  'Coaching/accountability',
  'Community support',
];

const regionOptions: RegionOption[] = ['San Diego / Imperial', 'Greater New Orleans / Louisiana', 'Other'];
const alignmentOptions: AlignmentOption[] = ['Yes', 'Somewhat', 'Not sure', 'No'];
const executiveInquiryTypes = [
  'Potential formal partnership pathway',
  'Executive introduction',
  'Regional resource collaboration',
  'Institutional or philanthropic inquiry',
  'General entrepreneurship pathway inquiry',
];
const calendlyBuildingConnectionsUrl = 'https://calendly.com/randycofield/buildingconnections';
const narrativeFields: Array<{ field: 'goal' | 'barrier' | 'readiness'; label: string }> = [
  { field: 'goal', label: 'What is your primary business or career goal?' },
  { field: 'barrier', label: 'What barrier is currently holding you back?' },
  { field: 'readiness', label: 'What would make you feel ready to connect with a business support organization?' },
];

const resourceLanes: ResourceLane[] = [
  {
    id: 'San Diego / Imperial',
    label: 'San Diego / Imperial',
    resource: 'San Diego & Imperial SBDC',
    url: 'https://sdivsbdc.org/',
    focus: 'A regional entrepreneurship support resource users may explore through the organization\'s own independent operations.',
    cta: 'Explore San Diego & Imperial SBDC',
    tone: 'border-cyan-300/25 bg-cyan-400/[0.06]',
    icon: <MapPin className="h-5 w-5" />,
  },
  {
    id: 'Greater New Orleans / Louisiana',
    label: 'Greater New Orleans / Louisiana',
    resource: 'Louisiana SBDC at Xavier University',
    url: 'https://www.louisianasbdc.org/lsbdc-greater-new-orleans-region',
    focus: 'A Greater New Orleans entrepreneurship support resource users may explore through the organization\'s own independent operations.',
    cta: 'Explore Louisiana SBDC Greater New Orleans',
    tone: 'border-emerald-300/25 bg-emerald-400/[0.06]',
    icon: <Landmark className="h-5 w-5" />,
  },
  {
    id: 'Other',
    label: 'Find Your Local SBDC',
    resource: 'SBDCNet Local SBDC Finder',
    url: 'https://www.sbdcnet.org/find-your-local-sbdc-office/',
    focus: 'A national finder users may explore when they need to locate an entrepreneurship support resource in another region.',
    cta: 'Find Your Local SBDC',
    tone: 'border-violet-300/25 bg-violet-400/[0.06]',
    icon: <Network className="h-5 w-5" />,
  },
];

const initialAssessment: AssessmentState = {
  stage: '',
  supportNeeds: [],
  region: '',
  alignment: '',
  goal: '',
  barrier: '',
  readiness: '',
};

const createInitialExecutiveInquiry = (user: UserProfile | null): ExecutiveInquiryState => ({
  name: user?.name || '',
  email: user?.email || '',
  organization: '',
  role: '',
  inquiryType: executiveInquiryTypes[0],
  region: '',
  message: '',
});

const resourcePathwayFlow = [
  'Inner Alignment',
  'Business Readiness',
  'External Resource Connection',
  'Economic Participation',
  'Community Reinvestment',
];

const audiencePathways = [
  {
    title: 'Emerging Founders',
    body: 'Members who have a business idea, vocational calling, or community solution and need clarity before moving into technical execution.',
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    title: 'Stabilizing Operators',
    body: 'Builders who have started but need structure around operations, accountability, market fit, systems, or readiness for external advising.',
    icon: <Layers3 className="h-5 w-5" />,
  },
  {
    title: 'Resource Navigators',
    body: 'Members seeking a practical bridge toward local entrepreneurship organizations, training, SBDC pathways, or approved support providers.',
    icon: <Compass className="h-5 w-5" />,
  },
];

const readinessStages = [
  {
    title: 'Identity And Purpose',
    body: 'Name the calling, lived experience, community need, or problem that is asking to become practical work.',
    signal: 'Fit before force',
  },
  {
    title: 'Model Clarity',
    body: 'Translate the idea into a simple offer, audience, delivery model, and first evidence of demand.',
    signal: 'Clarity before scale',
  },
  {
    title: 'Operating Capacity',
    body: 'Review time, tools, team, emotional capacity, financial reality, and support needs before overextending.',
    signal: 'Capacity before commitment',
  },
  {
    title: 'Resource Readiness',
    body: 'Prepare thoughtful questions, documentation, and next-step context before approaching outside resources.',
    signal: 'Preparation before referral',
  },
];

const founderMessagePrinciples = [
  'Entrepreneurship should not require people to disconnect from conscience, culture, faith, healing, or community accountability.',
  'This portal prepares members to move toward external resources with clarity, not pressure or unsupported promises.',
  'Conscious Careers is designed to connect learning, livelihood, dignity, and responsible economic participation over time.',
];

const supportPathways = [
  {
    title: 'Learning Pathway',
    body: 'Use HCN reflection, learning, and social-development spaces to clarify direction and build the inner structure needed for entrepreneurship.',
    icon: <BookOpenCheck className="h-5 w-5" />,
  },
  {
    title: 'Readiness Pathway',
    body: 'Use the guided assessment to identify stage, support needs, region, and preparation notes before moving to external resources.',
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    title: 'External Resource Pathway',
    body: 'Explore public entrepreneurship support organizations through their own independent programs, requirements, and intake processes.',
    icon: <Network className="h-5 w-5" />,
  },
  {
    title: 'Provider Support Pathway',
    body: 'Approved providers may support preparation, accountability, coaching, or education within HCN boundaries after review.',
    icon: <HeartHandshake className="h-5 w-5" />,
  },
];

const getResourceForRegion = (region: RegionOption | ''): ResourceLane =>
  resourceLanes.find((lane) => lane.id === region) || resourceLanes[2];

const hasAdvisoryCaution = (needs: SupportNeed[]): boolean =>
  needs.includes('Legal/entity formation') || needs.includes('Financial management');

const EntrepreneurshipSupportPage: React.FC<EntrepreneurshipSupportPageProps> = ({
  user,
  onBack,
  onSignInPrompt,
  onApplyAsProvider,
}) => {
  const [assessment, setAssessment] = useState<AssessmentState>(initialAssessment);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [assessmentStatus, setAssessmentStatus] = useState('');
  const [executiveInquiry, setExecutiveInquiry] = useState<ExecutiveInquiryState>(() =>
    createInitialExecutiveInquiry(user)
  );
  const [executiveInquiryStatus, setExecutiveInquiryStatus] = useState('');
  const [isExecutiveInquirySubmitting, setExecutiveInquirySubmitting] = useState(false);

  const selectedResource = useMemo(
    () => getResourceForRegion(assessment.region),
    [assessment.region]
  );

  const completedSegments = [
    Boolean(assessment.stage),
    assessment.supportNeeds.length > 0,
    Boolean(assessment.region),
    Boolean(assessment.alignment),
    Boolean(assessment.goal.trim() || assessment.barrier.trim() || assessment.readiness.trim()),
  ].filter(Boolean).length;

  const progressPercent = Math.round((completedSegments / 5) * 100);
  const needsAlignmentPreparation = assessment.alignment === 'Not sure' || assessment.alignment === 'No';
  const needsFundingSupport = assessment.supportNeeds.includes('Funding readiness');
  const needsProfessionalAdvisoryBoundary = hasAdvisoryCaution(assessment.supportNeeds);

  const recommendation = useMemo(() => {
    const cnhStep = needsAlignmentPreparation
      ? 'Start with HCN discernment and identity alignment before requesting technical business support.'
      : assessment.stage === 'I am preparing for funding or capital readiness' || needsFundingSupport
        ? 'Prepare a clear business story, use-of-funds outline, readiness notes, and next-step questions before meeting an advisor.'
        : 'Complete the readiness reflection, identify one practical next action, then connect with the most relevant support lane.';

    const nextAction = needsAlignmentPreparation
      ? 'Complete an HCN preparation pass, then open the recommended external resource when the business direction is clearer.'
      : `Open ${selectedResource.resource} and request the most appropriate advising or training pathway.`;

    return {
      readinessSummary: assessment.stage
        ? `${assessment.stage}. Primary support need: ${assessment.supportNeeds[0] || 'not selected'}.`
        : 'Complete the readiness assessment to generate a member-specific pathway.',
      cnhStep,
      resource: selectedResource,
      nextAction,
    };
  }, [assessment.stage, assessment.supportNeeds, needsAlignmentPreparation, needsFundingSupport, selectedResource]);

  const toggleSupportNeed = (need: SupportNeed) => {
    setAssessment((current) => {
      const exists = current.supportNeeds.includes(need);
      return {
        ...current,
        supportNeeds: exists
          ? current.supportNeeds.filter((entry) => entry !== need)
          : [...current.supportNeeds, need],
      };
    });
    setHasSubmitted(false);
  };

  const updateField = <K extends keyof AssessmentState>(field: K, value: AssessmentState[K]) => {
    setAssessment((current) => ({ ...current, [field]: value }));
    setHasSubmitted(false);
  };

  const scrollToExecutiveInquiry = () => {
    document.getElementById('executive-inquiry')?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateExecutiveInquiryField = <K extends keyof ExecutiveInquiryState>(
    field: K,
    value: ExecutiveInquiryState[K]
  ) => {
    setExecutiveInquiry((current) => ({ ...current, [field]: value }));
    setExecutiveInquiryStatus('');
  };

  const completeAssessment = () => {
    if (!user) {
      setAssessmentStatus('Sign in or create a profile to generate a personalized entrepreneurship pathway.');
      onSignInPrompt();
      return;
    }

    if (!assessment.stage || assessment.supportNeeds.length === 0 || !assessment.region || !assessment.alignment) {
      setAssessmentStatus('Complete the stage, support need, region, and alignment fields to generate a pathway.');
      return;
    }

    setHasSubmitted(true);
    setAssessmentStatus('Recommended pathway generated locally for this session.');
  };

  const submitExecutiveInquiry = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = executiveInquiry.name.trim();
    const email = executiveInquiry.email.trim();
    const message = executiveInquiry.message.trim();

    if (!name || !email || message.length < 10) {
      setExecutiveInquiryStatus('Name, email, and a message of at least 10 characters are required.');
      return;
    }

    setExecutiveInquirySubmitting(true);
    setExecutiveInquiryStatus('');

    try {
      const structuredMessage = [
        'High Executive Contact and General Inquiry',
        '',
        `Inquiry type: ${executiveInquiry.inquiryType}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Organization: ${executiveInquiry.organization.trim() || 'Not provided'}`,
        `Role/title: ${executiveInquiry.role.trim() || 'Not provided'}`,
        `Region: ${executiveInquiry.region.trim() || 'Not provided'}`,
        '',
        'Message:',
        message,
        '',
        'Boundary: This submission is for executive contact, general inquiry, or potential future formal pathway review. It does not create a formal partnership, referral guarantee, funding guarantee, or professional advice relationship.',
      ].join('\n');

      const data = await api<{ ticketId?: string }>('/support/contact', {
        method: 'POST',
        body: {
          name,
          email,
          subject: `High Executive Contact / General Inquiry - ${executiveInquiry.inquiryType}`,
          message: structuredMessage,
          route: '/conscious-careers/entrepreneurship-support#executive-inquiry',
        },
      });

      setExecutiveInquiryStatus(`Executive inquiry received${data.ticketId ? `: ${data.ticketId}` : ''}.`);
      setExecutiveInquiry((current) => ({ ...current, message: '' }));
    } catch (error) {
      setExecutiveInquiryStatus(error instanceof Error ? error.message : 'Executive inquiry could not be recorded.');
    } finally {
      setExecutiveInquirySubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.12),transparent_30%)] px-4 pb-16 pt-20 text-slate-100 sm:px-6 sm:pt-24 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Conscious Careers
        </button>

        <section className="relative overflow-hidden border-b border-white/10 pb-10 lg:pb-14">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,0.68fr)_minmax(320px,0.32fr)]">
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200/30 bg-white p-2 shadow-[0_18px_60px_rgba(20,184,166,0.24)]">
                  <img src={careersLogo} alt="Conscious Careers" className="h-full w-full rounded-2xl object-contain" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-200">
                    Entrepreneurship Support Portal
                  </p>
                  <p className="max-w-xl text-sm font-semibold text-slate-400">
                    A launch-safe Conscious Careers pathway for readiness, resource navigation, and institution-aware economic empowerment.
                  </p>
                </div>
              </div>

              <div className="max-w-5xl space-y-5">
                <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.98] tracking-tight text-white sm:text-5xl lg:text-7xl">
                  Build With Clarity Before You Build With Pressure
                </h1>
                <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  Conscious Careers helps members move from inspiration to readiness through grounded reflection, practical preparation, local resource pathways, and reviewed support channels.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => document.getElementById('readiness-assessment')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-teal-950/30 transition-colors hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                >
                  Start Readiness Pathway <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('resource-pathways')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
                >
                  View Resource Lanes
                </button>
                <button
                  type="button"
                  onClick={scrollToExecutiveInquiry}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.07] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-amber-50 transition-colors hover:bg-amber-200/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50"
                >
                  Executive Inquiry
                </button>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Portal Pathway</p>
              <div className="mt-5 space-y-3">
                {resourcePathwayFlow.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-xs font-black text-teal-100">
                      {index + 1}
                    </span>
                    <p className="text-sm font-black uppercase tracking-tight text-white">{step}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200/80">Platform Message</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Economic Development With Conscience
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              This portal is built for people who want their work to create livelihood without abandoning responsibility, dignity, or spiritual alignment.
            </p>
          </div>
          <div className="grid gap-3">
            {founderMessagePrinciples.map((principle, index) => (
              <div key={principle} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-teal-200" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Principle 0{index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{principle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Who This Is For</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              A Professional Pathway For Builders At Different Stages
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {audiencePathways.map((pathway) => (
              <article key={pathway.title} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-teal-200/30 hover:bg-white/[0.055]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/10 text-teal-100 transition-colors group-hover:bg-teal-300/[0.15]">
                  {pathway.icon}
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">{pathway.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{pathway.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="readiness-assessment" className="scroll-mt-28 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.63fr)_minmax(340px,0.37fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200/80">Primary Pathway Entry</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                    Guided Readiness Assessment
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    This session-only guide helps you identify your stage, support needs, region, and preparation notes. It does not save assessment responses to the backend.
                  </p>
                </div>
                <div className="min-w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:min-w-64">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal-300 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="mt-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {progressPercent}% pathway detail complete
                  </p>
                </div>
              </div>

              <div className="mb-7 grid gap-2 sm:grid-cols-5">
                {['Stage', 'Needs', 'Region', 'Alignment', 'Notes'].map((step, index) => (
                  <div
                    key={step}
                    className={`rounded-2xl border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.16em] ${
                      completedSegments > index
                        ? 'border-teal-300/40 bg-teal-300/10 text-teal-100'
                        : 'border-white/10 bg-white/[0.025] text-slate-500'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>

              {!user && (
                <div className="mb-7 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-amber-200" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-white">Sign In Required For Personalized Recommendations</p>
                      <p className="mt-2 text-sm leading-6 text-amber-50/80">
                        Guests can review the portal and public resource lanes. Generating a personalized pathway requires an HCN profile.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-300">What stage are you in?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {stageOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateField('stage', option)}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50 ${
                          assessment.stage === option
                            ? 'border-teal-300/50 bg-teal-300/[0.15] text-teal-50'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-300">What support do you need most?</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {supportNeedOptions.map((option) => {
                      const selected = assessment.supportNeeds.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleSupportNeed(option)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 ${
                            selected
                              ? 'border-blue-300/50 bg-blue-300/[0.15] text-blue-50'
                              : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-300">What region are you connected to?</p>
                    <div className="space-y-2">
                      {regionOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateField('region', option)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 ${
                            assessment.region === option
                              ? 'border-emerald-300/50 bg-emerald-300/[0.15] text-emerald-50'
                              : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-300">Are you aligned with the business you want to build?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {alignmentOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateField('alignment', option)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 ${
                            assessment.alignment === option
                              ? 'border-violet-300/50 bg-violet-300/[0.15] text-violet-50'
                              : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {narrativeFields.map(({ field, label }) => (
                    <label key={field} className="block">
                      <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
                      <textarea
                        value={assessment[field]}
                        onChange={(event) => updateField(field, event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                        placeholder="Write a concise reflection..."
                      />
                    </label>
                  ))}
                </div>

                {assessmentStatus && (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                    {assessmentStatus}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={completeAssessment}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-950 transition-colors hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                  >
                    Generate Recommended Pathway <Sparkles className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssessment(initialAssessment);
                      setHasSubmitted(false);
                      setAssessmentStatus('');
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200/80">Pathway Output</p>
                {hasSubmitted ? (
                  <div className="mt-5 space-y-4">
                    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Readiness Summary</p>
                      <p className="mt-2 text-sm leading-6 text-white">{recommendation.readinessSummary}</p>
                    </section>
                    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">HCN Preparation Step</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.cnhStep}</p>
                    </section>
                    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">External Resource</p>
                      <p className="mt-2 text-sm font-black text-white">{recommendation.resource.resource}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.nextAction}</p>
                      <a
                        href={recommendation.resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.15] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
                      >
                        Open Resource <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </section>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-black/20 p-5 text-sm leading-7 text-slate-400">
                    Complete the required assessment fields to see a pathway summary, HCN preparation step, resource lane, and suggested next action.
                  </div>
                )}
              </div>

              {(needsAlignmentPreparation || needsFundingSupport || needsProfessionalAdvisoryBoundary) && (
                <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-white">Pathway Notes</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-amber-50/85">
                    {needsAlignmentPreparation && (
                      <p>HCN preparation is recommended first because alignment is uncertain.</p>
                    )}
                    {needsFundingSupport && (
                      <p>External entrepreneurship support resources may help users explore business readiness questions. HCN does not guarantee funding, lending access, or program eligibility.</p>
                    )}
                    {needsProfessionalAdvisoryBoundary && (
                      <p>HCN does not provide legal, tax, accounting, lending, or financial advice. Qualified professionals may be needed.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 sm:p-6">
                <ShieldCheck className="mb-4 h-6 w-6 text-emerald-100" />
                <p className="text-sm font-black uppercase tracking-tight text-white">Readiness Before Referral</p>
                <p className="mt-3 text-sm leading-6 text-emerald-50/75">
                  The stronger the preparation notes, the easier it becomes to approach outside programs with context, humility, and practical next-step questions.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-5">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Entrepreneurship Readiness Stages</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              From Calling To Responsible Action
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {readinessStages.map((stage, index) => (
              <article key={stage.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-teal-200">Stage 0{index + 1}</span>
                <h3 className="mt-4 text-lg font-black uppercase tracking-tight text-white">{stage.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{stage.body}</p>
                <p className="mt-5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
                  {stage.signal}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="resource-pathways" className="scroll-mt-28 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Resource Pathways</p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                Select The Lane That Matches The Next Step
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                HCN prepares the member. External organizations operate independently and may provide business advising, training, or technical assistance through their own processes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {supportPathways.map((pathway) => (
                <article key={pathway.title} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-300/10 text-blue-100">
                    {pathway.icon}
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">{pathway.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{pathway.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {resourceLanes.map((lane) => (
              <article key={lane.id} className={`rounded-3xl border p-5 shadow-xl shadow-black/20 ${lane.tone}`}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-white/10 p-3 text-white">{lane.icon}</div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-300">
                    External
                  </span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">{lane.label}</h3>
                <p className="mt-1 text-sm font-bold text-teal-100">{lane.resource}</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{lane.focus}</p>
                <details className="group mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black uppercase tracking-[0.16em] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                    Pathway Details
                    <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    Use this lane after clarifying your business question, readiness stage, and practical support need. Program eligibility, availability, and intake decisions belong to the external organization.
                  </p>
                </details>
                <a
                  href={lane.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.15] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
                >
                  {lane.cta} <ArrowUpRight className="h-4 w-4" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <UsersRound className="mb-5 h-7 w-7 text-teal-200" />
            <h3 className="text-xl font-black uppercase tracking-tight text-white">Provider Support Path</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Coaches, mentors, consultants, and entrepreneurship support providers must be reviewed and approved before being presented to HCN members.
            </p>
            <button
              type="button"
              onClick={onApplyAsProvider}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.15] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50"
            >
              Apply To Support HCN Entrepreneurs
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200/80">Regenerative Economic Model</p>
                <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white sm:text-2xl">A Principle For Circular Growth</h3>
              </div>
              <Rocket className="h-8 w-8 text-emerald-200" />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ['Reinvestment Protocol', 'A planned 5% reinvestment pathway concept intended to route a portion of future platform revenue into micro-grants or support opportunities after legal, technical, and operational review.'],
                ['Localized Resilience', 'Regional pathways can connect local providers, entrepreneurs, and resource organizations so value circulates within communities.'],
                ['Conscious Careers Integration', 'Learning pathways can connect to earning pathways through verified providers, entrepreneurship preparation, and future external-resource opportunities.'],
              ].map(([title, body]) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <Recycle className="mb-3 h-5 w-5 text-emerald-100" />
                  <p className="text-sm font-black uppercase tracking-tight text-white">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)]">
          <div className="rounded-3xl border border-blue-300/20 bg-blue-300/[0.055] p-6 sm:p-8">
            <Building2 className="mb-5 h-7 w-7 text-blue-100" />
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Institutional And Regional Support Paths</h2>
            <p className="mt-4 text-sm leading-7 text-blue-50/80">
              HCN can help prepare members before they explore entrepreneurship programs, making potential referrals more intentional, values-aligned, and readiness-informed. Future formal partnerships may be pursued, but this page does not claim procurement, contracting, government partnership status, or confirmed partnership with any listed organization.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToExecutiveInquiry}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                Open Executive Inquiry Form
              </button>
              <a
                href={calendlyBuildingConnectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.15] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
              >
                Schedule A Conversation <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-rose-300/20 bg-rose-300/[0.05] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-7 w-7 text-rose-100" />
              <Scale className="h-7 w-7 text-rose-100" />
            </div>
            <h2 className="mt-5 text-xl font-black uppercase tracking-tight text-white">Compliance Boundary</h2>
            <p className="mt-4 text-sm leading-7 text-rose-50/85">
              HCN provides educational, reflective, and social-learning support. External organizations may provide business advising or technical assistance. HCN does not provide legal, tax, financial, accounting, lending, or guaranteed funding advice through this page.
            </p>
          </div>
        </section>

        <section id="executive-inquiry" className="grid scroll-mt-28 gap-5 lg:grid-cols-[minmax(0,0.62fr)_minmax(320px,0.38fr)]">
          <form
            onSubmit={submitExecutiveInquiry}
            className="rounded-3xl border border-blue-300/20 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 sm:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200/80">
                  Contact And Scheduling
                </p>
                <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                  Executive Contact And General Inquiry
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Use this form for executive introductions, institutional conversations, regional resource discussions, or general inquiries. Submissions route to the HCN admin console for review and do not create a confirmed partnership.
                </p>
              </div>
              <FileText className="h-8 w-8 shrink-0 text-blue-100" />
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Name</span>
                <input
                  type="text"
                  value={executiveInquiry.name}
                  onChange={(event) => updateExecutiveInquiryField('name', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Email</span>
                <input
                  type="email"
                  value={executiveInquiry.email}
                  onChange={(event) => updateExecutiveInquiryField('email', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Organization</span>
                <input
                  type="text"
                  value={executiveInquiry.organization}
                  onChange={(event) => updateExecutiveInquiryField('organization', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Role Or Title</span>
                <input
                  type="text"
                  value={executiveInquiry.role}
                  onChange={(event) => updateExecutiveInquiryField('role', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Inquiry Type</span>
                <select
                  value={executiveInquiry.inquiryType}
                  onChange={(event) => updateExecutiveInquiryField('inquiryType', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-all focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                >
                  {executiveInquiryTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Region</span>
                <input
                  type="text"
                  value={executiveInquiry.region}
                  onChange={(event) => updateExecutiveInquiryField('region', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="City, state, region, or national"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-slate-300">Inquiry</span>
              <textarea
                value={executiveInquiry.message}
                onChange={(event) => updateExecutiveInquiryField('message', event.target.value)}
                rows={5}
                minLength={10}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                placeholder="Share the executive contact, general inquiry, or potential future pathway context..."
                required
              />
            </label>

            {executiveInquiryStatus && (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                {executiveInquiryStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={isExecutiveInquirySubmitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-60"
            >
              {isExecutiveInquirySubmitting ? 'Submitting...' : 'Submit Executive Inquiry'}
            </button>
          </form>

          <aside className="rounded-3xl border border-teal-300/20 bg-teal-300/[0.06] p-6 sm:p-8">
            <CalendarDays className="mb-5 h-8 w-8 text-teal-100" />
            <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-100/75">Immediate Option</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">Schedule Building Connections</h2>
            <p className="mt-4 text-sm leading-7 text-teal-50/80">
              For time-sensitive executive conversations or exploratory alignment, use the scheduling link while the intake record remains available through the form.
            </p>
            <a
              href={calendlyBuildingConnectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-100/20 bg-teal-300/[0.15] px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-teal-300/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
            >
              Open Calendly <ArrowUpRight className="h-4 w-4" />
            </a>
            <p className="mt-5 text-sm leading-6 text-teal-50/70">
              Scheduling a call does not create a formal partnership, advisory relationship, funding relationship, or guaranteed platform outcome.
            </p>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default EntrepreneurshipSupportPage;
