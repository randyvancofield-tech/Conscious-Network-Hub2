-- Phase 4R-B: internal one-time recovery codes for launch-safe account recovery.

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
