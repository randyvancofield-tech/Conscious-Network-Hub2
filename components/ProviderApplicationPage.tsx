import React, { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, ChevronRight, FileText, ShieldCheck } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/randycofield/buildingconnections';

const providerGroups = [
  'Religious Leaders',
  'Spiritualists',
  'Holistic Experts',
  'Mental Wellness Providers',
  'Cultural Enthusiasts',
  'Life Coaches',
];

const steps = [
  'Account',
  'Identity',
  'Services',
  'Credentials',
  'Alignment',
  'Consent',
] as const;

type ProviderApplicationValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  communicationPreference: string;
  providerCategory: string;
  organizationName: string;
  professionalTitle: string;
  website: string;
  socialLinks: string;
  serviceArea: string;
  availabilityMode: string;
  servicesOffered: string;
  targetAudience: string;
  populationsServed: string;
  experienceLevel: string;
  yearsExperience: string;
  practiceStatus: string;
  availabilityToServe: string;
  credentialsText: string;
  licenseNumber: string;
  issuingOrganization: string;
  credentialExpiration: string;
  professionalReferences: string;
  consciousService: string;
  ethicalResponsibility: string;
  marginalizedCommunities: string;
  worldviewDiversity: string;
  whyHigherConsciousNetwork: string;
  transformationSupport: string;
  accurateInformation: boolean;
  credentialReview: boolean;
  providerStandards: boolean;
  approvalNotAutomatic: boolean;
  contactConsent: boolean;
};

interface ProviderApplicationPageProps {
  onBack: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onViewStatus: () => void;
}

const initialValues: ProviderApplicationValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  communicationPreference: 'Email',
  providerCategory: '',
  organizationName: '',
  professionalTitle: '',
  website: '',
  socialLinks: '',
  serviceArea: '',
  availabilityMode: 'Virtual and in-person',
  servicesOffered: '',
  targetAudience: '',
  populationsServed: '',
  experienceLevel: '',
  yearsExperience: '',
  practiceStatus: '',
  availabilityToServe: '',
  credentialsText: '',
  licenseNumber: '',
  issuingOrganization: '',
  credentialExpiration: '',
  professionalReferences: '',
  consciousService: '',
  ethicalResponsibility: '',
  marginalizedCommunities: '',
  worldviewDiversity: '',
  whyHigherConsciousNetwork: '',
  transformationSupport: '',
  accurateInformation: false,
  credentialReview: false,
  providerStandards: false,
  approvalNotAutomatic: false,
  contactConsent: false,
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, type = 'text', required = false, placeholder }) => (
  <label className="block space-y-2">
    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/20"
    />
  </label>
);

const TextArea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}> = ({ label, value, onChange, required = false, rows = 4, placeholder }) => (
  <label className="block space-y-2">
    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-amber-100/40 focus:ring-2 focus:ring-amber-100/20"
    />
  </label>
);

