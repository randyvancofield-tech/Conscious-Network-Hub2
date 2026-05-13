import React, { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile } from '../types';

interface GrantApplicationPageProps {
  user: UserProfile | null;
  onBack: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

const MAX_GRANT_AMOUNT_USD = 12000;

const countryConfigs = [
  {
    country: 'United States',
    regionLabel: 'State',
    postalLabel: 'ZIP code',
    registrationLabel: 'EIN, LLC, nonprofit, or sole proprietor status if applicable',
  },
  {
    country: 'Canada',
    regionLabel: 'Province or territory',
    postalLabel: 'Postal code',
    registrationLabel: 'Business number, nonprofit, GST/HST, or sole proprietor status if applicable',
  },
  {
    country: 'United Kingdom',
    regionLabel: 'Nation or county',
    postalLabel: 'Postcode',
    registrationLabel: 'Companies House, charity number, UTR, or sole trader status if applicable',
  },
  {
    country: 'Nigeria',
    regionLabel: 'State',
    postalLabel: 'Postal code',
    registrationLabel: 'CAC, TIN, NGO, cooperative, or sole trader status if applicable',
  },
  {
    country: 'Ghana',
    regionLabel: 'Region',
    postalLabel: 'Postal code',
    registrationLabel: 'Registrar General, TIN, NGO, or sole proprietor status if applicable',
  },
  {
    country: 'South Africa',
    regionLabel: 'Province',
    postalLabel: 'Postal code',
    registrationLabel: 'CIPC, NPO, SARS, or sole proprietor status if applicable',
  },
  {
    country: 'Kenya',
    regionLabel: 'County',
    postalLabel: 'Postal code',
    registrationLabel: 'Business Registration Service, NGO, PIN, or sole proprietor status if applicable',
  },
  {
    country: 'India',
    regionLabel: 'State or union territory',
    postalLabel: 'PIN code',
    registrationLabel: 'Udyam, GSTIN, NGO, trust, or sole proprietor status if applicable',
  },
  {
    country: 'Australia',
    regionLabel: 'State or territory',
    postalLabel: 'Postcode',
    registrationLabel: 'ABN, ACN, charity, or sole trader status if applicable',
  },
  {
    country: 'Brazil',
    regionLabel: 'State',
    postalLabel: 'Postal code',
    registrationLabel: 'CNPJ, MEI, association, or sole entrepreneur status if applicable',
  },
  {
    country: 'Mexico',
    regionLabel: 'State',
    postalLabel: 'Postal code',
    registrationLabel: 'RFC, moral person, civil association, or sole entrepreneur status if applicable',
  },
  {
    country: 'Philippines',
    regionLabel: 'Province or region',
    postalLabel: 'ZIP code',
    registrationLabel: 'DTI, SEC, BIR, cooperative, or sole proprietor status if applicable',
  },
  {
    country: 'Other',
    regionLabel: 'Region, province, or state',
    postalLabel: 'Postal or local code',
    registrationLabel: 'Local business, nonprofit, faith, cooperative, or sole proprietor status if applicable',
  },
];

const applicantTypes = [
  'Individual founder',
  'Registered small business',
  'Faith-based initiative',
  'Nonprofit or community organization',
  'Cooperative or collective',
  'Student entrepreneur',
];

const ventureStages = [
  'Idea or planning',
  'Early launch',
  'Operating and growing',
  'Recovery or restart',
  'Community expansion',
];

const fundUses = [
  'Equipment or tools',
  'Training or certification',
  'Technology or software',
  'Inventory or supplies',
  'Marketing and outreach',
  'Workspace or operations',
  'Legal, registration, or compliance',
  'Mental wellness support',
  'Spiritual or community programming',
  'Education or curriculum',
];

const developmentFocuses = [
  'Economic development',
  'Mental wellness',
  'Spiritual formation',
  'Educational growth',
  'Family stability',
  'Community service',
  'Youth or intergenerational impact',
];

const grantSteps = ['Eligibility', 'Funding', 'Development', 'Stewardship'] as const;

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = 'text', placeholder, required = false }) => (
  <label className="block space-y-2">
    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-100/40 focus:ring-2 focus:ring-emerald-100/20"
    />
  </label>
);

const TextArea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, rows = 4, required = false }) => (
  <label className="block space-y-2">
    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="w-full min-w-0 resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-emerald-100/40 focus:ring-2 focus:ring-emerald-100/20"
    />
  </label>
);

const ToggleGrid: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}> = ({ options, selected, onToggle }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {options.map((option) => {
      const isSelected = selected.includes(option);
      return (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(option)}
          className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-xs font-bold uppercase tracking-wider transition ${
            isSelected
              ? 'border-emerald-200/40 bg-emerald-400/15 text-emerald-50'
              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          {option}
        </button>
      );
    })}
  </div>
);

