import { DAYS_PER_WEEK } from "@/lib/program-constants";
import { prisma } from "@/lib/prisma";

export async function syncProgramSchedule(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
  });
  if (!program) return null;

  for (let weekNumber = 1; weekNumber <= program.durationWeeks; weekNumber++) {
    const week = await prisma.programWeek.upsert({
      where: {
        programId_weekNumber: { programId, weekNumber },
      },
      update: {},
      create: { programId, weekNumber },
    });

    for (let dayNumber = 1; dayNumber <= DAYS_PER_WEEK; dayNumber++) {
      await prisma.programDay.upsert({
        where: {
          weekId_dayNumber: { weekId: week.id, dayNumber },
        },
        update: {},
        create: { weekId: week.id, dayNumber },
      });
    }
  }

  return prisma.program.findUnique({
    where: { id: programId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              workout: true,
              options: {
                orderBy: { sortOrder: "asc" },
                include: { workout: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function assignWorkoutToDay(
  dayId: string,
  workoutId: string | null,
) {
  return prisma.programDay.update({
    where: { id: dayId },
    data: { workoutId },
    include: { workout: true },
  });
}