import "server-only";

import { applyOverrideToDay } from "@/lib/demo-schedule-overrides";
import { applyCatalogMetadata } from "@/lib/programs";
import { syncProgramSchedule } from "@/lib/program-schedule";

type DayOptionRow = {
  workoutId: string;
  label: string;
  notes?: string | null;
  sessionId?: string | null;
  trainingLocation?: string | null;
  workout?: { id: string; name: string; description?: string | null } | null;
};

type DaySessionRow = {
  id: string;
  partIndex: number;
  label: string;
  sessionKind?: string | null;
  timeSlot?: string | null;
  notes?: string | null;
  sortOrder?: number;
  options?: DayOptionRow[];
};

type DayRow = {
  id: string;
  dayNumber: number;
  workoutId: string | null;
  notes?: string | null;
  videoUrl?: string | null;
  calendarDate?: string | null;
  defaultSets?: number | null;
  defaultReps?: string | null;
  defaultRestSec?: number | null;
  publishedAt?: Date | null;
  partCount?: number | null;
  workout?: { id: string; name: string; description?: string | null } | null;
  sessions?: DaySessionRow[];
  options?: Array<{
    workoutId: string;
    label: string;
    notes?: string | null;
    sessionId?: string | null;
    trainingLocation?: string | null;
    workout?: { id: string; name: string; description?: string | null } | null;
  }>;
};

function mapDayOptions(day: DayRow): DayOptionRow[] {
  const fromOptions = (day.options || []).map((opt) => ({
    workoutId: opt.workoutId,
    label: opt.label,
    notes: opt.notes ?? null,
    sessionId: opt.sessionId ?? null,
    trainingLocation: opt.trainingLocation ?? null,
    workout: opt.workout ?? null,
  }));
  if (fromOptions.length > 0) return fromOptions;
  if (day.workoutId) {
    return [
      {
        workoutId: day.workoutId,
        label: "Standard",
        workout: day.workout ?? null,
      },
    ];
  }
  return [];
}

function mapDay(day: DayRow) {
  const sessions = (day.sessions || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? a.partIndex) - (b.sortOrder ?? b.partIndex))
    .map((s) => ({
      id: s.id,
      partIndex: s.partIndex,
      label: s.label,
      sessionKind: s.sessionKind ?? "strength",
      timeSlot: s.timeSlot ?? null,
      notes: s.notes ?? null,
      sortOrder: s.sortOrder ?? s.partIndex - 1,
      options: (s.options || []).map((opt) => ({
        workoutId: opt.workoutId,
        label: opt.label,
        notes: opt.notes ?? null,
        sessionId: s.id,
        trainingLocation: opt.trainingLocation ?? null,
        workout: opt.workout ?? null,
      })),
    }));

  const flatFromSessions = sessions.flatMap((s) => s.options || []);
  const options = flatFromSessions.length > 0 ? flatFromSessions : mapDayOptions(day);

  return applyOverrideToDay({
    id: day.id,
    dayNumber: day.dayNumber,
    workoutId: day.workoutId,
    notes: day.notes ?? null,
    videoUrl: day.videoUrl ?? null,
    calendarDate: day.calendarDate ?? null,
    defaultSets: day.defaultSets ?? null,
    defaultReps: day.defaultReps ?? null,
    defaultRestSec: day.defaultRestSec ?? null,
    publishedAt: day.publishedAt ? day.publishedAt.toISOString() : null,
    partCount: day.partCount ?? Math.max(1, sessions.length || 1),
    sessions:
      sessions.length > 0
        ? sessions
        : [
            {
              id: `legacy-${day.id}`,
              partIndex: 1,
              label: "Main",
              sessionKind: "strength",
              timeSlot: null,
              notes: null,
              sortOrder: 0,
              options,
            },
          ],
    workout: day.workout ?? null,
    options,
  });
}

const programInclude = {
  weeks: {
    orderBy: { weekNumber: "asc" as const },
    include: {
      days: {
        orderBy: { dayNumber: "asc" as const },
        include: {
          workout: true,
          sessions: {
            orderBy: [{ sortOrder: "asc" as const }, { partIndex: "asc" as const }],
            include: {
              options: {
                orderBy: { sortOrder: "asc" as const },
                include: { workout: true },
              },
            },
          },
          options: {
            orderBy: { sortOrder: "asc" as const },
            include: { workout: true },
          },
        },
      },
    },
  },
  _count: { select: { enrollments: true } },
};

export async function listProgramsFromDb() {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.program.findMany({
    orderBy: { sortOrder: "asc" },
    include: programInclude,
  });

  return rows.map((p) =>
    applyCatalogMetadata({
      ...p,
      startDate: p.startDate ?? null,
      weeks: p.weeks.map((w) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        macroPhaseIndex: w.macroPhaseIndex,
        phaseWeekNumber: w.phaseWeekNumber,
        days: w.days.map((d) => mapDay(d)),
      })),
    }),
  );
}

export async function getProgramBySlugFromDb(slug: string) {
  const { prisma } = await import("@/lib/prisma");
  let program = await prisma.program.findUnique({
    where: { slug },
    include: programInclude,
  });
  if (!program) return null;

  if (program.weeks.length < program.durationWeeks) {
    await syncProgramSchedule(program.id);
    program = await prisma.program.findUnique({
      where: { slug },
      include: programInclude,
    });
    if (!program) return null;
  }

  return applyCatalogMetadata({
    ...program,
    startDate: program.startDate ?? null,
    weeks: program.weeks.map((w) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      macroPhaseIndex: w.macroPhaseIndex,
      phaseWeekNumber: w.phaseWeekNumber,
      days: w.days.map((d) => mapDay(d)),
    })),
    _count: { enrollments: program._count.enrollments },
  });
}

export async function getSyncedProgramFromDb(slug: string) {
  const { prisma } = await import("@/lib/prisma");
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) return null;
  await syncProgramSchedule(program.id);
  return getProgramBySlugFromDb(slug);
}