import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { normalizePrescription } from "@/lib/workout-schemes";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { isDemoMode } from "@/lib/demo-enrollments";
import { getPastsForWorkoutExercises } from "@/lib/workout-logs-store";
import { resolveUserId } from "@/lib/current-user";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed } from "@/lib/demo-seed-store";
import {
  buildDemoWorkoutExerciseItems,
  findDemoWorkoutRecord,
} from "@/lib/demo-workout-items";

export async function getMemberWorkoutById(
  workoutId: string,
  opts?: { userId?: string; memberName?: string },
): Promise<MemberWorkoutView | null> {
  const data = (await getDemoSeed({ preferFresh: true })) as any;
  if (isDemoMode()) {
    await hydrateDemoExercises();
  }
  const workoutExercises = (data.workoutExercises || []) as any[];
  const workout = findDemoWorkoutRecord((data.workouts || []) as any[], workoutId, workoutExercises);
  if (!workout) return null;

  // Use loadDemoExercises() in demo mode so that name changes performed in the
  // admin Exercise Library are reflected in member workout views too.
  const exList = isDemoMode() ? loadDemoExercises() : (data.exercises || []);
  const exById: Record<string, any> = Object.fromEntries(
    exList.map((e: any) => [e.id, e])
  );

  const items = isDemoMode()
    ? buildDemoWorkoutExerciseItems(workoutId, workoutExercises, exList)
    : workoutExercises
        .filter((item: any) => item.workoutId === workoutId)
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((item: any) => ({
          id: item.id,
          exerciseId: item.exerciseId,
          exercise: exById[item.exerciseId] || {},
          setScheme: item.setScheme,
          repPattern: item.repPattern,
          reps: item.reps,
          sets: item.sets,
          weightTier: item.weightTier,
          notes: item.notes,
        }));

  const exercises = items.map((item: any) => {
    const ex = item.exercise?.id ? item.exercise : exById[item.exerciseId] || {};
    const rx = normalizePrescription(item);
    return {
      id: item.id,
      exerciseId: item.exerciseId || ex.id,
      name: ex.name || "Exercise",
      description: item.notes ?? ex.description,
      videoUrl: ex.videoUrl,
      setScheme: rx.approach,
      repPattern: rx.repPattern,
      reps: rx.reps,
      setCount: rx.sets ?? 3,
      weightTier: item.weightTier ?? "light",
      past: null,
    };
  });

  // Attach latest past performance (silhouette) for each exercise block.
  // Uses current joined user (cookie) when available; falls back to demo-user in legacy demo mode.
  const uid = opts?.userId || (await resolveUserId());
  const pastByBlockId: Record<string, any> = {};
  try {
    Object.assign(pastByBlockId, await getPastsForWorkoutExercises(exercises, uid));
  } catch {
    // non-fatal; silhouettes just won't show this time
  }

  const exercisesWithPast = exercises.map((ex: any) => ({
    ...ex,
    past: pastByBlockId[ex.id] ?? null,
  }));

  return {
    workoutId: workout.id,
    workoutName: workout.name || "Workout",
    memberName: opts?.memberName || "Demo Member",
    exercises: exercisesWithPast,
  };
}