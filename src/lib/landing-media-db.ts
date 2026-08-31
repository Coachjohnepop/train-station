import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import type { LandingMediaConfig, WelcomeVideosByPlan } from "@/lib/landing-media-store";
import type { HeroSlide } from "@/lib/hero-slides";

function rowToConfig(row: {
  welcomeVideoUrl: string | null;
  welcomeVideosByPlan: Prisma.JsonValue;
  freeChastiseVideoUrl: string | null;
  heroSlides: Prisma.JsonValue;
  gagVideoUrl: string | null;
  gagStartSec: number;
  gagDurationSec: number;
  gagEnabled: boolean;
  purchaseThankYouVideoUrl: string | null;
  equipmentIntroVideoUrl: string | null;
  measurementsIntroVideoUrl: string | null;
  uploadedContentVolumeDb: number;
  venmoQrUrl: string | null;
  venmoHandle: string | null;
  venmoInstructions: string | null;
  freeTicketFullUrl: string | null;
  freeTicketFullBuiltAt: string | null;
  freeTicketFullIntroSource: string | null;
  freeTicketFullStatus: string;
  freeTicketFullError: string | null;
  updatedAt: Date;
}): LandingMediaConfig {
  return {
    welcomeVideoUrl: row.welcomeVideoUrl,
    welcomeVideosByPlan: (row.welcomeVideosByPlan || {}) as WelcomeVideosByPlan,
    freeChastiseVideoUrl: row.freeChastiseVideoUrl,
    heroSlides: (Array.isArray(row.heroSlides) ? row.heroSlides : []) as HeroSlide[],
    gagVideoUrl: row.gagVideoUrl,
    gagStartSec: row.gagStartSec,
    gagDurationSec: row.gagDurationSec,
    gagEnabled: row.gagEnabled,
    purchaseThankYouVideoUrl: row.purchaseThankYouVideoUrl,
    equipmentIntroVideoUrl: row.equipmentIntroVideoUrl,
    measurementsIntroVideoUrl: row.measurementsIntroVideoUrl,
    uploadedContentVolumeDb: row.uploadedContentVolumeDb,
    venmoQrUrl: row.venmoQrUrl,
    venmoHandle: row.venmoHandle,
    venmoInstructions: row.venmoInstructions,
    freeTicketFullUrl: row.freeTicketFullUrl,
    freeTicketFullBuiltAt: row.freeTicketFullBuiltAt,
    freeTicketFullIntroSource: row.freeTicketFullIntroSource,
    freeTicketFullStatus: parseStatus(row.freeTicketFullStatus),
    freeTicketFullError: row.freeTicketFullError,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseStatus(raw: string): LandingMediaConfig["freeTicketFullStatus"] {
  if (raw === "queued" || raw === "running" || raw === "ok" || raw === "error" || raw === "idle") {
    return raw;
  }
  return "idle";
}

function configToRow(config: LandingMediaConfig) {
  return {
    welcomeVideoUrl: config.welcomeVideoUrl,
    welcomeVideosByPlan: config.welcomeVideosByPlan as Prisma.InputJsonValue,
    freeChastiseVideoUrl: config.freeChastiseVideoUrl,
    heroSlides: config.heroSlides as Prisma.InputJsonValue,
    gagVideoUrl: config.gagVideoUrl,
    gagStartSec: config.gagStartSec,
    gagDurationSec: config.gagDurationSec,
    gagEnabled: config.gagEnabled,
    purchaseThankYouVideoUrl: config.purchaseThankYouVideoUrl,
    equipmentIntroVideoUrl: config.equipmentIntroVideoUrl,
    measurementsIntroVideoUrl: config.measurementsIntroVideoUrl,
    uploadedContentVolumeDb: config.uploadedContentVolumeDb,
    venmoQrUrl: config.venmoQrUrl,
    venmoHandle: config.venmoHandle,
    venmoInstructions: config.venmoInstructions,
    freeTicketFullUrl: config.freeTicketFullUrl,
    freeTicketFullBuiltAt: config.freeTicketFullBuiltAt,
    freeTicketFullIntroSource: config.freeTicketFullIntroSource,
    freeTicketFullStatus: config.freeTicketFullStatus,
    freeTicketFullError: config.freeTicketFullError,
  };
}

export async function loadLandingMediaFromDb(): Promise<LandingMediaConfig | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.landingMediaSettings.findUnique({ where: { id: "default" } });
    return row ? rowToConfig(row) : null;
  } catch {
    return null;
  }
}

export async function saveLandingMediaToDb(config: LandingMediaConfig): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    const data = configToRow(config);
    await prisma.landingMediaSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
    return true;
  } catch (e) {
    console.warn("Landing media Postgres save failed", e);
    return false;
  }
}
