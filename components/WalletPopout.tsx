import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Lock,
} from 'lucide-react';
import { ethers } from 'ethers';
import { buildAuthHeaders } from '../services/sessionService';
import { UserProfile } from '../types';

interface WalletPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

type VerifyStatus = 'unverified' | 'connected' | 'verified' | 'error';
type WalletAction = 'connect' | 'verify' | 'stake' | 'claim' | null;

type LedgerActivity = {
  id: string;
  type: 'stake' | 'reward';
  amount: string;
  detail: string;
  date: string;
  txHash?: string;
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

const LS_KEY = 'hcn_wallet_session_v1';
const DEFAULT_CHAIN_ID = 1;
const DEFAULT_STAKE_AMOUNT = 5n;
const DEFAULT_REWARD_ACTIVITY = 'knowledge_contribution';

const HCN_LEDGER_ABI = [
  'event ReputationStaked(address indexed staker,uint256 amount,uint256 reputationAfter)',
  'event RewardsClaimed(address indexed recipient,bytes32 indexed txid,uint256 amount,uint256 reputationPoints)',
  'function stakeReputation(uint256 amount) external',
  'function claimRewards(bytes32 txid,uint256 amount,uint256 reputationPoints,bytes signature) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function reputationOf(address account) external view returns (uint256)',
] as const;

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

const WalletPopout: React.FC<WalletPopoutProps> = ({ isOpen, onClose, user }) => {
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
    String((import.meta as any)?.env?.VITE_WALLET_VERIFY_URL || '/api/wallet/verify')
  );
  const challengeEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_WALLET_CHALLENGE_URL || '/api/wallet/challenge')
  );
  const walletSessionEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_WALLET_SESSION_URL || '/api/wallet/session')
  );
  const walletLogoutEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_WALLET_LOGOUT_URL || '/api/wallet/logout')
  );
  const walletRewardSignEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_WALLET_REWARD_SIGN_URL || '/api/wallet/rewards/sign')
  );

  const ledgerContractAddressRaw = String(
    (import.meta as any)?.env?.VITE_HCN_CREDITS_CONTRACT_ADDRESS || ''
  ).trim();
  const ledgerContractAddress = normalizeAddress(ledgerContractAddressRaw) || '';
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
  const [busyAction, setBusyAction] = useState<WalletAction>(null);
  const [toast, setToast] = useState<string>('');
  const [creditsBalance, setCreditsBalance] = useState<string>(
    String(user?.walletBalanceTokens ?? '0')
  );
  const [reputationBalance, setReputationBalance] = useState<string>(
    String(user?.reputationScore ?? '0')
  );
  const [activities, setActivities] = useState<LedgerActivity[]>([
    {
      id: 'seed-reward',
      type: 'reward',
      amount: '+12 HCN',
      detail: 'Knowledge Contribution',
      date: '2h ago',
    },
    {
      id: 'seed-stake',
      type: 'stake',
      amount: '-5 HCN',
      detail: 'Node Reputation Stake',
      date: '1d ago',
    },
    {
      id: 'seed-reward-2',
      type: 'reward',
      amount: '+2.5 HCN',
      detail: 'Peer Support Bonus',
      date: '2d ago',
    },
  ]);

  const fallbackDid = useMemo(() => {
    if (!user) return 'did:hcn:node_guest';
    const base = user.email || 'guest';
    const hash = btoa(base).substring(0, 12).toLowerCase();
    return `did:hcn:node_${hash}`;
  }, [user]);

  const walletDID = did || fallbackDid;

  const appendActivity = useCallback((next: Omit<LedgerActivity, 'id' | 'date'>) => {
    const activity: LedgerActivity = {
      id: crypto.randomUUID(),
      date: 'just now',
      ...next,
    };
    setActivities((prev) => [activity, ...prev].slice(0, 20));
  }, []);

  const loadOnchainBalances = useCallback(async () => {
    if (!window.ethereum || !connectedAddress || !ledgerContractAddress) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(ledgerContractAddress, HCN_LEDGER_ABI, provider);
      const [balanceRaw, reputationRaw] = await Promise.all([
        contract.balanceOf(connectedAddress),
        contract.reputationOf(connectedAddress),
      ]);
      setCreditsBalance(balanceRaw.toString());
      setReputationBalance(reputationRaw.toString());
    } catch {
      // Keep UI resilient if the ledger contract is not deployed on current network.
    }
  }, [connectedAddress, ledgerContractAddress]);

  useEffect(() => {
    setCreditsBalance(String(user?.walletBalanceTokens ?? '0'));
    setReputationBalance(String(user?.reputationScore ?? '0'));
  }, [user?.walletBalanceTokens, user?.reputationScore]);

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
    const restoreWalletSession = async (): Promise<void> => {
      try {
        const response = await fetch(walletSessionEndpoint, {
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
        // Ignore session restoration failures.
      }
    };
    void restoreWalletSession();
  }, [walletSessionEndpoint]);

  useEffect(() => {
    void loadOnchainBalances();
  }, [loadOnchainBalances]);

  useEffect(() => {
    if (!window.ethereum || !ledgerContractAddress || !connectedAddress) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(ledgerContractAddress, HCN_LEDGER_ABI, provider);
    const targetAddress = connectedAddress.toLowerCase();

    const onStake = (staker: string, amount: bigint, reputationAfter: bigint, event: any) => {
      if (String(staker || '').toLowerCase() !== targetAddress) return;
      appendActivity({
        type: 'stake',
        amount: `-${amount.toString()} REP`,
        detail: 'Reputation staked',
        txHash: String(event?.log?.transactionHash || ''),
      });
      setReputationBalance(reputationAfter.toString());
    };

    const onReward = (
      recipient: string,
      _txid: string,
      amount: bigint,
      reputationPoints: bigint,
      event: any
    ) => {
      if (String(recipient || '').toLowerCase() !== targetAddress) return;
      appendActivity({
        type: 'reward',
        amount: `+${amount.toString()} HCN`,
        detail: `Reward claimed (+${reputationPoints.toString()} REP)`,
        txHash: String(event?.log?.transactionHash || ''),
      });
      void loadOnchainBalances();
    };

    contract.on('ReputationStaked', onStake);
    contract.on('RewardsClaimed', onReward);
    return () => {
      contract.off('ReputationStaked', onStake);
      contract.off('RewardsClaimed', onReward);
    };
  }, [appendActivity, connectedAddress, ledgerContractAddress, loadOnchainBalances]);

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
      setToast('No wallet detected. Install MetaMask or another EVM wallet.');
      return false;
    }
    return true;
  };

  const connectWallet = async (): Promise<void> => {
    if (!requireEthereum()) return;
    setBusyAction('connect');
    setToast('');

    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = normalizeAddress(accounts?.[0]);
      if (!address) throw new Error('No account returned by wallet');

      const chainHex = String(await window.ethereum.request({ method: 'eth_chainId' }));
      const nextChainId = parseInt(chainHex, 16) || DEFAULT_CHAIN_ID;

      setConnectedAddress(address);
      setChainId(nextChainId);
      setDid(toDidPkh(nextChainId, address));
      setVerifyStatus('connected');
      setVerifiedAt('');
      setToast('Wallet connected');

      if (nextChainId !== configuredChainId) {
        setToast(
          `Wallet connected on chain ${nextChainId}. Expected ${configuredChainId} for HCN contracts.`
        );
      }
    } catch (error: any) {
      setVerifyStatus('error');
      setToast(error?.message || 'Wallet connection failed');
    } finally {
      setBusyAction(null);
    }
  };

  const disconnectLocal = async (): Promise<void> => {
    setConnectedAddress('');
    setChainId(0);
    setDid('');
    setVerifyStatus('unverified');
    setVerifiedAt('');
    localStorage.removeItem(LS_KEY);
    try {
      await fetch(walletLogoutEndpoint, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore logout errors.
    }
    setToast('Disconnected');
  };

  const verifyWallet = async (): Promise<void> => {
    if (!requireEthereum()) return;
    if (!connectedAddress) {
      await connectWallet();
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
          did: walletDID,
        }),
      });
      const challengeData = await challengeResp.json().catch(() => ({}));
      if (!challengeResp.ok) {
        throw new Error(challengeData?.error || 'Wallet challenge request failed');
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
          did: walletDID,
          requestId: challenge.requestId,
        }),
      });
      const verifyData = await verifyResp.json().catch(() => ({}));
      if (!verifyResp.ok) {
        throw new Error(verifyData?.error || 'Wallet verification failed');
      }

      const session = verifyData?.session || {};
      setDid(String(session.did || walletDID));
      setVerifyStatus('verified');
      setVerifiedAt(new Date().toLocaleString());
      setToast('Wallet verified');
    } catch (error: any) {
      setVerifyStatus('error');
      setToast(error?.message || 'Verification failed');
    } finally {
      setBusyAction(null);
    }
  };

  const withLedgerSigner = async (): Promise<{
    signer: ethers.Signer;
    signerAddress: string;
    contract: ethers.Contract;
  }> => {
    if (!window.ethereum) {
      throw new Error('Wallet provider unavailable');
    }
    if (!ledgerContractAddress) {
      throw new Error('HCN credits contract address is not configured');
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = normalizeAddress(await signer.getAddress());
    if (!signerAddress) {
      throw new Error('Unable to read signer address');
    }
    const contract = new ethers.Contract(ledgerContractAddress, HCN_LEDGER_ABI, signer);
    return { signer, signerAddress, contract };
  };

  const stakeReputation = async (): Promise<void> => {
    if (!connectedAddress) {
      setToast('Connect and verify wallet first');
      return;
    }
    setBusyAction('stake');
    setToast('');
    try {
      const { signerAddress, contract } = await withLedgerSigner();
      if (signerAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
        throw new Error('Connected address differs from active signer');
      }
      const tx = await contract.stakeReputation(DEFAULT_STAKE_AMOUNT);
      setToast(`Stake submitted: ${tx.hash.slice(0, 10)}...`);
      const receipt = await tx.wait();
      appendActivity({
        type: 'stake',
        amount: `-${DEFAULT_STAKE_AMOUNT.toString()} REP`,
        detail: 'Node reputation stake confirmed',
        txHash: String(receipt?.hash || tx.hash || ''),
      });
      await loadOnchainBalances();
    } catch (error: any) {
      setToast(error?.message || 'Stake transaction failed');
    } finally {
      setBusyAction(null);
    }
  };

  const claimRewards = async (): Promise<void> => {
    if (!connectedAddress) {
      setToast('Connect and verify wallet first');
      return;
    }
    setBusyAction('claim');
    setToast('');
    try {
      const proofId = `frontend-${Date.now().toString(10)}`;
      const rewardResp = await fetch(walletRewardSignEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          walletAddress: connectedAddress,
          activityType: DEFAULT_REWARD_ACTIVITY,
          proofId,
        }),
      });
      const rewardData = await rewardResp.json().catch(() => ({}));
      if (!rewardResp.ok) {
        throw new Error(rewardData?.error || 'Failed to obtain backend reward signature');
      }
      const reward = rewardData?.reward || {};
      if (!reward?.signature || !reward?.txid) {
        throw new Error('Reward signature response is missing required fields');
      }

      const { signerAddress, contract } = await withLedgerSigner();
      if (signerAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
        throw new Error('Connected address differs from active signer');
      }
      const tx = await contract.claimRewards(
        reward.txid,
        BigInt(String(reward.amount || '0')),
        BigInt(String(reward.reputationPoints || '0')),
        String(reward.signature)
      );
      setToast(`Claim submitted: ${tx.hash.slice(0, 10)}...`);
      const receipt = await tx.wait();
      appendActivity({
        type: 'reward',
        amount: `+${String(reward.amount || '0')} HCN`,
        detail: `Claimed ${DEFAULT_REWARD_ACTIVITY} reward`,
        txHash: String(receipt?.hash || tx.hash || ''),
      });
      await loadOnchainBalances();
    } catch (error: any) {
      setToast(error?.message || 'Reward claim failed');
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
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-none">Sovereign Vault</h2>
              <p className="text-[10px] text-teal-400 mt-1 uppercase tracking-widest font-bold">
                Encrypted Node Access
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

        {toast && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] text-slate-200 uppercase tracking-wider">
            {toast}
          </div>
        )}

        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              Hybrid Architecture
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
              Sensitive profile data stays off-chain. Wallet DID and reputation claims are anchored
              on-chain with backend-signed verification.
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
                Identity Identifier (DID)
              </label>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group/did">
              <span className="font-mono text-xs text-slate-300 truncate mr-2">{walletDID}</span>
              <button
                className="text-slate-500 hover:text-blue-400 transition-colors"
                onClick={() => copyText(walletDID)}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Wallet Address
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
                Wallet Session Cookie Enabled
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={connectedAddress ? () => void disconnectLocal() : () => void connectWallet()}
                disabled={busyAction !== null}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest"
              >
                {connectedAddress
                  ? 'Disconnect'
                  : busyAction === 'connect'
                  ? 'Connecting...'
                  : 'Connect'}
              </button>

              <button
                onClick={() => void verifyWallet()}
                disabled={busyAction !== null || !connectedAddress}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-[11px] transition-all uppercase tracking-widest"
              >
                {busyAction === 'verify' ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5 rounded-3xl border-t border-blue-500/30">
            <Coins className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{creditsBalance}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">HCN Credits</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border-t border-teal-500/30">
            <Zap className="w-5 h-5 text-teal-400 mb-2" />
            <p className="text-2xl font-bold text-white">{reputationBalance}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Reputation</p>
          </div>
        </section>

        <div className="mb-8 p-4 bg-blue-500/5 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              Data Autonomy Note
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed italic">
            Signatures are generated by your wallet. Backend reward signatures authorize claim mint
            operations, and all sensitive payloads can be encrypted locally in the Sovereign Vault.
          </p>
        </div>

        <section className="space-y-4 mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" /> Network Participation
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => void stakeReputation()}
              disabled={busyAction !== null || !connectedAddress}
              className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">
                  {busyAction === 'stake' ? 'Staking...' : 'Stake Reputation'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => void claimRewards()}
              disabled={busyAction !== null || !connectedAddress}
              className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <ArrowDownLeft className="w-5 h-5 text-teal-400" />
                <span className="text-sm font-medium">
                  {busyAction === 'claim' ? 'Claiming...' : 'Claim Knowledge Rewards'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        <section className="flex-1 flex flex-col min-h-[200px]">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
            <History className="w-3 h-3" /> Ledger Activity
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {activities.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl"
              >
                <div>
                  <p className="text-sm font-bold text-white">{tx.detail}</p>
                  <p className="text-[10px] text-slate-500">{tx.date}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-mono font-bold ${
                      tx.type === 'reward' ? 'text-green-400' : 'text-blue-400'
                    }`}
                  >
                    {tx.amount}
                  </p>
                  {tx.txHash ? (
                    <button
                      className="text-[10px] text-blue-400/60 hover:text-blue-300 flex items-center gap-1 justify-end mt-1"
                      onClick={() => copyText(tx.txHash || '')}
                    >
                      TXID <ExternalLink className="w-2 h-2" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-white/10 shrink-0">
          <button
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={connectedAddress ? () => void verifyWallet() : () => void connectWallet()}
            disabled={busyAction !== null}
          >
            Bridge External Wallet
          </button>
          <p className="text-[10px] text-center text-slate-500 mt-4 italic uppercase tracking-tighter">
            HCN Node Protocol v1.0 hybrid session mode
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletPopout;
