-- Soft-archive for catalog exercises (hide from pickers; keep workout references).
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Exercise_archivedAt_idx" ON "Exercise"("archivedAt");
