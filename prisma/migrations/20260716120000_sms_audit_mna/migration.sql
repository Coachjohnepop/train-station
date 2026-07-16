-- SMS consent / phone normalization on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneE164" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsOptOutAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsOptInAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_phoneE164_idx" ON "User"("phoneE164");

-- Expand SmsLog into durable messaging ledger
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "direction" TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'sms';
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "providerSid" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "providerStatus" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "simulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- userId optional for unknown-phone / retained audit after user delete
ALTER TABLE "SmsLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Widen message if needed (Postgres TEXT already fine; force Text for Prisma)
ALTER TABLE "SmsLog" ALTER COLUMN "message" TYPE TEXT;

-- Drop old FK and recreate with ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsLog_userId_fkey'
  ) THEN
    ALTER TABLE "SmsLog" DROP CONSTRAINT "SmsLog_userId_fkey";
  END IF;
END $$;

ALTER TABLE "SmsLog"
  ADD CONSTRAINT "SmsLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SmsLog_userId_sentAt_idx" ON "SmsLog"("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "SmsLog_providerSid_idx" ON "SmsLog"("providerSid");
CREATE INDEX IF NOT EXISTS "SmsLog_status_sentAt_idx" ON "SmsLog"("status", "sentAt");
CREATE INDEX IF NOT EXISTS "SmsLog_direction_sentAt_idx" ON "SmsLog"("direction", "sentAt");
CREATE INDEX IF NOT EXISTS "SmsLog_source_sentAt_idx" ON "SmsLog"("source", "sentAt");
CREATE INDEX IF NOT EXISTS "SmsLog_phone_sentAt_idx" ON "SmsLog"("phone", "sentAt");

-- Delivery event trail
CREATE TABLE IF NOT EXISTS "SmsDeliveryEvent" (
    "id" TEXT NOT NULL,
    "smsLogId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "detail" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsDeliveryEvent_smsLogId_createdAt_idx" ON "SmsDeliveryEvent"("smsLogId", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsDeliveryEvent_createdAt_idx" ON "SmsDeliveryEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsDeliveryEvent_smsLogId_fkey'
  ) THEN
    ALTER TABLE "SmsDeliveryEvent"
      ADD CONSTRAINT "SmsDeliveryEvent_smsLogId_fkey"
      FOREIGN KEY ("smsLogId") REFERENCES "SmsLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Append-only system audit
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'info',
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_occurredAt_idx" ON "AuditEvent"("action", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_outcome_occurredAt_idx" ON "AuditEvent"("outcome", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditEvent_actorUserId_fkey'
  ) THEN
    ALTER TABLE "AuditEvent"
      ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
