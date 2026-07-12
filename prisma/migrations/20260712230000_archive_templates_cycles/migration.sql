-- Soft-archive shelf for templates and 28-day packs (look back before hard delete)
ALTER TABLE "WorkoutTemplate" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WorkoutTemplate_archivedAt_idx" ON "WorkoutTemplate"("archivedAt");

ALTER TABLE "WorkoutCycle" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WorkoutCycle_archivedAt_idx" ON "WorkoutCycle"("archivedAt");
