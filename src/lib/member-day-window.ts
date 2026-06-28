import "server-only";

import { DAY_LABELS } from "@/lib/program-constants";
import { localTodayIso, rollingProgramCalendarDays } from "@/lib/program-calendar";
import type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";

export type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";
import { resolveProgramWorkoutForCalendarDate } from "@/lib/go-to-today";
import { getProgramBySlug } from "@/lib/program-data";
import { getUserEnrollments } from "@/lib/data/user-data";
import {
  addDaysIso,
  dayVisibilityTier,
  daysFromToday,
  themeLabelForDay,
} from "@/lib/workout-day-visibility";
import { getDemoSeed } from "@/lib/demo-seed-store";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { buildDemoWorkoutExerciseItems } from "@/lib/demo-workout-items";
import { isDemoMode } from "@/lib/demo-enrollments";

const STRETCH_RE = /stretch|mobility|foam|yoga|warm[- ]?up|cool[- ]?down|flex/i;

function formatWeekday(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function exerciseNamesForWorkout(workoutId: string): Promise<string[]> {
  if (!workoutId) return [];

  if (isDemoMode()) {
    await hydrateDemoExercises();
    const data = (await getDemoSeed()) as {
      workoutExercises?: Parameters<typeof buildDemoWorkoutExerciseItems>[1];
    };
    const items = buildDemoWorkoutExerciseItems(
      workoutId,
      data.workoutExercises || [],
      loadDemoExercises(),
    );
    return items.map((it) => it.exercise?.name || "Exercise");
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.workoutExercise.findMany({
      where: { workoutId },
      orderBy: { sortOrder: "asc" },
      include: { exercise: { select: { name: true } } },
    });
    return rows.map((r) => r.exercise?.name || "Exercise");
  } catch {
    return [];
  }
}

export function pickStretchPreview(names: string[]): string[] {
  const hits = names.filter((n) => STRETCH_RE.test(n));
  if (hits.length) return hits.slice(0, 4);
  return names.slice(0, 2);
}

export async function resolvePrimaryScheduleProgram(userId: string) {
  const enrolls = getUserEnrollments(userId);
  const slugs = Object.keys(enrolls).sort((a, b) => {
    if (a === "adult") return -1;
    if (b === "adult") return 1;
    return a.localeCompare(b);
  });

  for (const slug of slugs) {
    const program = await getProgramBySlug(slug);
    if (!program) continue;
    const cat = (program.category || "workout") as string;
    if (cat === "workout" || cat === "journey" || cat === "yoga") {
      return {
        slug,
        program,
        enrollment: enrolls[slug] || { currentWeek: 1, currentDay: 1 },
      };
    }
  }
  return null;
}

/** Placeholder schedule for intake ramp when member has no program enrolled yet. */
export function buildIntakeRampPlaceholderDays(
  todayIso: string,
  windowDays = 10,
  daysBefore = 3,
): MemberDaySummary[] {
  const daysAfter = Math.max(0, windowDays - 1 - daysBefore);
  const days: MemberDaySummary[] = [];

  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const iso = addDaysIso(todayIso, offset);
    const phase = offset < 0 ? "past" : offset === 0 ? "today" : "future";
    const visibilityTier = dayVisibilityTier(iso, todayIso);
    const dayNumber = offset + daysBefore + 1;
    const dayLabel = DAY_LABELS[dayNumber - 1] ?? `Day ${dayNumber}`;
    const themeLabel = visibilityTier === "label" ? themeLabelForDay(null, dayLabel) : null;

    days.push({
      iso,
      phase,
      weekday: formatWeekday(iso),
      shortDate: formatShortDate(iso),
      dayLabel,
      weekNumber: 1,
      dayNumber,
      workoutName: visibilityTier === "label" ? themeLabel : "Ramp-up",
      workoutId: null,
      programSlug: "intake-ramp",
      completed: false,
      exerciseCount: 0,
      exerciseNames: [],
      stretchNames: [],
      smsOverride: false,
      hasWorkout: true,
      daysFromToday: offset,
      visibilityTier,
      themeLabel,
    });
  }

  return days;
}

export function rollupForMemberDays(days: MemberDaySummary[]): MemberDayWindowRollup {
  const past = days.filter((d) => d.phase === "past");
  const future = days.filter((d) => d.phase === "future");
  return {
    pastDone: past.filter((d) => d.completed).length,
    pastTotal: past.length,
    futureTotal: future.filter((d) => d.hasWorkout).length,
  };
}

export async function buildMemberDayWindow(
  userId: string,
  programSlug: string,
  loggedWorkoutIds: Set<string>,
  opts?: { rollingDays?: number; daysBefore?: number },
): Promise<{ days: MemberDaySummary[]; rollup: MemberDayWindowRollup } | null> {
  const program = await getProgramBySlug(programSlug);
  if (!program) return null;

  const todayIso = localTodayIso();
  const rollingDays = opts?.rollingDays ?? 10;
  const daysBefore = opts?.daysBefore ?? 3;
  const rolling = rollingProgramCalendarDays(program, todayIso, rollingDays, daysBefore);
  const days: MemberDaySummary[] = [];

  for (const entry of rolling) {
    const resolved = resolveProgramWorkoutForCalendarDate(program, entry.iso);
    const workoutId = resolved?.smsOverride ? null : resolved?.workoutId || null;
    const names = workoutId ? await exerciseNamesForWorkout(workoutId) : [];
    const dayLabel = DAY_LABELS[entry.dayNumber - 1] ?? `Day ${entry.dayNumber}`;
    const offset = daysFromToday(entry.iso, todayIso);
    const visibilityTier = dayVisibilityTier(entry.iso, todayIso);
    const rawWorkoutName = resolved?.workoutName || resolved?.option || null;
    const themeLabel = rawWorkoutName ? themeLabelForDay(rawWorkoutName, dayLabel) : null;
    const visibleNames = visibilityTier === "label" ? [] : names;

    days.push({
      iso: entry.iso,
      phase: entry.phase,
      weekday: formatWeekday(entry.iso),
      shortDate: formatShortDate(entry.iso),
      dayLabel,
      weekNumber: entry.weekNumber,
      dayNumber: entry.dayNumber,
      workoutName: rawWorkoutName,
      workoutId,
      programSlug,
      completed: !!(workoutId && loggedWorkoutIds.has(workoutId)),
      exerciseCount: visibleNames.length,
      exerciseNames: visibleNames,
      stretchNames: pickStretchPreview(names),
      smsOverride: !!resolved?.smsOverride,
      hasWorkout: !!resolved,
      daysFromToday: offset,
      visibilityTier,
      themeLabel,
    });
  }

  const past = days.filter((d) => d.phase === "past");
  const future = days.filter((d) => d.phase === "future");

  return {
    days,
    rollup: {
      pastDone: past.filter((d) => d.completed).length,
      pastTotal: past.length,
      futureTotal: future.filter((d) => d.hasWorkout).length,
    },
  };
}

/** Next calendar day after today in the member day wheel. */
export function nextMemberDay(
  days: MemberDaySummary[],
  todayIso: string,
): MemberDaySummary | null {
  const idx = days.findIndex((d) => d.iso === todayIso);
  if (idx < 0 || idx >= days.length - 1) return null;
  return days[idx + 1] ?? null;
}

/** Tomorrow's stretch preview when member is on calendar today. */
export function nextDayStretchPreview(days: MemberDaySummary[], todayIso: string): string[] {
  return nextMemberDay(days, todayIso)?.stretchNames ?? [];
}