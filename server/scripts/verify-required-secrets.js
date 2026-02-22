const { spawn } = require('child_process');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '..');
const ENTRY = path.join(SERVER_DIR, 'dist', 'index.js');

const REQUIRED_MISSING_PATTERN =
  /Missing required secrets\/environment variables: .*AUTH_TOKEN_SECRET \(or SESSION_SECRET\).*DATABASE_URL/i;
const SHARED_DB_MISMATCH_PATTERN =
  /AUTH_PERSISTENCE_BACKEND=shared_db requires DATABASE_URL to use postgres:\/\/ or postgresql:\/\//i;
const PROD_BACKEND_MISMATCH_PATTERN =
  /Production requires AUTH_PERSISTENCE_BACKEND=shared_db|AUTH_PERSISTENCE_BACKEND must be set to shared_db/i;
const PROD_DATABASE_URL_MISMATCH_PATTERN =
  /Production requires DATABASE_URL to use postgres:\/\/ or postgresql:\/\/|Shared DB persistence requires DATABASE_URL to use postgres:\/\/ or postgresql:\/\/|AUTH_PERSISTENCE_BACKEND=shared_db requires DATABASE_URL to use postgres:\/\/ or postgresql:\/\//i;

const buildEnv = ({ unset = [], set = {} } = {}) => {
  const env = { ...process.env };
  for (const key of unset) {
    delete env[key];
  }
  return { ...env, ...set };
};

const stopProcess = (proc) => {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
  setTimeout(() => {
    if (!proc.killed) {
      proc.kill('SIGKILL');
    }
  }, 800);
};

const runExpectFailure = () =>
  new Promise((resolve, reject) => {
    const env = buildEnv({
      set: {
        NODE_ENV: 'test',
        PORT: '3981',
        AUTH_TOKEN_SECRET: '',
        SESSION_SECRET: '',
        DATABASE_URL: '',
      },
    });

    const proc = spawn(process.execPath, [ENTRY], { cwd: SERVER_DIR, env });
    let output = '';
    const timeout = setTimeout(() => {
      stopProcess(proc);
      reject(new Error('Timeout waiting for startup failure when secrets are missing.'));
    }, 12000);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        reject(new Error('Expected startup to fail without required secrets, but it exited with code 0.'));
        return;
      }

      if (!REQUIRED_MISSING_PATTERN.test(output)) {
        reject(
          new Error(
            `Startup failed, but missing-secret message was not clear enough.\nOutput:\n${output}`
          )
        );
        return;
      }

      resolve();
    });
  });

