import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { ethers } from 'ethers';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import { localStore } from '../services/persistenceStore';
import { recordAuditEvent } from '../services/auditTelemetry';

const router = Router();
const protectedRouter = Router();
protectedRouter.use(requireCanonicalIdentity);

type DidPkh = { chainId: number; address: string };

type IntegrityRecord = {
  profileIntegrityHash: string;
  contentCid: string;
  verificationRecord: string;
  securityAnchorTimestamp: string;
  addressBinding: string;
};

type AnchorTechnicalRecord = {
  transactionHash: string;
  anchorBlockNumber: number | null;
  contractAddress: string;
  chainId: number;
  ipfsGatewayUrl: string;
};

type EncryptedIntegrityPayload = {
  version: 'hcn-integrity-v1';
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  cipherText: string;
  encryptedAt: string;
};

const PROFILE_ANCHOR_ABI = [
  'function anchorProfileIntegrity(address account,string cid,bytes32 profileHash) external',
  'function profileCidOf(address account) external view returns (string)',
  'function profileHashOf(address account) external view returns (bytes32)',
  'function profileUpdatedAtOf(address account) external view returns (uint256)',
] as const;

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs';
const DEFAULT_PINATA_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const DEFAULT_INFURA_URL = 'https://ipfs.infura.io:5001/api/v0/add?pin=true';

const parseDidPkh = (did: string): DidPkh | null => {
  const match = /^did:pkh:eip155:(\d+):(0x[a-f0-9]{40})$/i.exec(String(did || '').trim());
  if (!match) return null;
  const parsedChainId = Number(match[1]);
  if (!Number.isFinite(parsedChainId) || parsedChainId <= 0) return null;
  try {
    return {
      chainId: Math.floor(parsedChainId),
      address: ethers.getAddress(match[2]),
    };
  } catch {
    return null;
  }
};

const resolveGatewayBase = (): string => {
  const configured = String(process.env.IPFS_GATEWAY || '').trim().replace(/\/+$/, '');
  if (!configured) return DEFAULT_IPFS_GATEWAY;
  if (/^https?:\/\//i.test(configured)) return configured;
  return `https://${configured}`;
};

const toGatewayUrl = (cid: string): string => `${resolveGatewayBase()}/${encodeURIComponent(cid)}`;

const resolveUploadProvider = (): 'pinata' | 'infura' | 'custom' => {
  const raw = String(process.env.IPFS_UPLOAD_PROVIDER || '')
    .trim()
    .toLowerCase();
  if (raw === 'infura') return 'infura';
  if (raw === 'custom') return 'custom';
  return 'pinata';
};

const ensureCid = (value: unknown): string => {
  const cid = String(value || '').trim();
  if (!cid) throw new Error('IPFS upload did not return a CID');
  return cid;
};

const parseJsonSafely = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const parseInfuraResponseCid = (raw: string): string | null => {
  const normalized = String(raw || '').trim();
  if (!normalized) return null;
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = parseJsonSafely(lines[i]);
    const cid = String(parsed?.Hash || '').trim();
    if (cid) return cid;
  }

  const fallback = parseJsonSafely(normalized);
  return String(fallback?.Hash || '').trim() || null;
};

const uploadViaPinata = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String(process.env.PINATA_PIN_JSON_URL || '').trim().replace(/\/+$/, '');
  const url = endpoint || DEFAULT_PINATA_URL;
  const jwt = String(process.env.PINATA_JWT || '').trim();
  if (!jwt) {
    throw new Error('PINATA_JWT is required for server-side IPFS uploads');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataMetadata: { name: fileName },
      pinataContent: payload,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((data as any)?.error || (data as any)?.message || 'Pinata upload failed'));
  }

  return ensureCid((data as any)?.IpfsHash);
};

const uploadViaInfura = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String(process.env.INFURA_ADD_URL || '').trim().replace(/\/+$/, '');
  const url = endpoint || DEFAULT_INFURA_URL;
  const projectId = String(process.env.INFURA_PROJECT_ID || '').trim();
  const projectSecret = String(process.env.INFURA_PROJECT_SECRET || '').trim();
  if (!projectId || !projectSecret) {
    throw new Error('INFURA_PROJECT_ID and INFURA_PROJECT_SECRET are required for server-side IPFS uploads');
  }

  const payloadBlob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('file', payloadBlob, `${fileName}.json`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString('base64')}`,
    },
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || 'Infura upload failed');
  }

  const cid = parseInfuraResponseCid(text);
  return ensureCid(cid);
};

const uploadViaCustomEndpoint = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String(process.env.IPFS_PIN_JSON_URL || '').trim();
  if (!endpoint) {
    throw new Error('IPFS_PIN_JSON_URL is required for custom server-side IPFS uploads');
  }

  const authToken = String(process.env.IPFS_PIN_JSON_TOKEN || '').trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      fileName,
      payload,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((data as any)?.error || (data as any)?.message || 'Custom IPFS upload failed'));
  }

  return ensureCid((data as any)?.cid || (data as any)?.hash || (data as any)?.IpfsHash);
};

const uploadEncryptedPayloadToIpfs = async (
  payload: unknown,
  fileName: string
): Promise<{ cid: string; gatewayUrl: string }> => {
  const provider = resolveUploadProvider();
  let cid = '';
  if (provider === 'infura') {
    cid = await uploadViaInfura(payload, fileName);
  } else if (provider === 'custom') {
    cid = await uploadViaCustomEndpoint(payload, fileName);
  } else {
    cid = await uploadViaPinata(payload, fileName);
  }

  return {
    cid,
    gatewayUrl: toGatewayUrl(cid),
  };
};

const ensureEncryptionKey = (): Buffer => {
  const raw = String(process.env.SENSITIVE_DATA_KEY || '').trim();
  if (!raw) {
    throw new Error('SENSITIVE_DATA_KEY is required to encrypt integrity payloads');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
};

const encryptPayload = (payload: unknown): EncryptedIntegrityPayload => {
  const key = ensureEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plainBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const cipherText = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 'hcn-integrity-v1',
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipherText: cipherText.toString('base64'),
    encryptedAt: new Date().toISOString(),
  };
};

const toProfileIntegrityHash = (payload: unknown): string => {
  const serialized = JSON.stringify(payload);
  return `0x${crypto.createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
};

