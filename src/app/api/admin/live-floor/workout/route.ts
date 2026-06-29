import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveCoachMemberName } from "@/lib/coach-roster";
import { getSmsGeneratedWorkout } from "@/lib/sms-generated-workouts";
import { normalizeLiveSessionDate } from "@/lib/live-workout-session";
import { coachDisplayName } from "@/lib/demo-coach";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const workoutId = searchParams.get("workoutId");
  const sessionDate = normalizeLiveSessionDate(searchParams.get("date") || undefined);

  if (!userId || !workoutId) {
    return NextResponse.json({ error: "userId and workoutId required." }, { status: 400 });
  }

  const memberName = await resolveCoachMemberName(userId);
  const workout = await getSmsGeneratedWorkout(workoutId, memberName, userId);
  if (!workout) {
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }

  return NextResponse.json({
    workout,
    memberName,
    userId,
    workoutId,
    sessionDate,
    instructorName: coachDisplayName(session),
  });
}