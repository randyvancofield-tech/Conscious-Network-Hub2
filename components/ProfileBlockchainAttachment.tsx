import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { ExternalLink, Link2, Lock, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { toIpfsGatewayUrl, uploadJsonToIpfs } from '../services/ipfsUploadService';
import { encryptWithWalletSignature, requestVaultSignature } from '../services/sovereignVault';

type AnchoredProfileRecord = {
  cid: string;
  txHash: string;
  gatewayUrl: string;
  attachedAt: string;
  encrypted: boolean;
  walletAddress: string;
};

interface ProfileBlockchainAttachmentProps {
  user: UserProfile;
  profilePayload: Record<string, unknown>;
}

const PROFILE_ANCHOR_ABI = [
  'event ProfileCidAttached(address indexed account,string cid)',
  'function attachProfileCid(string cid) external',
  'function profileCidOf(address account) external view returns (string)',
] as const;

declare global {
  interface Window {
    ethereum?: any;
  }
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

const toPositiveChainId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const toStorageKey = (userId: string): string => `hcn_profile_anchor:${userId}`;

const loadStoredAnchor = (userId: string): AnchoredProfileRecord | null => {
  try {
    const raw = localStorage.getItem(toStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnchoredProfileRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.cid || !parsed.gatewayUrl) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistAnchor = (userId: string, value: AnchoredProfileRecord): void => {
  localStorage.setItem(toStorageKey(userId), JSON.stringify(value));
};

const ProfileBlockchainAttachment: React.FC<ProfileBlockchainAttachmentProps> = ({
  user,
  profilePayload,
}) => {
  const configuredChainId = toPositiveChainId(
    (import.meta as any)?.env?.VITE_BLOCKCHAIN_NETWORK_ID
  );
  const anchorContractAddressRaw = String(
    (import.meta as any)?.env?.VITE_HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS ||
      (import.meta as any)?.env?.VITE_PROFILE_ANCHOR_CONTRACT_ADDRESS ||
      ''
  ).trim();
  const anchorContractAddress = normalizeAddress(anchorContractAddressRaw);

  const [busy, setBusy] = useState(false);
  const [encryptBeforeUpload, setEncryptBeforeUpload] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [anchored, setAnchored] = useState<AnchoredProfileRecord | null>(() =>
    loadStoredAnchor(user.id)
  );

  const canAnchor = Boolean(anchorContractAddress);

  const blockchainPayload = useMemo(
    () => ({
      schema: 'hcn.profile.v1',
      userId: user.id,
      walletDid: user.walletDid || null,
      capturedAt: new Date().toISOString(),
      profile: profilePayload,
    }),
    [profilePayload, user.id, user.walletDid]
  );

  const loadOnchainCid = useCallback(async (): Promise<void> => {
    if (!window.ethereum || !anchorContractAddress) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send('eth_accounts', []);
      const address = normalizeAddress(accounts?.[0]);
      if (!address) return;
      setWalletAddress(address);

      const contract = new ethers.Contract(anchorContractAddress, PROFILE_ANCHOR_ABI, provider);
      const onchainCid = String(await contract.profileCidOf(address)).trim();
      if (!onchainCid) return;

      const previous = loadStoredAnchor(user.id);
      const nextRecord: AnchoredProfileRecord = {
        cid: onchainCid,
        txHash: previous?.txHash || '',
        gatewayUrl: toIpfsGatewayUrl(onchainCid),
        attachedAt: previous?.attachedAt || new Date().toISOString(),
        encrypted: previous?.encrypted ?? true,
        walletAddress: address,
      };
      persistAnchor(user.id, nextRecord);
      setAnchored(nextRecord);
    } catch {
      // Keep profile page resilient if contract/provider is unavailable.
    }
  }, [anchorContractAddress, user.id]);

  useEffect(() => {
    void loadOnchainCid();
  }, [loadOnchainCid]);

  useEffect(() => {
    if (!window.ethereum || !anchorContractAddress || !walletAddress) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(anchorContractAddress, PROFILE_ANCHOR_ABI, provider);
    const targetWallet = walletAddress.toLowerCase();

    const onProfileCidAttached = (account: string, cid: string, event: any) => {
      if (String(account || '').toLowerCase() !== targetWallet) return;
      const nextRecord: AnchoredProfileRecord = {
        cid: String(cid || '').trim(),
        txHash: String(event?.log?.transactionHash || ''),
        gatewayUrl: toIpfsGatewayUrl(cid),
        attachedAt: new Date().toISOString(),
        encrypted: encryptBeforeUpload,
        walletAddress,
      };
      persistAnchor(user.id, nextRecord);
      setAnchored(nextRecord);
    };

    contract.on('ProfileCidAttached', onProfileCidAttached);
    return () => {
      contract.off('ProfileCidAttached', onProfileCidAttached);
    };
  }, [anchorContractAddress, encryptBeforeUpload, user.id, walletAddress]);

  const attachProfile = async (): Promise<void> => {
    if (!window.ethereum) {
      setError('No EVM wallet detected in this browser session');
      return;
    }
    if (!anchorContractAddress) {
      setError('Profile anchor contract address is not configured');
      return;
    }

    setBusy(true);
    setStatus('');
    setError('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send('eth_requestAccounts', []);
      const activeAddress = normalizeAddress(accounts?.[0]);
      if (!activeAddress) {
        throw new Error('Wallet account is not available');
      }
      setWalletAddress(activeAddress);

      const network = await provider.getNetwork();
      const activeChainId = Number(network.chainId);
      if (configuredChainId && activeChainId !== configuredChainId) {
        throw new Error(
          `Wallet is connected to chain ${activeChainId}. Expected chain ${configuredChainId}.`
        );
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(anchorContractAddress, PROFILE_ANCHOR_ABI, signer);

      setStatus('Uploading profile metadata to decentralized storage...');
      let payloadForStorage: unknown = blockchainPayload;
      if (encryptBeforeUpload) {
        const signature = await requestVaultSignature(activeAddress);
        payloadForStorage = await encryptWithWalletSignature(blockchainPayload, signature);
      }

      const upload = await uploadJsonToIpfs(payloadForStorage, {
        fileName: `hcn-profile-${user.id}-${Date.now().toString(10)}`,
      });
      setStatus(`CID ${upload.cid} created. Broadcasting on-chain attachment...`);

      const tx = await contract.attachProfileCid(upload.cid);
      const receipt = await tx.wait();

      const nextRecord: AnchoredProfileRecord = {
        cid: upload.cid,
        txHash: String(receipt?.hash || tx.hash || ''),
        gatewayUrl: upload.gatewayUrl,
        attachedAt: new Date().toISOString(),
        encrypted: encryptBeforeUpload,
        walletAddress: activeAddress,
      };
      persistAnchor(user.id, nextRecord);
      setAnchored(nextRecord);
      setStatus('Profile successfully attached to blockchain.');
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'Profile attachment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-[2.5rem] border border-teal-500/20 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-[0.18em] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-teal-400" />
            Profile to Blockchain
          </h4>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Upload your profile metadata JSON to IPFS and anchor only the CID hash on-chain.
          </p>
        </div>
        <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="text-slate-500 uppercase tracking-widest mb-1">Network</div>
          <div className="text-slate-200 font-mono">
            {configuredChainId ? `Chain ${configuredChainId}` : 'Not Configured'}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="text-slate-500 uppercase tracking-widest mb-1">Anchor Contract</div>
          <div className="text-slate-200 font-mono truncate">
            {anchorContractAddress || 'Not Configured'}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={encryptBeforeUpload}
          onChange={(event) => setEncryptBeforeUpload(event.target.checked)}
          className="accent-teal-500"
        />
        <Lock className="w-4 h-4 text-teal-400" />
        Encrypt metadata locally with wallet signature before IPFS upload
      </label>

      <button
        onClick={() => void attachProfile()}
        disabled={busy || !canAnchor}
        className="w-full py-4 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold uppercase tracking-widest transition-all"
      >
        {busy ? 'Anchoring Profile...' : 'Attach Profile to Blockchain'}
      </button>

      {status ? (
        <div className="text-xs text-teal-300 bg-teal-500/10 border border-teal-500/30 rounded-xl p-3">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          {error}
        </div>
      ) : null}

      {anchored ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2">
          <div className="text-slate-400 uppercase tracking-widest">Latest CID</div>
          <div className="font-mono text-slate-200 break-all">{anchored.cid}</div>
          <div className="text-slate-400">
            Wallet: <span className="font-mono text-slate-300">{anchored.walletAddress}</span>
          </div>
          <div className="text-slate-400">
            Encrypted Payload: <span className="text-slate-300">{anchored.encrypted ? 'Yes' : 'No'}</span>
          </div>
          <div className="text-slate-500">Anchored: {new Date(anchored.attachedAt).toLocaleString()}</div>
          <div className="flex flex-wrap gap-4 text-[11px]">
            <a
              href={anchored.gatewayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
            >
              Open IPFS Payload <ExternalLink className="w-3 h-3" />
            </a>
            {anchored.txHash ? (
              <span className="font-mono text-slate-400 truncate">TX: {anchored.txHash}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProfileBlockchainAttachment;
