import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import {
  type GamificationDivision,
  type GamificationLevers,
  divisionForPlan,
  normalizeGamificationLevers,
} from "@/lib/gamification-levers";
import { getGamificationLevers } from "@/lib/gamification-config-store";

/** Rolling season key: starts at UTC midnight of window start. */
export function currentSeasonKey(seasonDays: number, now = new Date()): string {
  const days = Math.max(7, seasonDays);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  // Align to fixed epoch buckets so all users share a season.
  const epoch = Date.UTC(2026, 0, 1);
  const dayIndex = Math.floor((start.getTime() - epoch) / 86_400_000);
  const bucket = Math.floor(dayIndex / days) * days;
  const bucketStart = new Date(epoch + bucket * 86_400_000);
  return `roll-${bucketStart.toISOString().slice(0, 10)}-d${days}`;
}

export function seasonWindow(seasonKey: string, seasonDays: number, now = new Date()): {
  start: Date;
  end: Date;
} {
  const end = now;
  const start = new Date(now.getTime() - Math.max(7, seasonDays) * 86_400_000);
  // Prefer parsing roll-YYYY-MM-DD-dN
  const m = seasonKey.match(/^roll-(\d{4}-\d{2}-\d{2})-d(\d+)$/);
  if (m) {
    const s = new Date(`${m[1]}T00:00:00.000Z`);
    const days = Number(m[2]) || seasonDays;
    return { start: s, end: new Date(s.getTime() + days * 86_400_000) };
  }
  return { start, end };
}

function localDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Recompute one user's season score from events (DB only).
 * No-op when database is not configured.
 */
export async function recomputeUserSeasonScore(
  userId: string,
  division: GamificationDivision,
  levers?: GamificationLevers,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const L = levers ?? (await getGamificationLevers());
  const seasonKey = currentSeasonKey(L.seasonDays);
  const { start, end } = seasonWindow(seasonKey, L.seasonDays);

  const events = await prisma.gamificationEvent.findMany({
    where: {
      userId,
      at: { gte: start, lte: end },
    },
    select: { points: true, at: true },
    orderBy: { at: "asc" },
  });

  const points = events.reduce((s, e) => s + e.points, 0);
  const days = new Set(events.map((e) => localDayKey(e.at)));
  const lastEventAt = events.length ? events[events.length - 1].at : null;

  await prisma.gamificationSeasonScore.upsert({
    where: { userId_seasonKey: { userId, seasonKey } },
    create: {
      userId,
      seasonKey,
      division,
      points,
      activeDays: days.size,
      lastEventAt,
      rank: null,
      percentile: null,
    },
    update: {
      division,
      points,
      activeDays: days.size,
      lastEventAt,
    },
  });
}

export type DivisionRankRow = {
  userId: string;
  division: string;
  points: number;
  activeDays: number;
  rank: number;
  percentile: number;
  eligible: boolean;
  topPercent: boolean;
};

/** Rank everyone in a division for the current season; persist ranks. */
export async function recomputeDivisionRanks(
  division: GamificationDivision,
  levers?: GamificationLevers,
): Promise<DivisionRankRow[]> {
  if (!isDatabaseConfigured()) return [];
  const L = levers ?? (await getGamificationLevers());
  const seasonKey = currentSeasonKey(L.seasonDays);

  const rows = await prisma.gamificationSeasonScore.findMany({
    where: { seasonKey, division },
    orderBy: [{ points: "desc" }, { lastEventAt: "desc" }, { userId: "asc" }],
  });

  const eligible = rows.filter(
    (r) =>
      r.activeDays >= L.minActiveDaysForPercentile &&
      r.points >= L.minSeasonPointsForPercentile,
  );

  const ranked: DivisionRankRow[] = rows.map((r) => {
    const eligIdx = eligible.findIndex((e) => e.userId === r.userId);
    const eligibleRank = eligIdx >= 0 ? eligIdx + 1 : 0;
    const n = eligible.length;
    const cut =
      n >= L.minDivisionSizeForTopCut
        ? Math.max(1, Math.ceil((L.topPercentile / 100) * n))
        : n >= 2
          ? Math.min(2, n)
          : 0;
    const topPercent = eligibleRank > 0 && eligibleRank <= cut;
    const percentile =
      n > 0 && eligibleRank > 0 ? Math.round((100 * (n - eligibleRank + 1)) / n) : 0;

    return {
      userId: r.userId,
      division: r.division,
      points: r.points,
      activeDays: r.activeDays,
      rank: eligibleRank || rows.findIndex((x) => x.userId === r.userId) + 1,
      percentile,
      eligible: eligIdx >= 0,
      topPercent,
    };
  });

  // Persist rank/percentile for eligible ordering on board
  await Promise.all(
    ranked.map((r) =>
      prisma.gamificationSeasonScore.update({
        where: { userId_seasonKey: { userId: r.userId, seasonKey } },
        data: { rank: r.rank, percentile: r.percentile },
      }),
    ),
  );

  return ranked;
}

export async function recomputeAllDivisions(levers?: GamificationLevers): Promise<void> {
  const L = levers ?? (await getGamificationLevers());
  for (const d of ["explorer", "member", "business", "pro"] as GamificationDivision[]) {
    await recomputeDivisionRanks(d, L);
  }
}

export { divisionForPlan, normalizeGamificationLevers };
