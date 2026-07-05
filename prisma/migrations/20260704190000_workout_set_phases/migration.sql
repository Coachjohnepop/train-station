-- Structured workout prescriptions: phases (hold / reps / burnout / timed)
-- and explicit set count + rest-between on WorkoutExercise.

CREATE TYPE "SetPhaseType" AS ENUM ('HOLD', 'REPS', 'BURNOUT', 'TIMED');
CREATE TYPE "RepKind" AS ENUM ('FIXED', 'BURNOUT', 'MAX');

ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "setCount" INTEGER;
ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "restBetweenSetsSec" INTEGER;

-- Backfill new columns from legacy flat fields where present.
UPDATE "WorkoutExercise"
SET "setCount" = "sets"
WHERE "setCount" IS NULL AND "sets" IS NOT NULL;

UPDATE "WorkoutExercise"
SET "restBetweenSetsSec" = "restSec"
WHERE "restBetweenSetsSec" IS NULL AND "restSec" IS NOT NULL;

CREATE TABLE "WorkoutSetPhase" (
    "id" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "phaseIndex" INTEGER NOT NULL,
    "phaseType" "SetPhaseType" NOT NULL,
    "durationSec" INTEGER,
    "reps" INTEGER,
    "repKind" "RepKind" NOT NULL DEFAULT 'FIXED',
    "positionCue" TEXT,

    CONSTRAINT "WorkoutSetPhase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutSetPhase_workoutExerciseId_phaseIndex_key"
    ON "WorkoutSetPhase"("workoutExerciseId", "phaseIndex");

CREATE INDEX "WorkoutSetPhase_workoutExerciseId_idx"
    ON "WorkoutSetPhase"("workoutExerciseId");

ALTER TABLE "WorkoutSetPhase"
    ADD CONSTRAINT "WorkoutSetPhase_workoutExerciseId_fkey"
    FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;