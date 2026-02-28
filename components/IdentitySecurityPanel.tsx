import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, ShieldCheck, Copy, AlertTriangle, Lock } from 'lucide-react';
import { ethers } from 'ethers';
import { buildAuthHeaders } from '../services/sessionService';
import { UserProfile } from '../types';

interface IdentitySecurityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

type VerifyStatus = 'unverified' | 'connected' | 'verified' | 'error';
type IdentityAction = 'connect' | 'verify' | null;

declare global {
  interface Window {
    ethereum?: any;
  }
}

const LS_KEY = 'hcn_identity_security_session_v1';
const DEFAULT_CHAIN_ID = 1;

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toDidPkh(chainId: number, address: string): string {
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}`;
}

const normalizeAddress = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return ethers.getAddress(raw);
  } catch {
    return null;
  }
};

const normalizeChainId = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CHAIN_ID;
  return Math.floor(parsed);
};

const IdentitySecurityPanel: React.FC<IdentitySecurityPanelProps> = ({ isOpen, onClose, user }) => {
  const persisted = useMemo(() => {
    return safeParseJSON<{
      address?: string;
      chainId?: number;
      did?: string;
      verifyStatus?: VerifyStatus;
      verifiedAt?: string;
    }>(localStorage.getItem(LS_KEY));
  }, []);

  const backendBaseUrl = String((import.meta as any)?.env?.VITE_BACKEND_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const toApiUrl = useCallback(
    (pathOrUrl: string): string => {
      const raw = String(pathOrUrl || '').trim();
      if (!raw) return backendBaseUrl || '';
      if (/^https?:\/\//i.test(raw)) return raw;
      const normalized = raw.startsWith('/') ? raw : `/${raw}`;
      return backendBaseUrl ? `${backendBaseUrl}${normalized}` : normalized;
    },
    [backendBaseUrl]
  );

  const verifyEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_IDENTITY_VERIFY_URL || '/api/identity-security/verify')
  );
  const challengeEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_IDENTITY_CHALLENGE_URL || '/api/identity-security/challenge')
  );
  const identitySessionEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_IDENTITY_SESSION_URL || '/api/identity-security/session')
  );
  const identityLogoutEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_IDENTITY_LOGOUT_URL || '/api/identity-security/logout')
  );
  const configuredChainId = normalizeChainId(
    (import.meta as any)?.env?.VITE_BLOCKCHAIN_NETWORK_ID || DEFAULT_CHAIN_ID
  );

  const [connectedAddress, setConnectedAddress] = useState<string>(persisted?.address || '');
  const [chainId, setChainId] = useState<number>(persisted?.chainId || 0);
  const [did, setDid] = useState<string>(persisted?.did || '');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    persisted?.verifyStatus || 'unverified'
  );
  const [verifiedAt, setVerifiedAt] = useState<string>(persisted?.verifiedAt || '');
  const [busyAction, setBusyAction] = useState<IdentityAction>(null);
  const [toast, setToast] = useState<string>('');

  const fallbackDid = useMemo(() => {
    if (!user) return 'did:hcn:node_guest';
    const base = user.email || 'guest';
    const hash = btoa(base).substring(0, 12).toLowerCase();
    return `did:hcn:node_${hash}`;
  }, [user]);

  const identityDid = did || fallbackDid;

  useEffect(() => {
    const payload = { address: connectedAddress, chainId, did, verifyStatus, verifiedAt };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [connectedAddress, chainId, did, verifyStatus, verifiedAt]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const normalized = normalizeAddress(accounts?.[0]);
      if (!normalized) {
        setConnectedAddress('');
        setChainId(0);
        setDid('');
        setVerifyStatus('unverified');
        setVerifiedAt('');
        return;
      }
      setConnectedAddress(normalized);
      setDid(toDidPkh(chainId || DEFAULT_CHAIN_ID, normalized));
      setVerifyStatus((prev) => (prev === 'verified' ? 'verified' : 'connected'));
    };

    const handleChainChanged = (hexChainId: string) => {
      const nextChainId = parseInt(hexChainId, 16) || DEFAULT_CHAIN_ID;
      setChainId(nextChainId);
      if (connectedAddress) {
        setDid(toDidPkh(nextChainId, connectedAddress));
        setVerifyStatus((prev) => (prev === 'verified' ? 'verified' : 'connected'));
      }
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [connectedAddress, chainId]);

  useEffect(() => {
    const restoreIdentitySession = async (): Promise<void> => {
      try {
        const response = await fetch(identitySessionEndpoint, {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        const session = data?.session || {};
        const restoredAddress = normalizeAddress(session.address);
        const restoredChainId = normalizeChainId(session.chainId);
        if (!restoredAddress) return;
        setConnectedAddress(restoredAddress);
        setChainId(restoredChainId);
        setDid(String(session.did || toDidPkh(restoredChainId, restoredAddress)));
        setVerifyStatus('verified');
        if (session.verifiedAt) {
          setVerifiedAt(new Date(String(session.verifiedAt)).toLocaleString());
        }
      } catch {
        // Ignore restoration errors so the panel stays usable.
      }
    };
    void restoreIdentitySession();
  }, [identitySessionEndpoint]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast('Copied');
    } catch {
      setToast('Copy failed');
    }
  };

  const requireEthereum = (): boolean => {
    if (!window.ethereum) {
      setToast('No compatible signer extension detected');
      return false;
    }
    return true;
  };

  const connectIdentityAddress = async (): Promise<void> => {
    if (!requireEthereum()) return;
    setBusyAction('connect');
    setToast('');

    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = normalizeAddress(accounts?.[0]);
      if (!address) throw new Error('No address returned by signer');

      const chainHex = String(await window.ethereum.request({ method: 'eth_chainId' }));
      const nextChainId = parseInt(chainHex, 16) || DEFAULT_CHAIN_ID;

      setConnectedAddress(address);
      setChainId(nextChainId);
      setDid(toDidPkh(nextChainId, address));
      setVerifyStatus('connected');
      setVerifiedAt('');
      setToast('Address binding connected');

      if (nextChainId !== configuredChainId) {
        setToast(`Connected on chain ${nextChainId}. Expected chain ${configuredChainId}.`);
      }
    } catch (error: any) {
      setVerifyStatus('error');
      setToast(error?.message || 'Address connection failed');
    } finally {
      setBusyAction(null);
    }
  };

  const clearLocalIdentitySession = async (): Promise<void> => {
    setConnectedAddress('');
    setChainId(0);
    setDid('');
    setVerifyStatus('unverified');
    setVerifiedAt('');
    localStorage.removeItem(LS_KEY);
    try {
      await fetch(identityLogoutEndpoint, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore remote logout issues.
    }
    setToast('Identity session cleared');
  };

  const verifyIdentity = async (): Promise<void> => {
    if (!requireEthereum()) return;
    if (!connectedAddress) {
      await connectIdentityAddress();
      return;
    }

    setBusyAction('verify');
    setToast('');

    try {
      const challengeResp = await fetch(challengeEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          address: connectedAddress,
          chainId: chainId || DEFAULT_CHAIN_ID,
          did: identityDid,
        }),
      });
      const challengeData = await challengeResp.json().catch(() => ({}));
      if (!challengeResp.ok) {
        throw new Error(challengeData?.error || 'Identity challenge request failed');
      }

      const challenge = challengeData?.challenge || {};
      const message = String(challenge.message || '').trim();
      if (!message) {
        throw new Error('Challenge payload missing signable message');
      }

      const signature: string = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, connectedAddress],
      });

      const verifyResp = await fetch(verifyEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message,
          signature,
          address: connectedAddress,
          chainId: chainId || DEFAULT_CHAIN_ID,
          did: identityDid,
          requestId: challenge.requestId,
        }),
      });
      const verifyData = await verifyResp.json().catch(() => ({}));
      if (!verifyResp.ok) {
        throw new Error(verifyData?.error || 'Identity verification failed');
      }

      const session = verifyData?.session || {};
      setDid(String(session.did || identityDid));
      setVerifyStatus('verified');
      setVerifiedAt(new Date().toLocaleString());
      setToast('Identity verification complete');
    } catch (error: any) {
      setVerifyStatus('error');
      setToast(error?.message || 'Verification failed');
    } finally {
      setBusyAction(null);
    }
  };

  const statusLabel = useMemo(() => {
    if (verifyStatus === 'verified') return 'Verified';
    if (verifyStatus === 'connected') return 'Connected';
    if (verifyStatus === 'error') return 'Error';
    return 'Unverified';
  }, [verifyStatus]);

  const statusColor = useMemo(() => {
    if (verifyStatus === 'verified') return 'text-green-400';
    if (verifyStatus === 'connected') return 'text-cyan-300';
    if (verifyStatus === 'error') return 'text-red-400';
    return 'text-slate-400';
  }, [verifyStatus]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-[#0a0f1a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform duration-500 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-none">Identity Security Panel</h2>
              <p className="text-[10px] text-teal-400 mt-1 uppercase tracking-widest font-bold">
                Session Integrity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {toast ? (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] text-slate-200 uppercase tracking-wider">
            {toast}
          </div>
        ) : null}

        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              Security Infrastructure
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
              Identity verification is used only for DID binding, integrity anchoring, and session
              continuity.
            </p>
          </div>
        </div>

        <section className="space-y-4 mb-8">
          <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-600/20 to-teal-600/10 border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-24 h-24 text-blue-400" />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 block">
                Identity Status
              </label>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="font-mono text-xs text-slate-300 truncate mr-2">{identityDid}</span>
              <button
                className="text-slate-500 hover:text-blue-400 transition-colors"
                onClick={() => copyText(identityDid)}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Address Binding
                </div>
                <div className="font-mono text-xs text-slate-300 truncate">
                  {connectedAddress || 'Not connected'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Chain ID:{' '}
                  <span className="text-slate-300 font-mono">{chainId || '-'}</span>
                  {verifiedAt ? (
                    <span className="ml-2">
                      - Verified: <span className="text-slate-300">{verifiedAt}</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                className="text-slate-500 hover:text-blue-400 transition-colors ml-3"
                onClick={() => connectedAddress && copyText(connectedAddress)}
                disabled={!connectedAddress}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Lock className="w-3 h-3 text-teal-400" />
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
                Secure Session Cookie Enabled
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => void connectIdentityAddress()}
                disabled={busyAction !== null}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest disabled:opacity-60"
              >
                {busyAction === 'connect' ? 'Connecting...' : 'Connect'}
              </button>

              <button
                onClick={() => void verifyIdentity()}
                disabled={busyAction !== null || !connectedAddress}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest disabled:opacity-60"
              >
                {busyAction === 'verify' ? 'Verifying...' : 'Verify'}
              </button>

              <button
                onClick={() => void clearLocalIdentitySession()}
                disabled={busyAction !== null}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default IdentitySecurityPanel;
