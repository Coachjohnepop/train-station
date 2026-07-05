-- Macro training phases (Jeremy cycle) + gym/home enrollment track

CREATE TABLE "ProgramMacroPhase" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "phaseIndex" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minWeeks" INTEGER NOT NULL,
    "maxWeeks" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramMacroPhase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramMacroPhase_programId_phaseIndex_key" ON "ProgramMacroPhase"("programId", "phaseIndex");
CREATE INDEX "ProgramMacroPhase_programId_sortOrder_idx" ON "ProgramMacroPhase"("programId", "sortOrder");

ALTER TABLE "ProgramMacroPhase" ADD CONSTRAINT "ProgramMacroPhase_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramWeek" ADD COLUMN "macroPhaseIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProgramWeek" ADD COLUMN "phaseWeekNumber" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "ProgramWeek_programId_macroPhaseIndex_phaseWeekNumber_idx" ON "ProgramWeek"("programId", "macroPhaseIndex", "phaseWeekNumber");

-- Backfill existing weeks: global weekNumber becomes phase week within phase 1
UPDATE "ProgramWeek" SET "macroPhaseIndex" = 1, "phaseWeekNumber" = "weekNumber";

ALTER TABLE "ProgramEnrollment" ADD COLUMN "trainingLocation" TEXT NOT NULL DEFAULT 'gym';