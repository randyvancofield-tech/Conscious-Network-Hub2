const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const requiredTables = ['User', 'Membership', 'SocialPost', 'Reflection', 'ProviderSession'];

const overrideUrl = process.argv[2];

function maskDatabaseUrl(value) {
  const parsed = new URL(value);
  parsed.password = parsed.password ? '***' : '';
  return parsed.toString();
}

async function main() {
  const connectionString = overrideUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const parsedUrl = new URL(connectionString);
  console.log('DATABASE_URL', maskDatabaseUrl(connectionString));
  console.log('DATABASE_HOST', parsedUrl.host);
  console.log(
    'DATABASE_CONNECTION_TYPE',
    parsedUrl.hostname.includes('-pooler.') ? 'pooled' : 'direct'
  );
  console.log('DATABASE_SSLMODE', parsedUrl.searchParams.get('sslmode') || '(not set)');
  console.log(
    'PG_SSL_CONFIG',
    JSON.stringify({ rejectUnauthorized: false, servername: parsedUrl.hostname })
  );

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

  const now = await client.query(
    'select now() as now, current_database() as database, current_user as user'
  );
  console.log('SELECT_NOW', JSON.stringify(now.rows[0]));

  const tables = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
     order by table_name`
  );
  const tableNames = tables.rows.map((row) => row.table_name);
  console.log('TABLES', JSON.stringify(tableNames));

  const presence = Object.fromEntries(
    requiredTables.map((tableName) => [tableName, tableNames.includes(tableName)])
  );
  console.log('REQUIRED_TABLES', JSON.stringify(presence));

  await client.end();
}

main().catch((error) => {
  console.error('ERROR', error);
  process.exitCode = 1;
});
