ALTER TABLE "CoachSettings" ADD COLUMN "programStartMaxOffsetDays" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "CoachSettings" ADD COLUMN "programStartRecommendWeekday" INTEGER DEFAULT 1;
ALTER TABLE "CoachSettings" ADD COLUMN "programBlockDays" INTEGER NOT NULL DEFAULT 28;