-- Speaking engagement intake (scope wizard) before 15-min coach call.
CREATE TABLE IF NOT EXISTS "SpeakingInquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "eventType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "audienceSize" TEXT,
    "audienceDesc" TEXT,
    "organization" TEXT,
    "eventDate" TEXT,
    "locationCity" TEXT,
    "locationState" TEXT,
    "budgetRange" TEXT,
    "topicsGoals" TEXT,
    "extraNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SpeakingInquiry_userId_idx" ON "SpeakingInquiry"("userId");
CREATE INDEX IF NOT EXISTS "SpeakingInquiry_email_idx" ON "SpeakingInquiry"("email");
CREATE INDEX IF NOT EXISTS "SpeakingInquiry_status_idx" ON "SpeakingInquiry"("status");
CREATE INDEX IF NOT EXISTS "SpeakingInquiry_createdAt_idx" ON "SpeakingInquiry"("createdAt");
