import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, assertUserScope } from "@/lib/api-auth";
import { isStaffRole } from "@/lib/staff-access";
import { createWorkoutLogAndPerformances, type LogExerciseInput } from "@/lib/data/user-data";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { getGamificationPointsConfig } from "@/lib/gamification-config";
import {
  canLogSessionDate,
  lateAdjustedPoints,
  lateScoreLabel,
} from "@/lib/member-workout-late";
import { resolveLogSessionDate } from "@/lib/member-workout-log";
import { localTodayIso } from "@/lib/program-calendar";

const logExerciseSchema = z.object({
  workoutExerciseId: z.string().optional(),
  exerciseId: z.string(),
  setScheme: z.string(),
  repPattern: z.string().nullable().optional(),
  reps: z.string().nullable().optional(),
  sets: z.number().int().nullable().optional(),
  weightTier: z.string(),
  startingWeightLbs: z
    .number()
    .nonnegative()
    .optional()
    .nullable()
    .transform((v) => (v && v > 0 ? v : null)),
  repsCompleted: z.number().int().optional().nullable(),
  setsCompleted: z.number().int().optional().nullable(),
});

const logBodySchema = z.object({
  exercises: z.array(logExerciseSchema).min(0),  // allow partial (0+)
  programSlug: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  targetUserId: z.string().optional(),
  // Enrollment keys (W1D1 / M1D1) used to 400 the whole log. Coerce later.
  sessionDate: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: workoutId } = await params;

  const parsed = logBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uid =
    isStaffRole(auth.session.role) && parsed.data.targetUserId
      ? parsed.data.targetUserId
      : auth.session.id;
  const scopeErr = assertUserScope(auth.session, uid);
  if (scopeErr) return scopeErr;

  // Free-pool / content-tier: block explorer bypass of the Today UI lock.
  // Maintain library: Business+ unlimited, or Coach Class earned uses (see resolveMaintainAccess).
  if (!isStaffRole(auth.session.role)) {
    const { isMaintainWorkoutId, resolveMaintainAccess } = await import(
      "@/lib/member-maintain-workouts"
    );
    const maintain = await isMaintainWorkoutId(workoutId);
    if (maintain) {
      const { getMemberProfile } = await import("@/lib/member-profiles-store");
      const profile = await getMemberProfile(uid);
      const access = await resolveMaintainAccess(uid, profile?.plan);
      if (!access.allowed) {
        return NextResponse.json(
          {
            detail: access.detail,
            locked: true,
            maintainAccess: {
              mode: access.mode,
              usesRemaining: access.usesRemaining,
              upgradeHref: access.upgradeHref,
            },
          },
          { status: 403 },
        );
      }
    } else {
      const { assertMemberCanLogWorkout } = await import("@/lib/gamification-content-access");
      const canLog = await assertMemberCanLogWorkout({
        userId: uid,
        programSlug: parsed.data.programSlug,
      });
      if (!canLog.ok) {
        return NextResponse.json({ detail: canLog.reason, locked: true }, { status: 403 });
      }
    }
  }

  const todayIso = localTodayIso();
  const sessionDate = resolveLogSessionDate(parsed.data.sessionDate, todayIso);
  if (!isStaffRole(auth.session.role)) {
    const allowed = canLogSessionDate(sessionDate, todayIso);
    if (!allowed.ok) {
      return NextResponse.json({ detail: allowed.reason, locked: true }, { status: 403 });
    }
  }

  try {
    const result = await createWorkoutLogAndPerformances({
      workoutId,
      userId: uid,
      exercises: parsed.data.exercises as LogExerciseInput[],
      programSlug: parsed.data.programSlug,
      progress: parsed.data.progress,
    });

    let gamification: Awaited<ReturnType<typeof awardGamificationPoints>> | null = null;
    let gamificationWarning: string | null = null;
    let lateScore: { late: boolean; hitPercent: number } | null = null;
    try {
      const pointsConfig = await getGamificationPointsConfig();
      const adjusted = lateAdjustedPoints(
        pointsConfig.workout_logged,
        sessionDate,
        todayIso,
      );
      lateScore = { late: adjusted.late, hitPercent: adjusted.hitPercent };
      gamification = await awardGamificationPoints({
        userId: uid,
        eventId: `workout:${workoutId}:${sessionDate}`,
        type: "workout_logged",
        points: adjusted.points,
        label: adjusted.late ? lateScoreLabel(adjusted.hitPercent) : undefined,
        programSlug: parsed.data.programSlug ?? null,
      });
    } catch (gamErr: unknown) {
      gamificationWarning =
        gamErr instanceof Error
          ? gamErr.message
          : "Could not save gamification points — please try again in a moment.";
      console.warn("Workout logged but gamification award failed", gamErr);
    }

    const gamificationPayload = gamification
      ? {
          ...gamification,
          pointsEarned: gamification.pointsEarned,
          late: lateScore?.late ?? false,
          lateHitPercent: lateScore?.hitPercent ?? 0,
        }
      : null;

    // Notify coach (Messages + email) + member confirmation email.
    // Non-fatal — logging already succeeded.
    let coachNotify: { inApp: boolean; email: boolean; sms: boolean } | null = null;
    let memberNotify: boolean | null = null;
    try {
      const { prisma } = await import("@/lib/prisma");
      const { isDemoMode } = await import("@/lib/demo-enrollments");
      const progress = parsed.data.progress ?? result.progress ?? 100;

      let workoutName = "Workout";
      let maintain = false;
      const exerciseNames = new Map<string, string>();

      if (!isDemoMode()) {
        const workout = await prisma.workout.findUnique({
          where: { id: workoutId },
          select: {
            name: true,
            source: true,
            exercises: {
              select: { exerciseId: true, exercise: { select: { name: true } } },
            },
          },
        });
        if (workout) {
          workoutName = workout.name;
          maintain = workout.source === "maintain";
          for (const we of workout.exercises) {
            exerciseNames.set(we.exerciseId, we.exercise.name);
          }
        }
        // Fill any missing names from exercise ids on the log payload
        const missing = parsed.data.exercises
          .map((e) => e.exerciseId)
          .filter((id) => id && !exerciseNames.has(id));
        if (missing.length) {
          const rows = await prisma.exercise.findMany({
            where: { id: { in: [...new Set(missing)] } },
            select: { id: true, name: true },
          });
          for (const r of rows) exerciseNames.set(r.id, r.name);
        }
      } else {
        maintain = parsed.data.programSlug === "maintain";
      }

      const { getMemberProfile } = await import("@/lib/member-profiles-store");
      const profile = await getMemberProfile(uid);
      let memberName = profile?.email?.split("@")[0] || "Member";
      let memberEmail = profile?.email || "";
      // Prefer the member being logged (not staff coach session when impersonating).
      if (uid === auth.session.id) {
        memberName = auth.session.name?.trim() || memberName;
        memberEmail = auth.session.email || memberEmail;
      } else if (!isDemoMode()) {
        const memberUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { name: true, email: true },
        });
        if (memberUser) {
          memberName = memberUser.name?.trim() || memberName;
          memberEmail = memberUser.email || memberEmail;
        }
      }
      if (!memberEmail) memberEmail = auth.session.email || profile?.email || "";

      const {
        notifyCoachWorkoutLogged,
        notifyMemberWorkoutLogged,
      } = await import("@/lib/coach-member-notify");
      coachNotify = await notifyCoachWorkoutLogged({
        userId: uid,
        name: memberName,
        email: memberEmail,
        workoutName,
        workoutId,
        sessionDate,
        progress,
        programSlug: parsed.data.programSlug ?? null,
        late: lateScore?.late ?? false,
        maintain,
        exercises: parsed.data.exercises.map((e) => ({
          name: exerciseNames.get(e.exerciseId) || e.exerciseId,
          setsCompleted: e.setsCompleted,
          repsCompleted: e.repsCompleted,
          startingWeightLbs: e.startingWeightLbs,
        })),
      });

      try {
        memberNotify = await notifyMemberWorkoutLogged({
          name: memberName,
          email: memberEmail,
          workoutName,
          sessionDate,
          progress,
          maintain,
          late: lateScore?.late ?? false,
        });
      } catch (memberMailErr) {
        console.warn("Workout logged but member email failed", memberMailErr);
        memberNotify = false;
      }
    } catch (notifyErr) {
      console.warn("Workout logged but coach notify failed", notifyErr);
    }

    return NextResponse.json({
      ...result,
      gamification: gamificationPayload,
      gamificationWarning,
      coachNotify,
      memberNotify,
    });
  } catch (e: any) {
    // Preserve previous error behavior for "user not found" / "workout not found" etc.
    if (e?.message?.includes("User not found")) {
      return NextResponse.json({ detail: "User not found" }, { status: 500 });
    }
    if (e?.message?.includes("Workout not found")) {
      return NextResponse.json({ detail: "Workout not found" }, { status: 404 });
    }
    return NextResponse.json(
      { detail: e?.message || "Failed to log workout" },
      { status: 500 }
    );
  }
}
