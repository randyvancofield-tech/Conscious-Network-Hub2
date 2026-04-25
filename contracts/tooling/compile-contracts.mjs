import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const profileContractPath = path.join(rootDir, 'contracts', 'HCNProfileAnchor.sol');

const source = fs.readFileSync(profileContractPath, 'utf8');
const input = {
  language: 'Solidity',
  sources: {
    'HCNProfileAnchor.sol': {
      content: source,
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
if (!profileArtifact?.abi || !profileArtifact?.evm?.bytecode?.object) {
  throw new Error('Compiled artifacts are missing HCNProfileAnchor ABI or bytecode');
}

console.log('Compiled HCNProfileAnchor successfully');
