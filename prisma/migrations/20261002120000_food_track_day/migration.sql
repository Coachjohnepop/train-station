CREATE TABLE IF NOT EXISTS "FoodTrackDay" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eatenOn" TEXT NOT NULL,
  "seasonKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodTrackDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodTrackDay_userId_eatenOn_key" ON "FoodTrackDay"("userId", "eatenOn");
CREATE INDEX IF NOT EXISTS "FoodTrackDay_userId_seasonKey_idx" ON "FoodTrackDay"("userId", "seasonKey");

DO $$ BEGIN
  ALTER TABLE "FoodTrackDay"
    ADD CONSTRAINT "FoodTrackDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
