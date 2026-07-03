-- Data warehouse foundation: analytics events, payment facts, daily marts, workout certify fields

ALTER TABLE "Workout" ADD COLUMN IF NOT EXISTS "certifiedAt" TIMESTAMP(3);
ALTER TABLE "Workout" ADD COLUMN IF NOT EXISTS "exportText" TEXT;
ALTER TABLE "Workout" ADD COLUMN IF NOT EXISTS "certifiedBy" TEXT;

CREATE TABLE IF NOT EXISTS "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "landingPath" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "deviceType" TEXT,
    "userAgent" TEXT,
    "convertedSignup" BOOLEAN NOT NULL DEFAULT false,
    "convertedPaid" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsSession_sessionKey_key" ON "AnalyticsSession"("sessionKey");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_userId_idx" ON "AnalyticsSession"("userId");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_lastActivityAt_idx" ON "AnalyticsSession"("lastActivityAt");

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "anonymousId" TEXT,
    "pagePath" TEXT,
    "pageTitle" TEXT,
    "pageSection" TEXT,
    "referrer" TEXT,
    "elementId" TEXT,
    "elementText" TEXT,
    "elementRole" TEXT,
    "clickHref" TEXT,
    "clickAction" TEXT,
    "programId" TEXT,
    "programSlug" TEXT,
    "workoutId" TEXT,
    "exerciseId" TEXT,
    "enrollmentId" TEXT,
    "tierSlug" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "deviceType" TEXT,
    "role" TEXT,
    "properties" JSONB,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionKey_occurredAt_idx" ON "AnalyticsEvent"("sessionKey", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_pagePath_occurredAt_idx" ON "AnalyticsEvent"("pagePath", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

CREATE TABLE IF NOT EXISTS "FactSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "amountRefundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "tierSlug" TEXT,
    "planId" TEXT,
    "billingReason" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "stripeEventId" TEXT,
    "properties" JSONB,
    CONSTRAINT "FactSubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactSubscriptionPayment_stripeInvoiceId_key" ON "FactSubscriptionPayment"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "FactSubscriptionPayment_paidAt_idx" ON "FactSubscriptionPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "FactSubscriptionPayment_userId_paidAt_idx" ON "FactSubscriptionPayment"("userId", "paidAt");
CREATE INDEX IF NOT EXISTS "FactSubscriptionPayment_status_paidAt_idx" ON "FactSubscriptionPayment"("status", "paidAt");

CREATE TABLE IF NOT EXISTS "FactCommissionPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerEmail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactCommissionPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactCommissionPayout_paidAt_idx" ON "FactCommissionPayout"("paidAt");
CREATE INDEX IF NOT EXISTS "FactCommissionPayout_partnerId_idx" ON "FactCommissionPayout"("partnerId");
CREATE INDEX IF NOT EXISTS "FactCommissionPayout_status_idx" ON "FactCommissionPayout"("status");

CREATE TABLE IF NOT EXISTS "MartDailyMetrics" (
    "id" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "activeMembers" INTEGER NOT NULL DEFAULT 0,
    "payingMembers" INTEGER NOT NULL DEFAULT 0,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "newSignups" INTEGER NOT NULL DEFAULT 0,
    "workoutCompletions" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "pageClicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "liveSessionsJoined" INTEGER NOT NULL DEFAULT 0,
    "churnedSubscriptions" INTEGER NOT NULL DEFAULT 0,
    "properties" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MartDailyMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MartDailyMetrics_metricDate_key" ON "MartDailyMetrics"("metricDate");

CREATE TABLE IF NOT EXISTS "MartMemberDailySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "tierSlug" TEXT,
    "role" TEXT NOT NULL,
    "isPaying" BOOLEAN NOT NULL DEFAULT false,
    "workoutsCompleted" INTEGER NOT NULL DEFAULT 0,
    "exercisesLogged" INTEGER NOT NULL DEFAULT 0,
    "gamificationPoints" INTEGER NOT NULL DEFAULT 0,
    "programSlug" TEXT,
    "enrollmentDay" INTEGER,
    "daysSinceLastWorkout" INTEGER,
    "city" TEXT,
    "state" TEXT,
    CONSTRAINT "MartMemberDailySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MartMemberDailySnapshot_userId_snapshotDate_key" ON "MartMemberDailySnapshot"("userId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "MartMemberDailySnapshot_snapshotDate_idx" ON "MartMemberDailySnapshot"("snapshotDate");
CREATE INDEX IF NOT EXISTS "MartMemberDailySnapshot_snapshotDate_isPaying_idx" ON "MartMemberDailySnapshot"("snapshotDate", "isPaying");

ALTER TABLE "AnalyticsSession" DROP CONSTRAINT IF EXISTS "AnalyticsSession_userId_fkey";
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT IF EXISTS "AnalyticsEvent_sessionId_fkey";
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_fkey";
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FactSubscriptionPayment" DROP CONSTRAINT IF EXISTS "FactSubscriptionPayment_userId_fkey";
ALTER TABLE "FactSubscriptionPayment" ADD CONSTRAINT "FactSubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MartMemberDailySnapshot" DROP CONSTRAINT IF EXISTS "MartMemberDailySnapshot_userId_fkey";
ALTER TABLE "MartMemberDailySnapshot" ADD CONSTRAINT "MartMemberDailySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;