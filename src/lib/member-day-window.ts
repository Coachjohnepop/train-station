import "server-only";

import { DAY_LABELS } from "@/lib/program-constants";
import { localTodayIso } from "@/lib/program-calendar";
import {
  coordinateFromEnrollmentDay,
  enrollmentDayKey,
  formatCycleDayFromWeekDay,
  linearEnrollmentDay,
  rollingEnrollmentProgramDays,
} from "@/lib/member-enrollment-day";
import {
  blockPhaseForCalendarDate,
  calendarDateForBlockDay,
  effectiveEnrollmentPosition,
  resolveProgramBlock,
  type ResolvedProgramBlock,
} from "@/lib/member-program-block";
import type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";

export type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";

import { getProgramBySlug } from "@/lib/program-data";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";
import { getSessionForUserOnDate, hydrateTodaySessions } from "@/lib/today-sessions";
import { getWorkoutExercisePreview } from "@/lib/sms-generated-workouts";
import { getUserEnrollments } from "@/lib/data/user-data";
import {
  addDaysIso,
  dayVisibilityTier,
  dayVisibilityTierByOffset,
  daysFromToday,
  themeLabelForDay,
} from "@/lib/workout-day-visibility";
import { findEnrollmentWeek, macroPhasesForProgramSlug, normalizeTrainingLocation, pickWorkoutOptionByLocation } from "@/lib/program-macro-cycle";
import { dayWorkoutOptions } from "@/lib/member-program-workout";
import { getDemoSeed } from "@/lib/demo-seed-store";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { buildDemoWorkoutExerciseItems } from "@/lib/demo-workout-items";
import { isDemoMode } from "@/lib/demo-enrollments";
import { dayWorkoutCompleted } from "@/lib/member-day-completion";

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
  const enrolls = await getUserEnrollments(userId);
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

/**
 * Always-available catch-up · today · tomorrow calendar chips.
 * Used when no program schedule is linked so swipe still works with empty workout days.
 */
export function buildCalendarSwipeDays(
  todayIso: string,
  loggedCalendarDates: Set<string> = new Set(),
  daysBefore = 5,
  daysAfter = 1,
): MemberDaySummary[] {
  const days: MemberDaySummary[] = [];
  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const iso = addDaysIso(todayIso, offset);
    const phase = offset < 0 ? "past" : offset === 0 ? "today" : "future";
    const dayLabel =
      offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday" : formatWeekday(iso);
    days.push({
      iso,
      calendarDate: iso,
      phase,
      weekday: formatWeekday(iso),
      shortDate: formatShortDate(iso),
      dayLabel,
      weekNumber: 1,
      dayNumber: offset + daysBefore + 1,
      workoutName: null,
      workoutId: null,
      programSlug: "calendar",
      completed: loggedCalendarDates.has(iso),
      exerciseCount: 0,
      exerciseNames: [],
      stretchNames: [],
      smsOverride: false,
      hasWorkout: false,
      daysFromToday: offset,
      visibilityTier: dayVisibilityTier(iso, todayIso),
      themeLabel: null,
    });
  }
  return days;
}

