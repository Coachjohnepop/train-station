import "server-only";

import { getUserEnrollments } from "@/lib/data/user-data";
import { resolveUserId } from "@/lib/current-user";
import { getProgramBySlug } from "@/lib/program-data";
import {
  findEnrollmentWeek,
  macroPhasesForProgramSlug,
  normalizeTrainingLocation,
  pickWorkoutOptionByLocation,
  type ProgramWeekLike,
  type TrainingLocation,
} from "@/lib/program-macro-cycle";
import { normalizeProgramSlug } from "@/lib/programs";
import { localTodayIso } from "@/lib/program-calendar";
import { resolveProgramBlock } from "@/lib/member-program-block";
import {
  normalizeDaySessions,
  type DayWithSessionsLike,
  type ResolvedDayPart,
} from "@/lib/program-day-sessions";

export type { ResolvedDayPart };

export type ResolvedProgramWorkout = {
  workoutId: string;
  option?: string;
  weekNumber: number;
  dayNumber: number;
  macroPhaseIndex?: number;
  phaseWeekNumber?: number;
  trainingLocation?: TrainingLocation;
  workoutName?: string;
};

export type ResolvedProgramDayParts = {
  dayId?: string;
  weekNumber: number;
  dayNumber: number;
  partCount: number;
  trainingLocation: TrainingLocation;
  parts: ResolvedDayPart[];
};

export function dayWorkoutOptions(day: {
  workoutId?: string | null;
  workout?: { id: string; name?: string } | null;
  options?: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>;
}) {
  if (day.options?.length) return day.options;
  if (day.workoutId) {
    return [{ workoutId: day.workoutId, label: "Gym", workout: day.workout }];
  }
  if (day.workout?.id) {
    return [{ workoutId: day.workout.id, label: "Gym", workout: day.workout }];
  }
  return [];
}

export type EnrollmentSlice = {
  currentWeek: number;
  currentDay: number;
  currentPhase?: number;
  trainingLocation?: string | null;
  programStartDate?: string | null;
  blockEndsAt?: string | null;
};

/** Resolve the member's current scheduled workout for a program (phase week/day + gym/home). */
export async function resolveMemberProgramWorkout(
  programSlug: string,
  userId?: string,
  opts?: { trainingLocation?: TrainingLocation },
): Promise<ResolvedProgramWorkout | null> {
  const slug = normalizeProgramSlug(programSlug);
  const program = await getProgramBySlug(slug);
  if (!program?.weeks?.length) return null;

  const uid = userId || (await resolveUserId());
  const enrolls = await getUserEnrollments(uid);
  const en: EnrollmentSlice = enrolls[slug] ||
    enrolls[programSlug] || { currentWeek: 1, currentDay: 1, currentPhase: 1, trainingLocation: "gym" };

  const phases = macroPhasesForProgramSlug(slug);
  const location = opts?.trainingLocation ?? normalizeTrainingLocation(en.trainingLocation);

  const week = findEnrollmentWeek(program.weeks, en, phases);
  const day =
    week?.days?.find((d: { dayNumber: number }) => d.dayNumber === en.currentDay) ||
    week?.days?.[0];
  if (!day) return null;

  const optsList = dayWorkoutOptions(day);
  if (!optsList.length) return null;

  const pick = pickWorkoutOptionByLocation(optsList, location);
  if (!pick?.workoutId) return null;

  return {
    workoutId: pick.workoutId,
    option: pick.label,
    weekNumber: week?.weekNumber ?? en.currentWeek,
    dayNumber: day.dayNumber,
    macroPhaseIndex: week?.macroPhaseIndex ?? en.currentPhase ?? 1,
    phaseWeekNumber: week?.phaseWeekNumber ?? en.currentWeek,
    trainingLocation: location,
    workoutName: pick.workout?.name || day.workout?.name,
  };
}

