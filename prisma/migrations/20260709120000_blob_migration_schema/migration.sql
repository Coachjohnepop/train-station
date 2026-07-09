-- Blob → Postgres migration schema (PR-1). Tables unused until store facades wire up (PR-2+).

-- AlterTable: User (registered-accounts mirror fields)
ALTER TABLE "User" ADD COLUMN "signupPlan" TEXT;
ALTER TABLE "User" ADD COLUMN "registeredAt" TIMESTAMP(3);

-- AlterTable: Workout (SMS / lesson-plan workouts)
ALTER TABLE "Workout" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'catalog';
ALTER TABLE "Workout" ADD COLUMN "restTimerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workout" ADD COLUMN "restTimerSeconds" INTEGER;

-- AlterTable: WorkoutExercise (SMS block labels)
ALTER TABLE "WorkoutExercise" ADD COLUMN "blockName" TEXT;

-- CreateTable: MemberProfile
CREATE TABLE "MemberProfile" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "weightLbs" TEXT,
    "notes" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
    "approvedAt" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'none',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentNote" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "referralCode" TEXT,
    "referredByUserId" TEXT,
    "intensiveSessionsTotal" INTEGER,
    "intensiveSessionsRemaining" INTEGER,
    "intensiveWindowDays" INTEGER,
    "intensiveStartsAt" TIMESTAMP(3),
    "intensiveExpiresAt" TIMESTAMP(3),
    "customTrainingOfferId" TEXT,
    "welcomeSignupEmailSentAt" TIMESTAMP(3),
    "welcomeCompleteEmailSentAt" TIMESTAMP(3),
    "welcomeSmsSentAt" TIMESTAMP(3),
    "coachIntakeCompleteAt" TIMESTAMP(3),
    "coachIntakeCompletedBy" TEXT,
    "introBookedAt" TIMESTAMP(3),
    "coachMeetingRequestedAt" TIMESTAMP(3),
    "coachMeetingRequestedBy" TEXT,
    "coachMeetingRequestNote" TEXT,
    "rampStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable: OAuthIdentity
