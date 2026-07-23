-- Gamification v2: ledger, seasons, promos, config, prizes

CREATE TABLE IF NOT EXISTS "GamificationConfig" (
    "id" TEXT NOT NULL,
    "levers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "GamificationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GamificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "programSlug" TEXT,
    "seasonKey" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GamificationEvent_userId_at_idx" ON "GamificationEvent"("userId", "at");
CREATE INDEX IF NOT EXISTS "GamificationEvent_seasonKey_userId_idx" ON "GamificationEvent"("seasonKey", "userId");
CREATE INDEX IF NOT EXISTS "GamificationEvent_type_at_idx" ON "GamificationEvent"("type", "at");
CREATE INDEX IF NOT EXISTS "GamificationEvent_userId_type_idx" ON "GamificationEvent"("userId", "type");

CREATE TABLE IF NOT EXISTS "GamificationSeasonScore" (
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "rank" INTEGER,
    "percentile" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationSeasonScore_pkey" PRIMARY KEY ("userId","seasonKey")
);

CREATE INDEX IF NOT EXISTS "GamificationSeasonScore_seasonKey_division_points_idx"
  ON "GamificationSeasonScore"("seasonKey", "division", "points");
CREATE INDEX IF NOT EXISTS "GamificationSeasonScore_seasonKey_division_rank_idx"
  ON "GamificationSeasonScore"("seasonKey", "division", "rank");

CREATE TABLE IF NOT EXISTS "GamificationPromo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'free_week_upgrade',
    "fromPlan" TEXT NOT NULL,
    "toPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimBy" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "GamificationPromo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GamificationPromo_userId_status_idx" ON "GamificationPromo"("userId", "status");
CREATE INDEX IF NOT EXISTS "GamificationPromo_status_claimBy_idx" ON "GamificationPromo"("status", "claimBy");
CREATE INDEX IF NOT EXISTS "GamificationPromo_status_trialEndsAt_idx" ON "GamificationPromo"("status", "trialEndsAt");

CREATE TABLE IF NOT EXISTS "GamificationPrizeAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "freeDays" INTEGER,
    "notes" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedBy" TEXT,

    CONSTRAINT "GamificationPrizeAward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GamificationPrizeAward_userId_seasonKey_idx" ON "GamificationPrizeAward"("userId", "seasonKey");
CREATE INDEX IF NOT EXISTS "GamificationPrizeAward_seasonKey_idx" ON "GamificationPrizeAward"("seasonKey");

-- Append-only compliance trail (no updates/deletes from app code)
CREATE TABLE IF NOT EXISTS "GamificationAuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "GamificationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GamificationAuditLog_at_idx" ON "GamificationAuditLog"("at");
CREATE INDEX IF NOT EXISTS "GamificationAuditLog_actorId_at_idx" ON "GamificationAuditLog"("actorId", "at");
CREATE INDEX IF NOT EXISTS "GamificationAuditLog_action_at_idx" ON "GamificationAuditLog"("action", "at");
CREATE INDEX IF NOT EXISTS "GamificationAuditLog_targetId_at_idx" ON "GamificationAuditLog"("targetId", "at");

