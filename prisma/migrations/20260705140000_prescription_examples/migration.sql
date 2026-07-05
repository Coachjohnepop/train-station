CREATE TABLE "PrescriptionExample" (
    "id" INTEGER NOT NULL,
    "patternType" TEXT NOT NULL,
    "sampleExercise" TEXT NOT NULL,
    "setCount" INTEGER NOT NULL,
    "restBetweenSetsSec" INTEGER NOT NULL DEFAULT 90,
    "weightTier" TEXT NOT NULL DEFAULT 'medium',
    "phase1Type" TEXT,
    "phase1DurationSec" INTEGER,
    "phase1Reps" INTEGER,
    "phase1RepKind" TEXT,
    "phase1PositionCue" TEXT,
    "phase2Type" TEXT,
    "phase2DurationSec" INTEGER,
    "phase2Reps" INTEGER,
    "phase2RepKind" TEXT,
    "phase2PositionCue" TEXT,
    "notes" TEXT,
    "summary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrescriptionExample_patternType_idx" ON "PrescriptionExample"("patternType");