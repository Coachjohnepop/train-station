-- Recrawl ping cooldown (Admin → Search). Optional so older rows stay valid.
ALTER TABLE "SiteSeoSettings" ADD COLUMN IF NOT EXISTS "lastRecrawlPingAt" TIMESTAMP(3);
