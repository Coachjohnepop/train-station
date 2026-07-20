import { PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";
import { weekDayFromCycle } from "@/lib/program-cycle-day";
import { cloneWorkout } from "@/lib/clone-workout";
import { prisma } from "@/lib/prisma";
import { workoutContentTitle } from "@/lib/workout-content-name";

async function assertWorkoutExists(workoutId: string) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true },
  });
  if (!workout) {
    throw new Error(
      "WORKOUT_NOT_FOUND: That workout was removed or merged — refresh the page and pick again from the library.",
    );
  }
}

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
  /** Default active only. */
  archive?: "active" | "archived" | "all";
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

  const archive = opts?.archive || "active";
  const base = opts?.libraryOnly
    ? { programId: null as string | null }
    : programId
      ? { OR: [{ programId: null }, { programId }] }
      : { programId: null as string | null };

  const where =
    archive === "all"
      ? base
      : archive === "archived"
        ? { AND: [base, { archivedAt: { not: null } }] }
        : { AND: [base, { archivedAt: null }] };

  return prisma.workoutCycle.findMany({
    where,
    orderBy: [{ programId: "asc" }, { cycleMonth: "asc" }, { updatedAt: "desc" }],
    include: {
      ...cycleInclude,
      _count: { select: { days: true, clones: true } },
    },
  });
}

/** Soft-archive a 28-day pack / cycle (look-back shelf). */
export async function archiveWorkoutCycle(id: string) {
  const existing = await prisma.workoutCycle.findUnique({ where: { id } });
  if (!existing) throw new Error("CYCLE_NOT_FOUND");
  // Free program month slot so a new active pack can land there; keep name for look-back.
  const name =
    existing.programId && existing.cycleMonth
      ? `${existing.name.replace(/\s*\[archived.*\]\s*$/i, "")} [archived M${existing.cycleMonth}]`
      : existing.name;
  return prisma.workoutCycle.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      programId: null,
      cycleMonth: null,
      name,
    },
    include: cycleInclude,
  });
}

export async function restoreWorkoutCycle(id: string) {
  const existing = await prisma.workoutCycle.findUnique({ where: { id } });
  if (!existing) throw new Error("CYCLE_NOT_FOUND");
  return prisma.workoutCycle.update({
    where: { id },
    data: { archivedAt: null },
    include: cycleInclude,
  });
}

/**
 * Permanent delete — only if already archived (unless forceHard).
 * Soft path: archiveWorkoutCycle.
 */
