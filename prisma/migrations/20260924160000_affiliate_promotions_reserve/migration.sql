CREATE TABLE IF NOT EXISTS "AffiliatePromotion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "discountPercent" DOUBLE PRECISION NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliatePromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliateProgramSettings" (
  "id" TEXT NOT NULL,
  "reserveTargetCents" INTEGER NOT NULL DEFAULT 50000,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateProgramSettings_pkey" PRIMARY KEY ("id")
);
