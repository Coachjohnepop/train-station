/** Member floor: finish one card without sweeping the next one with it. */

export const FINISH_TAP_LOCK_MS = 800;

export function shouldAutoFinishExercise(input: {
  alreadyFinished: boolean;
  setCount: number;
  completedSetCount: number;
  isTimed: boolean;
  completedHasFirstSet: boolean;
}): boolean {
  if (input.alreadyFinished) return false;
  if (input.isTimed) return input.completedHasFirstSet;
  const sets = Number.isFinite(input.setCount) ? Math.floor(input.setCount) : 0;
  if (sets <= 0) return false;
  return input.completedSetCount >= sets && input.completedSetCount > 0;
}

export function nextUnfinishedExerciseId<T extends { id: string }>(
  exercises: T[],
  finishedId: string,
  finished: ReadonlySet<string>,
): string | null {
  const idx = exercises.findIndex((e) => e.id === finishedId);
  if (idx < 0) return null;
  const upcoming = exercises.slice(idx + 1).find((e) => !finished.has(e.id));
  return upcoming?.id ?? null;
}

export function isFinishTapLocked(lockUntilMs: number, nowMs = Date.now()): boolean {
  return nowMs < lockUntilMs;
}