CREATE TABLE "OAuthIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PasswordResetToken
CREATE TABLE "PasswordResetToken" (
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable: CoachChatThread
CREATE TABLE "CoachChatThread" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "memberId" TEXT,
    "programSlug" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CoachChatMessage
CREATE TABLE "CoachChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "youtubeId" TEXT,
    "videoDurationSec" INTEGER,
    "sessionDate" TEXT,
    "todaySessionId" TEXT,
    "workoutId" TEXT,
    "workoutTitle" TEXT,
    "smsLogId" TEXT,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "readByUserIds" TEXT[],
    "reactions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiveWorkoutSession
CREATE TABLE "LiveWorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "sessionDate" TEXT NOT NULL,
    "completedSets" JSONB NOT NULL,
    "finishedExercises" TEXT[],
    "weights" JSONB NOT NULL,
    "activeId" TEXT,
    "updatedBy" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveWorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CoachSettings
CREATE TABLE "CoachSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "coachPhone" TEXT,
    "coachEmail" TEXT,
    "messagingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPromptIntroBooking" BOOLEAN NOT NULL DEFAULT false,
    "autoPromptFollowUpBooking" BOOLEAN NOT NULL DEFAULT false,
    "commissionPayoutMode" TEXT NOT NULL DEFAULT 'on_demand',
    "commissionPayoutWeekday" INTEGER NOT NULL DEFAULT 5,
    "alertPrefs" JSONB NOT NULL,
    "warmupBlocks" JSONB NOT NULL,
    "rampTemplate" JSONB NOT NULL,
    "gamificationPoints" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MemberCoachPrefs
CREATE TABLE "MemberCoachPrefs" (
    "userId" TEXT NOT NULL,
    "coachingMode" TEXT,
    "alertOverrides" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCoachPrefs_pkey" PRIMARY KEY ("userId")
);

-- CreateTable: CommissionPartner
CREATE TABLE "CommissionPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommissionPayout
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "mrrCents" INTEGER NOT NULL,
    "tier1BaseCents" INTEGER NOT NULL,
    "tier1CommissionCents" INTEGER NOT NULL,
    "tier2BaseCents" INTEGER NOT NULL,
    "tier2CommissionCents" INTEGER NOT NULL,
    "totalCommissionCents" INTEGER NOT NULL,
    "transferId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommissionPayoutLine
CREATE TABLE "CommissionPayoutLine" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "transferId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "CommissionPayoutLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReferralCode
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stripePromotionCodeId" TEXT,
    "stripeCouponId" TEXT,
    "ownerUserId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StripeWebhookEvent
CREATE TABLE "StripeWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable: WaitlistEntry
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "plan" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomTrainingOffer
CREATE TABLE "CustomTrainingOffer" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "memberEmail" TEXT,
    "memberUserId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "parameters" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "createdByEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTrainingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberProfile_email_idx" ON "MemberProfile"("email");
CREATE INDEX "MemberProfile_paymentStatus_idx" ON "MemberProfile"("paymentStatus");
CREATE INDEX "MemberProfile_stripeCustomerId_idx" ON "MemberProfile"("stripeCustomerId");

CREATE UNIQUE INDEX "OAuthIdentity_provider_providerUserId_key" ON "OAuthIdentity"("provider", "providerUserId");
CREATE INDEX "OAuthIdentity_userId_idx" ON "OAuthIdentity"("userId");
CREATE INDEX "OAuthIdentity_email_idx" ON "OAuthIdentity"("email");

CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

CREATE INDEX "CoachChatThread_memberId_idx" ON "CoachChatThread"("memberId");
CREATE INDEX "CoachChatThread_programSlug_idx" ON "CoachChatThread"("programSlug");
CREATE INDEX "CoachChatThread_updatedAt_idx" ON "CoachChatThread"("updatedAt");

CREATE INDEX "CoachChatMessage_threadId_createdAt_idx" ON "CoachChatMessage"("threadId", "createdAt");
CREATE INDEX "CoachChatMessage_authorId_idx" ON "CoachChatMessage"("authorId");

CREATE UNIQUE INDEX "LiveWorkoutSession_userId_workoutId_sessionDate_key" ON "LiveWorkoutSession"("userId", "workoutId", "sessionDate");
CREATE INDEX "LiveWorkoutSession_userId_sessionDate_idx" ON "LiveWorkoutSession"("userId", "sessionDate");

CREATE INDEX "CommissionPartner_email_idx" ON "CommissionPartner"("email");
CREATE INDEX "CommissionPartner_enabled_idx" ON "CommissionPartner"("enabled");

CREATE UNIQUE INDEX "CommissionPayout_period_key" ON "CommissionPayout"("period");
CREATE INDEX "CommissionPayout_status_idx" ON "CommissionPayout"("status");

CREATE INDEX "CommissionPayoutLine_payoutId_idx" ON "CommissionPayoutLine"("payoutId");
CREATE INDEX "CommissionPayoutLine_partnerId_idx" ON "CommissionPayoutLine"("partnerId");

CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");

CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");

CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");
CREATE INDEX "WaitlistEntry_plan_idx" ON "WaitlistEntry"("plan");

CREATE INDEX "CustomTrainingOffer_memberUserId_idx" ON "CustomTrainingOffer"("memberUserId");
CREATE INDEX "CustomTrainingOffer_memberEmail_idx" ON "CustomTrainingOffer"("memberEmail");
CREATE INDEX "CustomTrainingOffer_status_idx" ON "CustomTrainingOffer"("status");

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthIdentity" ADD CONSTRAINT "OAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachChatMessage" ADD CONSTRAINT "CoachChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CoachChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberCoachPrefs" ADD CONSTRAINT "MemberCoachPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommissionPayoutLine" ADD CONSTRAINT "CommissionPayoutLine_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CommissionPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommissionPayoutLine" ADD CONSTRAINT "CommissionPayoutLine_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "CommissionPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;