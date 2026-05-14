import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const contractsDir = path.join(rootDir, 'contracts');
const contractFiles = ['HCNProfileAnchor.sol', 'ProviderManager.sol'];

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(
    contractFiles.map((fileName) => [
      fileName,
      { content: fs.readFileSync(path.join(contractsDir, fileName), 'utf8') },
    ])
  ),
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

const expectedContracts = [
  { fileName: 'HCNProfileAnchor.sol', contractName: 'HCNProfileAnchor' },
  { fileName: 'ProviderManager.sol', contractName: 'ProviderManager' },
];

for (const expected of expectedContracts) {
  const artifact = compiled?.contracts?.[expected.fileName]?.[expected.contractName];
  if (!artifact?.abi || !artifact?.evm?.bytecode?.object) {
    throw new Error(
      `Compiled artifacts are missing ${expected.contractName} ABI or bytecode`
    );
  }
  console.log(`Compiled ${expected.contractName} successfully`);
}
