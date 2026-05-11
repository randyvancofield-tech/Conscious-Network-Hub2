ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'applicant';

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
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "adminNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calendlyShownAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderApplicant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderApplicant_userId_key" ON "ProviderApplicant"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderApplicant_email_key" ON "ProviderApplicant"("email");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_status_idx" ON "ProviderApplicant"("status");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_providerCategory_idx" ON "ProviderApplicant"("providerCategory");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_submittedAt_idx" ON "ProviderApplicant"("submittedAt");
CREATE INDEX IF NOT EXISTS "ProviderApplicant_createdAt_idx" ON "ProviderApplicant"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProviderApplicant_userId_fkey'
  ) THEN
    ALTER TABLE "ProviderApplicant"
      ADD CONSTRAINT "ProviderApplicant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
