import { prisma } from "@/lib/prisma";
import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { normalizePrescription } from "@/lib/workout-schemes";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";

export async function getMemberWorkoutById(
  workoutId: string,
): Promise<MemberWorkoutView | null> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_MEMBER_EMAIL },
  });
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });

  if (!workout || !user) return null;

  const exercises = await Promise.all(
    workout.exercises.map(async (item) => {
      const past = await prisma.exercisePerformance.findFirst({
        where: {
          userId: user.id,
          exerciseId: item.exerciseId,
        },
        orderBy: { performedAt: "desc" },
      });

      const rx = normalizePrescription(item);

      return {
        id: item.id,
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        description: item.notes ?? item.exercise.description,
        videoUrl: item.exercise.videoUrl,
        setScheme: rx.approach,
        repPattern: rx.repPattern,
        reps: rx.reps,
        setCount: rx.sets ?? 3,
        weightTier: item.weightTier ?? "light",
        past: past
          ? {
              setScheme: past.setScheme,
              repPattern: null,
              reps: null,
              sets: null,
              weightTier: past.weightTier,
              startingWeightLbs: past.startingWeightLbs,
              performedAt: past.performedAt.toISOString(),
            }
          : null,
      };
    }),
  );

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    memberName: user.name ?? "Member",
    exercises,
  };
}