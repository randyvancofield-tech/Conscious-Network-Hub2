
import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Wallet,
  ShieldCheck,
  Activity,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Coins,
  History,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Info,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';

interface WalletPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

type VerifyStatus = 'unverified' | 'connected' | 'verified' | 'error';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const LS_KEY = 'hcn_wallet_session_v1';

function toDidPkh(chainId: number, address: string) {
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}`;
}

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

const WalletPopout: React.FC<WalletPopoutProps> = ({ isOpen, onClose, user }) => {
  const VERIFY_ENDPOINT =
    (import.meta as any)?.env?.VITE_WALLET_VERIFY_URL ||
    (process as any)?.env?.REACT_APP_WALLET_VERIFY_URL ||
    '';

  const persisted = useMemo(() => {
    return safeParseJSON<{
      address?: string;
      chainId?: number;
      did?: string;
      verifyStatus?: VerifyStatus;
      verifiedAt?: string;
    }>(localStorage.getItem(LS_KEY));
  }, []);

  const [connectedAddress, setConnectedAddress] = useState<string>(persisted?.address || '');
  const [chainId, setChainId] = useState<number>(persisted?.chainId || 0);
  const [did, setDid] = useState<string>(persisted?.did || '');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(persisted?.verifyStatus || 'unverified');
  const [verifiedAt, setVerifiedAt] = useState<string>(persisted?.verifiedAt || '');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>('');

  const fallbackDid = useMemo(() => {
    if (!user) return 'did:hcn:node_guest';
    const base = user.email || 'guest';
    const hash = btoa(base).substring(0, 12).toLowerCase();
    return `did:hcn:node_${hash}`;
  }, [user]);

  const walletDID = did || fallbackDid;

  const transactions = [
    { id: 1, type: 'reward', amount: '+12 HCN', detail: 'Knowledge Contribution', date: '2h ago' },
    { id: 2, type: 'stake', amount: '-5 HCN', detail: 'Node Reputation Stake', date: '1d ago' },
    { id: 3, type: 'reward', amount: '+2.5 HCN', detail: 'Peer Support Bonus', date: '2d ago' }
  ];

  useEffect(() => {
    const payload = { address: connectedAddress, chainId, did, verifyStatus, verifiedAt };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [connectedAddress, chainId, did, verifyStatus, verifiedAt]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const addr = accounts?.[0] || '';
      if (!addr) {
        setConnectedAddress('');
        setChainId(0);
        setDid('');
        setVerifyStatus('unverified');
        setVerifiedAt('');
        return;
      }
      setConnectedAddress(addr);
      setVerifyStatus((prev) => (prev === 'verified' ? 'verified' : 'connected'));
    };

    const handleChainChanged = (hexChainId: string) => {
      const cid = parseInt(hexChainId, 16);
      setChainId(cid || 0);
      if (connectedAddress) {
        setDid(toDidPkh(cid || 1, connectedAddress));
        setVerifyStatus((prev) => (prev === 'verified' ? 'verified' : 'connected'));
      }
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [connectedAddress]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast('Copied ✅');
    } catch {
      setToast('Copy failed ❌');
    }
  };

  const requireEthereum = () => {
    if (!window.ethereum) {
      setToast('No wallet detected. Install MetaMask or use a wallet-enabled browser.');
      return false;
    }
    return true;
  };

  const connectWallet = async () => {
    if (!requireEthereum()) return;
    setBusy(true);
    setToast('');

    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0] || '';
      if (!addr) throw new Error('No account returned by wallet');

      const hexChainId: string = await window.ethereum.request({ method: 'eth_chainId' });
      const cid = parseInt(hexChainId, 16) || 1;

      setConnectedAddress(addr);
      setChainId(cid);
      setDid(toDidPkh(cid, addr));
      setVerifyStatus('connected');
      setVerifiedAt('');

      setToast('Wallet connected ✅');
    } catch (e: any) {
      setVerifyStatus('error');
      setToast(e?.message || 'Wallet connect failed');
    } finally {
      setBusy(false);
    }
  };

  const disconnectLocal = () => {
    setConnectedAddress('');
    setChainId(0);
    setDid('');
    setVerifyStatus('unverified');
    setVerifiedAt('');
    setToast('Disconnected (app session) ✅');
  };

  const verifyWallet = async () => {
    if (!requireEthereum()) return;
    if (!connectedAddress) {
      await connectWallet();
      return;
    }

    setBusy(true);
    setToast('');

    try {
      const domain = window.location.host;
      const nowIso = new Date().toISOString();
      const message =
        `HCN Sovereign Vault Verification\n` +
        `Domain: ${domain}\n` +
        `Address: ${connectedAddress}\n` +
        `ChainId: ${chainId || 1}\n` +
        `Time: ${nowIso}\n\n` +
        `By signing, I prove I control this wallet for Higher Conscious Network (HCN).`;

      const signature: string = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, connectedAddress]
      });

      if (!VERIFY_ENDPOINT) {
        setVerifyStatus('connected');
        setVerifiedAt('');
        setToast('Signed ✅ (Backend verify not configured yet)');
        return;
      }

      const resp = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature,
          address: connectedAddress,
          chainId: chainId || 1,
          did: did || toDidPkh(chainId || 1, connectedAddress)
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Verification failed');

      setVerifyStatus('verified');
      setVerifiedAt(new Date().toLocaleString());
      setToast('Verified ✅');
    } catch (e: any) {
      setVerifyStatus('error');
      setToast(e?.message || 'Verification failed');
    } finally {
      setBusy(false);
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
    <div className={`fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-[#0a0f1a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-none">Sovereign Vault</h2>
              <p className="text-[10px] text-teal-400 mt-1 uppercase tracking-widest font-bold">Encrypted Node Access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] text-slate-200 uppercase tracking-wider">
            {toast}
          </div>
        )}

        {/* Security Alert - MVP Notice */}
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">MVP Security Protocol</p>
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
              This is an alpha implementation. Wallet address + DID are stored locally. Clearing site storage will reset this identity.
            </p>
          </div>
        </div>

        {/* Identity Section */}
        <section className="space-y-4 mb-8">
          <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-600/20 to-teal-600/10 border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-24 h-24 text-blue-400" />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 block">Identity Identifier (DID)</label>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
            </div>

            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group/did">
              <span className="font-mono text-xs text-slate-300 truncate mr-2">{walletDID}</span>
              <button className="text-slate-500 hover:text-blue-400 transition-colors" onClick={() => copyText(walletDID)}>
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Wallet Address</div>
                <div className="font-mono text-xs text-slate-300 truncate">
                  {connectedAddress ? connectedAddress : 'Not connected'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Chain ID: <span className="text-slate-300 font-mono">{chainId || '—'}</span>
                  {verifiedAt ? <span className="ml-2">• Verified: <span className="text-slate-300">{verifiedAt}</span></span> : null}
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
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Local Session Context Active</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={connectedAddress ? disconnectLocal : connectWallet}
                disabled={busy}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest"
              >
                {connectedAddress ? 'Disconnect' : (busy ? 'Connecting…' : 'Connect')}
              </button>

              <button
                onClick={verifyWallet}
                disabled={busy || !connectedAddress}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest"
              >
                {busy ? 'Processing…' : 'Verify'}
              </button>
            </div>
          </div>
        </section>

        {/* Balances */}
        <section className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5 rounded-3xl border-t border-blue-500/30">
            <Coins className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">42.5</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">HCN Credits</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border-t border-teal-500/30">
            <Zap className="w-5 h-5 text-teal-400 mb-2" />
            <p className="text-2xl font-bold text-white">{user?.reputationScore || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Reputation</p>
          </div>
        </section>

        {/* Encryption Notes */}
        <div className="mb-8 p-4 bg-blue-500/5 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Data Autonomy Note</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed italic">
            Wallet connection happens between your browser and your wallet provider. Private keys never leave your wallet. Verification is optional and will call your backend only when configured.
          </p>
          {!VERIFY_ENDPOINT && (
            <p className="text-[10px] text-amber-400/80 leading-relaxed mt-2 uppercase tracking-wider">
              Backend verification not configured yet (set VITE_WALLET_VERIFY_URL when ready).
            </p>
          )}
        </div>

        {/* Blockchain Features */}
        <section className="space-y-4 mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" /> Network Participation
          </h3>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">Stake Reputation</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group">
              <div className="flex items-center gap-3">
                <ArrowDownLeft className="w-5 h-5 text-teal-400" />
                <span className="text-sm font-medium">Claim Knowledge Rewards</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Transaction History */}
        <section className="flex-1 flex flex-col min-h-[200px]">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
            <History className="w-3 h-3" /> Ledger Activity
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-white">{tx.detail}</p>
                  <p className="text-[10px] text-slate-500">{tx.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-bold ${tx.type === 'reward' ? 'text-green-400' : 'text-blue-400'}`}>
                    {tx.amount}
                  </p>
                  <button className="text-[10px] text-blue-400/50 hover:text-blue-400 flex items-center gap-1 justify-end mt-1">
                    TXID <ExternalLink className="w-2 h-2" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-white/10 shrink-0">
          <button
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={connectedAddress ? verifyWallet : connectWallet}
            disabled={busy}
          >
            Bridge External Wallet
          </button>
          <p className="text-[10px] text-center text-slate-500 mt-4 italic uppercase tracking-tighter">
            HCN Node Protocol v0.8.2-alpha • Secure Decentralized Asset Vault
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletPopout;
