import "server-only";

import { PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";
import { weekDayFromCycle } from "@/lib/program-cycle-day";
import { cloneWorkout } from "@/lib/clone-workout";
import { prisma } from "@/lib/prisma";
import { workoutContentTitle } from "@/lib/workout-content-name";

const cycleInclude = {
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          workout: {
            include: { _count: { select: { exercises: true } } },
          },
        },
      },
    },
  },
  program: { select: { id: true, slug: true, name: true } },
} as const;

export type WorkoutCycleRecord = Awaited<ReturnType<typeof getWorkoutCycleById>>;

export async function ensureCycleDays(cycleId: string) {
  for (let dayNumber = 1; dayNumber <= PROGRAM_CYCLE_DAYS; dayNumber++) {
    await prisma.workoutCycleDay.upsert({
      where: { cycleId_dayNumber: { cycleId, dayNumber } },
      update: {},
      create: { cycleId, dayNumber },
    });
  }
}

export async function listWorkoutCycles(opts?: {
  programId?: string;
  programSlug?: string;
  libraryOnly?: boolean;
}) {
  let programId = opts?.programId;
  if (!programId && opts?.programSlug) {
    const program = await prisma.program.findUnique({
      where: { slug: opts.programSlug },
      select: { id: true },
    });
    programId = program?.id;
  }

  if (programId && !opts?.libraryOnly) {
    await backfillProgramCycles(programId);
  }

  const where = opts?.libraryOnly
    ? { programId: null }
    : programId
      ? { OR: [{ programId: null }, { programId }] }
      : { programId: null };

  return prisma.workoutCycle.findMany({
    where,
    orderBy: [{ programId: "asc" }, { cycleMonth: "asc" }, { updatedAt: "desc" }],
    include: {
      ...cycleInclude,
      _count: { select: { days: true, clones: true } },
    },
  });
}

export async function getWorkoutCycleById(id: string) {
  const cycle = await prisma.workoutCycle.findUnique({
    where: { id },
    include: cycleInclude,
  });
  if (!cycle) return null;
  await ensureCycleDays(id);
  return prisma.workoutCycle.findUnique({
    where: { id },
    include: cycleInclude,
  });
}

export async function createWorkoutCycle(input: {
  name: string;
  description?: string | null;
  programId?: string | null;
  cycleMonth?: number | null;
}) {
  const cycle = await prisma.workoutCycle.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      programId: input.programId ?? null,
      cycleMonth: input.cycleMonth ?? null,
    },
  });
  await ensureCycleDays(cycle.id);
  return getWorkoutCycleById(cycle.id);
}

export async function copyWorkoutCycle(
  sourceId: string,
  input: {
    name: string;
    programId?: string | null;
    cycleMonth?: number | null;
    deepCloneWorkouts?: boolean;
  },
) {
  const source = await getWorkoutCycleById(sourceId);
  if (!source) throw new Error("CYCLE_NOT_FOUND");

  const deepClone = input.deepCloneWorkouts !== false;
  const workoutIdMap = new Map<string, string>();

  if (deepClone) {
    for (const day of source.days) {
      for (const slot of day.slots) {
        if (workoutIdMap.has(slot.workoutId)) continue;
        const cloned = await cloneWorkout(
          slot.workoutId,
          workoutContentTitle(slot.workout.name),
        );
        workoutIdMap.set(slot.workoutId, cloned.id);
      }
    }
  }

  const cycle = await prisma.workoutCycle.create({
    data: {
      name: input.name.trim(),
      description: source.description,
      programId: input.programId ?? null,
      cycleMonth: input.cycleMonth ?? null,
      clonedFromId: sourceId,
      published: false,
    },
  });

  await ensureCycleDays(cycle.id);

  for (const day of source.days) {
    const targetDay = await prisma.workoutCycleDay.findUnique({
      where: { cycleId_dayNumber: { cycleId: cycle.id, dayNumber: day.dayNumber } },
    });
    if (!targetDay) continue;

    await prisma.workoutCycleDay.update({
      where: { id: targetDay.id },
      data: {
        isDayOff: day.isDayOff,
        notes: day.notes,
        publishedAt: null,
      },
    });

    await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: targetDay.id } });

    for (const slot of day.slots) {
      const workoutId = deepClone
        ? workoutIdMap.get(slot.workoutId) || slot.workoutId
        : slot.workoutId;
      await prisma.workoutCycleDaySlot.create({
        data: {
          cycleDayId: targetDay.id,
          workoutId,
          trainingLocation: slot.trainingLocation,
          sortOrder: slot.sortOrder,
        },
      });
    }
  }

  if (cycle.programId && cycle.cycleMonth) {
    await syncCycleToProgramSchedule(cycle.id);
  }

  return getWorkoutCycleById(cycle.id);
}

export async function updateCycleDaySlot(
  cycleId: string,
  dayNumber: number,
  input: {
    trainingLocation: "gym" | "home";
    workoutId?: string | null;
    isDayOff?: boolean;
    notes?: string | null;
  },
) {
  await ensureCycleDays(cycleId);
  const day = await prisma.workoutCycleDay.findUnique({
    where: { cycleId_dayNumber: { cycleId, dayNumber } },
  });
  if (!day) throw new Error("DAY_NOT_FOUND");

  if (input.isDayOff) {
    await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: day.id } });
    await prisma.workoutCycleDay.update({
      where: { id: day.id },
      data: { isDayOff: true, notes: input.notes ?? "Day Off" },
    });
  } else if (input.workoutId) {
    await prisma.workoutCycleDay.update({
      where: { id: day.id },
      data: { isDayOff: false, notes: input.notes ?? null },
    });
    const label = input.trainingLocation;
    await prisma.workoutCycleDaySlot.upsert({
      where: {
        cycleDayId_trainingLocation: {
          cycleDayId: day.id,
          trainingLocation: label,
        },
      },
      update: { workoutId: input.workoutId },
      create: {
        cycleDayId: day.id,
        workoutId: input.workoutId,
        trainingLocation: label,
        sortOrder: label === "gym" ? 0 : 1,
      },
    });
  }

  const cycle = await prisma.workoutCycle.findUnique({
    where: { id: cycleId },
    select: { programId: true, cycleMonth: true },
  });
  if (cycle?.programId && cycle.cycleMonth) {
    await syncCycleToProgramSchedule(cycleId);
  }

  return getWorkoutCycleById(cycleId);
}

