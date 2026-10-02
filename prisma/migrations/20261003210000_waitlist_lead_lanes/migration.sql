ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "lane" TEXT NOT NULL DEFAULT 'inbox';
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "laneAt" TIMESTAMP(3);
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "joinLinkSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WaitlistEntry_lane_idx" ON "WaitlistEntry"("lane");
