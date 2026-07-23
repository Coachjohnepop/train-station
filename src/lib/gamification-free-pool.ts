import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { linearEnrollmentDay } from "@/lib/member-enrollment-day";

export type FreePoolDayRow = {
  dayId: string;
  weekNumber: number;
  dayNumber: number;
  enrollmentDayNumber: number;
  freePool: boolean;
  contentTierMin: string | null;
  label: string;
  hasWorkout: boolean;
};

/** List program days with free-pool flags for admin curation. */
export async function listProgramFreePoolDays(
  programSlug: string,
): Promise<{ days: FreePoolDayRow[]; curatedCount: number }> {
  if (!isDatabaseConfigured()) return { days: [], curatedCount: 0 };

  const program = await prisma.program.findUnique({
    where: { slug: programSlug },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              options: { select: { id: true }, take: 1 },
              workout: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!program) return { days: [], curatedCount: 0 };

  const days: FreePoolDayRow[] = [];
  for (const week of program.weeks) {
    for (const day of week.days) {
      const enrollmentDayNumber = linearEnrollmentDay(week.weekNumber, day.dayNumber);
      days.push({
        dayId: day.id,
        weekNumber: week.weekNumber,
        dayNumber: day.dayNumber,
        enrollmentDayNumber,
        freePool: Boolean(day.freePool),
        contentTierMin: day.contentTierMin ?? null,
        label: day.workout?.name || `W${week.weekNumber}D${day.dayNumber}`,
        hasWorkout: Boolean(day.workoutId || day.options.length),
      });
    }
  }
  const curatedCount = days.filter((d) => d.freePool).length;
  return { days, curatedCount };
}

export async function setProgramDayFreePool(
  dayId: string,
  freePool: boolean,
  contentTierMin?: string | null,
): Promise<FreePoolDayRow | null> {
  if (!isDatabaseConfigured()) return null;
  const updated = await prisma.programDay.update({
    where: { id: dayId },
    data: {
      freePool,
      ...(contentTierMin !== undefined
        ? { contentTierMin: contentTierMin || null }
        : {}),
    },
    include: {
      week: { select: { weekNumber: true } },
      workout: { select: { name: true } },
      options: { select: { id: true }, take: 1 },
    },
  });
  return {
    dayId: updated.id,
    weekNumber: updated.week.weekNumber,
    dayNumber: updated.dayNumber,
    enrollmentDayNumber: linearEnrollmentDay(updated.week.weekNumber, updated.dayNumber),
    freePool: updated.freePool,
    contentTierMin: updated.contentTierMin,
    label: updated.workout?.name || `W${updated.week.weekNumber}D${updated.dayNumber}`,
    hasWorkout: Boolean(updated.workoutId || updated.options.length),
  };
}

/** Lookup freePool + curated mode for a program day by week/day. */
export async function getDayFreePoolFlags(
  programSlug: string,
  weekNumber: number,
  dayNumber: number,
): Promise<{ freePoolPinned: boolean; curatedMode: boolean; contentTierMin: string | null }> {
  if (!isDatabaseConfigured()) {
    return { freePoolPinned: false, curatedMode: false, contentTierMin: null };
  }
  try {
    const program = await prisma.program.findUnique({
      where: { slug: programSlug },
      select: { id: true },
    });
    if (!program) {
      return { freePoolPinned: false, curatedMode: false, contentTierMin: null };
    }
    const curatedCount = await prisma.programDay.count({
      where: { week: { programId: program.id }, freePool: true },
    });
    const day = await prisma.programDay.findFirst({
      where: {
        week: { programId: program.id, weekNumber },
        dayNumber,
      },
      select: { freePool: true, contentTierMin: true },
    });
    return {
      freePoolPinned: Boolean(day?.freePool),
      curatedMode: curatedCount > 0,
      contentTierMin: day?.contentTierMin ?? null,
    };
  } catch {
    return { freePoolPinned: false, curatedMode: false, contentTierMin: null };
  }
}
