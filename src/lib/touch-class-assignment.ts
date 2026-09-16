import "server-only";

import { bumpSessionsForWorkout } from "@/lib/today-sessions";

/** After coach edits a class workout, members should refresh Today. Never throw. */
export async function touchClassAssignmentForWorkout(
  workoutId: string,
  opts?: { title?: string },
): Promise<void> {
  if (!workoutId) return;
  try {
    await bumpSessionsForWorkout(workoutId, opts);
  } catch (err) {
    console.error("touchClassAssignmentForWorkout", workoutId, err);
  }
}
