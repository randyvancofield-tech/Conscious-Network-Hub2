import React from 'react';
import { CheckCircle2, CreditCard, LockKeyhole, Sparkles } from 'lucide-react';
import { MEMBERSHIP_TIERS } from '../services/platformData';
import { UserProfile } from '../types';
import { ActionButton, PageHeader, PageShell, SurfacePanel } from './ui/PlatformPrimitives';

type MembershipPageProps = {
  user: UserProfile | null;
  selectedTier: string;
  isCheckoutPending: boolean;
  notice?: string;
  onSelectTier: (tier: string) => void;
  onSignIn: () => void;
};

const MembershipPage: React.FC<MembershipPageProps> = ({
  user,
  selectedTier,
  isCheckoutPending,
  notice,
  onSelectTier,
  onSignIn,
}) => (
  <PageShell>
    <PageHeader
      eyebrow="Access architecture"
      title="Membership"
      description="Select the membership level for your platform account. All tiers continue through Stripe Checkout, including the $0 community tier."
      actions={
        user ? (
          <div className="cnh-status-badge rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300">
            Active: {user.tier || 'Not selected'}
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/30 bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-950/40 transition-colors hover:bg-blue-500"
          >
            <LockKeyhole className="h-4 w-4" />
            Member Login
          </button>
        )
      }
    />

    {notice && (
      <SurfacePanel className="border-blue-400/20 bg-blue-500/5 text-sm text-blue-100">{notice}</SurfacePanel>
    )}

    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {MEMBERSHIP_TIERS.map((tier) => {
        const isCurrent = user?.tier === tier.name;
        const isSelected = selectedTier === tier.name || isCurrent;
        return (
          <SurfacePanel
            key={tier.id}
            className={`flex h-full flex-col gap-6 ${isSelected ? 'border-blue-400/50 bg-blue-500/10' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/70">{tier.cadence}</p>
                <h2 className="text-xl 2xl:text-2xl font-black uppercase text-white">{tier.name}</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-300">
                {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
            </div>

            <div>
              <p className="text-3xl font-black text-white">{tier.price}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{tier.description}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Best For</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{tier.ideal}</p>
            </div>

            <ul className="space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-3">
              <ActionButton
                type="button"
                className="w-full"
                disabled={isCheckoutPending || isCurrent}
                icon={<CreditCard className="h-4 w-4" />}
                onClick={() => onSelectTier(tier.name)}
              >
                {isCheckoutPending && isSelected
                  ? 'Processing...'
                  : isCurrent
                  ? 'Current Tier'
                  : !user
                  ? 'Sign In to Continue'
                  : 'Continue to Checkout'}
              </ActionButton>
              <p className="text-xs leading-5 text-slate-500">{tier.access}</p>
            </div>
          </SurfacePanel>
        );
      })}
    </section>
  </PageShell>
);

export default MembershipPage;
