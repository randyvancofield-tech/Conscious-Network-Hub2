import React, { useState } from 'react';
import { ChevronRight, KeyRound, ShieldCheck } from 'lucide-react';

interface ProviderApplicantSignInPageProps {
  onBack: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<string>;
  onSignedIn: () => void;
}

const ProviderApplicantSignInPage: React.FC<ProviderApplicantSignInPageProps> = ({
  onBack,
  onSignIn,
  onPasswordReset,
  onSignedIn,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isResetOpen, setResetOpen] = useState(false);
  const [isResetSubmitting, setResetSubmitting] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSignIn(email, password);
      onSignedIn();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in as applicant.');
    } finally {
      setSubmitting(false);
    }
  };

  const requestReset = async () => {
    setResetSubmitting(true);
    setResetNotice('');
    setError('');
    try {
      const notice = await onPasswordReset(email);
      setResetNotice(notice);
    } catch (error) {
      setResetNotice(error instanceof Error ? error.message : 'Unable to send reset link.');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#0d0f0a] p-4 text-white sm:p-8">
      <div className="glass-panel w-full max-w-xl rounded-3xl border border-stone-200/20 bg-stone-300/[0.05] p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-100/60 transition-colors hover:text-white"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Provider Access
        </button>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200/20 bg-stone-300/10 text-stone-100">
          <KeyRound className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-stone-100/60">
          Returning Applicant
        </p>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          Applicant Sign In
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Sign in with the credentials created during your application. This area is limited to
          application status and submitted provider information.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-100/55">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-stone-100/25"
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-100/55">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:ring-2 focus:ring-stone-100/25"
              required
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <button
              type="button"
              onClick={() => {
                setResetOpen((open) => !open);
                setResetNotice('');
              }}
              className="text-[10px] font-black uppercase tracking-widest text-stone-100/70 transition-colors hover:text-white"
            >
              Forgot Password?
            </button>
            {isResetOpen && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={requestReset}
                  disabled={isResetSubmitting}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {isResetSubmitting ? 'Sending Reset Link' : 'Send Reset Link'}
                </button>
                {resetNotice && (
                  <p className="text-xs leading-5 text-stone-100/75">{resetNotice}</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-200 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-white disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {isSubmitting ? 'Signing In' : 'View Application Status'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProviderApplicantSignInPage;
