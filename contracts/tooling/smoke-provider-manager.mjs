import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const providerManagerPath = path.join(rootDir, 'contracts', 'ProviderManager.sol');

const input = {
  language: 'Solidity',
  sources: {
    'ProviderManager.sol': {
      content: fs.readFileSync(providerManagerPath, 'utf8'),
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
    `ProviderManager smoke compile failed:\n${fatal
      .map((item) => item.formattedMessage || item.message)
      .join('\n')}`
  );
}

const artifact = compiled?.contracts?.['ProviderManager.sol']?.ProviderManager;
if (!artifact?.abi || !artifact?.evm?.bytecode?.object) {
  throw new Error('ProviderManager smoke test missing ABI or bytecode');
}

const functions = new Set(
  artifact.abi
    .filter((entry) => entry.type === 'function')
    .map((entry) => entry.name)
);
const events = new Set(
  artifact.abi
    .filter((entry) => entry.type === 'event')
    .map((entry) => entry.name)
);

const requiredFunctions = [
  'addProvider',
  'removeProvider',
  'setProviderApproval',
  'setProviderApprovals',
  'approvedProviders',
  'isApprovedProvider',
  'setAdmin',
  'isAdmin',
  'transferOwnership',
  'owner',
];

const requiredEvents = [
  'ProviderApprovalUpdated',
  'AdminUpdated',
  'OwnershipTransferred',
];

const missingFunctions = requiredFunctions.filter((name) => !functions.has(name));
const missingEvents = requiredEvents.filter((name) => !events.has(name));

if (missingFunctions.length > 0 || missingEvents.length > 0) {
  throw new Error(
    [
      missingFunctions.length ? `Missing functions: ${missingFunctions.join(', ')}` : '',
      missingEvents.length ? `Missing events: ${missingEvents.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );
}

for (const eventName of requiredEvents) {
  const event = artifact.abi.find((entry) => entry.type === 'event' && entry.name === eventName);
  const allInputsAreWalletOrBool = event.inputs.every((inputItem) =>
    ['address', 'bool'].includes(inputItem.type)
  );
  if (!allInputsAreWalletOrBool) {
    throw new Error(`${eventName} event contains non-wallet metadata`);
  }
}

console.log('ProviderManager smoke test passed: ABI, bytecode, functions, and wallet-only events verified');
