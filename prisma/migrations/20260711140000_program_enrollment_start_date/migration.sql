-- Member-chosen start date for 28-day program block.
ALTER TABLE "ProgramEnrollment" ADD COLUMN "programStartDate" DATE;
ALTER TABLE "ProgramEnrollment" ADD COLUMN "blockEndsAt" DATE;