const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

async function countRows(client) {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::int FROM "User") AS users,
      (SELECT count(*)::int FROM "Membership") AS memberships,
      (SELECT count(*)::int FROM "PaymentHistory") AS payments,
      (SELECT count(*)::int FROM "ProviderSession" WHERE did LIKE 'user:%') AS user_sessions,
      (
        SELECT CASE
          WHEN to_regclass('public.launch_codes') IS NULL THEN 0
          ELSE (SELECT count(*)::int FROM public.launch_codes)
        END
      ) AS launch_codes
  `);
  return result.rows[0];
}

async function main() {
  const client = new Client(resolveConnectionConfig());
  await client.connect();

  try {
    const before = await countRows(client);
    await client.query('BEGIN');
    await client.query('DELETE FROM "Membership"');
    await client.query('DELETE FROM "ProviderSession" WHERE did LIKE $1', ['user:%']);
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.launch_codes') IS NOT NULL THEN
          DELETE FROM public.launch_codes;
        END IF;
      END $$;
    `);
    await client.query('DELETE FROM "User"');
    await client.query('COMMIT');
    const after = await countRows(client);

    console.log(JSON.stringify({ before, after }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error.message);
  process.exitCode = 1;
});
