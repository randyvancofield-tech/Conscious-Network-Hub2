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
      description="Production-ready tier selection is in place. Stripe checkout remains disabled at the UI entry point until the backend membership service is connected."
      actions={
        user ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300">
            Active: {user.tier || 'Not selected'}
          </div>
        ) : (
          <ActionButton type="button" onClick={onSignIn} icon={<LockKeyhole className="h-4 w-4" />}>
            Sign In
          </ActionButton>
        )
      }
    />

    {notice && (
      <SurfacePanel className="border-blue-400/20 bg-blue-500/5 text-sm text-blue-100">{notice}</SurfacePanel>
    )}

    <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {MEMBERSHIP_TIERS.map((tier) => {
        const isCurrent = selectedTier === tier.name || user?.tier === tier.name;
        return (
          <SurfacePanel
            key={tier.id}
            className={`flex h-full flex-col gap-6 ${isCurrent ? 'border-blue-400/50 bg-blue-500/10' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/70">{tier.cadence}</p>
                <h2 className="text-2xl font-black uppercase text-white">{tier.name}</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-300">
                {isCurrent ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
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
                disabled={isCheckoutPending || !tier.checkoutEnabled}
                icon={<CreditCard className="h-4 w-4" />}
                onClick={() => onSelectTier(tier.name)}
              >
                {tier.checkoutEnabled ? 'Continue to Checkout' : 'Checkout Pending Backend'}
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
