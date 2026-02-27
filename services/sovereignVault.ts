export interface EncryptedVaultPayload {
  version: 'hcn-vault-v1';
  algorithm: 'AES-GCM';
  cipherText: string;
  iv: string;
  salt: string;
  createdAt: string;
}

const PBKDF2_ITERATIONS = 250_000;
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH_BITS = 256;
const IV_BYTES = 12;
const SALT_BYTES = 16;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

const deriveVaultKey = async (walletSignature: string, salt: Uint8Array): Promise<CryptoKey> => {
  const signatureMaterial = utf8Encoder.encode(walletSignature);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signatureMaterial,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      salt,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH_BITS,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

export const requestVaultSignature = async (
  walletAddress: string,
  message?: string
): Promise<string> => {
  const provider = (window as any)?.ethereum;
  if (!provider?.request) {
    throw new Error('Wallet provider is unavailable');
  }
  const prompt =
    message ||
    [
      'Authorize Higher Conscious Network Sovereign Vault encryption.',
      `Wallet: ${walletAddress}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

  const signature = await provider.request({
    method: 'personal_sign',
    params: [prompt, walletAddress],
  });
  const normalized = String(signature || '').trim();
  if (!normalized) {
    throw new Error('Wallet did not return a signature');
  }
  return normalized;
};

export const encryptWithWalletSignature = async (
  payload: unknown,
  walletSignature: string
): Promise<EncryptedVaultPayload> => {
  const iv = randomBytes(IV_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveVaultKey(walletSignature, salt);

  const rawPayload = utf8Encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    rawPayload
  );

  return {
    version: 'hcn-vault-v1',
    algorithm: 'AES-GCM',
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    createdAt: new Date().toISOString(),
  };
};

export const decryptWithWalletSignature = async <T>(
  payload: EncryptedVaultPayload,
  walletSignature: string
): Promise<T> => {
  const iv = base64ToBytes(payload.iv);
  const salt = base64ToBytes(payload.salt);
  const cipherBytes = base64ToBytes(payload.cipherText);
  const key = await deriveVaultKey(walletSignature, salt);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    cipherBytes
  );
  const plainText = utf8Decoder.decode(new Uint8Array(decrypted));
  return JSON.parse(plainText) as T;
};
