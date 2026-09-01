-- Theme Song mix controls on Admin → Landing (public on/off, volume, click-starts).
-- Per-slide audio URLs live in LandingMediaSettings.heroSlides JSON.

ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "themeSongEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "themeSongVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.55;
ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "themeSongClickStarts" INTEGER NOT NULL DEFAULT 1;
