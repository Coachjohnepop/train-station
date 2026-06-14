import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { getMemberWorkoutById } from "@/lib/member-workout";
import fs from "fs";
import path from "path";

// Always re-read the file (no in-memory cache) so admin-driven updates to the
// seed snapshot are visible immediately.
function loadSeed() {
  const p = path.join(process.cwd(), "prisma/seed-data.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export const DEMO_MEMBER_EMAIL = "demo@thetrainstation.co";
export const DEMO_WORKOUT_NAME = "Preview: Upper Body Power";

export async function getDemoMemberWorkout(): Promise<MemberWorkoutView | null> {
  const data = loadSeed();
  const workout = (data.workouts || []).find((w: any) => w.name === DEMO_WORKOUT_NAME) || (data.workouts || [])[0];
  if (!workout) return null;
  return getMemberWorkoutById(workout.id);
}