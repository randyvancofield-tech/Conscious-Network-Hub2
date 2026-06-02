import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  FileText,
  Landmark,
  LockKeyhole,
  MapPin,
  Network,
  Scale,
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
type PortalMode = 'overview' | 'assessment';

interface ResourceLane {
  id: RegionOption;
  label: string;
  resource: string;
  url: string;
  focus: string;
  cta: string;
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

const imagery = {
  hero: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80',
  founder: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=1200&q=80',
};

const resourceLanes: ResourceLane[] = [
  {
    id: 'San Diego / Imperial',
    label: 'San Diego / Imperial',
    resource: 'San Diego & Imperial SBDC',
    url: 'https://sdivsbdc.org/',
    focus: 'Regional small business advising and training through the organization\'s own independent intake and programs.',
    cta: 'Open San Diego & Imperial SBDC',
    icon: <MapPin className="h-5 w-5" />,
  },
  {
    id: 'Greater New Orleans / Louisiana',
    label: 'Greater New Orleans / Louisiana',
    resource: 'Louisiana SBDC at Xavier University',
    url: 'https://www.louisianasbdc.org/lsbdc-greater-new-orleans-region',
    focus: 'Regional entrepreneurship support for Greater New Orleans through independently operated SBDC services.',
    cta: 'Open Louisiana SBDC',
    icon: <Landmark className="h-5 w-5" />,
  },
  {
    id: 'Other',
    label: 'Other Regions',
    resource: 'SBDCNet Local SBDC Finder',
    url: 'https://www.sbdcnet.org/find-your-local-sbdc-office/',
    focus: 'A national finder for locating a local SBDC when a member is outside the initial regional lanes.',
    cta: 'Find A Local SBDC',
    icon: <Network className="h-5 w-5" />,
  },
];

const narrativeFields: Array<{ field: 'goal' | 'barrier' | 'readiness'; label: string }> = [
  { field: 'goal', label: 'Primary business or career goal' },
  { field: 'barrier', label: 'Current barrier or missing structure' },
  { field: 'readiness', label: 'What would make you ready for outside support?' },
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

const getResourceForRegion = (region: RegionOption | ''): ResourceLane =>
  resourceLanes.find((lane) => lane.id === region) || resourceLanes[2];

const hasAdvisoryCaution = (needs: SupportNeed[]): boolean =>
  needs.includes('Legal/entity formation') || needs.includes('Financial management');

const EntrepreneurshipSupportPage: React.FC<EntrepreneurshipSupportPageProps> = ({
  user,
  onBack,
  onSignInPrompt,
}) => {
  const [portalMode, setPortalMode] = useState<PortalMode>('overview');
  const [showInquiryForm, setShowInquiryForm] = useState(false);
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
      ? 'Start with CNH discernment and identity alignment before requesting technical business support.'
      : assessment.stage === 'I am preparing for funding or capital readiness' || needsFundingSupport
        ? 'Prepare a clear business story, use-of-funds outline, readiness notes, and next-step questions before meeting an advisor.'
        : 'Complete the readiness reflection, identify one practical next action, then connect with the most relevant support lane.';

    const nextAction = needsAlignmentPreparation
      ? 'Complete a preparation pass, then open the recommended external resource when the business direction is clearer.'
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

  const openAssessment = () => {
    setPortalMode('assessment');
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const showExecutiveInquiry = () => {
    setShowInquiryForm(true);
    window.setTimeout(() => {
      document.getElementById('executive-inquiry')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

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

  const updateExecutiveInquiryField = <K extends keyof ExecutiveInquiryState>(
    field: K,
    value: ExecutiveInquiryState[K]
  ) => {
    setExecutiveInquiry((current) => ({ ...current, [field]: value }));
    setExecutiveInquiryStatus('');
  };

  const completeAssessment = () => {
    if (!user) {
      setAssessmentStatus('Current CNH members must sign in to generate a personalized entrepreneurship pathway.');
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

  if (portalMode === 'assessment') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 px-4 pb-14 pt-20 text-slate-100 sm:px-6 sm:pt-24 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setPortalMode('overview')}
              className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Portal
            </button>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <img src={careersLogo} alt="Conscious Careers" className="h-7 w-7 rounded-full bg-white object-contain" />
              <span className="text-xs font-black uppercase tracking-[0.16em] text-teal-100">Member Readiness Pathway</span>
            </div>
          </div>

          {!user ? (
            <section className="grid min-h-[68dvh] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] lg:grid-cols-[0.56fr_0.44fr]">
              <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
                <LockKeyhole className="mb-6 h-10 w-10 text-amber-200" />
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/80">Sign In Required</p>
                <h1 className="mt-4 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl">
                  The readiness pathway is for CNH members.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                  Guests can read the portal and open public resource links. Current Conscious Network Hub members sign in to generate a personalized readiness pathway for this session.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={onSignInPrompt}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
                  >
                    Sign In As Member <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalMode('overview')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    Return To Overview
                  </button>
                </div>
              </div>
              <div
                className="min-h-80 bg-cover bg-center"
                style={{ backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.76)), url(${imagery.founder})` }}
                aria-label="Professional preparing business planning materials"
              />
            </section>
          ) : (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.64fr)_minmax(340px,0.36fr)]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-8">
                <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Private Member Tool</p>
                    <h1 className="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
                      Readiness Pathway
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-slate-400">
                      Signed in as {user.email || user.name}. Responses are used only in this browser session and are not saved to the backend.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:min-w-64">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-teal-300 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="mt-3 text-right text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      {progressPercent}% complete
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-300">Choose your current stage</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {stageOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateField('stage', option)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50 ${
                            assessment.stage === option
                              ? 'border-teal-300/50 bg-teal-300/[0.14] text-teal-50'
                              : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-300">Select your support needs</p>
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
                                ? 'border-blue-300/50 bg-blue-300/[0.14] text-blue-50'
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
                      <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-300">Region</p>
                      <div className="space-y-2">
                        {regionOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => updateField('region', option)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 ${
                              assessment.region === option
                                ? 'border-emerald-300/50 bg-emerald-300/[0.14] text-emerald-50'
                                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-300">Alignment</p>
                      <div className="grid grid-cols-2 gap-2">
                        {alignmentOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => updateField('alignment', option)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 ${
                              assessment.alignment === option
                                ? 'border-violet-300/50 bg-violet-300/[0.14] text-violet-50'
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
                        <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
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
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
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
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/40"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Recommendation</p>
                  {hasSubmitted ? (
                    <div className="mt-5 space-y-4">
                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Readiness Summary</p>
                        <p className="mt-2 text-sm leading-6 text-white">{recommendation.readinessSummary}</p>
                      </section>
                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">CNH Preparation Step</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.cnhStep}</p>
                      </section>
                      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">External Resource</p>
                        <p className="mt-2 text-sm font-black text-white">{recommendation.resource.resource}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.nextAction}</p>
                        <a
                          href={recommendation.resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/[0.15] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
                        >
                          Open Resource <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </section>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-black/20 p-5 text-sm leading-7 text-slate-400">
                      Complete the required selections to generate a session-only pathway.
                    </div>
                  )}
                </div>

                {(needsAlignmentPreparation || needsFundingSupport || needsProfessionalAdvisoryBoundary) && (
                  <div className="rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-white">Boundary Notes</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-amber-50/85">
                      {needsAlignmentPreparation && (
                        <p>CNH preparation is recommended first because alignment is uncertain.</p>
                      )}
                      {needsFundingSupport && (
                        <p>External resources may help users explore business readiness. CNH does not guarantee funding, lending access, or eligibility.</p>
                      )}
                      {needsProfessionalAdvisoryBoundary && (
                        <p>CNH does not provide legal, tax, accounting, lending, or financial advice. Qualified professionals may be needed.</p>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#07110f] px-4 pb-16 pt-20 text-slate-100 sm:px-6 sm:pt-24 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Conscious Careers
        </button>

        <section className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/35 lg:grid-cols-[0.52fr_0.48fr]">
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-xl">
                <img src={careersLogo} alt="Conscious Careers" className="h-full w-full rounded-xl object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Conscious Careers</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">Entrepreneurship Support</p>
              </div>
            </div>

            <h1 className="mt-4 max-w-3xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              For members who want to build, stabilize, or grow professionally that can serve livelihood, family and community without moving alone.
            </h1>

            <div className="mt-8 grid gap-3 sm:max-w-sm">
              <button
                type="button"
                onClick={openAssessment}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100"
              >
                Start Readiness Pathway <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-500">
              Readiness is for signed-in CNH members. Guests can review the portal and open public resource gateways.
            </p>
          </div>

          <div className="relative min-h-80 overflow-hidden bg-slate-900 lg:min-h-[360px]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.05), rgba(2,6,23,0.82)), url(${imagery.hero})` }}
              aria-label="Entrepreneurs and advisors in a professional planning conversation"
            />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.48fr_0.52fr]">
          <div
            className="min-h-80 overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(7,17,15,0.2), rgba(7,17,15,0.72)), url(${imagery.founder})` }}
            aria-label="Professional entrepreneur working with strategic materials"
          />
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/80">Conscious Message</p>
            <p className="mt-4 text-base leading-8 text-slate-200 sm:text-lg">
              True professional growth starts from within. Conscious Careers connects emerging leaders and entrepreneurs with the tools to transcend traditional career limits. We help you move past the friction of self-doubt and ego into a space of authentic authority. Step into full alignment, build your business, and drive the future of conscious leadership.
            </p>
          </div>
        </section>

        <section id="resource-gateways" className="scroll-mt-28 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Resource Gateways</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">Public Entrepreneurship Resources</h2>
            </div>
            <p className="max-w-lg text-sm leading-7 text-slate-400">
              These links open external organizations. They are not partnership claims, eligibility guarantees, or professional advice relationships.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {resourceLanes.map((lane) => (
              <article key={lane.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-teal-200/30">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/10 text-teal-100">
                  {lane.icon}
                </div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{lane.label}</p>
                <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-white">{lane.resource}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{lane.focus}</p>
                <a
                  href={lane.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                >
                  {lane.cta} <ArrowUpRight className="h-4 w-4" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-rose-300/20 bg-rose-300/[0.05] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-7 w-7 text-rose-100" />
              <Scale className="h-7 w-7 text-rose-100" />
            </div>
            <h2 className="mt-5 text-xl font-black uppercase tracking-tight text-white">Compliance Boundary</h2>
            <p className="mt-4 text-sm leading-7 text-rose-50/85">
              CNH provides educational, reflective, and social-learning support. External organizations may provide business advising or technical assistance. CNH does not provide legal, tax, financial, accounting, lending, or guaranteed funding advice through this page.
            </p>
        </section>

        <section id="executive-inquiry" className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Contact And Scheduling</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">Executive Contact</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Use the form for executive introductions, institutional conversations, or regional resource discussions. For time-sensitive alignment, scheduling is available.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowInquiryForm((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100"
              >
                {showInquiryForm ? 'Close Form' : 'Open Inquiry Form'}
              </button>
              <a
                href={calendlyBuildingConnectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Schedule <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {showInquiryForm && (
            <form onSubmit={submitExecutiveInquiry} className="mt-8 border-t border-white/10 pt-8">
              <div className="mb-6 flex items-center gap-3">
                <FileText className="h-6 w-6 text-teal-100" />
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white">General Inquiry Form</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Name</span>
                  <input
                    type="text"
                    value={executiveInquiry.name}
                    onChange={(event) => updateExecutiveInquiryField('name', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Email</span>
                  <input
                    type="email"
                    value={executiveInquiry.email}
                    onChange={(event) => updateExecutiveInquiryField('email', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Organization</span>
                  <input
                    type="text"
                    value={executiveInquiry.organization}
                    onChange={(event) => updateExecutiveInquiryField('organization', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Role Or Title</span>
                  <input
                    type="text"
                    value={executiveInquiry.role}
                    onChange={(event) => updateExecutiveInquiryField('role', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Inquiry Type</span>
                  <select
                    value={executiveInquiry.inquiryType}
                    onChange={(event) => updateExecutiveInquiryField('inquiryType', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-all focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                  >
                    {executiveInquiryTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Region</span>
                  <input
                    type="text"
                    value={executiveInquiry.region}
                    onChange={(event) => updateExecutiveInquiryField('region', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                    placeholder="City, state, region, or national"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-slate-300">Inquiry</span>
                <textarea
                  value={executiveInquiry.message}
                  onChange={(event) => updateExecutiveInquiryField('message', event.target.value)}
                  rows={5}
                  minLength={10}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
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
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100 disabled:opacity-60"
              >
                {isExecutiveInquirySubmitting ? 'Submitting...' : 'Submit Executive Inquiry'}
              </button>
            </form>
          )}

          <p className="mt-5 text-sm leading-6 text-slate-500">
            Inquiry and scheduling do not create a formal partnership, advisory relationship, funding relationship, or guaranteed platform outcome.
          </p>
        </section>
      </div>
    </div>
  );
};

export default EntrepreneurshipSupportPage;
