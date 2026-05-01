ALTER TABLE "User" ADD COLUMN "providerApprovalStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "providerApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "providerRevokedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "providerAccessUpdatedAt" TIMESTAMP(3);

CREATE INDEX "User_providerApproved_idx" ON "User"("providerApproved");
CREATE INDEX "User_providerRevokedAt_idx" ON "User"("providerRevokedAt");
