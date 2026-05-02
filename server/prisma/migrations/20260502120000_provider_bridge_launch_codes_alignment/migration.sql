DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'walletAddress'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "walletAddress" TO "wallet_address";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'providerApproved'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'provider_status'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "providerApproved" TO "provider_status";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'tier'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'membership_tier'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "tier" TO "membership_tier";
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wallet_address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provider_status" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membership_tier" TEXT NOT NULL DEFAULT 'Free / Community Tier';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ProviderBridgeLaunch'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'launch_codes'
  ) THEN
    ALTER TABLE "ProviderBridgeLaunch" RENAME TO "launch_codes";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'code'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "id" TO "code";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'providerExternalId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'provider_external_id'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "providerExternalId" TO "provider_external_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'approvalStatus'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "approvalStatus" TO "approval_status";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'providerApproved'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'provider_status'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "providerApproved" TO "provider_status";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'walletAddress'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "walletAddress" TO "wallet_address";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'walletDid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'wallet_did'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "walletDid" TO "wallet_did";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'issuedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'issued_at'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "issuedAt" TO "issued_at";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'expiresAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "expiresAt" TO "expires_at";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'consumedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'consumed_at'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "consumedAt" TO "consumed_at";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'createdAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_codes' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "launch_codes" RENAME COLUMN "createdAt" TO "created_at";
  END IF;
END $$;

ALTER TABLE "launch_codes" ADD COLUMN IF NOT EXISTS "provider_id" TEXT;
ALTER TABLE "launch_codes" ADD COLUMN IF NOT EXISTS "provider_external_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "launch_codes" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'launch_codes_provider_id_fkey'
  ) THEN
    ALTER TABLE "launch_codes"
    ADD CONSTRAINT "launch_codes_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "launch_codes_provider_id_idx" ON "launch_codes"("provider_id");
CREATE INDEX IF NOT EXISTS "launch_codes_provider_external_id_idx" ON "launch_codes"("provider_external_id");
CREATE INDEX IF NOT EXISTS "launch_codes_expires_at_idx" ON "launch_codes"("expires_at");
CREATE INDEX IF NOT EXISTS "launch_codes_consumed_at_idx" ON "launch_codes"("consumed_at");
