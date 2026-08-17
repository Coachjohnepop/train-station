ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "startWeightLbs" TEXT;
ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "goalWeightLbs" TEXT;

-- Onboard stored starting weight on weightLbs; the sheet never read it.
UPDATE "MemberProfile"
SET "startWeightLbs" = "weightLbs"
WHERE "startWeightLbs" IS NULL
  AND "weightLbs" IS NOT NULL
  AND trim("weightLbs") <> '';
