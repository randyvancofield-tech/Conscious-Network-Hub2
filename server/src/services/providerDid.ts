import crypto from 'crypto';

const DID_PREFIX = 'did:hcn:ed25519:';

const toBase64Url = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fingerprintPublicKeyPem = (publicKeyPem: string): string => {
  const digest = crypto.createHash('sha256').update(publicKeyPem.trim()).digest();
  return toBase64Url(digest);
};

export const isDidFormatSupported = (did: string): boolean => did.startsWith(DID_PREFIX);

export const isDidBoundToPublicKey = (did: string, publicKeyPem: string): boolean => {
  if (!isDidFormatSupported(did)) return false;
  const expected = `${DID_PREFIX}${fingerprintPublicKeyPem(publicKeyPem)}`;
  return did === expected;
};

export const buildDidFromPublicKey = (publicKeyPem: string): string =>
  `${DID_PREFIX}${fingerprintPublicKeyPem(publicKeyPem)}`;

export const verifyDidChallengeSignature = (
  statement: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean => {
  try {
    const signature = Buffer.from(signatureBase64, 'base64');
    const keyObject = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(statement, 'utf8'), keyObject, signature);
  } catch {
    return false;
  }
};

