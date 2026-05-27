const path = require('path');
const { Client } = require('pg');
const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('NEON_DIRECT_CHECK');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsedUrl = new URL(connectionString);
  const client = new Client({
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 5432),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false, servername: parsedUrl.hostname },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();

  const result = await client.query('select now() as now');
  console.log(`Neon warm-up OK: ${result.rows[0].now.toISOString()}`);

  await client.end();
}

main().catch((error) => {
  console.error('ERROR', error);
  process.exitCode = 1;
});
