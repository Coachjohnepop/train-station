-- Bring Your Own Workout — isolated catalog (not Jeremy's Exercise/Workout tables).

CREATE TABLE "ByowExercise" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByowExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ByowWorkout" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "exportText" TEXT,
    "source" TEXT NOT NULL DEFAULT 'notes',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByowWorkout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ByowWorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "setScheme" TEXT,
    "reps" TEXT,
    "sets" INTEGER,
    "restSec" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ByowWorkoutExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ByowSourceNote" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "filename" TEXT,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ByowSourceNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ByowExercise_ownerUserId_name_idx" ON "ByowExercise"("ownerUserId", "name");
CREATE INDEX "ByowWorkout_ownerUserId_updatedAt_idx" ON "ByowWorkout"("ownerUserId", "updatedAt");
CREATE INDEX "ByowWorkoutExercise_workoutId_sortOrder_idx" ON "ByowWorkoutExercise"("workoutId", "sortOrder");
CREATE UNIQUE INDEX "ByowSourceNote_workoutId_key" ON "ByowSourceNote"("workoutId");
CREATE INDEX "ByowSourceNote_ownerUserId_createdAt_idx" ON "ByowSourceNote"("ownerUserId", "createdAt");

ALTER TABLE "ByowExercise" ADD CONSTRAINT "ByowExercise_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByowWorkout" ADD CONSTRAINT "ByowWorkout_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByowWorkoutExercise" ADD CONSTRAINT "ByowWorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ByowWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByowWorkoutExercise" ADD CONSTRAINT "ByowWorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ByowExercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ByowSourceNote" ADD CONSTRAINT "ByowSourceNote_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByowSourceNote" ADD CONSTRAINT "ByowSourceNote_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ByowWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
