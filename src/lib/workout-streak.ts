import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import { hydrateDemoLogsStore } from "@/lib/demo-logs";
import { prisma } from "@/lib/prisma";
import { resolveStorageUserId } from "@/lib/enrollment-db";
import { isDatabaseConfigured } from "@/lib/database-config";
import { localTodayIso } from "@/lib/program-calendar";

function dayKeyFromDate(d: Date, timeZone = "America/Los_Angeles"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Consecutive calendar days with ≥1 workout log, ending today or yesterday
 * (grace: if no workout today, streak can still include through yesterday).
 */
export function computeDayStreakFromDates(
  isoDays: string[],
  todayIso: string,
): number {
  const set = new Set(isoDays.filter(Boolean));
  if (!set.size) return 0;

  // Start from today if active today, else yesterday
  let cursor = todayIso;
  if (!set.has(cursor)) {
    const d = new Date(`${todayIso}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
    if (!set.has(cursor)) return 0;
  }

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

export async function getWorkoutDayStreak(userId: string): Promise<number> {
  const todayIso = localTodayIso();
  const tz = process.env.APP_TIMEZONE?.trim() || "America/Los_Angeles";

  if (isDemoMode()) {
    try {
      const logs = await hydrateDemoLogsStore({ preferFresh: true });
      const days = (logs.workoutLogs || [])
        .filter((l: { userId?: string }) => l.userId === userId)
        .map((l: { performedAt?: string; createdAt?: string }) => {
          const raw = l.performedAt || l.createdAt;
          if (!raw) return null;
          return dayKeyFromDate(new Date(raw), tz);
        })
        .filter(Boolean) as string[];
      return computeDayStreakFromDates(days, todayIso);
    } catch {
      return 0;
    }
  }

  if (!isDatabaseConfigured()) return 0;

  try {
    const storageUserId = await resolveStorageUserId(userId);
    const logs = await prisma.workoutLog.findMany({
      where: { userId: storageUserId },
      select: { performedAt: true },
      orderBy: { performedAt: "desc" },
      take: 400,
    });
    const days = logs.map((l) => dayKeyFromDate(l.performedAt, tz));
    return computeDayStreakFromDates(days, todayIso);
  } catch {
    return 0;
  }
}
