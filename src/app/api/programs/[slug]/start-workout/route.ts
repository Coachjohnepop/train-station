import { NextResponse } from "next/server";
import { getMemberWorkoutById } from "@/lib/member-workout";
import { resolveMemberProgramWorkout, memberProgramWorkoutPath } from "@/lib/member-program-workout";
import { resolveUserId } from "@/lib/current-user";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const uid = await resolveUserId();
  const resolved = await resolveMemberProgramWorkout(slug, uid);
  if (!resolved) {
    return NextResponse.json({ error: "No workout scheduled for this program yet" }, { status: 404 });
  }

  const workout = await getMemberWorkoutById(resolved.workoutId);
  return NextResponse.json({
    ...resolved,
    exerciseCount: workout?.exercises?.length ?? 0,
    path: await memberProgramWorkoutPath(slug, uid),
    isPreviewShell: /preview:/i.test(resolved.workoutName || workout?.workoutName || ""),
  });
}