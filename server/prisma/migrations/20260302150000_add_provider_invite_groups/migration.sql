CREATE TABLE "ProviderInviteGroup" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "membersJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderInviteGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderInviteGroup_did_name_key" ON "ProviderInviteGroup"("did", "name");
CREATE INDEX "ProviderInviteGroup_did_idx" ON "ProviderInviteGroup"("did");
CREATE INDEX "ProviderInviteGroup_updatedAt_idx" ON "ProviderInviteGroup"("updatedAt");