const GrantApplicationPage: React.FC<GrantApplicationPageProps> = ({
  user,
  onBack,
  onSubmit,
}) => {
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState('United States');
  const [region, setRegion] = useState('');
  const [locality, setLocality] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [legalName, setLegalName] = useState('');
  const [applicantType, setApplicantType] = useState('');
  const [ventureStage, setVentureStage] = useState('');
  const [requestedAmountUsd, setRequestedAmountUsd] = useState(2500);
  const [fundingTimeline, setFundingTimeline] = useState('');
  const [useOfFundsCategories, setUseOfFundsCategories] = useState<string[]>([]);
  const [developmentFocus, setDevelopmentFocus] = useState<string[]>([]);
  const [answers, setAnswers] = useState({
    ventureSummary: '',
    useOfFundsNarrative: '',
    developmentFocus: '',
    impactPlan: '',
    cnhLearning: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const countryConfig = useMemo(
    () => countryConfigs.find((entry) => entry.country === country) || countryConfigs[countryConfigs.length - 1],
    [country]
  );

  const completedSteps = useMemo(
    () => [
      Boolean(country && applicantType && ventureStage && locality),
      Boolean(requestedAmountUsd > 0 && requestedAmountUsd <= MAX_GRANT_AMOUNT_USD && useOfFundsCategories.length && answers.useOfFundsNarrative.length >= 20),
      Boolean(developmentFocus.length && answers.ventureSummary.length >= 20 && answers.developmentFocus.length >= 20 && answers.impactPlan.length >= 20),
      Boolean(answers.cnhLearning.length >= 20),
    ],
    [applicantType, answers, country, developmentFocus.length, locality, requestedAmountUsd, useOfFundsCategories.length, ventureStage]
  );
  const completedStepCount = completedSteps.filter(Boolean).length;
  const completionProgress = Math.round((completedStepCount / grantSteps.length) * 100);

  const updateAnswer = (key: keyof typeof answers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleValue = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
  };

  const validateStep = (): string | null => {
    if (step === 0 && (!country || !applicantType || !ventureStage || !locality)) {
      return 'Country, city/locality, applicant type, and venture stage are required.';
    }
    if (step === 1) {
      if (!Number.isFinite(requestedAmountUsd) || requestedAmountUsd <= 0 || requestedAmountUsd > MAX_GRANT_AMOUNT_USD) {
        return 'Grant requests must be between $1 and $12,000.';
      }
      if (useOfFundsCategories.length === 0) return 'Select at least one intended use of funds.';
      if (answers.useOfFundsNarrative.length < 20) return 'Explain how the grant funds would be used.';
    }
    if (step === 2) {
      if (developmentFocus.length === 0) return 'Select at least one development focus.';
      if (
        answers.ventureSummary.length < 20 ||
        answers.developmentFocus.length < 20 ||
        answers.impactPlan.length < 20
      ) {
        return 'Please complete the venture, development, and impact responses.';
      }
    }
    if (step === 3) {
      if (answers.cnhLearning.length < 20) return 'Please complete the CNH learning and stewardship response.';
    }
    return null;
  };

  const goNext = () => {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, grantSteps.length - 1));
  };

  const submit = async () => {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        country,
        region,
        locality,
        postalCode,
        legalName,
        applicantType,
        ventureStage,
        requestedAmountUsd,
        fundingTimeline,
        useOfFundsCategories,
        answers: {
          ...answers,
          developmentFocus: `${developmentFocus.join(', ')}\n\n${answers.developmentFocus}`,
          faithValues: answers.cnhLearning,
          accountabilityPlan: answers.cnhLearning,
        },
      });
      setSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to submit grant application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#07120d] p-4 text-white sm:p-8">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-3xl items-center">
          <div className="glass-panel w-full rounded-3xl border border-emerald-200/20 bg-emerald-400/[0.05] p-6 text-center shadow-2xl sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-400/10 text-emerald-100">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-100/60">
              Grant Application Submitted
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Thank you for applying
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Your Conscious Careers grant application has been received for review. The team will evaluate alignment, stewardship, and development impact before any next step.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
            >
              Back to Conscious Careers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#07120d] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-100/60 transition-colors hover:text-white"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Conscious Careers
        </button>

        <div className="mb-8 space-y-5">
          <div className="glass-panel rounded-3xl border border-emerald-200/20 bg-emerald-400/[0.04] p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-400/10 text-emerald-100">
                  <BadgeDollarSign className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-100/60">
                  Higher Conscious Network dba Conscious Careers
                </p>
                <h1 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
                  Grant Application
                </h1>
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-300">
                Apply for faith-driven entrepreneurial support up to $12,000. Applicants must be current Conscious Network Hub users and describe what they have learned.
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Grant Application Update
                </p>
                <h2 className="mt-1 text-lg font-black uppercase tracking-tight text-white sm:text-xl">
                  Step {step + 1}: {grantSteps[step]}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  {completedStepCount} of {grantSteps.length} pages complete
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-3 text-emerald-100">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Connected CNH account: {user?.email || 'Signed in'}
                </span>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${completionProgress}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {grantSteps.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-black uppercase transition ${
                    index === step
                      ? 'bg-emerald-300 text-slate-950'
                      : completedSteps[index]
                        ? 'bg-emerald-400/15 text-emerald-100'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {completedSteps[index] && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl sm:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-100">
                <Globe2 className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Eligibility & Origin</h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                    Q1. Country of origin or residence
                  </span>
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-100/20"
                  >
                    {countryConfigs.map((entry) => (
                      <option key={entry.country} value={entry.country}>{entry.country}</option>
                    ))}
                  </select>
                </label>
                <Field label={`Q2. ${countryConfig.regionLabel}`} value={region} onChange={setRegion} />
                <Field label="Q2. City, town, or locality" value={locality} onChange={setLocality} required />
                <Field label={`Q2. ${countryConfig.postalLabel}`} value={postalCode} onChange={setPostalCode} />
                <Field label="Q2. Legal or business name" value={legalName} onChange={setLegalName} placeholder={countryConfig.registrationLabel} />
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                    Q3. Applicant type
                  </span>
                  <select
                    value={applicantType}
                    onChange={(event) => setApplicantType(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-100/20"
                  >
                    <option value="">Select applicant type</option>
                    {applicantTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                    Q4. Venture stage
                  </span>
                  <select
                    value={ventureStage}
                    onChange={(event) => setVentureStage(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-100/20"
                  >
                    <option value="">Select venture stage</option>
                    {ventureStages.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-100">
                <Landmark className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Funding Request</h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-3 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                    Q5. Requested grant amount, up to $12,000 USD
                  </span>
                  <input
                    type="range"
                    min="1"
                    max={MAX_GRANT_AMOUNT_USD}
                    step="100"
                    value={requestedAmountUsd}
                    onChange={(event) => setRequestedAmountUsd(Number(event.target.value))}
                    className="w-full accent-emerald-300"
                  />
                  <input
                    type="number"
                    min="1"
                    max={MAX_GRANT_AMOUNT_USD}
                    value={requestedAmountUsd}
                    onChange={(event) => setRequestedAmountUsd(Math.min(MAX_GRANT_AMOUNT_USD, Math.max(0, Number(event.target.value))))}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-100/40 focus:ring-2 focus:ring-emerald-100/20"
                  />
                </label>
                <Field label="Q5. Funding timeline" value={fundingTimeline} onChange={setFundingTimeline} placeholder="Example: 90 days, 6 months, 12 months" />
                <div className="md:col-span-2 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                    Q6. Intended use of funds
                  </p>
                  <ToggleGrid
                    options={fundUses}
                    selected={useOfFundsCategories}
                    onToggle={(value) => toggleValue(value, useOfFundsCategories, setUseOfFundsCategories)}
                  />
                </div>
                <div className="md:col-span-2">
                  <TextArea
                    label="Q7. Explain exactly what you would use the grant for"
                    value={answers.useOfFundsNarrative}
                    onChange={(value) => updateAnswer('useOfFundsNarrative', value)}
                    rows={5}
                    required
                    placeholder="Include costs, purchase priorities, timing, and why this amount is appropriate."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-100">
                <GraduationCap className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Development Impact</h2>
              </div>
              <TextArea
                label="Q8. Describe your business, project, or entrepreneurial calling"
                value={answers.ventureSummary}
                onChange={(value) => updateAnswer('ventureSummary', value)}
                rows={5}
                required
              />
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/55">
                  Q9. Which development outcomes does your work lead or support?
                </p>
                <ToggleGrid
                  options={developmentFocuses}
                  selected={developmentFocus}
                  onToggle={(value) => toggleValue(value, developmentFocus, setDevelopmentFocus)}
                />
              </div>
              <TextArea
                label="Q10. Explain the economic, mental, spiritual, or educational development you intend to create"
                value={answers.developmentFocus}
                onChange={(value) => updateAnswer('developmentFocus', value)}
                rows={5}
                required
              />
              <TextArea
                label="Q11. Who will benefit, and what outcomes will show progress?"
                value={answers.impactPlan}
                onChange={(value) => updateAnswer('impactPlan', value)}
                rows={5}
                required
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-100">
                <HeartHandshake className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Stewardship & Values</h2>
              </div>
              <TextArea
                label="Q12. What have you learned on Conscious Network Hub, and how do faith, God-backed values, service, integrity, and responsible reporting guide this venture?"
                value={answers.cnhLearning}
                onChange={(value) => updateAnswer('cnhLearning', value)}
                rows={5}
                required
              />
              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-400/[0.06] p-4 text-sm leading-6 text-emerald-50">
                <div className="mb-2 flex items-center gap-2 text-emerald-100">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Review Lens</span>
                </div>
                Grant review will consider eligibility, clarity, stewardship, requested amount, use of funds, development impact, and alignment with Conscious Careers values.
              </div>
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep((current) => Math.max(current - 1, 0));
              }}
              disabled={step === 0 || isSubmitting}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Back
            </button>
            {step < grantSteps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-2xl bg-emerald-300 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-emerald-200"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="rounded-2xl bg-emerald-300 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting Grant Application' : 'Submit Grant Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrantApplicationPage;
