-- CreateTable
CREATE TABLE "WhDimDate" (
    "dateKey" INTEGER NOT NULL,
    "isoDate" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "monthName" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "dow" INTEGER NOT NULL,
    "dowName" TEXT NOT NULL,
    "isoWeek" INTEGER NOT NULL,
    "isFirstOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WhDimDate_pkey" PRIMARY KEY ("dateKey")
);

-- CreateTable
CREATE TABLE "WhDimPlan" (
    "planKey" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "billing" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WhDimPlan_pkey" PRIMARY KEY ("planKey")
);

-- CreateTable
CREATE TABLE "WhDimLanding" (
    "landingKey" INTEGER NOT NULL,
    "letter" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WhDimLanding_pkey" PRIMARY KEY ("landingKey")
);

-- CreateTable
CREATE TABLE "WhDimChannel" (
    "channelKey" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT '(none)',
    "medium" TEXT NOT NULL DEFAULT '(none)',
    "campaign" TEXT NOT NULL DEFAULT '(none)',

    CONSTRAINT "WhDimChannel_pkey" PRIMARY KEY ("channelKey")
);

-- CreateTable
CREATE TABLE "WhDimMember" (
    "memberKey" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "planKey" INTEGER,
    "city" TEXT,
    "state" TEXT,

    CONSTRAINT "WhDimMember_pkey" PRIMARY KEY ("memberKey")
);

-- CreateTable
CREATE TABLE "WhFactLandingSession" (
    "factId" TEXT NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "landingKey" INTEGER NOT NULL,
    "channelKey" INTEGER,
    "memberKey" INTEGER,
    "deviceType" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "convertedSignup" BOOLEAN NOT NULL DEFAULT false,
    "convertedPaid" BOOLEAN NOT NULL DEFAULT false,
    "sourceSessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhFactLandingSession_pkey" PRIMARY KEY ("factId")
);

-- CreateTable
CREATE TABLE "WhFactSignup" (
    "factId" TEXT NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "planKey" INTEGER NOT NULL,
    "memberKey" INTEGER NOT NULL,
    "path" TEXT,

    CONSTRAINT "WhFactSignup_pkey" PRIMARY KEY ("factId")
);

-- CreateTable
CREATE TABLE "WhFactPayment" (
    "factId" TEXT NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "planKey" INTEGER,
    "memberKey" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sourcePaymentId" TEXT NOT NULL,

    CONSTRAINT "WhFactPayment_pkey" PRIMARY KEY ("factId")
);

-- CreateTable
CREATE TABLE "WhFactUpgradeRequest" (
    "factId" TEXT NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "memberKey" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "sourceUserId" TEXT NOT NULL,

    CONSTRAINT "WhFactUpgradeRequest_pkey" PRIMARY KEY ("factId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhDimPlan_slug_key" ON "WhDimPlan"("slug");
CREATE UNIQUE INDEX "WhDimChannel_source_medium_campaign_key" ON "WhDimChannel"("source", "medium", "campaign");
CREATE UNIQUE INDEX "WhDimMember_userId_key" ON "WhDimMember"("userId");
CREATE INDEX "WhDimMember_planKey_idx" ON "WhDimMember"("planKey");
CREATE INDEX "WhDimMember_email_idx" ON "WhDimMember"("email");
CREATE UNIQUE INDEX "WhFactLandingSession_sourceSessionId_key" ON "WhFactLandingSession"("sourceSessionId");
CREATE INDEX "WhFactLandingSession_dateKey_landingKey_idx" ON "WhFactLandingSession"("dateKey", "landingKey");
CREATE INDEX "WhFactLandingSession_memberKey_idx" ON "WhFactLandingSession"("memberKey");
CREATE UNIQUE INDEX "WhFactSignup_memberKey_key" ON "WhFactSignup"("memberKey");
CREATE INDEX "WhFactSignup_dateKey_planKey_idx" ON "WhFactSignup"("dateKey", "planKey");
CREATE UNIQUE INDEX "WhFactPayment_sourcePaymentId_key" ON "WhFactPayment"("sourcePaymentId");
CREATE INDEX "WhFactPayment_dateKey_status_idx" ON "WhFactPayment"("dateKey", "status");
CREATE INDEX "WhFactPayment_memberKey_idx" ON "WhFactPayment"("memberKey");
CREATE UNIQUE INDEX "WhFactUpgradeRequest_sourceUserId_key" ON "WhFactUpgradeRequest"("sourceUserId");
CREATE INDEX "WhFactUpgradeRequest_dateKey_status_idx" ON "WhFactUpgradeRequest"("dateKey", "status");

-- AddForeignKey
ALTER TABLE "WhDimMember" ADD CONSTRAINT "WhDimMember_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "WhDimPlan"("planKey") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhFactLandingSession" ADD CONSTRAINT "WhFactLandingSession_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "WhDimDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactLandingSession" ADD CONSTRAINT "WhFactLandingSession_landingKey_fkey" FOREIGN KEY ("landingKey") REFERENCES "WhDimLanding"("landingKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactLandingSession" ADD CONSTRAINT "WhFactLandingSession_channelKey_fkey" FOREIGN KEY ("channelKey") REFERENCES "WhDimChannel"("channelKey") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhFactLandingSession" ADD CONSTRAINT "WhFactLandingSession_memberKey_fkey" FOREIGN KEY ("memberKey") REFERENCES "WhDimMember"("memberKey") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhFactSignup" ADD CONSTRAINT "WhFactSignup_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "WhDimDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactSignup" ADD CONSTRAINT "WhFactSignup_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "WhDimPlan"("planKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactSignup" ADD CONSTRAINT "WhFactSignup_memberKey_fkey" FOREIGN KEY ("memberKey") REFERENCES "WhDimMember"("memberKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactPayment" ADD CONSTRAINT "WhFactPayment_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "WhDimDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactPayment" ADD CONSTRAINT "WhFactPayment_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "WhDimPlan"("planKey") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhFactPayment" ADD CONSTRAINT "WhFactPayment_memberKey_fkey" FOREIGN KEY ("memberKey") REFERENCES "WhDimMember"("memberKey") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhFactUpgradeRequest" ADD CONSTRAINT "WhFactUpgradeRequest_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "WhDimDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhFactUpgradeRequest" ADD CONSTRAINT "WhFactUpgradeRequest_memberKey_fkey" FOREIGN KEY ("memberKey") REFERENCES "WhDimMember"("memberKey") ON DELETE RESTRICT ON UPDATE CASCADE;
