CREATE TABLE IF NOT EXISTS "Affiliate" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "totalRevenueCents" INTEGER NOT NULL DEFAULT 0,
  "totalCommissionCents" INTEGER NOT NULL DEFAULT 0,
  "pendingBalanceCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Affiliate_email_key" ON "Affiliate"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Affiliate_referralCode_key" ON "Affiliate"("referralCode");
CREATE INDEX IF NOT EXISTS "Affiliate_status_idx" ON "Affiliate"("status");

CREATE TABLE IF NOT EXISTS "AffiliateCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "discountPercent" DOUBLE PRECISION NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "maxUsage" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "stripePromotionCodeId" TEXT,
  "stripeCouponId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateCode_code_key" ON "AffiliateCode"("code");
CREATE INDEX IF NOT EXISTS "AffiliateCode_affiliateId_idx" ON "AffiliateCode"("affiliateId");

CREATE TABLE IF NOT EXISTS "AffiliatePayout" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AffiliatePayout_affiliateId_status_idx" ON "AffiliatePayout"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "AffiliatePayout_status_createdAt_idx" ON "AffiliatePayout"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "AffiliateClick" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "referer" TEXT,
  "landingPage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateClick_visitorId_idx" ON "AffiliateClick"("visitorId");

CREATE TABLE IF NOT EXISTS "AffiliateConversion" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "affiliateCodeId" TEXT,
  "plan" TEXT,
  "orderSubtotalCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "commissionRate" DOUBLE PRECISION NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "stripeCheckoutSessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "payoutId" TEXT,
  CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateConversion_userId_key" ON "AffiliateConversion"("userId");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_affiliateId_status_idx" ON "AffiliateConversion"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "AffiliateConversion_affiliateId_createdAt_idx" ON "AffiliateConversion"("affiliateId", "createdAt");

CREATE TABLE IF NOT EXISTS "AffiliateResetToken" (
  "tokenHash" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "rawToken" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateResetToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "AffiliateResetToken_affiliateId_idx" ON "AffiliateResetToken"("affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliateResetToken_expiresAt_idx" ON "AffiliateResetToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "AffiliateCode"
    ADD CONSTRAINT "AffiliateCode_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePayout"
    ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateClick"
    ADD CONSTRAINT "AffiliateClick_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateConversion"
    ADD CONSTRAINT "AffiliateConversion_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateConversion"
    ADD CONSTRAINT "AffiliateConversion_affiliateCodeId_fkey"
    FOREIGN KEY ("affiliateCodeId") REFERENCES "AffiliateCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateConversion"
    ADD CONSTRAINT "AffiliateConversion_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateResetToken"
    ADD CONSTRAINT "AffiliateResetToken_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
