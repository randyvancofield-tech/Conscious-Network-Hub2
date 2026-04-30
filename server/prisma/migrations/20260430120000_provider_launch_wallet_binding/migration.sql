ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;

ALTER TABLE "ProviderBridgeLaunch" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'provider';
ALTER TABLE "ProviderBridgeLaunch" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "ProviderBridgeLaunch" ADD COLUMN "providerApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderBridgeLaunch" ADD COLUMN "walletAddress" TEXT;
ALTER TABLE "ProviderBridgeLaunch" ADD COLUMN "walletDid" TEXT;

