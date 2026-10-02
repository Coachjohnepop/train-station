import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import { currentSeasonKey } from "@/lib/gamification-season";
import { pacificDateIso } from "@/lib/food-log";
import {
  buildFoodTrackDashboard,
  type FoodTrackDashboard,
  type FoodTrackDayRow,
} from "@/lib/food-track";
import { awardFoodTrackDayPoints } from "@/lib/member-gamification-store";
import { prisma } from "@/lib/prisma";

export type FoodTrackPayload = FoodTrackDashboard & {
  seasonKey: string;
  seasonDays: number;
};

async function seasonKeyNow(): Promise<{ seasonKey: string; seasonDays: number }> {
  const levers = await getGamificationLevers();
  const seasonDays = levers.seasonDays || 28;
  return { seasonKey: currentSeasonKey(seasonDays), seasonDays };
}

export async function loadFoodTrackDashboard(
  userId: string,
  todayIso = pacificDateIso(),
): Promise<FoodTrackPayload> {
  const { seasonKey, seasonDays } = await seasonKeyNow();
  if (!isDatabaseConfigured()) {
    return { seasonKey, seasonDays, ...buildFoodTrackDashboard({ todayIso, days: [] }) };
  }
  const rows = await prisma.foodTrackDay.findMany({
    where: { userId, seasonKey },
    orderBy: { eatenOn: "desc" },
  });
  const dates = rows.map((row) => row.eatenOn);
  const entries =
    dates.length > 0
      ? await prisma.foodEntry.findMany({
          where: { userId, eatenOn: { in: dates } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            eatenOn: true,
            calories: true,
            protein: true,
            starch: true,
            fat: true,
            extras: true,
          },
        })
      : [];
  const byDate = new Map<
    string,
    { calories: number; entryCount: number; meals: FoodTrackDayRow["meals"] }
  >();
  for (const entry of entries) {
    const cur = byDate.get(entry.eatenOn) ?? { calories: 0, entryCount: 0, meals: [] };
    cur.calories += entry.calories;
    cur.entryCount += 1;
    cur.meals.push({
      id: entry.id,
      calories: entry.calories,
      protein: entry.protein,
      starch: entry.starch,
      fat: entry.fat,
      extras: entry.extras,
    });
    byDate.set(entry.eatenOn, cur);
  }
  const days: FoodTrackDayRow[] = rows.map((row) => ({
    eatenOn: row.eatenOn,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    calories: byDate.get(row.eatenOn)?.calories ?? 0,
    entryCount: byDate.get(row.eatenOn)?.entryCount ?? 0,
    meals: byDate.get(row.eatenOn)?.meals ?? [],
  }));
  return { seasonKey, seasonDays, ...buildFoodTrackDashboard({ todayIso, days }) };
}

export async function startFoodTrackDay(userId: string, eatenOn: string) {
  const { seasonKey } = await seasonKeyNow();
  const existing = await prisma.foodTrackDay.findUnique({
    where: { userId_eatenOn: { userId, eatenOn } },
  });
  if (existing) return existing;
  return prisma.foodTrackDay.create({
    data: { userId, eatenOn, seasonKey },
  });
}

export async function completeFoodTrackDay(userId: string, eatenOn: string) {
  const entryCount = await prisma.foodEntry.count({ where: { userId, eatenOn } });
  if (entryCount < 1) {
    throw new Error("Log something you ate or drank first.");
  }
  let row = await prisma.foodTrackDay.findUnique({
    where: { userId_eatenOn: { userId, eatenOn } },
  });
  if (!row) {
    row = await startFoodTrackDay(userId, eatenOn);
  }
  if (!row.completedAt) {
    row = await prisma.foodTrackDay.update({
      where: { id: row.id },
      data: { completedAt: new Date() },
    });
  }
  const award = await awardFoodTrackDayPoints({ userId, dayIso: eatenOn });
  return { row, award };
}
