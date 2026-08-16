-- Singleton public SEO settings (Admin → Search).
CREATE TABLE IF NOT EXISTS "SiteSeoSettings" (
    "id" TEXT NOT NULL,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "ogTitle" TEXT NOT NULL,
    "ogDescription" TEXT NOT NULL,
    "ogImageUrl" TEXT NOT NULL,
    "ogImageAlt" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "googleSiteVerification" TEXT NOT NULL DEFAULT '',
    "bingSiteVerification" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSeoSettings_pkey" PRIMARY KEY ("id")
);
