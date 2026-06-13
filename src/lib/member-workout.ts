import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { normalizePrescription } from "@/lib/workout-schemes";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { getDemoPastsForWorkoutExercises } from "@/lib/demo-logs";
import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/current-user";
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

  const exById: Record<string, any> = Object.fromEntries(
    (data.exercises || []).map((e: any) => [e.id, e])
  );

  const we = (data.workoutExercises || [])
    .filter((item: any) => item.workoutId === workoutId)
    .sort((a: any, b: any) => {
      const aName = (exById[a.exerciseId] || {}).name || "";
      const bName = (exById[b.exerciseId] || {}).name || "";
      const aIsWarm = /warm/i.test(aName);
      const bIsWarm = /warm/i.test(bName);
      if (aIsWarm && !bIsWarm) return -1;
      if (!aIsWarm && bIsWarm) return 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

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
  // Uses current joined user (cookie) when available; falls back to demo-user in legacy demo mode.
  const uid = await resolveUserId("demo-user");
  const pastByBlockId: Record<string, any> = {};
  try {
    if (isDemoMode()) {
      const demoPasts = getDemoPastsForWorkoutExercises(exercises, uid);
      Object.assign(pastByBlockId, demoPasts);
    } else {
      for (const ex of exercises) {
        const latest = await prisma.exercisePerformance.findFirst({
          where: { userId: uid, exerciseId: ex.exerciseId },
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
  } catch (e) {
    // non-fatal; silhouettes just won't show this time
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