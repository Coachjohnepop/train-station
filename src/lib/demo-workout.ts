import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { getMemberWorkoutById } from "@/lib/member-workout";
import { getDemoSeed } from "@/lib/demo-seed-store";

export const DEMO_MEMBER_EMAIL = "demo@thetrainstation.co";
export const DEMO_WORKOUT_NAME = "Preview: Upper Body Power";

export async function getDemoMemberWorkout(): Promise<MemberWorkoutView | null> {
  const data = await getDemoSeed();
  const workouts = (data.workouts || []) as Array<{ id: string; name?: string }>;
  const workout = workouts.find((w) => w.name === DEMO_WORKOUT_NAME) || workouts[0];
  if (!workout) return null;
  return getMemberWorkoutById(workout.id);
}