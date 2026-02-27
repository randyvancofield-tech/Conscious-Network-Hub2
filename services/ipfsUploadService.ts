export type IpfsUploadProvider = 'pinata' | 'infura' | 'custom';

export interface IpfsUploadResult {
  cid: string;
  ipfsUrl: string;
  gatewayUrl: string;
  provider: IpfsUploadProvider;
}

interface UploadJsonToIpfsOptions {
  fileName?: string;
}

const DEFAULT_GATEWAY_BASE = 'https://ipfs.io/ipfs';
const DEFAULT_PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const DEFAULT_INFURA_ADD_URL = 'https://ipfs.infura.io:5001/api/v0/add?pin=true';

const resolveUploadProvider = (): IpfsUploadProvider => {
  const raw = String((import.meta as any)?.env?.VITE_IPFS_UPLOAD_PROVIDER || '')
    .trim()
    .toLowerCase();
  if (raw === 'infura') return 'infura';
  if (raw === 'custom') return 'custom';
  return 'pinata';
};

const resolveGatewayBase = (): string => {
  const configured = String((import.meta as any)?.env?.VITE_IPFS_GATEWAY || '')
    .trim()
    .replace(/\/+$/, '');
  if (!configured) return DEFAULT_GATEWAY_BASE;
  if (/^https?:\/\//i.test(configured)) return configured;
  return `https://${configured}`;
};

const ensureCid = (value: unknown, provider: IpfsUploadProvider): string => {
  const cid = String(value || '').trim();
  if (!cid) {
    throw new Error(`IPFS upload did not return a CID (${provider})`);
  }
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

const uploadJsonViaPinata = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String((import.meta as any)?.env?.VITE_PINATA_PIN_JSON_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const url = endpoint || DEFAULT_PINATA_PIN_URL;
  const jwt = String((import.meta as any)?.env?.VITE_PINATA_JWT || '').trim();
  if (!jwt) {
    throw new Error('VITE_PINATA_JWT is required for Pinata IPFS uploads');
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
  return ensureCid((data as any)?.IpfsHash, 'pinata');
};

const uploadJsonViaInfura = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String((import.meta as any)?.env?.VITE_INFURA_ADD_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const url = endpoint || DEFAULT_INFURA_ADD_URL;

  const projectId = String((import.meta as any)?.env?.VITE_INFURA_PROJECT_ID || '').trim();
  const projectSecret = String((import.meta as any)?.env?.VITE_INFURA_PROJECT_SECRET || '').trim();
  if (!projectId || !projectSecret) {
    throw new Error('VITE_INFURA_PROJECT_ID and VITE_INFURA_PROJECT_SECRET are required for Infura IPFS uploads');
  }

  const payloadBlob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('file', payloadBlob, `${fileName}.json`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${projectId}:${projectSecret}`)}`,
    },
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || 'Infura upload failed');
  }
  const cid = parseInfuraResponseCid(text);
  return ensureCid(cid, 'infura');
};

const uploadJsonViaCustomEndpoint = async (payload: unknown, fileName: string): Promise<string> => {
  const endpoint = String((import.meta as any)?.env?.VITE_IPFS_PIN_JSON_URL || '').trim();
  if (!endpoint) {
    throw new Error('VITE_IPFS_PIN_JSON_URL is required for custom IPFS uploads');
  }

  const token = String((import.meta as any)?.env?.VITE_IPFS_PIN_JSON_TOKEN || '').trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  return ensureCid((data as any)?.cid || (data as any)?.hash || (data as any)?.IpfsHash, 'custom');
};

export const toIpfsGatewayUrl = (cid: string): string =>
  `${resolveGatewayBase()}/${encodeURIComponent(cid)}`;

export const uploadJsonToIpfs = async (
  payload: unknown,
  options?: UploadJsonToIpfsOptions
): Promise<IpfsUploadResult> => {
  const provider = resolveUploadProvider();
  const fileName =
    String(options?.fileName || '').trim() || `hcn-profile-${Date.now().toString(10)}`;

  let cid = '';
  if (provider === 'infura') {
    cid = await uploadJsonViaInfura(payload, fileName);
  } else if (provider === 'custom') {
    cid = await uploadJsonViaCustomEndpoint(payload, fileName);
  } else {
    cid = await uploadJsonViaPinata(payload, fileName);
  }

  return {
    cid,
    ipfsUrl: `ipfs://${cid}`,
    gatewayUrl: toIpfsGatewayUrl(cid),
    provider,
  };
};
