ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "commissionMonths" INTEGER;
ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "vanityPath" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Affiliate_vanityPath_key" ON "Affiliate"("vanityPath");

DROP INDEX IF EXISTS "AffiliateConversion_userId_key";
CREATE INDEX IF NOT EXISTS "AffiliateConversion_userId_createdAt_idx" ON "AffiliateConversion"("userId", "createdAt");
ALTER TABLE "AffiliateConversion" ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateConversion_stripeInvoiceId_key" ON "AffiliateConversion"("stripeInvoiceId");
