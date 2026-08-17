/**
 * Import / clone jobs sometimes write the same movement twice in a row
 * (same exercise, sets, reps, scheme). Members see “2 of the same curls.”
 */
export function collapseConsecutiveCloneExercises<
  T extends {
    exerciseId: string;
    setCount: number;
    reps?: string | null;
    setScheme?: string | null;
  },
>(exercises: T[]): T[] {
  const out: T[] = [];
  for (const ex of exercises) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.exerciseId === ex.exerciseId &&
      prev.setCount === ex.setCount &&
      (prev.reps || "") === (ex.reps || "") &&
      (prev.setScheme || "") === (ex.setScheme || "")
    ) {
      continue;
    }
    out.push(ex);
  }
  return out;
}
