import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CalendarClock,
  Download,
  Landmark,
  LockKeyhole,
  MapPin,
  Network,
  Route,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types';
import careersLogo from '../src/assets/brand/conscious-careers-logo.png';
import foundationGatewayGuide from '../src/assets/brand/foundation-gateway-guide.jpg';

interface EntrepreneurshipSupportPageProps {
  user: UserProfile | null;
  onBack: () => void;
  onMembershipAccess: () => void;
  onGrantApplication: () => void;
  onReturnToPortal: () => void;
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
type PortalMode = 'overview' | 'assessment' | 'plan';

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

type ConsciousPlanField =
  | 'lifeSeason'
  | 'trustedStrengths'
  | 'growthPattern'
  | 'professionalLane'
  | 'professionalOutcome'
  | 'supportGap'
  | 'educationNeed'
  | 'learningStyle'
  | 'completionBarrier'
  | 'businessProblem'
  | 'servedAudience'
  | 'firstOffer'
  | 'neededResource';

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
const calendlyBuildingConnectionsUrl = 'https://calendly.com/randycofield/buildingconnections';
const grantApplicationPath = '/conscious-careers/grant-application';
const foundationRedirectDelaySeconds = 15;
const foundationRedirectMessage =
  'To build a foundation, we must first become conscious of what we consume. We direct everyone beginning their journey to the Conscious Network Hub because true alignment starts with absolute autonomy over the content you ingest. Think of this Hub as a space to clear the mind, body, and soul. Immersing your mind in high-vibrational content expands your vision. By intentionally shifting what you take in, you naturally elevate your emotional state, which refines your actions, and ultimately aligns your awareness far above the ego. The Hub is where your clarity begins.';

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

const consciousPlanSections: Array<{
  title: string;
  eyebrow: string;
  questions: Array<{ field: ConsciousPlanField; label: string }>;
}> = [
  {
    title: 'Personal Foundation',
    eyebrow: 'Self-awareness',
    questions: [
      { field: 'lifeSeason', label: 'What season of life, work, or leadership are you currently navigating?' },
      { field: 'trustedStrengths', label: 'What strengths do you most trust in yourself right now?' },
      { field: 'growthPattern', label: 'What pattern, fear, or habit most often interrupts your progress?' },
    ],
  },
  {
    title: 'Professional Direction',
    eyebrow: 'Career clarity',
    questions: [
      { field: 'professionalLane', label: 'What professional lane, craft, role, or leadership path do you want to strengthen?' },
      { field: 'professionalOutcome', label: 'What professional outcome matters most in the next 12 months?' },
      { field: 'supportGap', label: 'What support, accountability, or structure is missing?' },
    ],
  },
  {
    title: 'Educational Growth',
    eyebrow: 'Learning readiness',
    questions: [
      { field: 'educationNeed', label: 'What knowledge, credential, or skill would increase your readiness?' },
      { field: 'learningStyle', label: 'How do you learn best when pressure is high?' },
      { field: 'completionBarrier', label: 'What has prevented you from completing learning goals in the past?' },
    ],
  },
  {
    title: 'Business Development',
    eyebrow: 'Opportunity design',
    questions: [
      { field: 'businessProblem', label: 'What problem could your work or business help solve?' },
      { field: 'servedAudience', label: 'Who would be served by this idea, offer, or business?' },
      { field: 'firstOffer', label: 'What could your first practical offer, service, or pilot look like?' },
      { field: 'neededResource', label: 'What resource, relationship, or decision would make the next step possible?' },
    ],
  },
];

const emotionalIntelligenceQuestions = [
  'I can name what I am feeling before reacting under pressure.',
  'I can receive feedback without immediately defending myself.',
  'I notice when ego, fear, or comparison begins shaping a decision.',
  'I can pause before responding when a professional conversation becomes tense.',
  'I understand how my emotional state affects my leadership and communication.',
  'I can stay accountable without collapsing into shame.',
  'I can recognize when another person needs clarity, empathy, or boundaries.',
  'I can communicate a hard truth without losing respect for the other person.',
  'I can separate temporary discomfort from long-term misalignment.',
  'I can ask for help before frustration becomes withdrawal or control.',
  'I can make decisions from values instead of impulse.',
  'I can repair professional conflict when repair is appropriate.',
  'I can hold ambition without becoming disconnected from purpose.',
  'I can identify environments that strengthen or weaken my emotional clarity.',
  'I can lead myself consistently when no one is watching.',
];

const initialPlanFields: Record<ConsciousPlanField, string> = {
  lifeSeason: '',
  trustedStrengths: '',
  growthPattern: '',
  professionalLane: '',
  professionalOutcome: '',
  supportGap: '',
  educationNeed: '',
  learningStyle: '',
  completionBarrier: '',
  businessProblem: '',
  servedAudience: '',
  firstOffer: '',
  neededResource: '',
};

const consciousPlanExecutiveNote =
  'This Conscious Plan is a professional readiness brief. Bring it into your Conscious Network Hub guidance session, founder conversation, or external resource meeting as a concise record of your current clarity, emotional readiness, leadership questions, and next development priorities. It is designed to help you enter support conversations prepared, accountable, and aligned.';

const getResourceForRegion = (region: RegionOption | ''): ResourceLane =>
  resourceLanes.find((lane) => lane.id === region) || resourceLanes[2];

const hasAdvisoryCaution = (needs: SupportNeed[]): boolean =>
  needs.includes('Legal/entity formation') || needs.includes('Financial management');

const EntrepreneurshipSupportPage: React.FC<EntrepreneurshipSupportPageProps> = ({
  user,
  onBack,
  onMembershipAccess,
  onGrantApplication,
  onReturnToPortal,
}) => {
  const [portalMode, setPortalMode] = useState<PortalMode>('overview');
  const [assessment, setAssessment] = useState<AssessmentState>(initialAssessment);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [assessmentStatus, setAssessmentStatus] = useState('');
  const [planFields, setPlanFields] = useState<Record<ConsciousPlanField, string>>(initialPlanFields);
  const [emotionalIntelligenceAnswers, setEmotionalIntelligenceAnswers] = useState<Record<number, number>>({});
  const [planScoreRevealed, setPlanScoreRevealed] = useState(false);
  const [planStatus, setPlanStatus] = useState('');
  const [isFoundationRedirectOpen, setFoundationRedirectOpen] = useState(false);
  const [foundationRedirectSeconds, setFoundationRedirectSeconds] = useState(foundationRedirectDelaySeconds);
  const foundationAudioCleanupRef = useRef<(() => void) | null>(null);
  const foundationIntervalRef = useRef<number | null>(null);
  const foundationRedirectedRef = useRef(false);

  const stopFoundationAudio = () => {
    foundationAudioCleanupRef.current?.();
    foundationAudioCleanupRef.current = null;
  };

  const startFoundationAudio = () => {
    if (typeof window === 'undefined') return;
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const context = new AudioContextConstructor();
      const master = context.createGain();
      master.gain.setValueAtTime(0.0001, context.currentTime);
      master.gain.exponentialRampToValueAtTime(0.04, context.currentTime + 1.2);
      master.connect(context.destination);

      const oscillators = [216, 432, 528].map((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = index === 2 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        gain.gain.setValueAtTime(index === 2 ? 0.018 : 0.012, context.currentTime);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start();
        return oscillator;
      });

      const pulseTimer = window.setInterval(() => {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.01), now);
        master.gain.linearRampToValueAtTime(0.055, now + 0.4);
        master.gain.linearRampToValueAtTime(0.03, now + 1.4);
      }, 2400);

