import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { normalizePrescription } from "@/lib/workout-schemes";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { getDemoPastsForWorkoutExercises } from "@/lib/demo-logs";
import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

let seedData: any = null;
function loadSeed() {
  if (!seedData) {
    const p = path.join(process.cwd(), "prisma/seed-data.json");
    seedData = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return seedData;
}

export async function getMemberWorkoutById(
  workoutId: string,
): Promise<MemberWorkoutView | null> {
  const data = loadSeed();
  const workout = (data.workouts || []).find((w: any) => w.id === workoutId);
  if (!workout) return null;

  const we = (data.workoutExercises || [])
    .filter((item: any) => item.workoutId === workoutId)
    .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const exById: Record<string, any> = Object.fromEntries(
    (data.exercises || []).map((e: any) => [e.id, e])
  );

  const exercises = we.map((item: any) => {
    const ex = exById[item.exerciseId] || {};
    const rx = normalizePrescription(item);
    return {
      id: item.id,
      exerciseId: item.exerciseId,
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
  // - Demo mode: from file-backed store (written by /log when button pressed, supports partial % + exact finished exercises).
  // - Real DB (after Supabase): query latest ExercisePerformance rows for the demo member.
  // This makes "instructor sees what was partially or fully completed" visible on next load via silhouettes + log history.
  const pastByBlockId: Record<string, any> = {};
  try {
    if (isDemoMode()) {
      const demoPasts = getDemoPastsForWorkoutExercises(exercises);
      Object.assign(pastByBlockId, demoPasts);
    } else {
      const demoUser = await prisma.user.findUnique({
        where: { email: DEMO_MEMBER_EMAIL },
        select: { id: true },
      });
      if (demoUser) {
        for (const ex of exercises) {
          const latest = await prisma.exercisePerformance.findFirst({
            where: { userId: demoUser.id, exerciseId: ex.exerciseId },
            orderBy: { performedAt: "desc" },
          });
          if (latest) {
            pastByBlockId[ex.id] = {
              setScheme: latest.setScheme,
              repPattern: null,
              reps: null,
              sets: null,
              setsCompleted: null,
              weightTier: latest.weightTier,
              startingWeightLbs: latest.startingWeightLbs,
              performedAt: latest.performedAt.toISOString(),
            };
          }
        }
      }
    }
  } catch (e) {
    // non-fatal for demo/real; silhouettes just won't show this time
  }

  const exercisesWithPast = exercises.map((ex: any) => ({
    ...ex,
    past: pastByBlockId[ex.id] ?? null,
  }));

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    memberName: "Demo Member",
    exercises: exercisesWithPast,
  };
}