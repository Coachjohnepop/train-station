-- Durable email / push notification ledger (Postgres source of truth)
CREATE TABLE IF NOT EXISTS "OutboundNotification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "toAddress" TEXT,
    "userId" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundNotification_channel_createdAt_idx" ON "OutboundNotification"("channel", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundNotification_category_createdAt_idx" ON "OutboundNotification"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundNotification_userId_createdAt_idx" ON "OutboundNotification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundNotification_status_createdAt_idx" ON "OutboundNotification"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundNotification_toAddress_createdAt_idx" ON "OutboundNotification"("toAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundNotification_createdAt_idx" ON "OutboundNotification"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutboundNotification_userId_fkey'
  ) THEN
    ALTER TABLE "OutboundNotification"
      ADD CONSTRAINT "OutboundNotification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