      foundationAudioCleanupRef.current = () => {
        window.clearInterval(pulseTimer);
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.001), now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        window.setTimeout(() => {
          oscillators.forEach((oscillator) => oscillator.stop());
          context.close().catch(() => undefined);
        }, 650);
      };
    } catch {
      foundationAudioCleanupRef.current = null;
    }
  };

  const completeFoundationRedirect = () => {
    if (foundationRedirectedRef.current) return;
    foundationRedirectedRef.current = true;
    if (foundationIntervalRef.current !== null) {
      window.clearInterval(foundationIntervalRef.current);
      foundationIntervalRef.current = null;
    }
    stopFoundationAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onMembershipAccess();
  };

  const beginFoundationRedirect = () => {
    foundationRedirectedRef.current = false;
    setFoundationRedirectSeconds(foundationRedirectDelaySeconds);
    setFoundationRedirectOpen(true);
    stopFoundationAudio();
    startFoundationAudio();

    let timerComplete = false;
    let narrationComplete = false;
    const maybeRedirect = () => {
      if (timerComplete && narrationComplete) {
        completeFoundationRedirect();
      }
    };

    if (foundationIntervalRef.current !== null) {
      window.clearInterval(foundationIntervalRef.current);
      foundationIntervalRef.current = null;
    }

    const intervalId = window.setInterval(() => {
      setFoundationRedirectSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(intervalId);
          foundationIntervalRef.current = null;
          timerComplete = true;
          maybeRedirect();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    foundationIntervalRef.current = intervalId;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(foundationRedirectMessage);
        utterance.rate = 1.35;
        utterance.pitch = 1.03;
        utterance.volume = 0.92;
        utterance.onend = () => {
          narrationComplete = true;
          maybeRedirect();
        };
        utterance.onerror = () => {
          narrationComplete = true;
          maybeRedirect();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        narrationComplete = true;
        maybeRedirect();
      }
    } else {
      narrationComplete = true;
      maybeRedirect();
    }
  };

  useEffect(() => {
    return () => {
      if (foundationIntervalRef.current !== null) {
        window.clearInterval(foundationIntervalRef.current);
        foundationIntervalRef.current = null;
      }
      stopFoundationAudio();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

  const emotionalIntelligenceTotal = emotionalIntelligenceQuestions.reduce(
    (total, _question, index) => total + (emotionalIntelligenceAnswers[index] || 0),
    0
  );
  const emotionalIntelligenceMax = emotionalIntelligenceQuestions.length * 5;
  const emotionalIntelligencePercent = Math.round((emotionalIntelligenceTotal / emotionalIntelligenceMax) * 100);
  const emotionalIntelligenceComplete = emotionalIntelligenceQuestions.every(
    (_question, index) => Boolean(emotionalIntelligenceAnswers[index])
  );
  const emotionalIntelligenceLevel =
    emotionalIntelligencePercent >= 85
      ? 'Integrated emotional leadership'
      : emotionalIntelligencePercent >= 70
        ? 'Strong developing awareness'
        : emotionalIntelligencePercent >= 55
          ? 'Active growth opportunity'
          : 'Foundation-building recommended';

  const openAssessment = () => {
    setPortalMode('assessment');
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const openPlan = () => {
    setPortalMode('plan');
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
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

  const updatePlanField = (field: ConsciousPlanField, value: string) => {
    setPlanFields((current) => ({ ...current, [field]: value }));
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

  const calculatePlanScore = () => {
    if (!emotionalIntelligenceComplete) {
      setPlanStatus('Complete all emotional intelligence questions to calculate your score.');
      setPlanScoreRevealed(false);
      return;
    }
    setPlanStatus('');
    setPlanScoreRevealed(true);
  };

  const escapeReportHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const downloadConsciousPlan = () => {
    const generatedAt = new Date();
    const planResponses = consciousPlanSections
      .map((section) => `
        <section>
          <p class="eyebrow">${escapeReportHtml(section.eyebrow)}</p>
          <h2>${escapeReportHtml(section.title)}</h2>
          ${section.questions.map((question) => `
            <div class="answer">
              <h3>${escapeReportHtml(question.label)}</h3>
              <p>${escapeReportHtml(planFields[question.field].trim() || 'Not provided')}</p>
            </div>
          `).join('')}
        </section>
      `)
      .join('');

    const emotionalIntelligenceRows = emotionalIntelligenceQuestions
      .map((question, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeReportHtml(question)}</td>
          <td>${emotionalIntelligenceAnswers[index] || '-'}</td>
        </tr>
      `)
      .join('');

    const reportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conscious Plan Readiness Brief</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
    main { max-width: 920px; margin: 0 auto; padding: 48px 24px; }
    header, section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; margin-bottom: 18px; padding: 26px; }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; letter-spacing: 0.01em; }
    h2 { margin: 6px 0 18px; font-size: 22px; }
    h3 { margin: 0 0 6px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: 0.06em; }
    p { margin: 0; }
    .eyebrow { margin-bottom: 8px; color: #0f766e; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; }
    .note { background: #ecfeff; border-color: #99f6e4; }
    .score { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric { background: #f1f5f9; border-radius: 14px; padding: 16px; }
    .metric strong { display: block; font-size: 26px; }
    .answer { border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
    th { color: #334155; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    footer { color: #64748b; font-size: 12px; padding: 8px 2px; }
    @media print { body { background: white; } main { padding: 0; } header, section { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Conscious Careers</p>
      <h1>Conscious Plan Readiness Brief</h1>
      <p>Prepared ${escapeReportHtml(generatedAt.toLocaleString())}${user?.email ? ` for ${escapeReportHtml(user.email)}` : ''}.</p>
    </header>
    <section class="note">
      <p class="eyebrow">Executive Guidance</p>
      <p>${escapeReportHtml(consciousPlanExecutiveNote)}</p>
    </section>
    <section>
      <p class="eyebrow">Emotional Intelligence Score</p>
      <div class="score">
        <div class="metric"><span>Score</span><strong>${emotionalIntelligencePercent}%</strong></div>
        <div class="metric"><span>Level</span><strong>${escapeReportHtml(emotionalIntelligenceLevel)}</strong></div>
        <div class="metric"><span>Raw</span><strong>${emotionalIntelligenceTotal}/${emotionalIntelligenceMax}</strong></div>
      </div>
    </section>
    ${planResponses}
    <section>
      <p class="eyebrow">Emotional Intelligence Responses</p>
      <table>
        <thead><tr><th>#</th><th>Statement</th><th>Score</th></tr></thead>
        <tbody>${emotionalIntelligenceRows}</tbody>
      </table>
    </section>
    <footer>
      This brief is educational and reflective. It is not medical, mental health, legal, financial, accounting, lending, or guaranteed business advice.
    </footer>
  </main>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `conscious-plan-${generatedAt.toISOString().slice(0, 10)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  if (portalMode === 'assessment') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 px-4 pb-14 pt-20 text-slate-100 sm:px-6 sm:pt-24 lg:px-10">
        {isFoundationRedirectOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#020706]/95 px-3 py-3 text-slate-100 backdrop-blur-2xl sm:px-5 sm:py-6">
            <style>{`
              @keyframes cnhGatewayPan {
                0% { transform: scale(1.04) translate3d(-1.2%, 0, 0); }
                50% { transform: scale(1.08) translate3d(1.4%, -0.8%, 0); }
                100% { transform: scale(1.05) translate3d(0.4%, 0.7%, 0); }
              }
              @keyframes cnhVoiceRise {
                0%, 100% { transform: scaleY(0.42); opacity: 0.55; }
                45% { transform: scaleY(1); opacity: 1; }
              }
              @keyframes cnhGuideFloat {
                0%, 100% { transform: translate3d(0, 0, 0); }
                50% { transform: translate3d(0, -10px, 0); }
              }
            `}</style>
            <div className="mx-auto flex min-h-full w-full max-w-6xl items-center">
              <div className="relative my-auto w-full overflow-hidden rounded-[1.5rem] border border-teal-200/20 bg-[#07110f] shadow-2xl shadow-teal-950/30 sm:rounded-[2rem]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(94,234,212,0.14),transparent_32%),radial-gradient(circle_at_86%_8%,rgba(251,191,36,0.12),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.4),rgba(6,78,59,0.12))]" />
                <div className="relative grid lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="relative min-h-[18rem] overflow-hidden border-b border-white/10 bg-black lg:min-h-[min(78dvh,42rem)] lg:border-b-0 lg:border-r">
                    <img
                      src={foundationGatewayGuide}
                      alt="Conscious guide standing beside an open doorway into light"
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      style={{ animation: 'cnhGatewayPan 16s ease-in-out infinite alternate' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/15" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07110f] to-transparent" />
                    <div
                      className="pointer-events-none absolute right-[13%] top-[37%] flex h-16 w-16 items-center justify-center rounded-full border border-teal-100/30 bg-teal-200/10 shadow-2xl shadow-teal-300/20 backdrop-blur-md sm:h-20 sm:w-20"
                      style={{ animation: 'cnhGuideFloat 4.5s ease-in-out infinite' }}
                      aria-hidden="true"
                    >
                      <div className="flex h-9 items-center gap-1.5">
                        {[0, 1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            className="h-8 w-1.5 origin-bottom rounded-full bg-teal-100"
                            style={{ animation: `cnhVoiceRise ${0.72 + bar * 0.08}s ease-in-out ${bar * 0.08}s infinite` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="absolute left-4 top-4 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl sm:left-6 sm:top-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-teal-100/80">Guided Entry</p>
                      <p className="mt-1 text-xs font-semibold text-white">Voice and movement active when your browser permits it.</p>
                    </div>
                  </div>
                  <div className="relative flex flex-col justify-center p-5 sm:p-7 lg:p-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Foundation Redirect</p>
                        <h2 className="mt-3 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                          Your clarity begins inside the Hub.
                        </h2>
                      </div>
                      <div className="w-fit rounded-2xl border border-teal-200/20 bg-teal-300/10 px-4 py-3 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-100/70">Minimum Pause</p>
                        <p className="mt-1 text-2xl font-black text-white">
                          {foundationRedirectSeconds > 0 ? `${foundationRedirectSeconds}s` : 'Listening'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-6 text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">
                      {foundationRedirectMessage}
                    </p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {['Listen', 'Breathe', 'Enter The Hub'].map((label, index) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">0{index + 1}</p>
                          <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-white">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl border border-amber-100/15 bg-amber-100/[0.07] p-4">
                      <p className="text-xs leading-6 text-amber-50/80">
                        Redirect begins after the voice guidance completes. If a device blocks speech or ambient audio, the visual transition continues and routes safely to Membership Access.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
                    onClick={beginFoundationRedirect}
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

  if (portalMode === 'plan') {
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
              Back To Entrepreneurship Support
            </button>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <img src={careersLogo} alt="Conscious Careers" className="h-7 w-7 rounded-full bg-white object-contain" />
              <span className="text-xs font-black uppercase tracking-[0.16em] text-teal-100">Conscious Plan</span>
            </div>
          </div>

          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]">
            <div className="grid gap-0 lg:grid-cols-[0.58fr_0.42fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Step 2</p>
                <h1 className="mt-4 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                  Create Conscious Plan
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                  Answer personal, professional, educational, and business-development questions, then complete the emotional intelligence check before choosing your next step.
                </p>
              </div>
              <div
                className="min-h-72 bg-cover bg-center"
                style={{ backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.05), rgba(2,6,23,0.82)), url(${imagery.founder})` }}
                aria-label="Professional planning and leadership development workspace"
              />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.66fr)_minmax(320px,0.34fr)]">
            <div className="space-y-5">
              {consciousPlanSections.map((section) => (
                <section key={section.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200/80">{section.eyebrow}</p>
                  <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-white">{section.title}</h2>
                  <div className="mt-5 grid gap-4">
                    {section.questions.map((question) => (
                      <label key={question.field} className="block">
                        <span className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-slate-300">
                          {question.label}
                        </span>
                        <textarea
                          value={planFields[question.field]}
                          onChange={(event) => updatePlanField(question.field, event.target.value)}
                          rows={3}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/20"
                          placeholder="Write a grounded response..."
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}

              <section className="rounded-[1.5rem] border border-teal-300/20 bg-teal-300/[0.05] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <Brain className="mt-1 h-6 w-6 shrink-0 text-teal-100" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100/80">Emotional Intelligence Check</p>
                    <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-white">
                      Score Before Moving Forward
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-teal-50/75">
                      Rate each statement from 1 to 5. This is a reflective readiness score, not a diagnosis or clinical assessment.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {emotionalIntelligenceQuestions.map((question, index) => (
                    <fieldset key={question} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <legend className="mb-3 text-sm font-semibold leading-6 text-white">
                        {index + 1}. {question}
                      </legend>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setEmotionalIntelligenceAnswers((current) => ({ ...current, [index]: value }));
                              setPlanScoreRevealed(false);
                            }}
                            className={`rounded-xl border px-3 py-3 text-sm font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 ${
                              emotionalIntelligenceAnswers[index] === value
                                ? 'border-teal-200 bg-teal-300 text-slate-950'
                                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                            }`}
                            aria-label={`${question}: ${value}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>
            </div>

            <aside className="h-fit rounded-[1.5rem] border border-white/10 bg-slate-950/85 p-5 shadow-2xl shadow-black/30 sm:p-6 xl:sticky xl:top-24">
              <div className="flex items-center gap-3">
                <Route className="h-6 w-6 text-teal-100" />
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100/80">Plan Score</p>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-bold text-slate-300">Emotional intelligence completion</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-teal-300 transition-all duration-500"
                    style={{ width: `${(Object.keys(emotionalIntelligenceAnswers).length / emotionalIntelligenceQuestions.length) * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {Object.keys(emotionalIntelligenceAnswers).length} of {emotionalIntelligenceQuestions.length} answered
                </p>
              </div>

              {planStatus && (
                <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-50">
                  {planStatus}
                </p>
              )}

              <button
                type="button"
                onClick={calculatePlanScore}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition-colors hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100"
              >
                Calculate Score <Sparkles className="h-4 w-4" />
              </button>

              {planScoreRevealed && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-teal-300/25 bg-teal-300/[0.08] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100/80">Your Score</p>
                    <p className="mt-2 text-4xl font-black text-white">{emotionalIntelligencePercent}%</p>
                    <p className="mt-2 text-sm font-bold text-teal-50">{emotionalIntelligenceLevel}</p>
                    <p className="mt-3 text-sm leading-6 text-teal-50/75">
                      Score: {emotionalIntelligenceTotal} of {emotionalIntelligenceMax}. Use this as a reflection point before a guidance conversation.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Professional Use</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {consciousPlanExecutiveNote}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={downloadConsciousPlan}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200/30 bg-teal-300/[0.12] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-teal-50 transition-colors hover:bg-teal-300/[0.2] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                    >
                      Download Conscious Plan <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={user ? onReturnToPortal : onMembershipAccess}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      {user ? 'Return To CNH Portal' : 'Sign In To CNH Portal'}
                    </button>
                    <a
                      href={calendlyBuildingConnectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    >
                      Schedule Founder Guidance <CalendarClock className="h-4 w-4" />
                    </a>
                    <a
                      href={calendlyBuildingConnectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-950 transition-colors hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100"
                    >
                      Brainstorm With A Leader <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </aside>
          </section>
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

            <h1 className="mt-4 max-w-3xl text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
              For members who want to build, stabilize, or grow professionally that can serve livelihood, family and community without moving alone.
            </h1>
          </div>

          <div className="relative min-h-80 overflow-hidden bg-slate-900 lg:min-h-[360px]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.05), rgba(2,6,23,0.82)), url(${imagery.hero})` }}
              aria-label="Entrepreneurs and advisors in a professional planning conversation"
            />
          </div>

          <div className="border-t border-white/10 bg-white/[0.025] p-5 sm:p-6 lg:col-span-2">
            <div className="mx-auto grid max-w-6xl items-stretch gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:gap-4">
              <button
                type="button"
                onClick={openAssessment}
                className="group relative overflow-hidden rounded-2xl border border-teal-200/30 bg-teal-300 px-4 py-4 text-left shadow-[0_18px_45px_rgba(20,184,166,0.18)] transition duration-300 hover:-translate-y-1 hover:bg-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-100"
              >
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-800">Step 1</span>
                <span className="mt-2 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950">
                  Begin With Conscious Network Hub <ArrowRight className="h-4 w-4 shrink-0" />
                </span>
              </button>
              <div className="hidden items-center justify-center text-teal-100/70 xl:flex">
                <ArrowRight className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={openPlan}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-blue-200/40 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-blue-200">Step 2</span>
                <span className="mt-2 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-white">
                  Create Conscious Plan <ArrowRight className="h-4 w-4 shrink-0" />
                </span>
              </button>
              <div className="hidden items-center justify-center text-teal-100/70 xl:flex">
                <ArrowRight className="h-6 w-6" />
              </div>
              <a
                href={calendlyBuildingConnectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-amber-200/20 bg-amber-200/[0.08] px-4 py-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:bg-amber-200/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
              >
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-amber-100">Step 3</span>
                <span className="mt-2 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-white">
                  Brainstorm With A Leader <ArrowUpRight className="h-4 w-4 shrink-0" />
                </span>
              </a>
              <div className="hidden items-center justify-center text-teal-100/70 xl:flex">
                <ArrowRight className="h-6 w-6" />
              </div>
              <a
                href={grantApplicationPath}
                onClick={(event) => {
                  event.preventDefault();
                  onGrantApplication();
                }}
                className="group relative overflow-hidden rounded-2xl border border-blue-200/20 bg-blue-400/[0.09] px-4 py-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:bg-blue-300/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
              >
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-blue-100">Step 4</span>
                <span className="mt-2 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.12em] text-white">
                  Start Application <ArrowRight className="h-4 w-4 shrink-0" />
                </span>
                <span className="mt-3 block text-[11px] font-semibold leading-5 text-blue-100/75">
                  Grant applicants must be current Conscious Network Hub users.
                </span>
              </a>
            </div>
            <p className="mx-auto mt-4 max-w-5xl text-sm leading-6 text-slate-500">
              Step 1 is for signed-in CNH members. Step 2 calculates a page-based readiness score. Step 3 uses the active scheduling link. Step 4 opens the grant application for current CNH users.
            </p>
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
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">Public Entrepreneurship Resources:</h2>
            </div>
            <div className="max-w-3xl space-y-2 text-sm leading-7 text-slate-400">
              <p><span className="font-black text-slate-200">Disclaimer and Limitation of Liability:</span> The information, content, and materials available on this page are for educational, reflective, and social-learning purposes only.</p>
              <p><span className="font-black text-slate-200">No Professional Advice:</span> CNH does not provide legal, tax, financial, accounting, lending, or guaranteed funding advice.</p>
              <p><span className="font-black text-slate-200">Independent External Organizations:</span> Any business advising or technical assistance is provided solely by independent, external organizations.</p>
              <p><span className="font-black text-slate-200">No Endorsement or Guarantee:</span> Reference to these external entities does not constitute a partnership, endorsement, or guarantee of program eligibility.</p>
              <p><span className="font-black text-slate-200">User Responsibility:</span> Users should consult with qualified professionals for specific legal, tax, or financial guidance. CNH disclaims all liability for actions taken based on this page's content.</p>
            </div>
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

      </div>
    </div>
  );
};

export default EntrepreneurshipSupportPage;
