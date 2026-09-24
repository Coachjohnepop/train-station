ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Affiliate_stripeAccountId_idx" ON "Affiliate"("stripeAccountId");

ALTER TABLE "AffiliatePayout" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;
