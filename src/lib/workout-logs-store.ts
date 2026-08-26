import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import {
  getDemoPastsForWorkoutExercises,
  getDemoPerformanceCount,
  getDemoStrengthScore,
  getDemoWorkoutLogCount,
  hydrateDemoLogsStore,
} from "@/lib/demo-logs";
import {
  getCatchUpCalendarDatesDb,
  getLoggedCalendarDatesDb,
  getLoggedWorkoutIdsDb,
  getPastsForWorkoutExercisesDb,
  getPerformanceCountDb,
  getStrengthScoreDb,
  getWorkoutLogCountDb,
  type WorkoutExercisePast,
} from "@/lib/workout-logs-db";
import { localTodayIso } from "@/lib/program-calendar";

export type { WorkoutExercisePast };

export async function loadLoggedWorkoutIds(userId: string): Promise<Set<string>> {
  if (isDemoMode()) {
    const loggedSet = new Set<string>();
    try {
      const logsData = await hydrateDemoLogsStore({ preferFresh: true });
      (logsData.workoutLogs || []).forEach((log) => {
        if (log.userId === userId && log.workoutId) {
          loggedSet.add(log.workoutId);
        }
      });
    } catch {
      // non-fatal
    }
    return loggedSet;
  }
  return getLoggedWorkoutIdsDb(userId);
}

export async function loadLoggedCalendarDates(userId: string): Promise<Set<string>> {
  if (isDemoMode()) {
    const dates = new Set<string>();
    try {
      const logsData = await hydrateDemoLogsStore({ preferFresh: true });
      for (const log of logsData.workoutLogs || []) {
        if (log.userId !== userId) continue;
        const raw = (log as { performedAt?: string }).performedAt;
        if (raw) dates.add(localTodayIso(new Date(raw)));
      }
    } catch {
      // non-fatal
    }
    return dates;
  }
  return getLoggedCalendarDatesDb(userId);
}

export async function loadCatchUpCalendarDates(userId: string): Promise<Set<string>> {
  if (isDemoMode()) {
    const dates = new Set<string>();
    try {
      const logsData = await hydrateDemoLogsStore({ preferFresh: true });
      for (const log of logsData.workoutLogs || []) {
        if (log.userId !== userId) continue;
        const source = (log as { catchUpForDate?: string | null }).catchUpForDate;
        if (source) dates.add(source);
      }
    } catch {
      // non-fatal
    }
    return dates;
  }
  return getCatchUpCalendarDatesDb(userId);
}

export async function getWorkoutLogCount(userId: string): Promise<number> {
  if (isDemoMode()) {
    return getDemoWorkoutLogCount(userId);
  }
  return getWorkoutLogCountDb(userId);
}

export async function getPerformanceCount(userId: string): Promise<number> {
  if (isDemoMode()) {
    return getDemoPerformanceCount(userId);
  }
  return getPerformanceCountDb(userId);
}

export async function getStrengthScore(userId: string): Promise<number> {
  if (isDemoMode()) {
    return getDemoStrengthScore(userId);
  }
  return getStrengthScoreDb(userId);
}

export async function getPastsForWorkoutExercises(
  exerciseBlocks: Array<{ id: string; exerciseId: string }>,
  userId: string,
): Promise<Record<string, WorkoutExercisePast>> {
  if (isDemoMode()) {
    return getDemoPastsForWorkoutExercises(exerciseBlocks, userId);
  }
  return getPastsForWorkoutExercisesDb(exerciseBlocks, userId);
}