import "server-only";

import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { prisma } from "@/lib/prisma";
import { mapItemToBlock } from "@/lib/member-workout";
import { pinWarmupsFirst } from "@/lib/warmup-group";
import { DEFAULT_REST_TIMER_SECONDS, normalizeRestTimerSeconds } from "@/lib/rest-timer";
import { DEFAULT_REST_TIMER_SOUND } from "@/lib/rest-timer-sound";
import { DEFAULT_WARMUP_REST_SECONDS } from "@/lib/warmup-group";

export async function getByowMemberWorkout(
  workoutId: string,
  opts: { userId: string; isAdmin?: boolean; memberName?: string },
): Promise<MemberWorkoutView | null> {
  const workout = await prisma.byowWorkout.findUnique({
    where: { id: workoutId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: {
            select: { id: true, name: true, description: true, videoUrl: true },
          },
        },
      },
    },
  });
  if (!workout) return null;
  if (!opts.isAdmin && workout.ownerUserId !== opts.userId) return null;

  const exercises = pinWarmupsFirst(
    workout.exercises.map((item) =>
      mapItemToBlock({
        id: item.id,
        exerciseId: item.exerciseId,
        exercise: item.exercise,
        setScheme: item.setScheme,
        reps: item.reps,
        sets: item.sets,
        notes: item.notes,
        restSec: item.restSec,
      }),
    ),
  ).map((ex) => ({ ...ex, past: null }));

  return {
    workoutId: workout.id,
    workoutName: workout.name || "My workout",
    memberName: opts.memberName || "Member",
    exercises,
    restTimerEnabled: true,
    restTimerSeconds: normalizeRestTimerSeconds(DEFAULT_REST_TIMER_SECONDS),
    restTimerSound: DEFAULT_REST_TIMER_SOUND,
    warmupRestSeconds: DEFAULT_WARMUP_REST_SECONDS,
  };
}
