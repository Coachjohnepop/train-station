-- Live session rest controls so coach mid-session changes reach the member.
ALTER TABLE "LiveWorkoutSession" ADD COLUMN IF NOT EXISTS "restTimerEnabled" BOOLEAN;
ALTER TABLE "LiveWorkoutSession" ADD COLUMN IF NOT EXISTS "restTimerSeconds" INTEGER;
ALTER TABLE "LiveWorkoutSession" ADD COLUMN IF NOT EXISTS "restTimerSound" TEXT;
