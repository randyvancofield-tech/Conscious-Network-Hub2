const path = require('path');
const { Client } = require('pg');
const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('RECONCILE_LAUNCH_SCHEMA');

const apply = process.argv.includes('--apply');

const providerApplicantSql = `
CREATE TABLE IF NOT EXISTS "ProviderApplicant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "communicationPreference" TEXT,
  "providerCategory" TEXT NOT NULL,
  "organizationName" TEXT,
  "professionalTitle" TEXT,
  "website" TEXT,
  "socialLinks" JSONB,
  "serviceArea" TEXT,
  "availabilityMode" TEXT,
  "servicesOffered" JSONB,
  "targetAudience" TEXT,
  "populationsServed" JSONB,
  "experienceLevel" TEXT,
  "yearsExperience" INTEGER,
  "practiceStatus" TEXT,
  "availabilityToServe" TEXT,
  "credentialsText" TEXT,
  "licenseNumber" TEXT,
  "issuingOrganization" TEXT,
  "credentialExpiration" TIMESTAMP(3),
  "professionalReferences" TEXT,
  "resumeFile" JSONB NOT NULL,
  "coverLetterFile" JSONB NOT NULL,
  "alignmentAnswers" JSONB NOT NULL,
  "integrityConsents" JSONB NOT NULL,
  "consentAudit" JSONB,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "adminNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calendlyShownAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderApplicant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProviderApplicant" ADD COLUMN IF NOT EXISTS "consentAudit" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderApplicant_userId_key" ON "ProviderApplicant"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderApplicant_email_key" ON "ProviderApplicant"("email");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_status_idx" ON "ProviderApplicant"("status");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_providerCategory_idx" ON "ProviderApplicant"("providerCategory");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_submittedAt_idx" ON "ProviderApplicant"("submittedAt");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_createdAt_idx" ON "ProviderApplicant"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderApplicant_userId_fkey'
  ) THEN
    ALTER TABLE "ProviderApplicant"
      ADD CONSTRAINT "ProviderApplicant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

const careerGrantSql = `
CREATE TABLE IF NOT EXISTS "ConsciousCareerGrantApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "region" TEXT,
  "locality" TEXT,
  "postalCode" TEXT,
  "legalName" TEXT,
  "applicantType" TEXT NOT NULL,
  "ventureStage" TEXT NOT NULL,
  "requestedAmountUsd" INTEGER NOT NULL,
  "useOfFunds" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsciousCareerGrantApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConsciousCareerGrantApplication_userId_idx" ON "ConsciousCareerGrantApplication"("userId");
CREATE INDEX IF NOT EXISTS "ConsciousCareerGrantApplication_country_idx" ON "ConsciousCareerGrantApplication"("country");
CREATE INDEX IF NOT EXISTS "ConsciousCareerGrantApplication_status_idx" ON "ConsciousCareerGrantApplication"("status");
CREATE INDEX IF NOT EXISTS "ConsciousCareerGrantApplication_submittedAt_idx" ON "ConsciousCareerGrantApplication"("submittedAt");
CREATE INDEX IF NOT EXISTS "ConsciousCareerGrantApplication_createdAt_idx" ON "ConsciousCareerGrantApplication"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsciousCareerGrantApplication_userId_fkey'
  ) THEN
    ALTER TABLE "ConsciousCareerGrantApplication"
      ADD CONSTRAINT "ConsciousCareerGrantApplication_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

const providerCrmToolVisibilitySql = `
CREATE TABLE IF NOT EXISTS "ProviderCrmToolVisibility" (
  "toolId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ProviderCrmToolVisibility_pkey" PRIMARY KEY ("toolId")
);

CREATE INDEX IF NOT EXISTS "ProviderCrmToolVisibility_updated_idx"
  ON "ProviderCrmToolVisibility"("updatedAt");
`;

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

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function collectStatus(client) {
  const providerApplicant = await tableExists(client, 'ProviderApplicant');
  const careerGrant = await tableExists(client, 'ConsciousCareerGrantApplication');
  const providerCrmToolVisibility = await tableExists(client, 'ProviderCrmToolVisibility');
  return {
    providerApplicant,
    providerApplicantConsentAudit:
      providerApplicant && (await columnExists(client, 'ProviderApplicant', 'consentAudit')),
    consciousCareerGrantApplication: careerGrant,
    providerCrmToolVisibility,
  };
}

async function main() {
  const client = buildClient();
  await client.connect();
  try {
    const before = await collectStatus(client);
    if (apply) {
      await client.query('BEGIN');
      await client.query(providerApplicantSql);
      await client.query(careerGrantSql);
      await client.query(providerCrmToolVisibilitySql);
      await client.query('COMMIT');
    }
    const after = await collectStatus(client);
    console.log(
      JSON.stringify(
        {
          apply,
          before,
          after,
          missingAfterApply: Object.entries(after)
            .filter(([, exists]) => !exists)
            .map(([name]) => name),
        },
        null,
        2
      )
    );
  } catch (error) {
    if (apply) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection may already be closed or failed.
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
