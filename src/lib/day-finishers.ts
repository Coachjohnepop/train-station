import "server-only";

import { prisma } from "@/lib/prisma";
import { localTodayIso } from "@/lib/program-calendar";
import { displayFinisherFirstName, type DayFinisher } from "@/lib/day-finishers-format";

export type { DayFinisher };

const SKIP_EMAIL = /@(example\.com|thetrainstation\.co)$/i;

function liveSessionHasWork(session: {
  finishedExercises: unknown;
  completedSets: unknown;
}): boolean {
  const finished = Array.isArray(session.finishedExercises)
    ? session.finishedExercises.length
    : 0;
  const sets =
    session.completedSets && typeof session.completedSets === "object"
      ? Object.keys(session.completedSets as object).length
      : 0;
  return finished > 0 || sets > 0;
}

/** Classmates who logged or checked off a workout on each calendar date (PT). */
export async function listFinishersByCalendarDates(
  dates: string[],
): Promise<Record<string, DayFinisher[]>> {
  const unique = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  const empty: Record<string, DayFinisher[]> = {};
  for (const d of unique) empty[d] = [];
  if (!unique.length) return empty;

  const start = new Date(`${unique.sort()[0]}T00:00:00-07:00`);
  const end = new Date(`${unique[unique.length - 1]}T23:59:59.999-07:00`);

  const [logs, live] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { performedAt: { gte: start, lte: end }, completed: true },
      select: {
        userId: true,
        performedAt: true,
        user: { select: { id: true, name: true, email: true, hidden: true, role: true } },
      },
    }),
    prisma.liveWorkoutSession.findMany({
      where: { sessionDate: { in: unique } },
      select: {
        userId: true,
        sessionDate: true,
        finishedExercises: true,
        completedSets: true,
      },
    }),
  ]);

  const liveUserIds = [...new Set(live.map((s) => s.userId))];
  const liveUsers = liveUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: liveUserIds } },
        select: { id: true, name: true, email: true, hidden: true, role: true },
      })
    : [];
  const userById = new Map(liveUsers.map((u) => [u.id, u]));

  const byDate = new Map<string, Map<string, DayFinisher>>();
  function add(date: string, userId: string, name: string, email: string, hidden: boolean, role: string) {
    if (hidden || role !== "MEMBER") return;
    if (SKIP_EMAIL.test(email)) return;
    if (!byDate.has(date)) byDate.set(date, new Map());
    const bucket = byDate.get(date)!;
    if (bucket.has(userId)) return;
    bucket.set(userId, { userId, name: displayFinisherFirstName(name, email) });
  }

  for (const log of logs) {
    const date = localTodayIso(log.performedAt);
    if (!unique.includes(date) || !log.user) continue;
    add(
      date,
      log.user.id,
      log.user.name || "",
      log.user.email,
      log.user.hidden,
      log.user.role,
    );
  }

  for (const session of live) {
    if (!liveSessionHasWork(session)) continue;
    const user = userById.get(session.userId);
    if (!user) continue;
    add(
      session.sessionDate,
      user.id,
      user.name || "",
      user.email,
      user.hidden,
      user.role,
    );
  }

  const out: Record<string, DayFinisher[]> = { ...empty };
  for (const [date, people] of byDate) {
    out[date] = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}


