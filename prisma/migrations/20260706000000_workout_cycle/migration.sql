-- 28-day workout cycle as the focal content unit.

CREATE TABLE IF NOT EXISTS "WorkoutCycle" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "programId" TEXT,
  "cycleMonth" INTEGER,
  "clonedFromId" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkoutCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkoutCycleDay" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  "isDayOff" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "WorkoutCycleDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkoutCycleDaySlot" (
  "id" TEXT NOT NULL,
  "cycleDayId" TEXT NOT NULL,
  "workoutId" TEXT NOT NULL,
  "trainingLocation" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkoutCycleDaySlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutCycle_programId_cycleMonth_key"
  ON "WorkoutCycle"("programId", "cycleMonth");
CREATE INDEX IF NOT EXISTS "WorkoutCycle_programId_idx" ON "WorkoutCycle"("programId");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutCycleDay_cycleId_dayNumber_key"
  ON "WorkoutCycleDay"("cycleId", "dayNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutCycleDaySlot_cycleDayId_trainingLocation_key"
  ON "WorkoutCycleDaySlot"("cycleDayId", "trainingLocation");
CREATE INDEX IF NOT EXISTS "WorkoutCycleDaySlot_workoutId_idx" ON "WorkoutCycleDaySlot"("workoutId");

ALTER TABLE "WorkoutCycle"
  ADD CONSTRAINT "WorkoutCycle_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutCycle"
  ADD CONSTRAINT "WorkoutCycle_clonedFromId_fkey"
  FOREIGN KEY ("clonedFromId") REFERENCES "WorkoutCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkoutCycleDay"
  ADD CONSTRAINT "WorkoutCycleDay_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "WorkoutCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutCycleDaySlot"
  ADD CONSTRAINT "WorkoutCycleDaySlot_cycleDayId_fkey"
  FOREIGN KEY ("cycleDayId") REFERENCES "WorkoutCycleDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutCycleDaySlot"
  ADD CONSTRAINT "WorkoutCycleDaySlot_workoutId_fkey"
  FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;