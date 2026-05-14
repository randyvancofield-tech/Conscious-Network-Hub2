const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TIER = 'Guided Tier';
const PASSWORD = 'VerifyMember#1234';
const PORT = String(19000 + Math.floor(Math.random() * 1000));
const USER_ID = `verify-member-${crypto.randomUUID()}`;
const MEMBERSHIP_ID = crypto.randomUUID();

function resolveConnectionConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsedUrl = new URL(connectionString);
  return {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 5432),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false, servername: parsedUrl.hostname },
    connectionTimeoutMillis: 30000,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with ${child.exitCode}: ${output()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Retry until the deadline.
    }
    await wait(500);
  }
  throw new Error(`Server did not become healthy: ${output()}`);
}

async function requestCurrent(baseUrl, token) {
  const response = await fetch(`${baseUrl}/api/user/current`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function requestSignIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/user/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: `${USER_ID}@example.com`,
      password: PASSWORD,
    }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? '' : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

async function insertTemporaryUser(client) {
  const now = new Date();

  await client.query(
    `
      INSERT INTO "User" (
        id,
        email,
        name,
        password,
        membership_tier,
        "subscriptionStatus",
        "subscriptionStartDate",
        "subscriptionEndDate",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'Accelerated Tier', 'active', $5, NULL, $5)
    `,
    [
      USER_ID,
      `${USER_ID}@example.com`,
      'Membership Verifier',
      bcrypt.hashSync(PASSWORD, 10),
      now,
    ]
  );
}

async function insertActiveMembership(client) {
  const startDate = new Date(Date.now() - 60_000);
  await client.query(
    `
      INSERT INTO "Membership" (
        id,
        "userId",
        tier,
        status,
        "startDate",
        "endDate",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'active', $4, NULL, $4)
      ON CONFLICT ("userId")
      DO UPDATE SET
        tier = EXCLUDED.tier,
        status = 'active',
        "startDate" = EXCLUDED."startDate",
        "endDate" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    [MEMBERSHIP_ID, USER_ID, TIER, startDate]
  );
}

async function readProjection(client) {
  const result = await client.query(
    `
      SELECT
        membership_tier AS tier,
        "subscriptionStatus" AS status,
        "subscriptionStartDate" AS start_date,
        "subscriptionEndDate" AS end_date
      FROM "User"
      WHERE id = $1
    `,
    [USER_ID]
  );
  return result.rows[0] || null;
}

async function cleanup(client) {
  await client.query('DELETE FROM "ProviderSession" WHERE did = $1', [`user:${USER_ID}`]);
  await client.query('DELETE FROM "User" WHERE id = $1', [USER_ID]);
}

async function main() {
  const serverPath = path.resolve(__dirname, '../dist/index.js');
  const baseUrl = `http://localhost:${PORT}`;
  const childEnv = {
    ...process.env,
    PORT,
    STRIPE_MODE: process.env.STRIPE_MODE || 'test',
    STRIPE_SUCCESS_URL:
      process.env.STRIPE_SUCCESS_URL ||
      'http://localhost:3000/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    STRIPE_CANCEL_URL:
      process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/?checkout=cancel',
    SENSITIVE_DATA_KEY:
      process.env.SENSITIVE_DATA_KEY || 'local-membership-route-verification-only',
  };

  const client = new Client(resolveConnectionConfig());
  await client.connect();

  let child = null;
  const logs = [];
  const output = () => logs.slice(-20).join('\n');

  try {
    await cleanup(client);
    await insertTemporaryUser(client);

    child = spawn(process.execPath, [serverPath], {
      cwd: path.resolve(__dirname, '..'),
      env: childEnv,
      windowsHide: true,
    });
    child.stdout.on('data', (chunk) => logs.push(String(chunk).trim()));
    child.stderr.on('data', (chunk) => logs.push(String(chunk).trim()));

    await waitForHealth(baseUrl, child, output);

    const signin = await requestSignIn(baseUrl);
    assert(signin.status === 200, 'Expected sign-in request to pass', {
      signin,
      now: new Date().toISOString(),
      serverOutput: output(),
    });
    assert(
      signin.body.user?.hasActiveMembership === false,
      'Expected sign-in to clear stale projection without Membership row',
      signin.body
    );
    const token = String(signin.body.token || '').trim();
    assert(Boolean(token), 'Expected sign-in to return a session token', signin.body);

    const staleCurrent = await requestCurrent(baseUrl, token);
    assert(staleCurrent.status === 200, 'Expected stale projection current-user request to pass', {
      staleCurrent,
      now: new Date().toISOString(),
      serverOutput: output(),
    });
    assert(
      staleCurrent.body.user?.hasActiveMembership === false,
      'Expected stale projection without Membership row to be inactive',
      staleCurrent.body
    );
    assert(staleCurrent.body.user?.tier === null, 'Expected stale tier to be cleared', staleCurrent.body);
    assert(
      staleCurrent.body.user?.subscriptionStatus === 'inactive',
      'Expected stale subscription status to be cleared',
      staleCurrent.body
    );

    const clearedProjection = await readProjection(client);
    assert(clearedProjection?.tier === '', 'Expected User.membership_tier projection to be cleared', clearedProjection);
    assert(
      clearedProjection?.status === 'inactive',
      'Expected User.subscriptionStatus projection to be inactive',
      clearedProjection
    );

    await insertActiveMembership(client);

    const activeCurrent = await requestCurrent(baseUrl, token);
    assert(activeCurrent.status === 200, 'Expected active membership current-user request to pass', {
      activeCurrent,
      serverOutput: output(),
    });
    assert(
      activeCurrent.body.user?.hasActiveMembership === true,
      'Expected active Membership row to enable routing',
      activeCurrent.body
    );
    assert(activeCurrent.body.user?.tier === TIER, 'Expected active tier from Membership row', activeCurrent.body);
    assert(
      activeCurrent.body.user?.subscriptionStatus === 'active',
      'Expected active subscription status from Membership row',
      activeCurrent.body
    );

    const activeProjection = await readProjection(client);
    assert(activeProjection?.tier === TIER, 'Expected User.membership_tier to match Membership', activeProjection);
    assert(activeProjection?.status === 'active', 'Expected User.subscriptionStatus to match Membership', activeProjection);
    assert(Boolean(activeProjection?.start_date), 'Expected User.subscriptionStartDate to be populated', activeProjection);
    assert(activeProjection?.end_date === null, 'Expected User.subscriptionEndDate to match Membership.endDate', activeProjection);

    console.log(
      JSON.stringify(
        {
          success: true,
          backendUrl: baseUrl,
          staleProjectionCleared: true,
          activeMembershipCurrentUser: {
            hasActiveMembership: activeCurrent.body.user.hasActiveMembership,
            tier: activeCurrent.body.user.tier,
            subscriptionStatus: activeCurrent.body.user.subscriptionStatus,
          },
        },
        null,
        2
      )
    );
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
    }
    await cleanup(client).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error.message);
  process.exitCode = 1;
});
