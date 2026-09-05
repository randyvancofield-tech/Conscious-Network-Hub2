const baseUrl = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const origin = process.env.ORIGIN || 'http://localhost:5173';

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

  console.log('Account creation is disabled in smoke checks. Run auth lifecycle tests against an isolated test database.');
};

run().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
