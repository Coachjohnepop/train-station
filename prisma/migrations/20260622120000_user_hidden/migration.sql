-- Soft-hide test accounts instead of deleting (preserves Stripe refs, enrollments, etc.)
ALTER TABLE "User" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "hiddenAt" TIMESTAMP(3);