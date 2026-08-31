import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import type {
  DailyInspirationClip,
  MemberContentConfig,
  NutritionCalorieTier,
} from "@/lib/member-content-store";

function rowToConfig(row: {
  weeklyVideoUrl: string | null;
  weeklyVideoTitle: string;
  dinnerVideoUrl: string | null;
  dinnerVideoTitle: string;
  dailyInspirationClips: Prisma.JsonValue;
  nutritionIntro: string;
  nutritionTiers: Prisma.JsonValue;
  updatedAt: Date;
}): MemberContentConfig {
  return {
    weeklyVideoUrl: row.weeklyVideoUrl,
    weeklyVideoTitle: row.weeklyVideoTitle,
    dinnerVideoUrl: row.dinnerVideoUrl,
    dinnerVideoTitle: row.dinnerVideoTitle,
    dailyInspirationClips: (Array.isArray(row.dailyInspirationClips)
      ? row.dailyInspirationClips
      : []) as DailyInspirationClip[],
    nutritionIntro: row.nutritionIntro,
    nutritionTiers: (Array.isArray(row.nutritionTiers)
      ? row.nutritionTiers
      : []) as NutritionCalorieTier[],
    updatedAt: row.updatedAt.toISOString(),
  };
}

function configToRow(config: MemberContentConfig) {
  return {
    weeklyVideoUrl: config.weeklyVideoUrl,
    weeklyVideoTitle: config.weeklyVideoTitle,
    dinnerVideoUrl: config.dinnerVideoUrl,
    dinnerVideoTitle: config.dinnerVideoTitle,
    dailyInspirationClips: config.dailyInspirationClips as Prisma.InputJsonValue,
    nutritionIntro: config.nutritionIntro,
    nutritionTiers: config.nutritionTiers as Prisma.InputJsonValue,
  };
}

export async function loadMemberContentFromDb(): Promise<MemberContentConfig | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.memberContentSettings.findUnique({ where: { id: "default" } });
    return row ? rowToConfig(row) : null;
  } catch {
    return null;
  }
}

export async function saveMemberContentToDb(config: MemberContentConfig): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { prisma } = await import("@/lib/prisma");
    const data = configToRow(config);
    await prisma.memberContentSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
    return true;
  } catch (e) {
    console.warn("Member content Postgres save failed", e);
    return false;
  }
}
