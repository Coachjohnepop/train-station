-- Coach-curated free sample days + optional content tier floor
ALTER TABLE "ProgramDay" ADD COLUMN IF NOT EXISTS "freePool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgramDay" ADD COLUMN IF NOT EXISTS "contentTierMin" TEXT;
CREATE INDEX IF NOT EXISTS "ProgramDay_freePool_idx" ON "ProgramDay"("freePool");
