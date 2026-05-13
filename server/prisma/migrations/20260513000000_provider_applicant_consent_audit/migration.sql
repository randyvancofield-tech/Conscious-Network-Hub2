ALTER TABLE "ProviderApplicant"
  ADD COLUMN IF NOT EXISTS "consentAudit" JSONB;
