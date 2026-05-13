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
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ConsciousCareerGrantApplication_userId_fkey'
  ) THEN
    ALTER TABLE "ConsciousCareerGrantApplication"
      ADD CONSTRAINT "ConsciousCareerGrantApplication_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