export async function deleteWorkoutCycle(
  id: string,
  opts?: { hard?: boolean; forceHard?: boolean },
): Promise<{ mode: "archived" | "deleted" }> {
  const existing = await prisma.workoutCycle.findUnique({ where: { id } });
  if (!existing) throw new Error("CYCLE_NOT_FOUND");

  if (!opts?.hard) {
    await archiveWorkoutCycle(id);
    return { mode: "archived" };
  }
  if (!existing.archivedAt && !opts?.forceHard) {
    throw new Error("NOT_ARCHIVED");
  }
  await prisma.workoutCycle.delete({ where: { id } });
  return { mode: "deleted" };
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
    await assertWorkoutExists(input.workoutId);
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

/**
 * Snapshot a program's month (28-day block) into the **library** as a deep-cloned cycle.
 * Always clones workouts so the library is independent of the live program.
 */
/**
 * Snapshot a program **calendar week** (days 1–7) into the library as a deep-cloned
 * cycle pack. Days are stored as cycle dayNumber 1–7 (Mon–Sun). Description is tagged
 * `[week-pack]` so the UI can list week templates separately from 28-day months.
 */
export async function snapshotProgramWeekToLibrary(input: {
  programSlug: string;
  weekNumber: number;
  name: string;
  description?: string | null;
}) {
  const weekNumber = Math.max(1, Math.floor(input.weekNumber || 1));
  const program = await prisma.program.findUnique({
    where: { slug: input.programSlug },
    select: {
      id: true,
      name: true,
      weeks: {
        where: { weekNumber },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              sessions: {
                orderBy: { partIndex: "asc" },
                include: {
                  options: { orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) throw new Error("PROGRAM_NOT_FOUND");
  const week = program.weeks[0];
  if (!week) throw new Error("WEEK_NOT_FOUND");

  const cycle = await prisma.workoutCycle.create({
    data: {
      name: input.name.trim(),
      description:
        (input.description?.trim() ||
          `Week pack from ${program.name} · week ${weekNumber}`) + " [week-pack]",
      programId: null,
      cycleMonth: null,
      published: false,
    },
  });
  await ensureCycleDays(cycle.id);

  let slotsWritten = 0;
  for (const day of week.days) {
    const dayNumber = day.dayNumber; // 1–7
    if (dayNumber < 1 || dayNumber > 7) continue;
    const cycleDay = await prisma.workoutCycleDay.findUnique({
      where: { cycleId_dayNumber: { cycleId: cycle.id, dayNumber } },
    });
    if (!cycleDay) continue;

    const notes = day.notes || null;
    const isOff = /^day\s*off$/i.test(notes || "");
    await prisma.workoutCycleDay.update({
      where: { id: cycleDay.id },
      data: { isDayOff: isOff, notes, publishedAt: null },
    });
    await prisma.workoutCycleDaySlot.deleteMany({ where: { cycleDayId: cycleDay.id } });
    if (isOff) continue;

    // Prefer session options (multi-part); fall back to flat day options.
    type Opt = {
      workoutId: string;
      label: string;
      trainingLocation?: string | null;
      sortOrder?: number;
    };
    const rawOpts: Opt[] = [];
    if (day.sessions?.length) {
      for (const session of day.sessions) {
        for (const o of session.options || []) {
          if (o.workoutId) {
            rawOpts.push({
              workoutId: o.workoutId,
              label: o.label,
              trainingLocation: o.trainingLocation,
              sortOrder: o.sortOrder,
            });
          }
        }
      }
    }
    if (!rawOpts.length) {
      for (const o of day.options || []) {
        if (o.workoutId) {
          rawOpts.push({
            workoutId: o.workoutId,
            label: o.label,
            trainingLocation: o.trainingLocation,
            sortOrder: o.sortOrder,
          });
        }
      }
    }

    // Cycle slots only support gym|home uniqueness — keep first of each location.
    const byLoc = new Map<string, Opt>();
    for (const opt of rawOpts) {
      const loc =
        opt.trainingLocation ||
        (/^home/i.test(opt.label) ? "home" : /^gym/i.test(opt.label) ? "gym" : null);
      if (!loc || byLoc.has(loc)) continue;
      byLoc.set(loc, opt);
    }

    let sortOrder = 0;
    for (const [loc, opt] of byLoc) {
      const cloned = await cloneWorkout(
        opt.workoutId,
        workoutContentTitle(
          (
            await prisma.workout.findUnique({
              where: { id: opt.workoutId },
              select: { name: true },
            })
          )?.name || opt.label,
        ),
      );
      await prisma.workoutCycleDaySlot.create({
        data: {
          cycleDayId: cycleDay.id,
          workoutId: cloned.id,
          trainingLocation: loc,
          sortOrder: sortOrder++,
        },
      });
      slotsWritten += 1;
    }
  }

  if (slotsWritten === 0) {
    await prisma.workoutCycle.delete({ where: { id: cycle.id } });
    throw new Error("WEEK_EMPTY");
  }

  return getWorkoutCycleById(cycle.id);
}

/**
 * Paste a library week pack (days 1–7) onto a program calendar week.
 * Always deep-clones workouts onto ProgramDay options (Gym/Home).
 */
export async function pasteWeekPackOntoProgramWeek(input: {
  sourceCycleId: string;
  programSlug: string;
  targetWeekNumber: number;
  force?: boolean;
}): Promise<{ weekNumber: number; daysUpdated: number; slotsCloned: number }> {
  const targetWeekNumber = Math.max(1, Math.floor(input.targetWeekNumber || 1));
  const source = await getWorkoutCycleById(input.sourceCycleId);
  if (!source) throw new Error("CYCLE_NOT_FOUND");

  const program = await prisma.program.findUnique({
    where: { slug: input.programSlug },
    include: {
      weeks: {
        where: { weekNumber: targetWeekNumber },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              options: true,
              sessions: { include: { options: true } },
            },
          },
        },
      },
    },
  });
  if (!program) throw new Error("PROGRAM_NOT_FOUND");
  const week = program.weeks[0];
  if (!week) throw new Error("WEEK_NOT_FOUND");

  let occupied = 0;
  for (const d of week.days) {
    const n =
      (d.options?.length || 0) +
      (d.sessions || []).reduce((s, sess) => s + (sess.options?.length || 0), 0);
    if (n > 0) occupied += 1;
  }
  if (occupied > 0 && !input.force) {
    const err = new Error("CONTENT_EXISTS") as Error & { summary?: string };
    err.summary = `${occupied} day(s) already have workouts`;
    throw err;
  }

  let daysUpdated = 0;
  let slotsCloned = 0;

  for (const day of week.days) {
    const dayNumber = day.dayNumber;
    if (dayNumber < 1 || dayNumber > 7) continue;
    const srcDay = source.days.find((d) => d.dayNumber === dayNumber);
    if (!srcDay) continue;

    // Clear existing options on this program day (all sessions / flat).
    await prisma.programDayOption.deleteMany({ where: { dayId: day.id } });
    // Week-pack paste always starts clean day descriptions (same intent as auto-clear on week copy).
    await prisma.programDay.update({
      where: { id: day.id },
      data: {
        notes: null,
        publishedAt: null,
        partCount: 1,
        workoutId: null,
      },
    });

    if (srcDay.isDayOff || !srcDay.slots?.length) {
      daysUpdated += 1;
      continue;
    }

    // Ensure one Main session for options
    let session = await prisma.programDaySession.findFirst({
      where: { dayId: day.id, partIndex: 1 },
    });
    if (!session) {
      session = await prisma.programDaySession.create({
        data: {
          dayId: day.id,
          partIndex: 1,
          label: "Main",
          sessionKind: "strength",
          sortOrder: 0,
        },
      });
    }

    let sortOrder = 0;
    let firstWorkoutId: string | null = null;
    for (const slot of srcDay.slots) {
      const loc = slot.trainingLocation === "home" ? "home" : "gym";
      const label = loc === "home" ? "Home" : "Gym";
      const cloned = await cloneWorkout(
        slot.workoutId,
        workoutContentTitle(slot.workout?.name || label),
      );
      await prisma.programDayOption.create({
        data: {
          dayId: day.id,
          sessionId: session.id,
          workoutId: cloned.id,
          label,
          trainingLocation: loc,
          sortOrder: sortOrder++,
        },
      });
      if (!firstWorkoutId) firstWorkoutId = cloned.id;
      slotsCloned += 1;
    }
    if (firstWorkoutId) {
      await prisma.programDay.update({
        where: { id: day.id },
        data: { workoutId: firstWorkoutId },
      });
    }
    daysUpdated += 1;
  }

  return { weekNumber: targetWeekNumber, daysUpdated, slotsCloned };
}

export async function snapshotProgramMonthToLibrary(input: {
  programId?: string;
  programSlug?: string;
  cycleMonth?: number;
  name: string;
  description?: string | null;
}) {
  let programId = input.programId;
  if (!programId && input.programSlug) {
    const program = await prisma.program.findUnique({
      where: { slug: input.programSlug },
      select: { id: true, name: true },
    });
    if (!program) throw new Error("PROGRAM_NOT_FOUND");
    programId = program.id;
  }
  if (!programId) throw new Error("PROGRAM_REQUIRED");

  const cycleMonth = input.cycleMonth ?? 1;
  await backfillProgramCycles(programId);

  const source = await prisma.workoutCycle.findUnique({
    where: { programId_cycleMonth: { programId, cycleMonth } },
  });
  if (!source) throw new Error("CYCLE_NOT_FOUND");

  return copyWorkoutCycle(source.id, {
    name: input.name.trim(),
    programId: null,
    cycleMonth: null,
    deepCloneWorkouts: true,
  });
}

/**
 * True if a program month already has meaningful content (slots, day-off, notes).
 */
export async function programMonthHasContent(
  programId: string,
  cycleMonth: number,
): Promise<{ hasContent: boolean; summary: string }> {
  const existing = await prisma.workoutCycle.findUnique({
    where: { programId_cycleMonth: { programId, cycleMonth } },
    include: {
      days: {
        include: { slots: { select: { id: true } } },
      },
    },
  });
  if (!existing) {
    return { hasContent: false, summary: "empty" };
  }
  let slotCount = 0;
  let dayOffCount = 0;
  let notedDays = 0;
  for (const d of existing.days) {
    slotCount += d.slots.length;
    if (d.isDayOff) dayOffCount += 1;
    if (d.notes?.trim()) notedDays += 1;
  }
  const hasContent = slotCount > 0 || dayOffCount > 0 || notedDays > 0;
  return {
    hasContent,
    summary: hasContent
      ? `${slotCount} workout slot(s), ${dayOffCount} day-off, ${notedDays} noted day(s)`
      : "empty",
  };
}

/**
 * Paste a library (or any) cycle onto a program month by **day number** (1–28).
 * Always deep-clones workouts. Refuses overwrite unless `force: true`.
 */
export async function pasteCycleOntoProgramMonth(input: {
  sourceCycleId: string;
  programId?: string;
  programSlug?: string;
  cycleMonth: number;
  name?: string;
  /** Required when target month already has content. */
  force?: boolean;
}) {
  let programId = input.programId;
  let programName = "Program";
  if (!programId && input.programSlug) {
    const program = await prisma.program.findUnique({
      where: { slug: input.programSlug },
      select: { id: true, name: true },
    });
    if (!program) throw new Error("PROGRAM_NOT_FOUND");
    programId = program.id;
    programName = program.name;
  }
  if (!programId) throw new Error("PROGRAM_REQUIRED");

  const existing = await prisma.workoutCycle.findUnique({
    where: {
      programId_cycleMonth: { programId, cycleMonth: input.cycleMonth },
    },
  });

  if (existing) {
    const check = await programMonthHasContent(programId, input.cycleMonth);
    if (check.hasContent && !input.force) {
      const err = new Error("CONTENT_EXISTS");
      (err as Error & { summary?: string }).summary = check.summary;
      throw err;
    }
    // Remove prior month slot so copy can take the unique (programId, cycleMonth)
    await prisma.workoutCycle.delete({ where: { id: existing.id } });
  }

  return copyWorkoutCycle(input.sourceCycleId, {
    name:
      input.name?.trim() ||
      `${programName} · M${input.cycleMonth} (from template)`,
    programId,
    cycleMonth: input.cycleMonth,
    deepCloneWorkouts: true,
  });
}