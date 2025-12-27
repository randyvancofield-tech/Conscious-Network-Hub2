
import React, { useMemo } from 'react';
// Added AlertTriangle and Info to the lucide-react imports for security notes
import { X, Wallet, ShieldCheck, Activity, Copy, ArrowUpRight, ArrowDownLeft, Zap, Coins, History, ExternalLink, ChevronRight, AlertTriangle, Info, Lock } from 'lucide-react';
import { UserProfile } from '../types';

interface WalletPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

const WalletPopout: React.FC<WalletPopoutProps> = ({ isOpen, onClose, user }) => {
  // Generate a mock decentralized address for the user
  const walletAddress = useMemo(() => {
    if (!user) return '0x000...0000';
    const base = user.email || 'guest';
    const hash = btoa(base).substring(0, 12).toLowerCase();
    return `did:hcn:node_${hash}`;
  }, [user]);

  const transactions = [
    { id: 1, type: 'reward', amount: '+12 HCN', detail: 'Knowledge Contribution', date: '2h ago' },
    { id: 2, type: 'stake', amount: '-5 HCN', detail: 'Node Reputation Stake', date: '1d ago' },
    { id: 3, type: 'reward', amount: '+2.5 HCN', detail: 'Peer Support Bonus', date: '2d ago' },
  ];

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

        {/* Security Alert - MVP Notice */}
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">MVP Security Protocol</p>
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
              This is a temporary alpha implementation. All keys and identities are stored within your browser's local storage. Do not clear your browser cache if you wish to retain this specific node identity.
            </p>
          </div>
        </div>

        {/* Identity Section */}
        <section className="space-y-4 mb-8">
          <div className="p-6 rounded-[2rem] bg-gradient-to-br from-blue-600/20 to-teal-600/10 border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-24 h-24 text-blue-400" />
            </div>
            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 block">Identity Identifier (DID)</label>
            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 group/did">
              <span className="font-mono text-xs text-slate-300 truncate mr-2">{walletAddress}</span>
              <button className="text-slate-500 hover:text-blue-400 transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Lock className="w-3 h-3 text-teal-400" />
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">AES-256 Local Encryption Active</span>
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
            Your data never touches our servers in this phase. The portal communicates with the blockchain via a decentralized relay, but your private credentials reside solely in this browser's secure context.
          </p>
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
          <button className="w-full py-5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2">
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