const resolveAnchorRpcUrl = (): string => {
  const value =
    process.env.INTEGRITY_ANCHOR_RPC_URL ||
    process.env.DEPLOY_RPC_URL ||
    process.env.RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.ETH_RPC_URL ||
    '';
  return String(value).trim();
};

const resolveAnchorPrivateKey = (): string => {
  const value =
    process.env.INTEGRITY_ANCHOR_PRIVATE_KEY ||
    process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    '';
  return String(value).trim();
};

const normalizePrivateKey = (value: string): string => {
  const raw = String(value || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('INTEGRITY_ANCHOR_PRIVATE_KEY must be a 0x-prefixed 32-byte hex value');
  }
  return raw;
};

const normalizeAddress = (value: unknown, fieldLabel: string): string => {
  try {
    return ethers.getAddress(String(value || '').trim());
  } catch {
    throw new Error(`${fieldLabel} is missing or invalid`);
  }
};

const toIsoFromUnixSeconds = (seconds: bigint): string =>
  new Date(Number(seconds) * 1000).toISOString();

const anchorIntegrityRecord = async (
  accountAddress: string,
  cid: string,
  profileHash: string
): Promise<{
  securityAnchorTimestamp: string;
  technical: Omit<AnchorTechnicalRecord, 'ipfsGatewayUrl'>;
}> => {
  const rpcUrl = resolveAnchorRpcUrl();
  if (!rpcUrl) {
    throw new Error('INTEGRITY_ANCHOR_RPC_URL is required to anchor integrity records');
  }

  const privateKey = normalizePrivateKey(resolveAnchorPrivateKey());
  const contractAddress = normalizeAddress(
    process.env.HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS,
    'HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS'
  );
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const configuredChainRaw = Number(process.env.HCN_PROFILE_ANCHOR_CHAIN_ID || '');
  if (
    Number.isFinite(configuredChainRaw) &&
    configuredChainRaw > 0 &&
    Math.floor(configuredChainRaw) !== chainId
  ) {
    throw new Error(
      `Anchor chain mismatch. Connected chain ${chainId}, configured ${Math.floor(configuredChainRaw)}`
    );
  }

  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, PROFILE_ANCHOR_ABI, signer);

  const tx = await contract.anchorProfileIntegrity(accountAddress, cid, profileHash);
  const receipt = await tx.wait();
  const updatedAt = (await contract.profileUpdatedAtOf(accountAddress)) as bigint;

  return {
    securityAnchorTimestamp: toIsoFromUnixSeconds(updatedAt),
    technical: {
      transactionHash: String(receipt?.hash || tx.hash || ''),
      anchorBlockNumber:
        typeof receipt?.blockNumber === 'number' ? Number(receipt.blockNumber) : null,
      contractAddress,
      chainId,
    },
  };
};

const fetchAnchorRecord = async (
  accountAddress: string
): Promise<{
  cid: string;
  profileIntegrityHash: string;
  securityAnchorTimestamp: string;
  technical: Omit<AnchorTechnicalRecord, 'ipfsGatewayUrl' | 'transactionHash' | 'anchorBlockNumber'>;
} | null> => {
  const rpcUrl = resolveAnchorRpcUrl();
  if (!rpcUrl) {
    throw new Error('INTEGRITY_ANCHOR_RPC_URL is required to read integrity records');
  }

  const contractAddress = normalizeAddress(
    process.env.HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS,
    'HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS'
  );
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const contract = new ethers.Contract(contractAddress, PROFILE_ANCHOR_ABI, provider);
  const [cidRaw, profileHashRaw, updatedAtRaw] = await Promise.all([
    contract.profileCidOf(accountAddress),
    contract.profileHashOf(accountAddress),
    contract.profileUpdatedAtOf(accountAddress),
  ]);

  const cid = String(cidRaw || '').trim();
  const profileIntegrityHash = String(profileHashRaw || '').trim().toLowerCase();
  const updatedAt = BigInt(updatedAtRaw || 0);
  if (!cid || updatedAt === 0n) return null;

  return {
    cid,
    profileIntegrityHash,
    securityAnchorTimestamp: toIsoFromUnixSeconds(updatedAt),
    technical: {
      contractAddress,
      chainId,
    },
  };
};

