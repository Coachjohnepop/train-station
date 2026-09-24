CREATE TABLE IF NOT EXISTS "AffiliateInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedByEmail" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateInvite_tokenHash_key" ON "AffiliateInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "AffiliateInvite_email_idx" ON "AffiliateInvite"("email");
CREATE INDEX IF NOT EXISTS "AffiliateInvite_expiresAt_idx" ON "AffiliateInvite"("expiresAt");