const runExpectSuccess = () =>
  new Promise((resolve, reject) => {
    const testPort = 3982;
    const env = buildEnv({
      unset: ['AUTH_TOKEN_SECRET', 'SESSION_SECRET', 'DATABASE_URL'],
      set: {
        NODE_ENV: 'test',
        PORT: String(testPort),
        AUTH_TOKEN_SECRET: 'integration-test-auth-secret',
        DATABASE_URL: 'file:./prisma/dev.db',
        CORS_ORIGINS: 'http://localhost:3000',
      },
    });

    const proc = spawn(process.execPath, [ENTRY], { cwd: SERVER_DIR, env });
    let output = '';
    const readyPattern = new RegExp(`Backend listening on port ${testPort}`);
    const timeout = setTimeout(() => {
      stopProcess(proc);
      reject(new Error('Timeout waiting for startup success with required secrets present.'));
    }, 12000);

    const onData = (chunk) => {
      output += chunk.toString();
      if (readyPattern.test(output)) {
        clearTimeout(timeout);
        stopProcess(proc);
        resolve();
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('exit', (code) => {
      if (!readyPattern.test(output)) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Expected startup success with required secrets, but process exited early (code ${code}).\nOutput:\n${output}`
          )
        );
      }
    });
  });

const runExpectFailureSharedDbMisconfig = () =>
  new Promise((resolve, reject) => {
    const env = buildEnv({
      set: {
        NODE_ENV: 'test',
        PORT: '3983',
        AUTH_TOKEN_SECRET: 'integration-test-auth-secret',
        DATABASE_URL: 'file:./prisma/dev.db',
        AUTH_PERSISTENCE_BACKEND: 'shared_db',
        SENSITIVE_DATA_KEY: 'integration-test-sensitive-key',
      },
    });

    const proc = spawn(process.execPath, [ENTRY], { cwd: SERVER_DIR, env });
    let output = '';
    const timeout = setTimeout(() => {
      stopProcess(proc);
      reject(new Error('Timeout waiting for shared_db misconfiguration failure.'));
    }, 12000);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        reject(
          new Error(
            'Expected startup to fail for AUTH_PERSISTENCE_BACKEND=shared_db with file DATABASE_URL, but it exited with code 0.'
          )
        );
        return;
      }

      if (!SHARED_DB_MISMATCH_PATTERN.test(output)) {
        reject(
          new Error(
            `Startup failed, but shared_db validation message was not clear enough.\nOutput:\n${output}`
          )
        );
        return;
      }

      resolve();
    });
  });

const runExpectFailureProdBackendMisconfig = () =>
  new Promise((resolve, reject) => {
    const env = buildEnv({
      set: {
        NODE_ENV: 'production',
        PORT: '3984',
        AUTH_TOKEN_SECRET: 'integration-test-auth-secret',
        DATABASE_URL: 'postgres://example.com/app',
        AUTH_PERSISTENCE_BACKEND: 'local_file',
        SENSITIVE_DATA_KEY: 'integration-test-sensitive-key',
      },
    });

    const proc = spawn(process.execPath, [ENTRY], { cwd: SERVER_DIR, env });
    let output = '';
    const timeout = setTimeout(() => {
      stopProcess(proc);
      reject(new Error('Timeout waiting for production backend misconfiguration failure.'));
    }, 12000);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        reject(
          new Error(
            'Expected startup to fail for production AUTH_PERSISTENCE_BACKEND!=shared_db, but it exited with code 0.'
          )
        );
        return;
      }

      if (!PROD_BACKEND_MISMATCH_PATTERN.test(output)) {
        reject(
          new Error(
            `Startup failed, but production backend validation message was not clear enough.\nOutput:\n${output}`
          )
        );
        return;
      }

      resolve();
    });
  });

const runExpectFailureProdDatabaseUrlMisconfig = () =>
  new Promise((resolve, reject) => {
    const env = buildEnv({
      set: {
        NODE_ENV: 'production',
        PORT: '3985',
        AUTH_TOKEN_SECRET: 'integration-test-auth-secret',
        DATABASE_URL: 'file:./prisma/dev.db',
        AUTH_PERSISTENCE_BACKEND: 'shared_db',
        SENSITIVE_DATA_KEY: 'integration-test-sensitive-key',
      },
    });

    const proc = spawn(process.execPath, [ENTRY], { cwd: SERVER_DIR, env });
    let output = '';
    const timeout = setTimeout(() => {
      stopProcess(proc);
      reject(new Error('Timeout waiting for production DATABASE_URL misconfiguration failure.'));
    }, 12000);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        reject(
          new Error(
            'Expected startup to fail for production non-Postgres DATABASE_URL, but it exited with code 0.'
          )
        );
        return;
      }

      if (!PROD_DATABASE_URL_MISMATCH_PATTERN.test(output)) {
        reject(
          new Error(
            `Startup failed, but production DATABASE_URL validation message was not clear enough.\nOutput:\n${output}`
          )
        );
        return;
      }

      resolve();
    });
  });

const main = async () => {
  await runExpectFailure();
  await runExpectFailureSharedDbMisconfig();
  await runExpectFailureProdBackendMisconfig();
  await runExpectFailureProdDatabaseUrlMisconfig();
  await runExpectSuccess();
  console.log('Required secret startup checks passed.');
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