/** Push cycle content onto ProgramWeek/ProgramDay for member calendar compatibility. */
export async function syncCycleToProgramSchedule(cycleId: string) {
  const cycle = await getWorkoutCycleById(cycleId);
  if (!cycle?.programId || !cycle.cycleMonth) return null;

  const program = await prisma.program.findUnique({
    where: { id: cycle.programId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { dayNumber: "asc" } } },
      },
    },
  });
  if (!program) return null;

  for (const day of cycle.days) {
    const { weekNumber, dayNumber } = weekDayFromCycle(cycle.cycleMonth, day.dayNumber);
    const week = program.weeks.find((w) => w.weekNumber === weekNumber);
    const programDay = week?.days.find((d) => d.dayNumber === dayNumber);
    if (!programDay) continue;

    if (day.isDayOff) {
      await prisma.programDayOption.deleteMany({ where: { dayId: programDay.id } });
      await prisma.programDay.update({
        where: { id: programDay.id },
        data: {
          workoutId: null,
          notes: day.notes ?? "Day Off",
          cycleMonth: cycle.cycleMonth,
          cycleDay: day.dayNumber,
        },
      });
      continue;
    }

    const slots = day.slots.filter((s) => s.workoutId);
    await prisma.programDayOption.deleteMany({ where: { dayId: programDay.id } });
    if (slots.length > 0) {
      await prisma.programDayOption.createMany({
        data: slots.map((s, idx) => ({
          dayId: programDay.id,
          workoutId: s.workoutId,
          label: s.trainingLocation === "home" ? "Home" : "Gym",
          trainingLocation: s.trainingLocation,
          sortOrder: idx,
        })),
      });
    }

    await prisma.programDay.update({
      where: { id: programDay.id },
      data: {
        workoutId: slots[0]?.workoutId ?? null,
        notes: day.notes,
        cycleMonth: cycle.cycleMonth,
        cycleDay: day.dayNumber,
        publishedAt: day.publishedAt,
      },
    });
  }

  return cycle;
}

/** Import existing ProgramDay rows into WorkoutCycle tables (one-time / lazy backfill). */
export async function backfillProgramCycles(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              options: { orderBy: { sortOrder: "asc" }, include: { workout: true } },
            },
          },
        },
      },
    },
  });
  if (!program) return [];

  const months = new Set<number>();
  for (const week of program.weeks) {
    for (const day of week.days) {
      months.add(day.cycleMonth ?? 1);
    }
  }
  if (months.size === 0) months.add(1);

  const created: string[] = [];

  for (const cycleMonth of [...months].sort((a, b) => a - b)) {
    let cycle = await prisma.workoutCycle.findUnique({
      where: { programId_cycleMonth: { programId, cycleMonth } },
    });

    if (!cycle) {
      cycle = await prisma.workoutCycle.create({
        data: {
          name: `${program.name} · M${cycleMonth}`,
          programId,
          cycleMonth,
        },
      });
      created.push(cycle.id);
      await ensureCycleDays(cycle.id);
    }

    for (const week of program.weeks) {
      for (const day of week.days) {
        const month = day.cycleMonth ?? 1;
        if (month !== cycleMonth) continue;
        const cycleDayNum = day.cycleDay ?? ((week.weekNumber - 1) * 7 + day.dayNumber - 1) % 28 + 1;

        const cycleDay = await prisma.workoutCycleDay.findUnique({
          where: { cycleId_dayNumber: { cycleId: cycle.id, dayNumber: cycleDayNum } },
        });
        if (!cycleDay) continue;

        const isOff = /^day\s*off$/i.test(day.notes || "");
        await prisma.workoutCycleDay.update({
          where: { id: cycleDay.id },
          data: {
            isDayOff: isOff,
            notes: day.notes,
            publishedAt: day.publishedAt,
          },
        });

        await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: cycleDay.id } });
        if (!isOff) {
          for (const opt of day.options) {
            const loc =
              opt.trainingLocation ||
              (/^home/i.test(opt.label) ? "home" : /^gym/i.test(opt.label) ? "gym" : null);
            if (!loc || !opt.workoutId) continue;
            await prisma.workoutCycleDaySlot.create({
              data: {
                cycleDayId: cycleDay.id,
                workoutId: opt.workoutId,
                trainingLocation: loc,
                sortOrder: opt.sortOrder,
              },
            });
          }
        }
      }
    }
  }

  return created;
}

export async function deployCycleToProgram(
  cycleId: string,
  programId: string,
  cycleMonth: number,
) {
  const source = await getWorkoutCycleById(cycleId);
  if (!source) throw new Error("CYCLE_NOT_FOUND");

  const existing = await prisma.workoutCycle.findUnique({
    where: { programId_cycleMonth: { programId, cycleMonth } },
  });
  if (existing && existing.id !== cycleId) {
    throw new Error("MONTH_SLOT_TAKEN");
  }

  const deployed = await prisma.workoutCycle.update({
    where: { id: cycleId },
    data: { programId, cycleMonth },
  });

  await syncCycleToProgramSchedule(deployed.id);
  return getWorkoutCycleById(deployed.id);
}