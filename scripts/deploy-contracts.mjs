import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const profileContractPath = path.join(rootDir, 'contracts', 'HCNProfileAnchor.sol');
const frontendEnvLocalPath = path.join(rootDir, '.env.local');
const frontendEnvProdPath = path.join(rootDir, '.env.production');
const backendEnvLocalPath = path.join(rootDir, 'server', '.env.local');

const readSource = (sourcePath) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }
  return fs.readFileSync(sourcePath, 'utf8');
};

const compileContracts = () => {
  const input = {
    language: 'Solidity',
    sources: {
      'HCNProfileAnchor.sol': {
        content: readSource(profileContractPath),
      },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = Array.isArray(compiled?.errors) ? compiled.errors : [];
  const fatal = errors.filter((item) => item?.severity === 'error');
  if (fatal.length > 0) {
    throw new Error(
      `Solidity compile failed:\n${fatal.map((item) => item.formattedMessage || item.message).join('\n')}`
    );
  }

  const profileArtifact = compiled?.contracts?.['HCNProfileAnchor.sol']?.HCNProfileAnchor;
  if (!profileArtifact) {
    throw new Error('Compiled artifacts are missing expected contracts');
  }

  return {
    profileArtifact,
  };
};

const parseEnvFile = (filePath) => {
  const entries = [];
  if (!fs.existsSync(filePath)) return entries;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (!match) {
      entries.push({ type: 'raw', raw: line });
      continue;
    }
    entries.push({
      type: 'kv',
      key: match[1],
      value: match[2],
    });
  }
  return entries;
};

const renderEnvFile = (entries) =>
  `${entries
    .map((entry) => {
      if (entry.type === 'kv') return `${entry.key}=${entry.value}`;
      return entry.raw;
    })
    .join('\n')
    .replace(/\n+$/g, '')}\n`;

const upsertEnvValue = (filePath, key, value) => {
  const normalizedValue = String(value ?? '').trim();
  const entries = parseEnvFile(filePath);
  let updated = false;
  for (const entry of entries) {
    if (entry.type === 'kv' && entry.key === key) {
      entry.value = normalizedValue;
      updated = true;
      break;
    }
  }
  if (!updated) {
    if (entries.length > 0 && entries[entries.length - 1].type !== 'raw') {
      entries.push({ type: 'raw', raw: '' });
    }
    entries.push({ type: 'kv', key, value: normalizedValue });
  }
  fs.writeFileSync(filePath, renderEnvFile(entries), 'utf8');
};

const resolveEnv = (...keys) => {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
};

const ensureHexPrivateKey = (value, label) => {
  const normalized = String(value || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a 0x-prefixed 32-byte hex string`);
  }
  return normalized;
};

const main = async () => {
  const rpcUrl = resolveEnv('DEPLOY_RPC_URL', 'RPC_URL', 'SEPOLIA_RPC_URL', 'ETH_RPC_URL');
  const deployerPrivateKey = resolveEnv('DEPLOYER_PRIVATE_KEY', 'PRIVATE_KEY');

  if (!rpcUrl) {
    throw new Error(
      'Missing deploy RPC URL. Set DEPLOY_RPC_URL (or RPC_URL / SEPOLIA_RPC_URL / ETH_RPC_URL).'
    );
  }
  if (!deployerPrivateKey) {
    throw new Error('Missing deployer private key. Set DEPLOYER_PRIVATE_KEY (or PRIVATE_KEY).');
  }
  const normalizedDeployerKey = ensureHexPrivateKey(deployerPrivateKey, 'Deployer private key');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error('Failed to resolve target chain ID from RPC');
  }

  const deployerWallet = new ethers.Wallet(normalizedDeployerKey, provider);
  const deployerBalance = await provider.getBalance(deployerWallet.address);
  if (deployerBalance === 0n) {
    throw new Error(`Deployer account ${deployerWallet.address} has no gas funds on chain ${chainId}`);
  }

  const { profileArtifact } = compileContracts();

  console.log(`[DEPLOY] Chain ID: ${chainId}`);
  console.log(`[DEPLOY] Deployer: ${deployerWallet.address}`);

  const profileFactory = new ethers.ContractFactory(
    profileArtifact.abi,
    profileArtifact.evm.bytecode.object,
    deployerWallet
  );
  const profileContract = await profileFactory.deploy();
  await profileContract.waitForDeployment();
  const profileAddress = await profileContract.getAddress();

  console.log(`[DEPLOY] HCNProfileAnchor: ${profileAddress}`);
  console.log(`[DEPLOY] Profile deploy tx: ${profileContract.deploymentTransaction()?.hash || 'n/a'}`);

  if (!fs.existsSync(frontendEnvLocalPath)) fs.writeFileSync(frontendEnvLocalPath, '', 'utf8');
  if (!fs.existsSync(frontendEnvProdPath)) fs.writeFileSync(frontendEnvProdPath, '', 'utf8');
  if (!fs.existsSync(backendEnvLocalPath)) fs.writeFileSync(backendEnvLocalPath, '', 'utf8');

  upsertEnvValue(frontendEnvLocalPath, 'VITE_BLOCKCHAIN_NETWORK_ID', String(chainId));
  upsertEnvValue(frontendEnvLocalPath, 'VITE_IPFS_GATEWAY', resolveEnv('VITE_IPFS_GATEWAY') || 'https://ipfs.io/ipfs');

  upsertEnvValue(frontendEnvProdPath, 'VITE_BLOCKCHAIN_NETWORK_ID', String(chainId));
  upsertEnvValue(frontendEnvProdPath, 'VITE_IPFS_GATEWAY', resolveEnv('VITE_IPFS_GATEWAY') || 'https://ipfs.io/ipfs');

  upsertEnvValue(backendEnvLocalPath, 'HCN_PROFILE_ANCHOR_CONTRACT_ADDRESS', profileAddress);
  upsertEnvValue(backendEnvLocalPath, 'HCN_PROFILE_ANCHOR_CHAIN_ID', String(chainId));

  console.log('[DEPLOY] Updated .env.local, .env.production, and server/.env.local');
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DEPLOY][ERROR] ${message}`);
  process.exit(1);
});
