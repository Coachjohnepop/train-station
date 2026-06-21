type DemoExercise = {
  id: string;
  name: string;
  description?: string | null;
  videoUrl?: string | null;
};

type WorkoutExerciseRow = {
  id: string;
  workoutId: string;
  exerciseId: string;
  sortOrder?: number | null;
  setScheme?: string | null;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  weightTier?: string | null;
  notes?: string | null;
};

export function resolveDemoExercise(
  exerciseId: string,
  exList: DemoExercise[],
): DemoExercise {
  const ex = exList.find((e) => e.id === exerciseId);
  return ex || { id: exerciseId, name: "Unknown", description: null, videoUrl: null };
}

export function buildDemoWorkoutExerciseItems(
  workoutId: string,
  workoutExercises: WorkoutExerciseRow[],
  exList: DemoExercise[],
) {
  return workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => {
      const aName = resolveDemoExercise(a.exerciseId, exList).name;
      const bName = resolveDemoExercise(b.exerciseId, exList).name;
      const aIsWarm = /warm/i.test(aName);
      const bIsWarm = /warm/i.test(bName);
      if (aIsWarm && !bIsWarm) return -1;
      if (!aIsWarm && bIsWarm) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    })
    .map((we) => ({
      id: we.id,
      sortOrder: we.sortOrder,
      setScheme: we.setScheme,
      repPattern: we.repPattern,
      reps: we.reps,
      sets: we.sets,
      weightTier: we.weightTier,
      notes: we.notes,
      exercise: resolveDemoExercise(we.exerciseId, exList),
    }));
}

export function findDemoWorkoutRecord(
  workouts: Array<{ id: string; name?: string; description?: string | null }>,
  workoutId: string,
  workoutExercises: WorkoutExerciseRow[],
) {
  const found = workouts.find((w) => w.id === workoutId);
  if (found) return found;

  const hasItems = workoutExercises.some((we) => we.workoutId === workoutId);
  if (!hasItems) return null;

  return {
    id: workoutId,
    name: "Workout",
    description: null,
  };
}

export function ensureDemoWorkoutInSeed(
  workouts: Array<Record<string, unknown>>,
  workoutId: string,
  name = "Workout",
) {
  const list = [...workouts];
  if (list.some((w) => w.id === workoutId)) return list;
  list.push({
    id: workoutId,
    name,
    description: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return list;
}