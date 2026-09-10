-- Admin-managed How it Works copy + voice-over trims.

ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "howItWorks" JSONB NOT NULL DEFAULT '{}';
