import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { notifyCoachWarmupStarted } from "@/lib/coach-member-notify";
import {
  getWarmupProgress,
  saveWarmupProgress,
  warmupHasActivity,
} from "@/lib/member-warmup-progress-store";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";

const putSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedSets: z.record(z.string(), z.array(z.number().int().min(1))),
  finishedExercises: z.array(z.string()),
});

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const sessionDate = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const progress = await getWarmupProgress(session.id, sessionDate);
  return NextResponse.json({ progress });
}

export async function PUT(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }

  const existing = await getWarmupProgress(session.id, body.data.sessionDate);
  const next = await saveWarmupProgress({
    userId: session.id,
    sessionDate: body.data.sessionDate,
    completedSets: body.data.completedSets,
    finishedExercises: body.data.finishedExercises,
  });

  const shouldNotify =
    !existing.coachNotifiedAt &&
    warmupHasActivity(next) &&
    !warmupHasActivity(existing);

  let pointsEarned = 0;
  let totalPoints: number | null = null;

  if (shouldNotify) {
    const profile = await getMemberProfile(session.id);
    const name = session.name || resolveDemoUser(session.id)?.name || "Member";
    await notifyCoachWarmupStarted({
      userId: session.id,
      name,
      email: profile?.email || session.email,
      sessionDate: body.data.sessionDate,
    });
    await saveWarmupProgress({
      userId: session.id,
      sessionDate: body.data.sessionDate,
      completedSets: next.completedSets,
      finishedExercises: next.finishedExercises,
      coachNotifiedAt: new Date().toISOString(),
    });
    const award = await awardGamificationPoints({
      userId: session.id,
      eventId: `warmup:${body.data.sessionDate}`,
      type: "warmup_before_live",
    });
    pointsEarned = award.awarded ? GAMIFICATION_POINTS.warmup_before_live : 0;
    totalPoints = award.totalPoints;
  }

  return NextResponse.json({ progress: next, coachNotified: shouldNotify, pointsEarned, totalPoints });
}