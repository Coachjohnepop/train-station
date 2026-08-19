-- Rest after each warm-up movement (one card / named sets).
ALTER TABLE "CoachSettings" ADD COLUMN IF NOT EXISTS "warmupRestSeconds" INTEGER NOT NULL DEFAULT 15;
