const crypto = require('crypto');

const baseUrl = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const origin = process.env.ORIGIN || 'http://localhost:5173';
const runAuthFlow = process.env.RUN_AUTH_FLOW === 'true';

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: origin,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
};

const expectStatus = async (label, path, expectedStatus, options = {}) => {
  const result = await requestJson(path, options);
  if (result.response.status !== expectedStatus) {
    throw new Error(
      `${label} expected ${expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body)}`
    );
  }
  console.log(`PASS ${label}`);
  return result;
};

const run = async () => {
  console.log(`Smoke testing ${baseUrl}`);

  await expectStatus('health', '/health', 200);
  await expectStatus('unauthenticated AI chat is rejected', '/api/ai/chat', 401, {
    method: 'POST',
    body: JSON.stringify({ message: 'Smoke test' }),
  });
  await expectStatus('membership tiers are public', '/api/membership/tiers', 200);
  await expectStatus('empty signup payload is rejected', '/api/user/create', 400, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await expectStatus('empty signin payload is rejected', '/api/user/signin', 400, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (!runAuthFlow) {
    console.log('SKIP auth create/login/logout flow. Set RUN_AUTH_FLOW=true to enable it.');
    return;
  }

  const nonce = crypto.randomBytes(6).toString('hex');
  const email = `smoke.${nonce}@example.com`;
  const password = `Aa1!${crypto.randomBytes(8).toString('hex')}`;
  const name = `Smoke User ${nonce}`;

  const create = await expectStatus('auth create', '/api/user/create', 200, {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const token = create.body?.token;
  if (!create.body?.success || !token || !create.body?.user) {
    throw new Error(`auth create response missing expected fields: ${JSON.stringify(create.body)}`);
  }

  await expectStatus('current user after create', '/api/user/current', 200, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await expectStatus('logout', '/api/user/logout', 200, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  await expectStatus('current user rejected after logout', '/api/user/current', 401, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const signin = await expectStatus('signin after logout', '/api/user/signin', 200, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!signin.body?.success || !signin.body?.token || !signin.body?.user) {
    throw new Error(`signin response missing expected fields: ${JSON.stringify(signin.body)}`);
  }
};

run().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
