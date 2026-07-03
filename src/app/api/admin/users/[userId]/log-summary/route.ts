import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  getPerformanceCount,
  getStrengthScore,
  getWorkoutLogCount,
  loadLoggedWorkoutIds,
} from "@/lib/workout-logs-store";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;

  try {
    const [workoutLogs, performances, strengthScore, loggedSet] = await Promise.all([
      getWorkoutLogCount(userId),
      getPerformanceCount(userId),
      getStrengthScore(userId),
      loadLoggedWorkoutIds(userId),
    ]);

    return NextResponse.json({
      userId,
      workoutLogs,
      performances,
      strengthScore,
      loggedWorkoutIds: [...loggedSet],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Read failed";
    console.error("GET log-summary", e);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}