/** Client cache so a reload can restore sets before the live-session GET returns. */

export type MemberWorkoutProgressCache = {
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  weights: Record<string, string>;
  activeId?: string;
  updatedAt: string;
};

export function memberWorkoutProgressCacheKey(
  userId: string,
  workoutId: string,
  sessionDate?: string | null,
): string {
  return `ts-workout-progress:${userId}:${workoutId}:${sessionDate || "today"}`;
}

export function readMemberWorkoutProgressCache(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string | null;
}): MemberWorkoutProgressCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      memberWorkoutProgressCacheKey(input.userId, input.workoutId, input.sessionDate),
    );
    if (!raw) return null;
    const data = JSON.parse(raw) as MemberWorkoutProgressCache;
    if (!data || typeof data !== "object") return null;
    return {
      completedSets: data.completedSets && typeof data.completedSets === "object" ? data.completedSets : {},
      finishedExercises: Array.isArray(data.finishedExercises) ? data.finishedExercises : [],
      weights: data.weights && typeof data.weights === "object" ? data.weights : {},
      activeId: typeof data.activeId === "string" ? data.activeId : undefined,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeMemberWorkoutProgressCache(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string | null;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  weights: Record<string, string>;
  activeId?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const payload: MemberWorkoutProgressCache = {
      completedSets: input.completedSets,
      finishedExercises: input.finishedExercises,
      weights: input.weights,
      activeId: input.activeId,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      memberWorkoutProgressCacheKey(input.userId, input.workoutId, input.sessionDate),
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export function progressCacheHasWork(cache: MemberWorkoutProgressCache | null): boolean {
  if (!cache) return false;
  if (cache.finishedExercises.length > 0) return true;
  return Object.values(cache.completedSets).some((nums) => nums.length > 0);
}