const buildVerificationRecord = (
  userId: string,
  profileIntegrityHash: string,
  cid: string,
  securityAnchorTimestamp: string
): string => {
  const recordSeed = `${userId}:${profileIntegrityHash}:${cid}:${securityAnchorTimestamp}`;
  const shortHash = crypto.createHash('sha256').update(recordSeed, 'utf8').digest('hex').slice(0, 16);
  return `verify_${shortHash}`;
};

const isDebugRequested = (req: Request): boolean => {
  const debugFlag = String(req.query.debug || '').trim().toLowerCase();
  return debugFlag === '1' || debugFlag === 'true' || debugFlag === 'yes';
};

protectedRouter.post('/profile/verify', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await localStore.getUserById(authUserId);
  const did = String(user?.walletDid || '').trim();
  const didPkh = parseDidPkh(did);
  if (!user || !didPkh) {
    res.status(400).json({ error: 'A verified address binding is required before integrity anchoring' });
    return;
  }

  const profilePayload = req.body?.profilePayload;
  if (!profilePayload || typeof profilePayload !== 'object' || Array.isArray(profilePayload)) {
    res.status(400).json({ error: 'profilePayload object is required' });
    return;
  }

  try {
    const capturedAt = new Date().toISOString();
    const integrityPayload = {
      schema: 'hcn.profile.integrity.v1',
      userId: authUserId,
      did,
      addressBinding: didPkh.address,
      capturedAt,
      profile: profilePayload,
    };
    const profileIntegrityHash = toProfileIntegrityHash(integrityPayload);
    const encryptedPayload = encryptPayload({
      profileIntegrityHash,
      integrityPayload,
    });

    const ipfsUpload = await uploadEncryptedPayloadToIpfs(encryptedPayload, `hcn-profile-integrity-${authUserId}-${Date.now().toString(10)}`);
    const anchor = await anchorIntegrityRecord(
      didPkh.address,
      ipfsUpload.cid,
      profileIntegrityHash
    );
    const verificationRecord = buildVerificationRecord(
      authUserId,
      profileIntegrityHash,
      ipfsUpload.cid,
      anchor.securityAnchorTimestamp
    );

    const record: IntegrityRecord = {
      profileIntegrityHash,
      contentCid: ipfsUpload.cid,
      verificationRecord,
      securityAnchorTimestamp: anchor.securityAnchorTimestamp,
      addressBinding: didPkh.address,
    };

    recordAuditEvent(req, {
      domain: 'auth',
      action: 'profile_integrity_anchor',
      outcome: 'success',
      actorUserId: authUserId,
      targetUserId: authUserId,
      statusCode: 200,
      metadata: {
        verificationRecord,
        addressBinding: didPkh.address,
      },
    });

    const includeDebug = isDebugRequested(req);
    res.json({
      success: true,
      record,
      ...(includeDebug
        ? {
            technical: {
              ...anchor.technical,
              ipfsGatewayUrl: ipfsUpload.gatewayUrl,
            } satisfies AnchorTechnicalRecord,
          }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile integrity verification failed';
    res.status(500).json({ error: message });
  }
});

protectedRouter.get('/profile/record', async (req: Request, res: Response): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await localStore.getUserById(authUserId);
  const did = String(user?.walletDid || '').trim();
  const didPkh = parseDidPkh(did);
  if (!user || !didPkh) {
    res.status(400).json({ error: 'A verified address binding is required before integrity anchoring' });
    return;
  }

  try {
    const onchainRecord = await fetchAnchorRecord(didPkh.address);
    if (!onchainRecord) {
      res.status(404).json({ error: 'No integrity record found for this address binding' });
      return;
    }

    const record: IntegrityRecord = {
      profileIntegrityHash: onchainRecord.profileIntegrityHash,
      contentCid: onchainRecord.cid,
      verificationRecord: buildVerificationRecord(
        authUserId,
        onchainRecord.profileIntegrityHash,
        onchainRecord.cid,
        onchainRecord.securityAnchorTimestamp
      ),
      securityAnchorTimestamp: onchainRecord.securityAnchorTimestamp,
      addressBinding: didPkh.address,
    };

    const includeDebug = isDebugRequested(req);
    res.json({
      success: true,
      record,
      ...(includeDebug
        ? {
            technical: {
              ...onchainRecord.technical,
              transactionHash: '',
              anchorBlockNumber: null,
              ipfsGatewayUrl: toGatewayUrl(onchainRecord.cid),
            } satisfies AnchorTechnicalRecord,
          }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read integrity record';
    res.status(500).json({ error: message });
  }
});

router.use(protectedRouter);

export default router;
