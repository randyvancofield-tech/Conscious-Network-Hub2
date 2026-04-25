const { spawnSync } = require('child_process');
const path = require('path');

const [, , scriptName, ...scriptArgs] = process.argv;

if (!scriptName) {
  console.error('Usage: node scripts/run-powershell-script.js <script.ps1> [args...]');
  process.exit(1);
}

if (scriptName.includes('..') || path.isAbsolute(scriptName)) {
  console.error('Script name must be a file under server/scripts.');
  process.exit(1);
}

const scriptPath = path.join(__dirname, scriptName);
const candidates = process.platform === 'win32' ? ['pwsh', 'powershell'] : ['pwsh', 'powershell'];

let lastError = null;
for (const executable of candidates) {
  const result = spawnSync(
    executable,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...scriptArgs],
    {
      stdio: 'inherit',
      shell: false,
    }
  );

  if (result.error && result.error.code === 'ENOENT') {
    lastError = result.error;
    continue;
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

console.error(
  `Unable to find PowerShell runtime. Install PowerShell 7 (pwsh) or Windows PowerShell. ${lastError?.message || ''}`.trim()
);
process.exit(1);
