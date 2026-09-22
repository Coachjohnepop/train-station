CREATE TABLE IF NOT EXISTS "Approach" (
  "id" TEXT NOT NULL,
  "slug" TEXT,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Approach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Approach_slug_key" ON "Approach"("slug");

ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "approachId" TEXT;

CREATE INDEX IF NOT EXISTS "WorkoutExercise_approachId_idx" ON "WorkoutExercise"("approachId");

DO $$ BEGIN
  ALTER TABLE "WorkoutExercise"
    ADD CONSTRAINT "WorkoutExercise_approachId_fkey"
    FOREIGN KEY ("approachId") REFERENCES "Approach"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