const ProviderApplicationPage: React.FC<ProviderApplicationPageProps> = ({
  onBack,
  onSubmit,
  onViewStatus,
}) => {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProviderApplicationValues>(initialValues);
  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const update = <K extends keyof ProviderApplicationValues>(
    key: K,
    value: ProviderApplicationValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!values.firstName || !values.lastName || !values.email || !values.phone) {
        return 'Name, email, and phone are required.';
      }
      if (values.password !== values.confirmPassword) return 'Passwords do not match.';
      if (values.password.length < 12) return 'Password must be at least 12 characters.';
    }
    if (step === 1 && (!values.providerCategory || !values.professionalTitle || !values.serviceArea)) {
      return 'Provider category, title, and service area are required.';
    }
    if (step === 2 && (!values.servicesOffered || !values.targetAudience || !values.availabilityToServe)) {
      return 'Services, audience, and CNH availability are required.';
    }
    if (step === 3 && (!values.credentialsText || !resume || !coverLetter)) {
      return 'Credentials, resume, and cover letter are required.';
    }
    if (
      step === 4 &&
      (!values.consciousService ||
        !values.ethicalResponsibility ||
        !values.marginalizedCommunities ||
        !values.worldviewDiversity ||
        !values.whyHigherConsciousNetwork ||
        !values.transformationSupport)
    ) {
      return 'Please complete every mission-alignment response.';
    }
    if (
      step === 5 &&
      !(
        values.accurateInformation &&
        values.credentialReview &&
        values.providerStandards &&
        values.approvalNotAutomatic &&
        values.contactConsent
      )
    ) {
      return 'All integrity and consent acknowledgments are required.';
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
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const buildFormData = (): FormData => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    if (resume) formData.append('resume', resume);
    if (coverLetter) formData.append('coverLetter', coverLetter);
    return formData;
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
      await onSubmit(buildFormData());
      setSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to submit provider application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#120d05] p-4 text-white sm:p-8">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-3xl items-center">
          <div className="glass-panel w-full rounded-3xl border border-amber-200/20 bg-amber-400/[0.05] p-6 text-center shadow-2xl sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-400/10 text-emerald-100">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-100/60">
              Application Submitted
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Thank you for applying
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Thank you for applying to become a Conscious Network Hub provider. Your application
              has been received and is now pending review. Please schedule your discovery interview
              using the link below.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
              >
                <CalendarCheck className="h-4 w-4" />
                Schedule Discovery Interview
              </a>
              <button
                type="button"
                onClick={onViewStatus}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                View Application Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#120d05] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-100/60 transition-colors hover:text-white"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Provider Access
        </button>

        <div className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="glass-panel rounded-3xl border border-amber-200/20 bg-amber-400/[0.04] p-6 sm:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-400/10 text-amber-100">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-100/60">
              New Provider Applicant
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
              Apply to Join Conscious Network Hub
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Create your applicant account, submit credentials and materials, and enter a
              restricted review path. Full provider tools remain locked until approval and native
              CNH provider sign-in.
            </p>
          </div>

          <div className="glass-panel rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Step {step + 1} of {steps.length}
                </p>
                <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-white">
                  {steps[step]}
                </h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-amber-100" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {steps.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`rounded-xl px-2 py-2 text-[10px] font-black uppercase transition ${
                    index === step
                      ? 'bg-amber-300 text-slate-950'
                      : index < step
                        ? 'bg-emerald-400/15 text-emerald-100'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl sm:p-8">
          {step === 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="First name" value={values.firstName} onChange={(value) => update('firstName', value)} required />
              <Field label="Last name" value={values.lastName} onChange={(value) => update('lastName', value)} required />
              <Field label="Email" type="email" value={values.email} onChange={(value) => update('email', value)} required />
              <Field label="Phone number" type="tel" value={values.phone} onChange={(value) => update('phone', value)} required />
              <Field label="Password" type="password" value={values.password} onChange={(value) => update('password', value)} required />
              <Field label="Confirm password" type="password" value={values.confirmPassword} onChange={(value) => update('confirmPassword', value)} required />
              <label className="block space-y-2 md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                  Communication preference
                </span>
                <select
                  value={values.communicationPreference}
                  onChange={(event) => update('communicationPreference', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-100/20"
                >
                  <option>Email</option>
                  <option>Phone</option>
                  <option>Text</option>
                </select>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                  Provider group
                </span>
                <select
                  value={values.providerCategory}
                  onChange={(event) => update('providerCategory', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-100/20"
                >
                  <option value="">Select provider group</option>
                  {providerGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </label>
              <Field label="Professional title" value={values.professionalTitle} onChange={(value) => update('professionalTitle', value)} required />
              <Field label="Organization or business name" value={values.organizationName} onChange={(value) => update('organizationName', value)} />
              <Field label="Website" value={values.website} onChange={(value) => update('website', value)} />
              <TextArea label="Social media links" value={values.socialLinks} onChange={(value) => update('socialLinks', value)} rows={3} placeholder="One link per line" />
              <Field label="Location or service area" value={values.serviceArea} onChange={(value) => update('serviceArea', value)} required />
              <label className="block space-y-2 md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                  Availability mode
                </span>
                <select
                  value={values.availabilityMode}
                  onChange={(event) => update('availabilityMode', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-100/20"
                >
                  <option>Virtual and in-person</option>
                  <option>Virtual only</option>
                  <option>In-person only</option>
                </select>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 md:grid-cols-2">
              <TextArea label="Services offered" value={values.servicesOffered} onChange={(value) => update('servicesOffered', value)} required />
              <TextArea label="Target audience" value={values.targetAudience} onChange={(value) => update('targetAudience', value)} required />
              <TextArea label="Populations served" value={values.populationsServed} onChange={(value) => update('populationsServed', value)} />
              <Field label="Experience level" value={values.experienceLevel} onChange={(value) => update('experienceLevel', value)} />
              <Field label="Years of experience" type="number" value={values.yearsExperience} onChange={(value) => update('yearsExperience', value)} />
              <Field label="Current employment or practice status" value={values.practiceStatus} onChange={(value) => update('practiceStatus', value)} />
              <TextArea label="Availability to serve CNH users" value={values.availabilityToServe} onChange={(value) => update('availabilityToServe', value)} required />
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5 md:grid-cols-2">
              <TextArea label="Credentials, certifications, licenses, ordination, lineage, training, or qualifications" value={values.credentialsText} onChange={(value) => update('credentialsText', value)} required rows={5} />
              <TextArea label="Professional references" value={values.professionalReferences} onChange={(value) => update('professionalReferences', value)} rows={5} />
              <Field label="License number if applicable" value={values.licenseNumber} onChange={(value) => update('licenseNumber', value)} />
              <Field label="Issuing organization if applicable" value={values.issuingOrganization} onChange={(value) => update('issuingOrganization', value)} />
              <Field label="Credential expiration if applicable" type="date" value={values.credentialExpiration} onChange={(value) => update('credentialExpiration', value)} />
              <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                    Resume upload required
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => setResume(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-slate-950"
                  />
                  {resume && <p className="mt-2 text-xs text-emerald-100">{resume.name}</p>}
                </label>
                <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                    Cover letter upload required
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => setCoverLetter(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-slate-950"
                  />
                  {coverLetter && <p className="mt-2 text-xs text-emerald-100">{coverLetter.name}</p>}
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-5 md:grid-cols-2">
              <TextArea label="What does conscious service mean to you?" value={values.consciousService} onChange={(value) => update('consciousService', value)} required />
              <TextArea label="How do you balance spiritual, cultural, emotional, and ethical responsibility when supporting others?" value={values.ethicalResponsibility} onChange={(value) => update('ethicalResponsibility', value)} required />
              <TextArea label="Describe your approach to working with people from marginalized or underserved communities." value={values.marginalizedCommunities} onChange={(value) => update('marginalizedCommunities', value)} required />
              <TextArea label="How do you handle disagreement, spiritual diversity, or differing worldviews in a care-based setting?" value={values.worldviewDiversity} onChange={(value) => update('worldviewDiversity', value)} required />
              <TextArea label="Why do you want to become part of Conscious Network Hub?" value={values.whyHigherConsciousNetwork} onChange={(value) => update('whyHigherConsciousNetwork', value)} required />
              <TextArea label="How does your work support healing, empowerment, education, or transformation?" value={values.transformationSupport} onChange={(value) => update('transformationSupport', value)} required />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {[
                ['accurateInformation', 'I agree that the information submitted is accurate.'],
                ['credentialReview', 'I consent to review of credentials and application materials.'],
                ['providerStandards', 'I agree to CNH provider standards.'],
                ['approvalNotAutomatic', 'I acknowledge that approval is not automatic.'],
                ['contactConsent', 'I consent to be contacted for a discovery/interview call.'],
              ].map(([key, label]) => (
                <label key={key} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(values[key as keyof ProviderApplicationValues])}
                    onChange={(event) => update(key as keyof ProviderApplicationValues, event.target.checked as never)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-amber-300"
                  />
                  <span>{label}</span>
                </label>
              ))}
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
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-2xl bg-amber-400 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="rounded-2xl bg-amber-400 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting Application' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderApplicationPage;
