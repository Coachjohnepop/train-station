import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import type { SiteSeoConfig } from "@/lib/site-seo-store";

function rowToConfig(row: {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  ogImageAlt: string;
  keywords: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  googleSiteVerification: string;
  bingSiteVerification: string;
  lastRecrawlPingAt?: Date | null;
  updatedAt: Date;
}): SiteSeoConfig {
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageUrl: row.ogImageUrl,
    ogImageAlt: row.ogImageAlt,
    keywords: row.keywords,
    robotsIndex: row.robotsIndex,
    robotsFollow: row.robotsFollow,
    googleSiteVerification: row.googleSiteVerification,
    bingSiteVerification: row.bingSiteVerification,
    lastRecrawlPingAt: row.lastRecrawlPingAt ? row.lastRecrawlPingAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadSiteSeoFromDb(): Promise<SiteSeoConfig | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.siteSeoSettings.findUnique({ where: { id: "default" } });
    return row ? rowToConfig(row) : null;
  } catch {
    return null;
  }
}

export async function saveSiteSeoToDb(config: SiteSeoConfig): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.siteSeoSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        metaTitle: config.metaTitle,
        metaDescription: config.metaDescription,
        ogTitle: config.ogTitle,
        ogDescription: config.ogDescription,
        ogImageUrl: config.ogImageUrl,
        ogImageAlt: config.ogImageAlt,
        keywords: config.keywords,
        robotsIndex: config.robotsIndex,
        robotsFollow: config.robotsFollow,
        googleSiteVerification: config.googleSiteVerification,
        bingSiteVerification: config.bingSiteVerification,
        lastRecrawlPingAt: config.lastRecrawlPingAt ? new Date(config.lastRecrawlPingAt) : null,
      },
      update: {
        metaTitle: config.metaTitle,
        metaDescription: config.metaDescription,
        ogTitle: config.ogTitle,
        ogDescription: config.ogDescription,
        ogImageUrl: config.ogImageUrl,
        ogImageAlt: config.ogImageAlt,
        keywords: config.keywords,
        robotsIndex: config.robotsIndex,
        robotsFollow: config.robotsFollow,
        googleSiteVerification: config.googleSiteVerification,
        bingSiteVerification: config.bingSiteVerification,
        lastRecrawlPingAt: config.lastRecrawlPingAt ? new Date(config.lastRecrawlPingAt) : null,
      },
    });
    return true;
  } catch {
    return false;
  }
}
