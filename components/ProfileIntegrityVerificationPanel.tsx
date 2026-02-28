import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { buildAuthHeaders } from '../services/sessionService';
import { UserProfile } from '../types';

type IntegrityRecord = {
  profileIntegrityHash: string;
  contentCid: string;
  verificationRecord: string;
  securityAnchorTimestamp: string;
  addressBinding: string;
};

type TechnicalRecord = {
  transactionHash?: string;
  anchorBlockNumber?: number | null;
  contractAddress?: string;
  chainId?: number;
  ipfsGatewayUrl?: string;
};

type StoredRecord = {
  record: IntegrityRecord;
  technical?: TechnicalRecord;
};

interface ProfileIntegrityVerificationPanelProps {
  user: UserProfile;
  profilePayload: Record<string, unknown>;
}

const toStorageKey = (userId: string): string => `hcn_profile_integrity_record:${userId}`;

const safeParseStoredRecord = (value: string | null): StoredRecord | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredRecord;
    if (!parsed?.record?.verificationRecord) return null;
    return parsed;
  } catch {
    return null;
  }
};

const ProfileIntegrityVerificationPanel: React.FC<ProfileIntegrityVerificationPanelProps> = ({
  user,
  profilePayload,
}) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const [stored, setStored] = useState<StoredRecord | null>(() =>
    safeParseStoredRecord(localStorage.getItem(toStorageKey(user.id)))
  );

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
    String((import.meta as any)?.env?.VITE_PROFILE_INTEGRITY_VERIFY_URL || '/api/integrity/profile/verify')
  );
  const recordEndpoint = toApiUrl(
    String((import.meta as any)?.env?.VITE_PROFILE_INTEGRITY_RECORD_URL || '/api/integrity/profile/record')
  );

  const persistStoredRecord = (value: StoredRecord): void => {
    setStored(value);
    localStorage.setItem(toStorageKey(user.id), JSON.stringify(value));
  };

  const fetchLatestRecord = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(recordEndpoint, {
        method: 'GET',
        headers: buildAuthHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const record = data?.record as IntegrityRecord | undefined;
      if (!record?.verificationRecord) return;
      persistStoredRecord({
        record,
        technical: data?.technical as TechnicalRecord | undefined,
      });
    } catch {
      // Keep component resilient when backend integrity services are unavailable.
    }
  }, [recordEndpoint]);

  useEffect(() => {
    void fetchLatestRecord();
  }, [fetchLatestRecord]);

  const verifyIntegrity = async (): Promise<void> => {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const response = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ profilePayload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.error || 'Profile integrity verification failed'));
      }

      const record = data?.record as IntegrityRecord | undefined;
      if (!record?.verificationRecord) {
        throw new Error('Integrity verification response is missing required fields');
      }
      persistStoredRecord({
        record,
        technical: data?.technical as TechnicalRecord | undefined,
      });
      setStatus('Profile Integrity Verification complete.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Integrity verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-[2.5rem] border border-teal-500/20 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-[0.18em] flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-400" />
            Profile Integrity Verification
          </h4>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Stores encrypted profile integrity metadata off-chain and anchors CID/hash/timestamp
            with your address binding on-chain.
          </p>
        </div>
        <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2">
        <div className="text-slate-400 uppercase tracking-widest">Verification Scope</div>
        <div className="text-slate-300">DID Binding + CID Hash + Security Anchor Timestamp</div>
        <div className="flex items-center gap-2 text-teal-300">
          <Lock className="w-3.5 h-3.5" />
          Encryption is enforced before profile metadata upload.
        </div>
      </div>

      <button
        onClick={() => void verifyIntegrity()}
        disabled={busy}
        className="w-full py-4 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold uppercase tracking-widest transition-all"
      >
        {busy ? 'Verifying Integrity...' : 'Verify Profile Integrity'}
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

      {stored?.record ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2">
          <div className="text-slate-400 uppercase tracking-widest">Verification Record</div>
          <div className="font-mono text-slate-200 break-all">{stored.record.verificationRecord}</div>
          <div className="text-slate-400">
            Security Anchor Timestamp:{' '}
            <span className="text-slate-300">
              {new Date(stored.record.securityAnchorTimestamp).toLocaleString()}
            </span>
          </div>
          <div className="text-slate-400">
            Address Binding:{' '}
            <span className="font-mono text-slate-300 break-all">{stored.record.addressBinding}</span>
          </div>
          <div className="text-slate-400">
            Profile Integrity Hash:{' '}
            <span className="font-mono text-slate-300 break-all">{stored.record.profileIntegrityHash}</span>
          </div>

          <button
            onClick={() => setShowTechnical((prev) => !prev)}
            className="mt-2 text-[11px] text-blue-300 hover:text-blue-200 uppercase tracking-wider"
          >
            {showTechnical ? 'Hide Technical Debug View' : 'Show Technical Debug View'}
          </button>

          {showTechnical ? (
            <div className="mt-3 p-3 bg-black/30 border border-white/10 rounded-xl space-y-2">
              <div className="text-slate-400">
                CID: <span className="font-mono text-slate-300 break-all">{stored.record.contentCid}</span>
              </div>
              {stored.technical?.ipfsGatewayUrl ? (
                <a
                  href={stored.technical.ipfsGatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
                >
                  Open Encrypted IPFS Object <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
              {stored.technical?.transactionHash ? (
                <div className="text-slate-400">
                  Transaction Hash:{' '}
                  <span className="font-mono text-slate-300 break-all">
                    {stored.technical.transactionHash}
                  </span>
                </div>
              ) : null}
              {typeof stored.technical?.anchorBlockNumber === 'number' ? (
                <div className="text-slate-400">
                  Anchor Block: <span className="font-mono text-slate-300">{stored.technical.anchorBlockNumber}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ProfileIntegrityVerificationPanel;
