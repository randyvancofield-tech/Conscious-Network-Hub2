DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('user', 'provider', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SocialPostVisibility" AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS "providerExternalId" TEXT,
ADD COLUMN IF NOT EXISTS "handle" TEXT,
ADD COLUMN IF NOT EXISTS "bio" TEXT,
ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
ADD COLUMN IF NOT EXISTS "interests" JSONB,
ADD COLUMN IF NOT EXISTS "twitterUrl" TEXT,
ADD COLUMN IF NOT EXISTS "githubUrl" TEXT,
ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT,
ADD COLUMN IF NOT EXISTS "privacySettings" JSONB,
ADD COLUMN IF NOT EXISTS "passwordFingerprint" TEXT,
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "twoFactorMethod" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "walletDid" TEXT,
ADD COLUMN IF NOT EXISTS "pendingPhoneOtpHash" TEXT,
ADD COLUMN IF NOT EXISTS "pendingPhoneOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pendingPhoneOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "failedSignInAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_providerExternalId_key" ON "User"("providerExternalId");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "Membership_createdAt_idx" ON "Membership"("createdAt");
CREATE INDEX IF NOT EXISTS "PaymentHistory_userId_idx" ON "PaymentHistory"("userId");
CREATE INDEX IF NOT EXISTS "PaymentHistory_createdAt_idx" ON "PaymentHistory"("createdAt");

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" DROP DEFAULT;

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" TYPE "SocialPostVisibility"
USING (
  CASE
    WHEN lower(coalesce("visibility", '')) = 'private' THEN 'private'::"SocialPostVisibility"
    ELSE 'public'::"SocialPostVisibility"
  END
);

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" SET DEFAULT 'public'::"SocialPostVisibility";

ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "User_profileMedia_json_shape_check",
DROP CONSTRAINT IF EXISTS "User_privacySettings_json_shape_check",
DROP CONSTRAINT IF EXISTS "User_interests_json_shape_check";

ALTER TABLE "User"
ADD CONSTRAINT "User_profileMedia_json_shape_check"
CHECK (
  "profileMedia" IS NULL OR (
    jsonb_typeof("profileMedia") = 'object'
    AND jsonb_typeof("profileMedia"->'avatar') = 'object'
    AND jsonb_typeof("profileMedia"->'cover') = 'object'
    AND (
      ("profileMedia"->'avatar'->'url') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'url') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'avatar'->'storageProvider') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'storageProvider') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'avatar'->'objectKey') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'objectKey') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'url') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'url') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'storageProvider') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'storageProvider') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'objectKey') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'objectKey') IN ('string', 'null')
    )
  )
) NOT VALID;

ALTER TABLE "User"
ADD CONSTRAINT "User_privacySettings_json_shape_check"
CHECK (
  "privacySettings" IS NULL OR (
    jsonb_typeof("privacySettings") = 'object'
    AND ("privacySettings"->>'profileVisibility') IN ('public', 'private')
    AND jsonb_typeof("privacySettings"->'showEmail') = 'boolean'
    AND jsonb_typeof("privacySettings"->'allowMessages') = 'boolean'
    AND jsonb_typeof("privacySettings"->'blockedUsers') = 'array'
    AND NOT jsonb_path_exists(
      "privacySettings"->'blockedUsers',
      '$[*] ? (@.type() != "string")'
    )
  )
) NOT VALID;

ALTER TABLE "User"
ADD CONSTRAINT "User_interests_json_shape_check"
CHECK (
  "interests" IS NULL OR (
    jsonb_typeof("interests") = 'array'
    AND NOT jsonb_path_exists(
      "interests",
      '$[*] ? (@.type() != "string")'
    )
  )
) NOT VALID;

CREATE TABLE "ProviderBridgeLaunch" (
    "id" TEXT NOT NULL,
    "providerExternalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "jti" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderBridgeLaunch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderBridgeLaunch_jti_key" ON "ProviderBridgeLaunch"("jti");
CREATE INDEX "ProviderBridgeLaunch_providerExternalId_idx" ON "ProviderBridgeLaunch"("providerExternalId");
CREATE INDEX "ProviderBridgeLaunch_expiresAt_idx" ON "ProviderBridgeLaunch"("expiresAt");
CREATE INDEX "ProviderBridgeLaunch_consumedAt_idx" ON "ProviderBridgeLaunch"("consumedAt");

CREATE TABLE "ProviderChallenge" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderChallenge_did_idx" ON "ProviderChallenge"("did");
CREATE INDEX "ProviderChallenge_expiresAt_idx" ON "ProviderChallenge"("expiresAt");

CREATE TABLE "ProviderSession" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderSession_did_idx" ON "ProviderSession"("did");
CREATE INDEX "ProviderSession_expiresAt_idx" ON "ProviderSession"("expiresAt");
CREATE INDEX "ProviderSession_revokedAt_idx" ON "ProviderSession"("revokedAt");
