import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { buildBridgeUserFromToken } from '../services/sessionService';
import { UserProfile } from '../types';

interface AuthCallbackPageProps {
  onAuthenticated: (token: string, user: UserProfile) => void;
  onInvalidToken: () => void;
}

type CallbackState = 'loading' | 'success' | 'error';
const BASE44_PORTAL_URL = 'https://conscious-network-hub.base44.app';
const INVALID_SESSION_MESSAGE =
  'Your session could not be verified. Please return and reconnect.';

const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({
  onAuthenticated,
  onInvalidToken,
}) => {
  const [state, setState] = useState<CallbackState>('loading');
  const [message, setMessage] = useState('Signing you in...');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = new URLSearchParams(window.location.search).get('token')?.trim() || '';
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
    setMessage('Provider session verified. Opening your dashboard...');
    onAuthenticated(token, bridgeUser);
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
            onClick={() => window.location.assign(BASE44_PORTAL_URL)}
            className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            Return to Portal
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
