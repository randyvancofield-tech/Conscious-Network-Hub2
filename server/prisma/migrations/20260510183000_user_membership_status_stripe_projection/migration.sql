ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membership_status" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripe_id" TEXT;

CREATE INDEX IF NOT EXISTS "User_membership_status_idx" ON "User"("membership_status");
CREATE INDEX IF NOT EXISTS "User_stripe_id_idx" ON "User"("stripe_id");
