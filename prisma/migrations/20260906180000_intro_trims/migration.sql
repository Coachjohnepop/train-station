-- Per-slot start/end playback windows for coach intros (Admin → Videos trim).

ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "introTrims" JSONB NOT NULL DEFAULT '{}';
