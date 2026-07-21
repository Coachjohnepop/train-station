-- Shared rest timer popup state (coach checkoff → member countdown).
ALTER TABLE "LiveWorkoutSession" ADD COLUMN IF NOT EXISTS "restActive" JSONB;
