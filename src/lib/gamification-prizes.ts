import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { writeGamificationAudit } from "@/lib/gamification-audit";
import { currentSeasonKey } from "@/lib/gamification-season";
import { getGamificationLevers } from "@/lib/gamification-config-store";

export type PrizeDto = {
  id: string;
  userId: string;
  seasonKey: string;
  label: string;
  freeDays: number | null;
  notes: string | null;
  awardedAt: string;
  awardedBy: string | null;
};

function toDto(row: {
  id: string;
  userId: string;
  seasonKey: string;
  label: string;
  freeDays: number | null;
  notes: string | null;
  awardedAt: Date;
  awardedBy: string | null;
}): PrizeDto {
  return {
    id: row.id,
    userId: row.userId,
    seasonKey: row.seasonKey,
    label: row.label,
    freeDays: row.freeDays,
    notes: row.notes,
    awardedAt: row.awardedAt.toISOString(),
    awardedBy: row.awardedBy,
  };
}

export async function listRecentPrizes(limit = 20): Promise<PrizeDto[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.gamificationPrizeAward.findMany({
    orderBy: { awardedAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
  });
  return rows.map(toDto);
}

export async function listPrizesForUser(userId: string): Promise<PrizeDto[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await prisma.gamificationPrizeAward.findMany({
    where: { userId },
    orderBy: { awardedAt: "desc" },
    take: 20,
  });
  return rows.map(toDto);
}

export async function awardPrize(input: {
  userId: string;
  label: string;
  freeDays?: number | null;
  notes?: string | null;
  seasonKey?: string | null;
  awardedBy: string;
}): Promise<PrizeDto> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database required for prizes.");
  }
  const levers = await getGamificationLevers();
  const seasonKey = input.seasonKey || currentSeasonKey(levers.seasonDays);
  const row = await prisma.gamificationPrizeAward.create({
    data: {
      userId: input.userId,
      seasonKey,
      label: input.label.trim() || "Season prize",
      freeDays: input.freeDays ?? null,
      notes: input.notes ?? null,
      awardedBy: input.awardedBy,
    },
  });
  await writeGamificationAudit({
    action: "prize.award",
    actor: { actorId: input.awardedBy, actorRole: "STAFF" },
    targetId: row.id,
    detail: {
      userId: input.userId,
      label: row.label,
      freeDays: row.freeDays,
      seasonKey,
    },
  });
  return toDto(row);
}
