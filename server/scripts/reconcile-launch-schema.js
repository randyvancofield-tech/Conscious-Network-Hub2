const path = require('path');
const { Client } = require('pg');
const { loadServerEnv, logServerEnvDiagnostics } = require('./load-env');

loadServerEnv();
logServerEnvDiagnostics('RECONCILE_LAUNCH_SCHEMA');

const apply = process.argv.includes('--apply');

const userRoleApplicantSql = `
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'applicant';
`;

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

const notificationSql = `
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "roleScope" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

const adminMessageSql = `
CREATE TABLE IF NOT EXISTS "AdminMessage" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "submitterName" TEXT,
  "submitterEmail" TEXT,
  "submitterUserId" TEXT,
  "route" TEXT,
  "category" TEXT,
  "source" TEXT NOT NULL DEFAULT 'platform',
  "recipientEmail" TEXT NOT NULL DEFAULT 'higherconscious.network1@gmail.com',
  "metadata" JSONB,
  "aiAnalysis" TEXT,
  "adminNotes" TEXT,
  "resolutionSummary" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminMessage_recipient_status_idx" ON "AdminMessage"("recipientEmail", "status");
CREATE INDEX IF NOT EXISTS "AdminMessage_type_created_idx" ON "AdminMessage"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminMessage_priority_status_idx" ON "AdminMessage"("priority", "status");
CREATE INDEX IF NOT EXISTS "AdminMessage_submitter_idx" ON "AdminMessage"("submitterUserId");
`;

const accountRecoveryCodeSql = `
CREATE TABLE IF NOT EXISTS "AccountRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountRecoveryCode_codeHash_key" ON "AccountRecoveryCode"("codeHash");
CREATE INDEX IF NOT EXISTS "AccountRecoveryCode_userId_usedAt_idx" ON "AccountRecoveryCode"("userId", "usedAt");
CREATE INDEX IF NOT EXISTS "AccountRecoveryCode_userId_revokedAt_idx" ON "AccountRecoveryCode"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "AccountRecoveryCode_createdAt_idx" ON "AccountRecoveryCode"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountRecoveryCode_userId_fkey'
  ) THEN
    ALTER TABLE "AccountRecoveryCode"
      ADD CONSTRAINT "AccountRecoveryCode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
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

async function enumValueExists(client, enumName, enumValue) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = $1
          AND pg_enum.enumlabel = $2
      ) AS exists
    `,
    [enumName, enumValue]
  );
  return Boolean(result.rows[0]?.exists);
}

async function collectStatus(client) {
  const providerApplicant = await tableExists(client, 'ProviderApplicant');
  const careerGrant = await tableExists(client, 'ConsciousCareerGrantApplication');
  const providerCrmToolVisibility = await tableExists(client, 'ProviderCrmToolVisibility');
  const notification = await tableExists(client, 'Notification');
  const adminMessage = await tableExists(client, 'AdminMessage');
  const accountRecoveryCode = await tableExists(client, 'AccountRecoveryCode');
  const user = await tableExists(client, 'User');
  return {
    userRoleApplicant: await enumValueExists(client, 'UserRole', 'applicant'),
    userWalletAddress: user && (await columnExists(client, 'User', 'wallet_address')),
    providerApplicant,
    providerApplicantConsentAudit:
      providerApplicant && (await columnExists(client, 'ProviderApplicant', 'consentAudit')),
    consciousCareerGrantApplication: careerGrant,
    providerCrmToolVisibility,
    notification,
    adminMessage,
    accountRecoveryCode,
  };
}

async function main() {
  const client = buildClient();
  await client.connect();
  try {
    const before = await collectStatus(client);
    if (apply) {
      await client.query('BEGIN');
      await client.query(userRoleApplicantSql);
      await client.query(providerApplicantSql);
      await client.query(careerGrantSql);
      await client.query(providerCrmToolVisibilitySql);
      await client.query(notificationSql);
      await client.query(adminMessageSql);
      await client.query(accountRecoveryCodeSql);
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
