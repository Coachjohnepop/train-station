import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { normalizePrescription } from "@/lib/workout-schemes";
import { isDemoMode } from "@/lib/demo-enrollments";
import { getPastsForWorkoutExercises } from "@/lib/workout-logs-store";
import { resolveUserId } from "@/lib/current-user";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed } from "@/lib/demo-seed-store";
import {
  buildDemoWorkoutExerciseItems,
  findDemoWorkoutRecord,
} from "@/lib/demo-workout-items";
import { resolveExerciseVideoUrl } from "@/lib/exercise-video-hints";
import { prisma } from "@/lib/prisma";
import { collapseConsecutiveCloneExercises } from "@/lib/member-workout-lines";
import { DEFAULT_REST_TIMER_SECONDS, normalizeRestTimerSeconds } from "@/lib/rest-timer";
import { DEFAULT_REST_TIMER_SOUND } from "@/lib/rest-timer-sound";

function mapItemToBlock(item: {
  id: string;
  exerciseId?: string;
  exercise?: {
    id?: string;
    name?: string;
    description?: string | null;
    videoUrl?: string | null;
  };
  setScheme?: string | null;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  weightTier?: string | null;
  notes?: string | null;
  restSec?: number | null;
  restBetweenSetsSec?: number | null;
}) {
  const ex = item.exercise?.id ? item.exercise : {};
  const rx = normalizePrescription(item);
  const coachNotes =
    typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : null;
  const libraryDescription =
    typeof ex.description === "string" && ex.description.trim()
      ? ex.description.trim()
      : null;
  const restRaw = item.restBetweenSetsSec ?? item.restSec ?? null;
  const restSec =
    typeof restRaw === "number" && restRaw > 0 ? Math.min(600, Math.floor(restRaw)) : null;
  const name = ex.name || "Exercise";
  // Library URL first; else name-based YouTube example demos (same as SMS / catalog).
  const videoUrl = resolveExerciseVideoUrl({
    name,
    videoUrl: ex.videoUrl ?? null,
  });

  return {
    id: item.id,
    exerciseId: item.exerciseId || ex.id || item.id,
    name,
    description: coachNotes ?? libraryDescription,
    coachNotes,
    libraryDescription,
    videoUrl,
    setScheme: rx.approach,
    repPattern: rx.repPattern,
    reps: rx.reps,
    setCount: rx.sets ?? 3,
    weightTier: item.weightTier ?? "light",
    restSec,
    past: null as MemberWorkoutView["exercises"][0]["past"],
  };
}

async function attachPasts(
  exercises: MemberWorkoutView["exercises"],
  userId?: string,
): Promise<MemberWorkoutView["exercises"]> {
  const uid = userId || (await resolveUserId());
  const pastByBlockId: Record<string, any> = {};
  try {
    Object.assign(pastByBlockId, await getPastsForWorkoutExercises(exercises, uid));
  } catch {
    /* non-fatal */
  }
  return exercises.map((ex) => ({
    ...ex,
    past: pastByBlockId[ex.id] ?? null,
  }));
}

async function getMemberWorkoutFromPrisma(
  workoutId: string,
  opts?: { userId?: string; memberName?: string },
): Promise<MemberWorkoutView | null> {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: {
            select: {
              id: true,
              name: true,
              description: true,
              videoUrl: true,
            },
          },
        },
      },
    },
  });
  if (!workout) return null;

  const exercises = await attachPasts(
    collapseConsecutiveCloneExercises(
      workout.exercises.map((item) =>
        mapItemToBlock({
          id: item.id,
          exerciseId: item.exerciseId,
          exercise: item.exercise,
          setScheme: item.setScheme,
          repPattern: item.repPattern,
          reps: item.reps,
          // Prefer structured setCount; fall back to legacy sets column.
          sets: item.setCount ?? item.sets,
          weightTier: item.weightTier,
          notes: item.notes,
          restSec: item.restSec,
          restBetweenSetsSec: item.restBetweenSetsSec,
        }),
      ),
    ),
    opts?.userId,
  );

  return {
    workoutId: workout.id,
    workoutName: workout.name || "Workout",
    memberName: opts?.memberName || "Member",
    exercises,
    restTimerEnabled:
      workout.restTimerEnabled === true || typeof workout.restTimerSeconds === "number"
        ? workout.restTimerEnabled !== false
        : true,
    restTimerSeconds: normalizeRestTimerSeconds(
      workout.restTimerSeconds ?? DEFAULT_REST_TIMER_SECONDS,
    ),
    restTimerSound: workout.restTimerSound || DEFAULT_REST_TIMER_SOUND,
  };
}

export async function getMemberWorkoutById(
  workoutId: string,
  opts?: { userId?: string; memberName?: string },
): Promise<MemberWorkoutView | null> {
  if (!isDemoMode()) {
    try {
      const fromDb = await getMemberWorkoutFromPrisma(workoutId, opts);
      if (fromDb) return fromDb;
    } catch (e) {
      console.error("[member-workout] postgres read failed", e);
    }
    return null;
  }

  const data = (await getDemoSeed({ preferFresh: true })) as any;
  if (isDemoMode()) {
    await hydrateDemoExercises();
  }
  const workoutExercises = (data.workoutExercises || []) as any[];
  const workout = findDemoWorkoutRecord(
    (data.workouts || []) as any[],
    workoutId,
    workoutExercises,
  );
  if (!workout) return null;

  const exList = isDemoMode() ? loadDemoExercises() : data.exercises || [];
  const exById: Record<string, any> = Object.fromEntries(
    exList.map((e: any) => [e.id, e]),
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
          restSec: item.restSec,
          restBetweenSetsSec: item.restBetweenSetsSec,
        }));

  const exercises = await attachPasts(
    collapseConsecutiveCloneExercises(
      items.map((item: any) => {
        const ex = item.exercise?.id ? item.exercise : exById[item.exerciseId] || {};
        return mapItemToBlock({
          ...item,
          exercise: ex,
        });
      }),
    ),
    opts?.userId,
  );

  const seedWorkout = workout as {
    id: string;
    name?: string;
    restTimerEnabled?: boolean;
    restTimerSeconds?: number | null;
    restTimerSound?: string | null;
  };

  return {
    workoutId: seedWorkout.id,
    workoutName: seedWorkout.name || "Workout",
    memberName: opts?.memberName || "Demo Member",
    exercises,
    restTimerEnabled:
      seedWorkout.restTimerEnabled === true ||
      typeof seedWorkout.restTimerSeconds === "number"
        ? seedWorkout.restTimerEnabled !== false
        : true,
    restTimerSeconds: normalizeRestTimerSeconds(
      seedWorkout.restTimerSeconds ?? DEFAULT_REST_TIMER_SECONDS,
    ),
    restTimerSound: seedWorkout.restTimerSound || DEFAULT_REST_TIMER_SOUND,
  };
}
