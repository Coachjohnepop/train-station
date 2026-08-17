import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { isDemoMode, updateDemoUserSettings } from "@/lib/demo-reminders";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import {
  normalizeOnboardGender,
  normalizePrimaryGoal,
  normalizeWorkoutSchedule,
} from "@/lib/onboard-path";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  plan: z.string().optional(),
  phone: z.string().max(30).nullable().optional(),
  dailyReminderTime: z.string().max(10).nullable().optional(),
  weightLbs: z.string().max(20).nullable().optional(),
  startWeightLbs: z.string().max(20).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  weightLossGoal: z.string().max(240).nullable().optional(),
  weightLossTimeline: z.string().max(80).nullable().optional(),
  primaryGoal: z.string().max(40).nullable().optional(),
  workoutSchedule: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
});

export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;
  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan: normalizeSignupPlan(patch.plan),
    phone: patch.phone ?? undefined,
  });

  const profile = await updateMemberProfile(session.id, {
    ...(patch.plan ? { plan: normalizeSignupPlan(patch.plan) } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.dailyReminderTime !== undefined ? { dailyReminderTime: patch.dailyReminderTime } : {}),
    ...(patch.weightLbs !== undefined
      ? { weightLbs: patch.weightLbs, startWeightLbs: patch.weightLbs }
      : {}),
    ...(patch.startWeightLbs !== undefined && patch.weightLbs === undefined
      ? { startWeightLbs: patch.startWeightLbs }
      : {}),
    ...(patch.gender !== undefined
      ? { gender: patch.gender == null || patch.gender === "" ? null : normalizeOnboardGender(patch.gender) }
      : {}),
    ...(patch.weightLossGoal !== undefined ? { weightLossGoal: patch.weightLossGoal } : {}),
    ...(patch.weightLossTimeline !== undefined
      ? { weightLossTimeline: patch.weightLossTimeline }
      : {}),
    ...(patch.primaryGoal !== undefined
      ? { primaryGoal: patch.primaryGoal ? normalizePrimaryGoal(patch.primaryGoal) : null }
      : {}),
    ...(patch.workoutSchedule !== undefined
      ? {
          workoutSchedule: patch.workoutSchedule
            ? normalizeWorkoutSchedule(patch.workoutSchedule)
            : null,
        }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.city !== undefined ? { city: patch.city } : {}),
    ...(patch.state !== undefined ? { state: patch.state } : {}),
  });

  if (isDemoMode() && (patch.phone !== undefined || patch.dailyReminderTime !== undefined)) {
    await updateDemoUserSettings(session.id, {
      phone: patch.phone ?? undefined,
      dailyReminderTime: patch.dailyReminderTime ?? undefined,
    });
  }

  return NextResponse.json({ ok: true, profile });
}