/** Placeholder schedule for intake ramp when member has no program enrolled yet. */
export function buildIntakeRampPlaceholderDays(
  todayIso: string,
  windowDays = 5,
  daysBefore = 2,
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

async function summarizeProgramDay(
  userId: string,
  programSlug: string,
  enrollment: {
    trainingLocation?: string | null;
  },
  entry: {
    key: string;
    weekNumber: number;
    dayNumber: number;
    enrollmentDayNumber: number;
    day: Parameters<typeof dayWorkoutOptions>[0];
    phase: MemberDaySummary["phase"];
    offset: number;
  },
  loggedWorkoutIds: Set<string>,
  calendarToday: string,
  extras?: {
    calendarDate?: string;
    visibilityTier?: MemberDaySummary["visibilityTier"];
    loggedCalendarDates?: Set<string>;
  },
): Promise<MemberDaySummary> {
  const enrollmentDayNumber = entry.enrollmentDayNumber;
  const dayLabel = `Day ${enrollmentDayNumber}`;
  const visibilityTier =
    extras?.visibilityTier ?? dayVisibilityTierByOffset(entry.offset);
  const isProgramToday = entry.offset === 0;

  if (isProgramToday) {
    const coachSession = getSessionForUserOnDate(userId, calendarToday);
    if (coachSession) {
      const preview = await getWorkoutExercisePreview(coachSession.workoutId, 8);
      const visibleNames = visibilityTier === "label" ? [] : preview;
      return {
        iso: entry.key,
        calendarDate: extras?.calendarDate,
        phase: entry.phase,
        weekday: extras?.calendarDate ? formatWeekday(extras.calendarDate) : "Day",
        shortDate: extras?.calendarDate ? formatShortDate(extras.calendarDate) : String(enrollmentDayNumber),
        dayLabel,
        enrollmentDayNumber,
        weekNumber: entry.weekNumber,
        dayNumber: entry.dayNumber,
        workoutName: coachSession.title,
        workoutId: coachSession.workoutId,
        programSlug,
        completed: dayWorkoutCompleted(
          {
            iso: extras?.calendarDate || entry.key,
            calendarDate: extras?.calendarDate,
            workoutId: coachSession.workoutId,
          },
          loggedWorkoutIds,
          extras?.loggedCalendarDates ?? new Set(),
        ),
        exerciseCount: visibleNames.length,
        exerciseNames: visibleNames,
        stretchNames: pickStretchPreview(preview),
        smsOverride: true,
        hasWorkout: true,
        daysFromToday: entry.offset,
        visibilityTier,
        themeLabel: coachSession.title,
      };
    }
  }

  const optsForDay = dayWorkoutOptions(entry.day);
  const pick = pickWorkoutOptionByLocation(
    optsForDay,
    normalizeTrainingLocation(enrollment.trainingLocation),
  );
  const workoutId = pick?.workoutId || null;
  const names = workoutId ? await exerciseNamesForWorkout(workoutId) : [];
  const rawWorkoutName = pick?.workout?.name || null;
  const themeLabel = rawWorkoutName ? themeLabelForDay(rawWorkoutName, dayLabel) : null;
  const visibleNames = visibilityTier === "label" ? [] : names;

  return {
    iso: entry.key,
    calendarDate: extras?.calendarDate,
    phase: entry.phase,
    weekday: extras?.calendarDate ? formatWeekday(extras.calendarDate) : "Day",
    shortDate: extras?.calendarDate ? formatShortDate(extras.calendarDate) : String(enrollmentDayNumber),
    dayLabel,
    enrollmentDayNumber,
    weekNumber: entry.weekNumber,
    dayNumber: entry.dayNumber,
    workoutName: pick?.workout?.name || null,
    workoutId,
    programSlug,
    completed: dayWorkoutCompleted(
      {
        iso: extras?.calendarDate || entry.key,
        calendarDate: extras?.calendarDate,
        workoutId,
      },
      loggedWorkoutIds,
      extras?.loggedCalendarDates ?? new Set(),
    ),
    exerciseCount: visibleNames.length,
    exerciseNames: visibleNames,
    stretchNames: pickStretchPreview(names),
    smsOverride: false,
    hasWorkout: !!workoutId || optsForDay.length > 0,
    daysFromToday: entry.offset,
    visibilityTier,
    themeLabel,
  };
}

export async function buildMemberDayWindow(
  userId: string,
  programSlug: string,
  loggedWorkoutIds: Set<string>,
  opts?: {
    rollingDays?: number;
    daysBefore?: number;
    /** Override future-day visibility (used for temp content-review previews). */
    futureVisibility?: "names" | "full";
    upcomingDays?: number;
    loggedCalendarDates?: Set<string>;
  },
): Promise<{
  days: MemberDaySummary[];
  rollup: MemberDayWindowRollup;
  programTodayKey: string;
  block: ResolvedProgramBlock | null;
} | null> {
  const program = await getProgramBySlug(programSlug);
  if (!program) return null;

  await hydrateTodaySessions({ preferFresh: true });
  const calendarToday = localTodayIso();
  const rollingDays = opts?.rollingDays ?? 5;
  const daysBefore = opts?.daysBefore ?? 2;
  const upcomingDays = opts?.upcomingDays;
  const futureVisibility = opts?.futureVisibility;
  const loggedCalendarDates = opts?.loggedCalendarDates ?? new Set<string>();
  const enrolls = await getUserEnrollments(userId);
  const enrollment = enrolls[programSlug] || {
    currentWeek: 1,
    currentDay: 1,
    currentPhase: 1,
    trainingLocation: "gym" as const,
  };

  const startSettings = programStartSettingsFromCoach(await getCoachSettings());

  if (enrollment.programStartDate) {
    const block = resolveProgramBlock(
      enrollment,
      calendarToday,
      program.durationWeeks,
      startSettings.blockDays,
    );
    const effective = effectiveEnrollmentPosition(
      enrollment,
      calendarToday,
      program.durationWeeks,
      startSettings.blockDays,
    );
    const programTodayKey = enrollmentDayKey(effective.currentWeek, effective.currentDay);
    const days: MemberDaySummary[] = [];

    for (let linearDay = 1; linearDay <= startSettings.blockDays; linearDay++) {
      const coord = coordinateFromEnrollmentDay(linearDay, program.durationWeeks);
      if (!coord) continue;
      const week = program.weeks.find(
        (w: { weekNumber: number; days: unknown[] }) => w.weekNumber === coord.weekNumber,
      );
      const day = week?.days.find(
        (d: { dayNumber: number }) => d.dayNumber === coord.dayNumber,
      );
      if (!week || !day) continue;

      const calendarDate = calendarDateForBlockDay(block.programStartDate, linearDay);
      const phase = blockPhaseForCalendarDate(calendarDate, calendarToday);
      const offset = daysFromToday(calendarDate, calendarToday);
      const visibilityTier =
        offset > 0 && futureVisibility
          ? futureVisibility
          : dayVisibilityTier(calendarDate, calendarToday);
      const entry = {
        key: enrollmentDayKey(coord.weekNumber, coord.dayNumber),
        weekNumber: coord.weekNumber,
        dayNumber: coord.dayNumber,
        enrollmentDayNumber: linearDay,
        day,
        phase,
        offset,
      };

      const summary = await summarizeProgramDay(
        userId,
        programSlug,
        enrollment,
        entry,
        loggedWorkoutIds,
        calendarToday,
        { calendarDate, visibilityTier, loggedCalendarDates },
      );

      if (block.status === "pending") {
        summary.hasWorkout = linearDay === 1;
        if (linearDay > 1) summary.workoutId = null;
      }
      if (block.status === "expired" && phase === "future") {
        summary.hasWorkout = false;
        summary.workoutId = null;
      }

      days.push(summary);
    }

    const windowed =
      upcomingDays != null
        ? days.filter((d) => {
            const off = d.daysFromToday;
            return off >= -daysBefore && off <= upcomingDays;
          })
        : days;

    const past = windowed.filter((d) => d.phase === "past");
    const future = windowed.filter((d) => d.phase === "future");
    return {
      days: windowed,
      programTodayKey,
      block,
      rollup: {
        pastDone: past.filter((d) => d.completed).length,
        pastTotal: past.length,
        futureTotal: future.filter((d) => d.hasWorkout).length,
      },
    };
  }

  const phases = macroPhasesForProgramSlug(programSlug);
  const centerWeek = findEnrollmentWeek(program.weeks, enrollment, phases);
  const centerWeekNumber = centerWeek?.weekNumber ?? enrollment.currentWeek;
  const programTodayKey = enrollmentDayKey(enrollment.currentWeek, enrollment.currentDay);

  const rolling = rollingEnrollmentProgramDays(
    program.weeks,
    { weekNumber: centerWeekNumber, dayNumber: enrollment.currentDay },
    program.durationWeeks,
    rollingDays,
    daysBefore,
  );
  const days: MemberDaySummary[] = [];

  for (const entry of rolling) {
    const visibilityTier =
      entry.offset > 0 && futureVisibility ? futureVisibility : undefined;
    days.push(
      await summarizeProgramDay(
        userId,
        programSlug,
        enrollment,
        entry,
        loggedWorkoutIds,
        calendarToday,
        {
          calendarDate: addDaysIso(calendarToday, entry.offset),
          visibilityTier,
          loggedCalendarDates,
        },
      ),
    );
  }

  const past = days.filter((d) => d.phase === "past");
  const future = days.filter((d) => d.phase === "future");

  return {
    days,
    programTodayKey,
    block: null,
    rollup: {
      pastDone: past.filter((d) => d.completed).length,
      pastTotal: past.length,
      futureTotal: future.filter((d) => d.hasWorkout).length,
    },
  };
}

/** Next day after program-today in the member day wheel. */
export function nextMemberDay(
  days: MemberDaySummary[],
  programTodayKey: string,
): MemberDaySummary | null {
  const idx = days.findIndex((d) => d.iso === programTodayKey);
  if (idx < 0 || idx >= days.length - 1) return null;
  return days[idx + 1] ?? null;
}

/** Next program day's stretch preview when member is on program today. */
export function nextDayStretchPreview(days: MemberDaySummary[], programTodayKey: string): string[] {
  return nextMemberDay(days, programTodayKey)?.stretchNames ?? [];
}

export function memberScheduleLabel(
  programName: string,
  weekNumber: number,
  dayNumber: number,
): string {
  return `${programName} · ${formatCycleDayFromWeekDay(weekNumber, dayNumber)}`;
}