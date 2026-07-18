import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildSessionShells,
  clampPartCount,
  defaultPartKind,
  defaultPartLabel,
  defaultPartTimeSlot,
} from "@/lib/program-day-sessions";

/**
 * Ensure a day has `partCount` sessions (1..MAX). Creates missing shells;
 * never deletes sessions that still have options (shrink only empty trailing parts).
 */
export async function ensureProgramDaySessions(
  dayId: string,
  partCount: number,
): Promise<{ sessionIds: string[]; partCount: number }> {
  const total = clampPartCount(partCount);
  const day = await prisma.programDay.findUnique({
    where: { id: dayId },
    include: {
      sessions: {
        orderBy: { partIndex: "asc" },
        include: { _count: { select: { options: true } } },
      },
    },
  });
  if (!day) throw new Error("DAY_NOT_FOUND");

  const existing = new Map(day.sessions.map((s) => [s.partIndex, s]));
  const sessionIds: string[] = [];

  for (let partIndex = 1; partIndex <= total; partIndex++) {
    const found = existing.get(partIndex);
    if (found) {
      // When growing 1 → 2/3 parts, rename generic "Main" shells to AM/PM defaults.
      if (
        total > 1 &&
        (found.label === "Main" || !found.label?.trim())
      ) {
        await prisma.programDaySession.update({
          where: { id: found.id },
          data: {
            label: defaultPartLabel(partIndex, total),
            sessionKind: found.sessionKind || defaultPartKind(partIndex, total),
            timeSlot: found.timeSlot || defaultPartTimeSlot(partIndex, total),
            sortOrder: partIndex - 1,
          },
        });
      }
      sessionIds.push(found.id);
      continue;
    }
    const created = await prisma.programDaySession.create({
      data: {
        dayId,
        partIndex,
        label: defaultPartLabel(partIndex, total),
        sessionKind: defaultPartKind(partIndex, total),
        timeSlot: defaultPartTimeSlot(partIndex, total),
        sortOrder: partIndex - 1,
      },
    });
    sessionIds.push(created.id);
  }

  // Remove empty trailing sessions above new partCount
  for (const s of day.sessions) {
    if (s.partIndex > total && s._count.options === 0) {
      await prisma.programDaySession.delete({ where: { id: s.id } }).catch(() => {});
    }
  }

  await prisma.programDay.update({
    where: { id: dayId },
    data: { partCount: total },
  });

  // Ensure every option has a session (legacy rows)
  const mainId = sessionIds[0];
  if (mainId) {
    await prisma.programDayOption.updateMany({
      where: { dayId, sessionId: null },
      data: { sessionId: mainId },
    });
  }

  return { sessionIds, partCount: total };
}

/** Resolve session id for a part index, creating shells if needed. */
export async function resolveSessionIdForPart(
  dayId: string,
  partIndex: number,
  partCountHint?: number,
): Promise<string> {
  const total = clampPartCount(Math.max(partIndex, partCountHint ?? partIndex));
  const { sessionIds } = await ensureProgramDaySessions(dayId, total);
  const idx = Math.min(Math.max(1, partIndex), sessionIds.length) - 1;
  return sessionIds[idx]!;
}

export async function listDaySessionsWithOptions(dayId: string) {
  const sessions = await prisma.programDaySession.findMany({
    where: { dayId },
    orderBy: [{ sortOrder: "asc" }, { partIndex: "asc" }],
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: { workout: { select: { id: true, name: true, description: true } } },
      },
    },
  });
  return sessions;
}

export { buildSessionShells };
