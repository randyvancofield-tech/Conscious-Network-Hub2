import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Compass,
  Handshake,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  MapPin,
  Network,
  Recycle,
  Rocket,
  ShieldCheck,
  Sparkles,
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

const pathwaySteps = [
  {
    title: 'Discern',
    body: 'Clarify whether entrepreneurship is emerging from calling, survival, opportunity, service, or long-term vision.',
    icon: <Compass className="h-5 w-5" />,
  },
  {
    title: 'Prepare',
    body: 'Assess idea clarity, skill gaps, financial reality, emotional capacity, support needs, and timing.',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Connect',
    body: 'Move toward trusted external resources, approved coaches, SBDCs, local entrepreneurship organizations, or future formal collaborators if confirmed.',
    icon: <Handshake className="h-5 w-5" />,
  },
  {
    title: 'Circulate',
    body: 'Let skills, referrals, mentorship, resources, and opportunity circulate back into the community as capacity grows.',
    icon: <Recycle className="h-5 w-5" />,
  },
];

const resourcePathwayFlow = [
  'Inner Alignment',
  'Business Readiness',
  'External Resource Connection',
  'Economic Participation',
  'Community Reinvestment',
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
    <div className="min-h-[100dvh] w-full p-4 pt-20 text-slate-100 sm:p-6 sm:pt-24 md:p-8 lg:p-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:gap-10">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-3 text-slate-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Conscious Careers</span>
        </button>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl sm:rounded-[3rem] sm:p-10 lg:p-14">
          <div className="grid items-center gap-8 lg:grid-cols-[0.78fr_0.22fr]">
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-teal-200/20 bg-white/95 p-2 shadow-xl">
                  <img src={careersLogo} alt="Conscious Careers" className="h-full w-full rounded-2xl object-contain" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.45em] text-teal-200/70">
                    Entrepreneurship Support Portal
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-500">
                    External resource pathway, not a formal partnership claim
                  </p>
                </div>
              </div>

              <div className="max-w-4xl space-y-5">
                <h1 className="text-3xl font-black uppercase leading-tight tracking-tighter text-white sm:text-5xl lg:text-6xl">
                  Conscious Careers: Entrepreneurship Support
                </h1>
                <p className="text-xl font-black uppercase tracking-tight text-teal-100 sm:text-2xl">
                  Build with clarity before you build with pressure.
                </p>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  A guided pathway for members who feel called to start, stabilize, or grow a business through alignment, readiness, skill-building, and trusted local entrepreneurship resources.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('readiness-assessment')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-teal-300"
                >
                  Start Readiness Pathway <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={scrollToExecutiveInquiry}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10"
                >
                  Explore Potential Partnership Pathways
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {['Prepare people', 'Strengthen execution', 'Retain local value'].map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-teal-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-200">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-200/70">Strategic Resource Model</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">Resource Pathways Make The Work Scalable</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              HCN prepares members through alignment, readiness, social learning, and Conscious Careers pathways. External organizations operate independently and may provide entrepreneurship support through their own programs.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {resourcePathwayFlow.map((step, index) => (
              <div key={step} className="relative rounded-2xl border border-white/10 bg-slate-900/65 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-200">0{index + 1}</span>
                <p className="mt-5 text-sm font-black uppercase leading-5 text-white">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Conscious Careers Pathway</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Four Stages From Readiness To Circulation</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {pathwaySteps.map((step, index) => (
              <div key={step.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="rounded-xl bg-teal-400/10 p-3 text-teal-200">{step.icon}</div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Step {index + 1}</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Regional Lanes</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">External Entrepreneurship Resource Pathways</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {resourceLanes.map((lane) => (
              <div key={lane.id} className={`rounded-[1.75rem] border p-5 ${lane.tone}`}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-white/10 p-3 text-white">{lane.icon}</div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-300">
                    External resource
                  </span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">{lane.label}</h3>
                <p className="mt-1 text-sm font-bold text-teal-100">{lane.resource}</p>
                <p className="mt-4 min-h-24 text-sm leading-6 text-slate-300">{lane.focus}</p>
                <a
                  href={lane.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/15"
                >
                  {lane.cta} <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </section>

        <section id="readiness-assessment" className="grid gap-6 xl:grid-cols-[0.62fr_0.38fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-teal-200/70">Member Readiness Assessment</p>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Generate A Recommended Pathway</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Assessment responses are local-only for this session and are not saved to the backend.
                </p>
              </div>
              <div className="min-w-40">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-teal-300" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="mt-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {progressPercent}% complete
                </p>
              </div>
            </div>

            {!user && (
              <div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-1 h-5 w-5 text-amber-200" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white">Sign In Required</p>
                    <p className="mt-2 text-sm leading-6 text-amber-50/80">
                      Guests can view the pathway and resources. Personalized readiness recommendations require an HCN profile.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-7">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">What stage are you in?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {stageOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateField('stage', option)}
                      className={`rounded-xl border px-4 py-3 text-left text-xs font-bold transition-colors ${
                        assessment.stage === option
                          ? 'border-teal-300/50 bg-teal-300/15 text-teal-50'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">What support do you need most?</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {supportNeedOptions.map((option) => {
                    const selected = assessment.supportNeeds.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleSupportNeed(option)}
                        className={`rounded-xl border px-4 py-3 text-left text-xs font-bold transition-colors ${
                          selected
                            ? 'border-blue-300/50 bg-blue-300/15 text-blue-50'
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
                  <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">What region are you connected to?</p>
                  <div className="space-y-2">
                    {regionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateField('region', option)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-xs font-bold transition-colors ${
                          assessment.region === option
                            ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-50'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Are you aligned with the business you want to build?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {alignmentOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateField('alignment', option)}
                        className={`rounded-xl border px-4 py-3 text-left text-xs font-bold transition-colors ${
                          assessment.alignment === option
                            ? 'border-violet-300/50 bg-violet-300/15 text-violet-50'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {narrativeFields.map(({ field, label }) => (
                  <label key={field} className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
                    <textarea
                      value={assessment[field]}
                      onChange={(event) => updateField(field, event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                      placeholder="Write a concise reflection..."
                    />
                  </label>
                ))}
              </div>

              {assessmentStatus && (
                <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                  {assessmentStatus}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={completeAssessment}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-teal-300"
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
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-200/70">Recommended Pathway</p>
              {hasSubmitted ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Readiness Summary</p>
                    <p className="mt-2 text-sm leading-6 text-white">{recommendation.readinessSummary}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">HCN Preparation Step</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.cnhStep}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">External Resource</p>
                    <p className="mt-2 text-sm font-black text-white">{recommendation.resource.resource}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.nextAction}</p>
                    <a
                      href={recommendation.resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/15"
                    >
                      Open Resource <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
                  Complete the member assessment to see the pathway summary, HCN preparation step, resource lane, and suggested next action.
                </div>
              )}
            </div>

            {(needsAlignmentPreparation || needsFundingSupport || needsProfessionalAdvisoryBoundary) && (
              <div className="rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
                <p className="text-sm font-black uppercase tracking-widest text-white">Pathway Notes</p>
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
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6">
            <HeartHandshake className="mb-5 h-7 w-7 text-teal-200" />
            <h3 className="text-lg font-black uppercase tracking-tight text-white">Professional Support Pathway</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Coaches, mentors, consultants, and entrepreneurship support providers must be reviewed and approved before being presented to HCN members.
            </p>
            <button
              type="button"
              onClick={onApplyAsProvider}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/15"
            >
              Apply To Support HCN Entrepreneurs
            </button>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 lg:col-span-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-200/70">Regenerative Economic Model</p>
                <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">A Principle For Circular Growth</h3>
              </div>
              <Rocket className="h-8 w-8 text-emerald-200" />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ['Reinvestment Protocol', 'A planned 5% reinvestment pathway concept intended to route a portion of future platform revenue into micro-grants or support opportunities after legal, technical, and operational review.'],
                ['Localized Resilience', 'Regional pathways can connect local providers, entrepreneurs, and resource organizations so value circulates within communities.'],
                ['Conscious Careers Integration', 'Learning pathways can connect to earning pathways through verified providers, entrepreneurship preparation, and future external-resource opportunities.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-black uppercase tracking-tight text-white">{title}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
            <Building2 className="mb-5 h-7 w-7 text-blue-200" />
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">For Local And Institutional Organizations</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              HCN can help prepare members before they explore entrepreneurship programs, making potential referrals more intentional, values-aligned, and readiness-informed. Future formal partnerships may be pursued, but this page does not claim procurement, contracting, government partnership status, or confirmed partnership with any listed organization.
            </p>
            <button
              type="button"
              onClick={scrollToExecutiveInquiry}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-400"
            >
              Open Executive Inquiry Form
            </button>
          </div>

          <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/[0.05] p-6 sm:p-8">
            <BadgeCheck className="mb-5 h-7 w-7 text-rose-100" />
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Compliance Boundary</h2>
            <p className="mt-4 text-sm leading-7 text-rose-50/85">
              HCN provides educational, reflective, and social-learning support. External organizations may provide business advising or technical assistance. HCN does not provide legal, tax, financial, accounting, lending, or guaranteed funding advice through this page.
            </p>
          </div>
        </section>

        <section id="executive-inquiry" className="grid gap-5 lg:grid-cols-[0.62fr_0.38fr]">
          <form
            onSubmit={submitExecutiveInquiry}
            className="rounded-[2rem] border border-blue-300/20 bg-slate-950/75 p-5 shadow-2xl sm:p-8"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-200/70">
              Future Formal Pathway Intake
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">
              High Executive Contact And General Inquiry
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Use this form for executive introductions, institutional conversations, regional resource discussions, or general inquiries. Submissions route to the HCN admin console for review and do not create a confirmed partnership.
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Name</span>
                <input
                  type="text"
                  value={executiveInquiry.name}
                  onChange={(event) => updateExecutiveInquiryField('name', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Email</span>
                <input
                  type="email"
                  value={executiveInquiry.email}
                  onChange={(event) => updateExecutiveInquiryField('email', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Organization</span>
                <input
                  type="text"
                  value={executiveInquiry.organization}
                  onChange={(event) => updateExecutiveInquiryField('organization', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Role Or Title</span>
                <input
                  type="text"
                  value={executiveInquiry.role}
                  onChange={(event) => updateExecutiveInquiryField('role', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Inquiry Type</span>
                <select
                  value={executiveInquiry.inquiryType}
                  onChange={(event) => updateExecutiveInquiryField('inquiryType', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-all focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                >
                  {executiveInquiryTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Region</span>
                <input
                  type="text"
                  value={executiveInquiry.region}
                  onChange={(event) => updateExecutiveInquiryField('region', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                  placeholder="City, state, region, or national"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Inquiry</span>
              <textarea
                value={executiveInquiry.message}
                onChange={(event) => updateExecutiveInquiryField('message', event.target.value)}
                rows={5}
                minLength={10}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/20"
                placeholder="Share the executive contact, general inquiry, or potential future pathway context..."
                required
              />
            </label>

            {executiveInquiryStatus && (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                {executiveInquiryStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={isExecutiveInquirySubmitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-400 disabled:opacity-60"
            >
              {isExecutiveInquirySubmitting ? 'Submitting...' : 'Submit Executive Inquiry'}
            </button>
          </form>

          <aside className="rounded-[2rem] border border-teal-300/20 bg-teal-300/[0.06] p-6 sm:p-8">
            <CalendarDays className="mb-5 h-8 w-8 text-teal-100" />
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-teal-100/75">Immediate Option</p>
            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">Schedule Building Connections</h2>
            <p className="mt-4 text-sm leading-7 text-teal-50/80">
              For time-sensitive executive conversations or exploratory alignment, use the scheduling link while the intake record still remains available through the form.
            </p>
            <a
              href={calendlyBuildingConnectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-100/20 bg-teal-300/15 px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-teal-300/25"
            >
              Open Calendly <ArrowUpRight className="h-4 w-4" />
            </a>
            <p className="mt-5 text-xs leading-5 text-teal-50/60">
              Scheduling a call does not create a formal partnership, advisory relationship, funding relationship, or guaranteed platform outcome.
            </p>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default EntrepreneurshipSupportPage;