export function resolveDayWorkoutForEnrollment(
  program: { weeks: ProgramWeekLike[] },
  programSlug: string,
  enrollment: EnrollmentSlice,
  dayNumber = enrollment.currentDay,
): Omit<ResolvedProgramWorkout, "workoutName"> & { workoutName?: string; dayId?: string } | null {
  const phases = macroPhasesForProgramSlug(programSlug);
  const week = findEnrollmentWeek(program.weeks, enrollment, phases);
  const multi = resolveDayPartsForEnrollment(program, programSlug, enrollment, dayNumber);
  if (!multi?.parts.length) return null;
  const primary = multi.parts[0];
  return {
    workoutId: primary.workoutId,
    option: primary.optionLabel,
    weekNumber: multi.weekNumber,
    dayNumber: multi.dayNumber,
    macroPhaseIndex: week?.macroPhaseIndex ?? enrollment.currentPhase ?? 1,
    phaseWeekNumber: week?.phaseWeekNumber ?? enrollment.currentWeek,
    trainingLocation: multi.trainingLocation,
    workoutName: primary.workoutName,
    dayId: multi.dayId,
  };
}

/**
 * Resolve all programmed parts for a member day (Gym/Home pick per part).
 * Empty shells are omitted. Single-part days return one entry.
 */
export function resolveDayPartsForEnrollment(
  program: { weeks: ProgramWeekLike[] },
  programSlug: string,
  enrollment: EnrollmentSlice,
  dayNumber = enrollment.currentDay,
): ResolvedProgramDayParts | null {
  const phases = macroPhasesForProgramSlug(programSlug);
  const location = normalizeTrainingLocation(enrollment.trainingLocation);
  const week = findEnrollmentWeek(program.weeks, enrollment, phases);
  const day = week?.days?.find((d) => d.dayNumber === dayNumber);
  if (!week || !day) return null;

  const dayAny = day as {
    id?: string;
    partCount?: number;
    workout?: { id?: string; name?: string } | null;
    sessions?: DayWithSessionsLike["sessions"];
    options?: DayWithSessionsLike["options"];
  };
  const dayLike: DayWithSessionsLike = {
    id: dayAny.id || `day-${week.weekNumber}-${day.dayNumber}`,
    partCount: dayAny.partCount,
    sessions: dayAny.sessions,
    options: dayWorkoutOptions(day).map((o) => ({
      workoutId: o.workoutId,
      label: o.label || "Gym",
      trainingLocation: (o as { trainingLocation?: string | null }).trainingLocation,
    })),
  };
  const normalized = normalizeDaySessions(dayLike);

  const parts: ResolvedDayPart[] = [];
  for (const session of normalized.sessions) {
    const opts = (session.options || []).map((o) => ({
      workoutId: o.workoutId,
      label: o.label,
      trainingLocation: o.trainingLocation,
      workout: undefined as { id: string; name?: string } | undefined,
    }));
    // Fall back to flat day options only when session has no options but is part 1
    const pool =
      opts.length > 0
        ? opts
        : session.partIndex === 1
          ? dayWorkoutOptions(day)
          : [];
    const pick = pickWorkoutOptionByLocation(pool, location);
    if (!pick?.workoutId) continue;
    parts.push({
      sessionId: session.id,
      partIndex: session.partIndex,
      label: session.label || `Part ${session.partIndex}`,
      sessionKind: session.sessionKind,
      timeSlot: session.timeSlot,
      optionLabel: pick.label,
      workoutId: pick.workoutId,
      workoutName: pick.workout?.name || dayAny.workout?.name,
    });
  }

  if (!parts.length) return null;

  return {
    dayId: dayAny.id,
    weekNumber: week.weekNumber,
    dayNumber: day.dayNumber,
    partCount: Math.max(normalized.partCount, parts.length),
    trainingLocation: location,
    parts,
  };
}

export async function memberProgramWorkoutPath(
  _programSlug?: string,
  _userId?: string,
): Promise<string> {
  return "/member/today";
}