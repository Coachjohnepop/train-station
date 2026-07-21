-- Coach-selectable rest timer end sound (whistle | bell | buzzer | cybertruck)
ALTER TABLE "Workout" ADD COLUMN IF NOT EXISTS "restTimerSound" TEXT;
