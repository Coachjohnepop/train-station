import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { isStaffRole } from "@/lib/staff-access";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { localTodayIso } from "@/lib/program-calendar";
import { MAINTAIN_WORKOUT_SOURCE } from "@/lib/member-maintain-workouts";

export const dynamic = "force-dynamic";

/**
 * In-progress Quick maintain session for this member (today), if any.
 * Backed by LiveWorkoutSession so refresh / private mode still resume when logged in.
 */
export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const forUser = searchParams.get("userId");
  const userId =
    isStaffRole(auth.session.role) && forUser ? forUser : auth.session.id;

  if (isDemoMode()) {
    return NextResponse.json({ resume: null });
  }

  const today = localTodayIso();
  try {
    const maintainWorkouts = await prisma.workout.findMany({
      where: { source: MAINTAIN_WORKOUT_SOURCE },
      select: { id: true, name: true },
    });
    if (!maintainWorkouts.length) {
      return NextResponse.json({ resume: null });
    }
    const nameById = new Map(maintainWorkouts.map((w) => [w.id, w.name]));

    const sessions = await prisma.liveWorkoutSession.findMany({
      where: {
        userId,
        sessionDate: today,
        workoutId: { in: [...nameById.keys()] },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });

    for (const s of sessions) {
      const finished = s.finishedExercises?.length ?? 0;
      const hasSets = Object.keys((s.completedSets as object) || {}).length > 0;
      const hasWeights = Object.keys((s.weights as object) || {}).length > 0;
      const ageMs = Date.now() - s.updatedAt.getTime();
      // Drop stale empty sessions older than 12h
      if (!hasSets && !hasWeights && finished === 0 && ageMs > 12 * 60 * 60 * 1000) {
        continue;
      }
      return NextResponse.json({
        resume: {
          userId,
          workoutId: s.workoutId,
          workoutName: nameById.get(s.workoutId) || "Quick maintain",
          sessionDate: s.sessionDate,
          updatedAt: s.updatedAt.toISOString(),
          finishedCount: finished,
        },
      });
    }

    return NextResponse.json({ resume: null });
  } catch (e) {
    console.warn("[maintain-resume]", e);
    return NextResponse.json({ resume: null });
  }
}
