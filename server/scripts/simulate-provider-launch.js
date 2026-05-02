const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const backendUrl = String(
  process.env.PROVIDER_BRIDGE_TEST_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:3001'
).replace(/\/+$/, '');
const frontendOrigin = String(
  process.env.PROVIDER_BRIDGE_TEST_ORIGIN ||
    process.env.FRONTEND_BASE_URL ||
    'http://localhost:3000'
).replace(/\/+$/, '');
const issuer = String(process.env.BRIDGE_PROVIDER_ISSUER || '').trim();
const audience = String(process.env.BRIDGE_PROVIDER_AUDIENCE || '').trim();
const bridgeSecret = String(process.env.BRIDGE_PROVIDER_SECRET || '').trim();

const required = { issuer, audience, bridgeSecret };
for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing ${key}. Configure bridge env before running this simulation.`);
    process.exit(1);
  }
}

const normalizeScopes = (scopes) => {
  const normalized = scopes
    .filter((scope) => typeof scope === 'string')
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.includes('provider:read')) normalized.push('provider:read');
  if (!normalized.includes('provider:host')) normalized.push('provider:host');
  return Array.from(new Set(normalized)).sort();
};

const canonicalWalletPayload = (input) =>
  [
    'Conscious Network Provider Launch',
    `aud=${input.audience}`,
    `providerExternalId=${input.providerExternalId}`,
    `email=${input.email}`,
    `name=${input.name}`,
    `role=${input.role}`,
    `approvalStatus=${input.approvalStatus}`,
    `walletAddress=${input.walletAddress}`,
    `walletDid=${input.walletDid}`,
    `jti=${input.jti}`,
    `scopes=${input.scopes.join(',')}`,
  ].join('\n');

const canonicalBridgePayload = (input) =>
  [
    input.issuer,
    input.audience,
    String(input.timestampMs),
    input.providerExternalId,
    input.email,
    input.name,
    input.role,
    input.approvalStatus,
    input.walletAddress,
    input.walletDid,
    input.jti,
    input.scopes.join(','),
  ].join('\n');

const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`${options.method || 'GET'} ${url} failed: HTTP ${response.status} ${detail}`);
  }
  return data;
};

const main = async () => {
  const wallet = ethers.Wallet.createRandom();
  const scopes = normalizeScopes(['provider:read', 'provider:host']);
  const timestampMs = Date.now();
  const providerExternalId = `sim-provider-${timestampMs}`;
  const email = `provider-${timestampMs}@example.test`;
  const name = 'Simulated Provider';
  const walletAddress = ethers.getAddress(wallet.address);
  const walletDid = `did:pkh:eip155:1:${walletAddress.toLowerCase()}`;
  const jti = crypto.randomUUID();

  const body = {
    providerExternalId,
    email,
    name,
    role: 'provider',
    approvalStatus: 'approved',
    providerApproved: true,
    walletAddress,
    walletDid,
    walletSignature: await wallet.signMessage(
      canonicalWalletPayload({
        audience,
        providerExternalId,
        email,
        name,
        role: 'provider',
        approvalStatus: 'approved',
        walletAddress,
        walletDid,
        jti,
        scopes,
      })
    ),
    jti,
    aud: audience,
    scopes,
  };

  const bridgePayload = canonicalBridgePayload({
    issuer,
    audience,
    timestampMs,
    providerExternalId,
    email,
    name,
    role: 'provider',
    approvalStatus: 'approved',
    walletAddress,
    walletDid,
    jti,
    scopes,
  });
  const bridgeSignature = crypto
    .createHmac('sha256', bridgeSecret)
    .update(bridgePayload, 'utf8')
    .digest('hex');

  console.log(`Issuing launch code against ${backendUrl}`);
  const issued = await requestJson(`${backendUrl}/api/bridge/provider/issue-launch-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://conscious-network-hub.base44.app',
      'X-Bridge-Issuer': issuer,
      'X-Bridge-Timestamp': String(timestampMs),
      'X-Bridge-Signature': bridgeSignature,
      'X-Bridge-Key-Id': 'local-simulation',
    },
    body: JSON.stringify(body),
  });

  console.log(`Consuming launch code from origin ${frontendOrigin}`);
  const consumed = await requestJson(`${backendUrl}/api/bridge/provider/consume-launch-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: frontendOrigin,
    },
    body: JSON.stringify({ code: issued.launchCode }),
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        launchCodeIssued: Boolean(issued.launchCode),
        userId: consumed.user && consumed.user.id,
        providerExternalId: consumed.user && consumed.user.providerExternalId,
        providerSessionIssued: Boolean(consumed.providerSession && consumed.providerSession.token),
        sessionIssued: Boolean(consumed.session && consumed.session.token),
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
