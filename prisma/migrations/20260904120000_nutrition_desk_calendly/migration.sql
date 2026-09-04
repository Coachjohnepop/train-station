-- Nutrition page copy + Calendly event for custom meal planning.

ALTER TABLE "MemberContentSettings" ADD COLUMN IF NOT EXISTS "nutritionCalendlyUrl" TEXT;
ALTER TABLE "MemberContentSettings" ADD COLUMN IF NOT EXISTS "nutritionDesk" JSONB NOT NULL DEFAULT '{}';
