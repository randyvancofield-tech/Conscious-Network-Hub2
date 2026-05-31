const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('VERIFY_LAUNCH_DATA_PATHS');

const REQUIRED_COLUMNS = {
  User: [
    'id',
    'email',
    'role',
    'providerApprovalStatus',
    'provider_status',
    'providerRevokedAt',
    'providerAccessUpdatedAt',
    'wallet_address',
    'walletDid',
  ],
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
    'adminNotes',
    'submittedAt',
    'calendlyShownAt',
    'reviewedAt',
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
  Notification: [
    'id',
    'userId',
    'type',
    'title',
    'body',
    'roleScope',
    'metadata',
    'readAt',
    'createdAt',
    'updatedAt',
  ],
  AdminMessage: [
    'id',
    'type',
    'status',
    'priority',
    'subject',
    'message',
    'submitterName',
    'submitterEmail',
    'submitterUserId',
    'route',
    'category',
    'source',
    'recipientEmail',
    'metadata',
    'aiAnalysis',
    'adminNotes',
    'resolutionSummary',
    'resolvedAt',
    'createdAt',
    'updatedAt',
  ],
  AccountRecoveryCode: [
    'id',
    'userId',
    'codeHash',
    'usedAt',
    'revokedAt',
    'createdAt',
    'updatedAt',
  ],
};

const REQUIRED_ENUM_VALUES = {
  UserRole: ['user', 'applicant', 'provider', 'admin'],
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

async function listEnumValues(client, enumName) {
  const result = await client.query(
    `
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = $1
      ORDER BY enumsortorder
    `,
    [enumName]
  );
  return new Set(result.rows.map((row) => String(row.enumlabel)));
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

    checks.enums = {};
    for (const [enumName, requiredValues] of Object.entries(REQUIRED_ENUM_VALUES)) {
      const values = await listEnumValues(client, enumName);
      checks.enums[enumName] = {
        values: Array.from(values),
        missingValues: requiredValues.filter((value) => !values.has(value)),
      };
    }

    checks.User.prismaCount = await prisma.user.count();
    checks.ProviderApplicant.prismaCount = await prisma.providerApplicant.count();
    checks.ConsciousCareerGrantApplication.prismaCount =
      await prisma.consciousCareerGrantApplication.count();
    checks.ProviderCrmToolVisibility.rowCount = await client
      .query('SELECT COUNT(*)::int AS count FROM "ProviderCrmToolVisibility"')
      .then((result) => Number(result.rows[0]?.count || 0));
    checks.Notification.rowCount = await client
      .query('SELECT COUNT(*)::int AS count FROM "Notification"')
      .then((result) => Number(result.rows[0]?.count || 0));
    checks.AdminMessage.rowCount = await client
      .query('SELECT COUNT(*)::int AS count FROM "AdminMessage"')
      .then((result) => Number(result.rows[0]?.count || 0));
    checks.AccountRecoveryCode.rowCount = await client
      .query('SELECT COUNT(*)::int AS count FROM "AccountRecoveryCode"')
      .then((result) => Number(result.rows[0]?.count || 0));

    const failures = Object.entries(checks).flatMap(([tableName, check]) => {
      if (tableName === 'enums') return [];
      const missing = [];
      if (!check.tableExists) missing.push(`${tableName}:table`);
      for (const column of check.missingColumns) missing.push(`${tableName}.${column}`);
      return missing;
    });
    for (const [enumName, check] of Object.entries(checks.enums)) {
      for (const value of check.missingValues) failures.push(`${enumName}.${value}`);
    }

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
