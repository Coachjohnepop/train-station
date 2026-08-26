-- Catch-up: log stamps today; source program day is remembered so the missed chip shows done.
ALTER TABLE "WorkoutLog" ADD COLUMN IF NOT EXISTS "catchUpForDate" TEXT;
CREATE INDEX IF NOT EXISTS "WorkoutLog_userId_catchUpForDate_idx" ON "WorkoutLog"("userId", "catchUpForDate");
