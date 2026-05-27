const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('VERIFY_LAUNCH_DATA_PATHS');

const REQUIRED_COLUMNS = {
  ProviderApplicant: [
    'id',
    'userId',
    'email',
    'firstName',
    'lastName',
    'phone',
    'providerCategory',
    'resumeFile',
    'coverLetterFile',
    'alignmentAnswers',
    'integrityConsents',
    'consentAudit',
    'status',
    'submittedAt',
    'updatedAt',
  ],
  ConsciousCareerGrantApplication: [
    'id',
    'userId',
    'country',
    'region',
    'locality',
    'postalCode',
    'legalName',
    'applicantType',
    'ventureStage',
    'requestedAmountUsd',
    'useOfFunds',
    'answers',
    'status',
    'submittedAt',
    'updatedAt',
  ],
  ProviderCrmToolVisibility: [
    'toolId',
    'enabled',
    'updatedByUserId',
    'createdAt',
    'updatedAt',
  ],
};

function buildClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsedUrl = new URL(connectionString);
  const hostname = parsedUrl.hostname;
  const local = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  return new Client({
    host: hostname,
    port: Number(parsedUrl.port || 5432),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.replace(/^\//, ''),
    ssl: local ? false : { rejectUnauthorized: false, servername: hostname },
    connectionTimeoutMillis: 30000,
  });
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function listColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => String(row.column_name)));
}

async function main() {
  const client = buildClient();
  client.on('error', (error) => {
    console.warn('[VERIFY_LAUNCH_DATA_PATHS] Postgres connection warning', error.message);
  });
  const prisma = new PrismaClient();
  const checks = {};

  await client.connect();
  try {
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const exists = await tableExists(client, tableName);
      const columns = exists ? await listColumns(client, tableName) : new Set();
      checks[tableName] = {
        tableExists: exists,
        missingColumns: requiredColumns.filter((column) => !columns.has(column)),
      };
    }

    checks.ProviderApplicant.prismaCount = await prisma.providerApplicant.count();
    checks.ConsciousCareerGrantApplication.prismaCount =
      await prisma.consciousCareerGrantApplication.count();
    checks.ProviderCrmToolVisibility.rowCount = await client
      .query('SELECT COUNT(*)::int AS count FROM "ProviderCrmToolVisibility"')
      .then((result) => Number(result.rows[0]?.count || 0));

    const failures = Object.entries(checks).flatMap(([tableName, check]) => {
      const missing = [];
      if (!check.tableExists) missing.push(`${tableName}:table`);
      for (const column of check.missingColumns) missing.push(`${tableName}.${column}`);
      return missing;
    });

    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          checks,
          failures,
        },
        null,
        2
      )
    );

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await client.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
