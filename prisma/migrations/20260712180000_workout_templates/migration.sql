-- Coach workout template library (paste always clones)
CREATE TABLE IF NOT EXISTS "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "versionLabel" TEXT,
    "notes" TEXT,
    "workoutId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutTemplate_workoutId_key" ON "WorkoutTemplate"("workoutId");
CREATE INDEX IF NOT EXISTS "WorkoutTemplate_category_name_idx" ON "WorkoutTemplate"("category", "name");
CREATE INDEX IF NOT EXISTS "WorkoutTemplate_updatedAt_idx" ON "WorkoutTemplate"("updatedAt");

DO $$ BEGIN
  ALTER TABLE "WorkoutTemplate"
    ADD CONSTRAINT "WorkoutTemplate_workoutId_fkey"
    FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
