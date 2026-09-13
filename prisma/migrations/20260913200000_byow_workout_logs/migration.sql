CREATE TABLE "ByowWorkoutLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "exerciseNames" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ByowWorkoutLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ByowWorkoutLog_userId_completedAt_idx" ON "ByowWorkoutLog"("userId", "completedAt");
CREATE INDEX "ByowWorkoutLog_workoutId_idx" ON "ByowWorkoutLog"("workoutId");

ALTER TABLE "ByowWorkoutLog" ADD CONSTRAINT "ByowWorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ByowWorkoutLog" ADD CONSTRAINT "ByowWorkoutLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ByowWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
