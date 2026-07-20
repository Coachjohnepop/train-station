import "server-only";

import {
  calendarDateForProgramDay,
  mondayOfWeek,
  parseIsoDate,
  toIsoDate,
} from "@/lib/program-calendar";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { prisma } from "@/lib/prisma";
import { normalizeProgramSlug } from "@/lib/programs";

/**
 * Set program.startDate to the Monday of the given ISO date and rewrite every
 * ProgramDay.calendarDate from week/day numbers so the design calendar matches.
 */
export async function reanchorProgramCalendar(
  slug: string,
  startDateIso: string,
): Promise<{
  startDate: string;
  daysUpdated: number;
}> {
  const parsed = parseIsoDate(startDateIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_START_DATE");
  }
  const startMonday = mondayOfWeek(parsed);
  const startDate = toIsoDate(startMonday);

  if (isCoachCatalogDemo()) {
    let notFound = false;
    let daysUpdated = 0;
    const { blobSaved } = await mutateDemoSeed(
      (data) => {
        const programs = (data.programs || []) as Array<Record<string, unknown>>;
        const target = normalizeProgramSlug(slug);
        const prog = programs.find(
          (p) =>
            p.slug === slug || normalizeProgramSlug(String(p.slug ?? "")) === target,
        );
        if (!prog) {
          notFound = true;
          return;
        }
        prog.startDate = startDate;
        const weeks = ((data.programWeeks as any[]) || []).filter(
          (w) => w.programId === prog.id,
        );
        const days = (data.programDays as any[]) || [];
        for (const w of weeks) {
          for (const d of days) {
            if (d.weekId !== w.id) continue;
            d.calendarDate = calendarDateForProgramDay(
              startMonday,
              w.weekNumber,
              d.dayNumber,
            );
            daysUpdated += 1;
          }
        }
      },
      { preferFresh: true },
    );
    if (notFound) throw new Error("PROGRAM_NOT_FOUND");
    requireBlobPersisted(blobSaved, "Program calendar re-anchor");
    return { startDate, daysUpdated };
  }

  const program = await prisma.program.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!program) throw new Error("PROGRAM_NOT_FOUND");

  await prisma.program.update({
    where: { id: program.id },
    data: { startDate },
  });

  const weeks = await prisma.programWeek.findMany({
    where: { programId: program.id },
    select: {
      weekNumber: true,
      days: { select: { id: true, dayNumber: true } },
    },
  });

  let daysUpdated = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      const calendarDate = calendarDateForProgramDay(
        startMonday,
        week.weekNumber,
        day.dayNumber,
      );
      await prisma.programDay.update({
        where: { id: day.id },
        data: { calendarDate },
      });
      daysUpdated += 1;
    }
  }

  return { startDate, daysUpdated };
}
