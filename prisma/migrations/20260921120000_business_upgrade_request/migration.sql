-- AlterTable
ALTER TABLE "MemberProfile" ADD COLUMN "businessUpgradeRequestedAt" TIMESTAMP(3);
ALTER TABLE "MemberProfile" ADD COLUMN "businessUpgradeStatus" TEXT;
ALTER TABLE "MemberProfile" ADD COLUMN "businessUpgradeReviewedAt" TIMESTAMP(3);
ALTER TABLE "MemberProfile" ADD COLUMN "businessUpgradeReviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "MemberProfile_businessUpgradeStatus_idx" ON "MemberProfile"("businessUpgradeStatus");
