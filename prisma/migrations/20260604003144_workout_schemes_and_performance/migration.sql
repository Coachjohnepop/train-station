-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "setScheme" TEXT;
ALTER TABLE "WorkoutExercise" ADD COLUMN "weightTier" TEXT;

-- CreateTable
CREATE TABLE "ExercisePerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "workoutExerciseId" TEXT,
    "setScheme" TEXT NOT NULL,
    "weightTier" TEXT NOT NULL,
    "startingWeightLbs" REAL,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExercisePerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExercisePerformance_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExercisePerformance_userId_exerciseId_performedAt_idx" ON "ExercisePerformance"("userId", "exerciseId", "performedAt");
