CREATE TABLE "AnalyticsWeekdaySnapshot" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "dow" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsWeekdaySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsWeekdaySnapshot_weekStart_dow_key" ON "AnalyticsWeekdaySnapshot"("weekStart", "dow");
CREATE INDEX "AnalyticsWeekdaySnapshot_weekStart_idx" ON "AnalyticsWeekdaySnapshot"("weekStart");

CREATE TABLE "SocialDripPost" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "channels" TEXT NOT NULL DEFAULT '["x","instagram","facebook"]',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialDripPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialDripPost_status_scheduledAt_idx" ON "SocialDripPost"("status", "scheduledAt");
