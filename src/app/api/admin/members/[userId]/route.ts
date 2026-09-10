import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { getAccountByUserId, upsertSignInAccount } from "@/lib/member-accounts-store";
import { getMemberCoachPrefs } from "@/lib/member-coach-prefs-store";
import { coachingModeFromPrefs } from "@/lib/member-coaching-mode";
import {
  ensureMemberProfile,
  getMemberProfile,
  updateMemberProfile,
} from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";
import {
  normalizeOnboardGender,
  normalizePrimaryGoal,
  normalizeWorkoutSchedule,
} from "@/lib/onboard-path";
import { formatPhoneInputValue } from "@/lib/sms-phone";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const nullableString = z.string().max(4000).nullable().optional();

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  dailyReminderTime: z.string().max(10).nullable().optional(),
  weightLbs: z.string().max(20).nullable().optional(),
  startWeightLbs: z.string().max(20).nullable().optional(),
  goalWeightLbs: z.string().max(20).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  weightLossGoal: z.string().max(240).nullable().optional(),
  weightLossTimeline: z.string().max(80).nullable().optional(),
  primaryGoal: z.string().max(40).nullable().optional(),
  workoutSchedule: z.string().max(40).nullable().optional(),
  notes: nullableString,
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
});

function blankToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function loadCard(userId: string) {
  const accountRow = await getAccountByUserId(userId);
  if (!accountRow) return null;

  const profile =
    (await getMemberProfile(userId)) ??
    (await ensureMemberProfile({
      userId,
      email: accountRow.email,
      plan: "explorer",
      phone: accountRow.account.phone,
    }));

  const prefs = await getMemberCoachPrefs(userId);
  const coachingMode = coachingModeFromPrefs(prefs, userId);

  return {
    userId,
    email: accountRow.email,
    name: accountRow.account.name,
    createdAt: accountRow.account.createdAt,
    planLabel: signupPlanLabel(profile.plan),
    coachingMode,
    profile,
  };
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const card = await loadCard(userId);
  if (!card) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  return NextResponse.json(card);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const accountRow = await getAccountByUserId(userId);
  if (!accountRow) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const phone =
    body.phone === undefined
      ? undefined
      : body.phone
        ? formatPhoneInputValue(body.phone) || null
        : null;
  const gender = body.gender === undefined ? undefined : normalizeOnboardGender(body.gender);
  const primaryGoal =
    body.primaryGoal === undefined ? undefined : normalizePrimaryGoal(body.primaryGoal);
  const workoutSchedule =
    body.workoutSchedule === undefined
      ? undefined
      : normalizeWorkoutSchedule(body.workoutSchedule);

  const name = body.name?.trim();
  if (name || phone !== undefined) {
    await upsertSignInAccount({
      email: accountRow.email,
      userId: accountRow.account.userId,
      role: accountRow.account.role,
      name: name || accountRow.account.name,
      phone: phone !== undefined ? phone : undefined,
    });
  }

  await ensureMemberProfile({
    userId,
    email: accountRow.email,
    plan: "explorer",
    phone: phone ?? accountRow.account.phone,
  });

  await updateMemberProfile(userId, {
    ...(phone !== undefined ? { phone } : {}),
    ...(body.dailyReminderTime !== undefined
      ? { dailyReminderTime: blankToNull(body.dailyReminderTime) ?? null }
      : {}),
    ...(body.weightLbs !== undefined ? { weightLbs: blankToNull(body.weightLbs) ?? null } : {}),
    ...(body.startWeightLbs !== undefined
      ? { startWeightLbs: blankToNull(body.startWeightLbs) ?? null }
      : {}),
    ...(body.goalWeightLbs !== undefined
      ? { goalWeightLbs: blankToNull(body.goalWeightLbs) ?? null }
      : {}),
    ...(gender !== undefined ? { gender } : {}),
    ...(body.weightLossGoal !== undefined
      ? { weightLossGoal: blankToNull(body.weightLossGoal) ?? null }
      : {}),
    ...(body.weightLossTimeline !== undefined
      ? { weightLossTimeline: blankToNull(body.weightLossTimeline) ?? null }
      : {}),
    ...(primaryGoal !== undefined ? { primaryGoal } : {}),
    ...(workoutSchedule !== undefined ? { workoutSchedule } : {}),
    ...(body.notes !== undefined ? { notes: blankToNull(body.notes) ?? null } : {}),
    ...(body.city !== undefined ? { city: blankToNull(body.city) ?? null } : {}),
    ...(body.state !== undefined ? { state: blankToNull(body.state) ?? null } : {}),
  });

  const card = await loadCard(userId);
  return NextResponse.json({ ok: true, ...card });
}
