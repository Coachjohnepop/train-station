-- Admin-managed Explore Content cards (image + subtitle + description).
-- Title is the program / offer name — same words on the landing card.

ALTER TABLE "LandingMediaSettings" ADD COLUMN IF NOT EXISTS "exploreContent" JSONB NOT NULL DEFAULT '{}';
