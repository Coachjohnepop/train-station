-- Cycle position (M1D1 … M1D28) and typed training location on day options.

ALTER TABLE "ProgramDay" ADD COLUMN IF NOT EXISTS "cycleMonth" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProgramDay" ADD COLUMN IF NOT EXISTS "cycleDay" INTEGER;

UPDATE "ProgramDay" pd
SET
  "cycleDay" = (((pw."weekNumber" - 1) * 7 + pd."dayNumber" - 1) % 28) + 1,
  "cycleMonth" = FLOOR(((pw."weekNumber" - 1) * 7 + pd."dayNumber" - 1) / 28) + 1
FROM "ProgramWeek" pw
WHERE pd."weekId" = pw.id AND pd."cycleDay" IS NULL;

ALTER TABLE "ProgramDayOption" ADD COLUMN IF NOT EXISTS "trainingLocation" TEXT;

UPDATE "ProgramDayOption"
SET "trainingLocation" = 'gym'
WHERE "trainingLocation" IS NULL AND LOWER(TRIM("label")) = 'gym';

UPDATE "ProgramDayOption"
SET "trainingLocation" = 'home'
WHERE "trainingLocation" IS NULL AND LOWER(TRIM("label")) LIKE 'home%';