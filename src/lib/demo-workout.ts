import { prisma } from "@/lib/prisma";
import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { getMemberWorkoutById } from "@/lib/member-workout";

export const DEMO_MEMBER_EMAIL = "demo@thetrainstation.co";
export const DEMO_WORKOUT_NAME = "Preview: Upper Body Power";

export async function getDemoMemberWorkout(): Promise<MemberWorkoutView | null> {
  const workout = await prisma.workout.findFirst({
    where: { name: DEMO_WORKOUT_NAME },
    select: { id: true },
  });
  if (!workout) return null;
  return getMemberWorkoutById(workout.id);
}