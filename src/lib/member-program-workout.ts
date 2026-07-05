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
  const location = normalizeTrainingLocation(enrollment.trainingLocation);
  const week = findEnrollmentWeek(program.weeks, enrollment, phases);
  const day = week?.days?.find((d) => d.dayNumber === dayNumber);
  if (!week || !day) return null;

  const pick = pickWorkoutOptionByLocation(dayWorkoutOptions(day), location);
  if (!pick?.workoutId) return null;

  return {
    workoutId: pick.workoutId,
    option: pick.label,
    weekNumber: week.weekNumber,
    dayNumber: day.dayNumber,
    macroPhaseIndex: week.macroPhaseIndex ?? enrollment.currentPhase ?? 1,
    phaseWeekNumber: week.phaseWeekNumber ?? enrollment.currentWeek,
    trainingLocation: location,
    workoutName: pick.workout?.name || day.workout?.name,
    dayId: (day as { id?: string }).id,
  };
}

export async function memberProgramWorkoutPath(
  _programSlug?: string,
  _userId?: string,
): Promise<string> {
  return "/member/today";
}