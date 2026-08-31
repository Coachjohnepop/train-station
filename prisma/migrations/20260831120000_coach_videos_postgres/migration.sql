-- Coach video desk: landing intros, member YouTube strip, and library rows
-- persist in Postgres. Binary files stay on Blob; these tables hold URLs.

CREATE TABLE IF NOT EXISTS "LandingMediaSettings" (
    "id" TEXT NOT NULL,
    "welcomeVideoUrl" TEXT,
    "welcomeVideosByPlan" JSONB NOT NULL,
    "freeChastiseVideoUrl" TEXT,
    "heroSlides" JSONB NOT NULL,
    "gagVideoUrl" TEXT,
    "gagStartSec" INTEGER NOT NULL DEFAULT 43,
    "gagDurationSec" INTEGER NOT NULL DEFAULT 5,
    "gagEnabled" BOOLEAN NOT NULL DEFAULT true,
    "purchaseThankYouVideoUrl" TEXT,
    "equipmentIntroVideoUrl" TEXT,
    "measurementsIntroVideoUrl" TEXT,
    "uploadedContentVolumeDb" INTEGER NOT NULL DEFAULT 6,
    "venmoQrUrl" TEXT,
    "venmoHandle" TEXT,
    "venmoInstructions" TEXT,
    "freeTicketFullUrl" TEXT,
    "freeTicketFullBuiltAt" TEXT,
    "freeTicketFullIntroSource" TEXT,
    "freeTicketFullStatus" TEXT NOT NULL DEFAULT 'idle',
    "freeTicketFullError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingMediaSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MemberContentSettings" (
    "id" TEXT NOT NULL,
    "weeklyVideoUrl" TEXT,
    "weeklyVideoTitle" TEXT NOT NULL,
    "dinnerVideoUrl" TEXT,
    "dinnerVideoTitle" TEXT NOT NULL,
    "dailyInspirationClips" JSONB NOT NULL,
    "nutritionIntro" TEXT NOT NULL,
    "nutritionTiers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberContentSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SiteVideoAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVideoAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteVideoAsset_createdAt_idx" ON "SiteVideoAsset"("createdAt");

-- Prisma-as-postgres: do not expose new tables via PostgREST.
REVOKE ALL ON TABLE "LandingMediaSettings" FROM anon, authenticated;
REVOKE ALL ON TABLE "MemberContentSettings" FROM anon, authenticated;
REVOKE ALL ON TABLE "SiteVideoAsset" FROM anon, authenticated;
ALTER TABLE "LandingMediaSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberContentSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteVideoAsset" ENABLE ROW LEVEL SECURITY;
