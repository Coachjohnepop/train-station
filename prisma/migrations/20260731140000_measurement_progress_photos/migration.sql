-- Baseline “before” portrait on member profile + per-check-in progress photo.
ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "beforePhotoUrl" TEXT;
ALTER TABLE "UserMeasurement" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
