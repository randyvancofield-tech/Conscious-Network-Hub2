import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { consumeProviderLaunchCode } from '../services/backendApiService';
import { setAuthSession } from '../services/sessionService';
import { UserProfile } from '../types';

const PROVIDER_SESSION_TOKEN_STORAGE_KEY = 'hcn_provider_session_token';
const PROVIDER_SESSION_TOKEN_EVENT = 'hcn:provider-session-token-updated';

interface ProviderLaunchGateProps {
  onAuthenticated: (user: UserProfile) => void;
}

type GateState = 'loading' | 'success' | 'error';

const ProviderLaunchGate: React.FC<ProviderLaunchGateProps> = ({ onAuthenticated }) => {
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState('Establishing secure provider session...');

  useEffect(() => {
    let cancelled = false;

    const consume = async (): Promise<void> => {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const code = String(params.get('code') || params.get('launchCode') || '').trim();
      if (!code) {
        if (!cancelled) {
          setState('error');
          setMessage('Provider launch code is missing.');
        }
        return;
      }

      const consumed = await consumeProviderLaunchCode(code);
      if (!consumed?.session?.token || !consumed?.providerSession?.token || !consumed?.user?.id) {
        if (!cancelled) {
          setState('error');
          setMessage('Provider launch failed. The code may be invalid or expired.');
        }
        return;
      }

      const authenticatedUser: UserProfile = {
        id: consumed.user.id,
        email: consumed.user.email,
        name: consumed.user.name || consumed.user.email.split('@')[0] || 'Provider',
        tier: consumed.user.tier || 'Accelerated Tier',
        subscriptionStatus: consumed.user.subscriptionStatus || 'active',
        createdAt: consumed.user.createdAt,
        hasProfile: true,
        identityVerified: true,
        twoFactorEnabled: consumed.user.twoFactorEnabled,
        twoFactorMethod: consumed.user.twoFactorMethod,
        phoneNumberMasked: consumed.user.phoneNumberMasked,
        walletDid: consumed.user.walletDid,
        role: consumed.user.role,
        providerExternalId: consumed.user.providerExternalId,
      };

      setAuthSession(consumed.session.token, authenticatedUser);
      try {
        window.sessionStorage.setItem(
          PROVIDER_SESSION_TOKEN_STORAGE_KEY,
          consumed.providerSession.token
        );
        window.dispatchEvent(
          new CustomEvent(PROVIDER_SESSION_TOKEN_EVENT, {
            detail: {
              token: consumed.providerSession.token,
              expiresAt: consumed.providerSession.expiresAt,
            },
          })
        );
      } catch {
        // Ignore constrained storage contexts.
      }

      if (cancelled) return;
      setState('success');
      setMessage('Provider session verified. Redirecting to your dashboard...');
      window.history.replaceState({}, document.title, '/');
      onAuthenticated(authenticatedUser);
    };

    void consume();
    return () => {
      cancelled = true;
    };
  }, [onAuthenticated]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg glass-panel rounded-3xl border border-blue-500/20 p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-600/20">
            {state === 'loading' && <Loader2 className="w-6 h-6 text-blue-300 animate-spin" />}
            {state === 'success' && <ShieldCheck className="w-6 h-6 text-emerald-300" />}
            {state === 'error' && <AlertTriangle className="w-6 h-6 text-amber-300" />}
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider">
              Provider Launch
            </h2>
            <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">
              Conscious Network Hub
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">{message}</p>

        {state === 'error' && (
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            Return to Hub
          </button>
        )}
      </div>
    </div>
  );
};

export default ProviderLaunchGate;
