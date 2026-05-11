import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { buildBridgeUserFromToken } from '../services/sessionService';
import { consumeProviderLaunchCode } from '../services/backendApiService';
import type { ProviderBridgeConsumeResult } from '../services/backendApiService';
import { UserProfile } from '../types';

interface AuthCallbackPageProps {
  onAuthenticated: (token: string, user: UserProfile, providerSessionToken?: string) => void;
  onInvalidToken: () => void;
}

type CallbackState = 'loading' | 'success' | 'error';
const INVALID_SESSION_MESSAGE =
  'Your session could not be verified. Please return and reconnect.';

const toProviderLaunchUser = (result: ProviderBridgeConsumeResult): UserProfile | null => {
  const rawUser = result.user;
  const role = rawUser.role === 'admin' ? 'admin' : rawUser.role === 'provider' ? 'provider' : null;
  if (!role || !rawUser.id || !rawUser.email) return null;

  return {
    id: rawUser.id,
    name: rawUser.name || rawUser.email.split('@')[0] || 'Provider',
    email: rawUser.email,
    role,
    providerExternalId: rawUser.providerExternalId,
    tier: rawUser.tier || 'Accelerated Tier',
    subscriptionStatus: rawUser.subscriptionStatus || 'active',
    hasProfile: true,
    identityVerified: Boolean(rawUser.walletDid),
    reputationScore: 100,
    accessKeyIndex: 200,
    createdAt: rawUser.createdAt,
    twoFactorEnabled: rawUser.twoFactorEnabled,
    twoFactorMethod: rawUser.twoFactorMethod,
    phoneNumberMasked: rawUser.phoneNumberMasked,
    walletDid: rawUser.walletDid,
    initialTwoFactorRequired: rawUser.initialTwoFactorRequired === true,
    initialTwoFactorCompleted: rawUser.initialTwoFactorCompleted === true,
    canAccessFullPlatform: rawUser.canAccessFullPlatform !== false,
  };
};

const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({
  onAuthenticated,
  onInvalidToken,
}) => {
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('Signing you in...');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const authenticate = async (): Promise<void> => {
      const params = new URLSearchParams(window.location.search);
      const launchCode = params.get('launchCode')?.trim() || '';
      if (launchCode) {
        setMessage('Verifying provider launch...');
        const result = await consumeProviderLaunchCode(launchCode);
        if (cancelled) return;
        const launchUser = result ? toProviderLaunchUser(result) : null;
        if (!result || !launchUser) {
          onInvalidToken();
          setState('error');
          setMessage(INVALID_SESSION_MESSAGE);
          return;
        }

        setState('success');
        setMessage('Provider launch verified. Opening your provider tools...');
        onAuthenticated(result.session.token, launchUser, result.providerSession.token);
        return;
      }

      const token = params.get('token')?.trim() || '';
      if (!token) {
        onInvalidToken();
        setState('error');
        setMessage(INVALID_SESSION_MESSAGE);
        return;
      }

      const bridgeUser = buildBridgeUserFromToken(token);
      if (!bridgeUser) {
        onInvalidToken();
        setState('error');
        setMessage(INVALID_SESSION_MESSAGE);
        return;
      }

      setState('success');
      setMessage('Provider session verified. Opening your provider tools...');
      onAuthenticated(token, bridgeUser);
    };

    void authenticate().catch(() => {
      if (cancelled) return;
      onInvalidToken();
      setState('error');
      setMessage(INVALID_SESSION_MESSAGE);
    });

    return () => {
      cancelled = true;
    };
  }, [onAuthenticated, onInvalidToken]);

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
            <h2 className="text-xl font-black uppercase tracking-wider">Provider Callback</h2>
            <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">
              Conscious Network Hub
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">{message}</p>

        {state === 'error' && (
          <button
            type="button"
            onClick={() => window.location.assign('/provider-access')}
            className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            Return to Provider Access
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
