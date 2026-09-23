import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { getAccountByUserId, upsertSignInAccount } from "@/lib/member-accounts-store";
import { getMemberCoachPrefs } from "@/lib/member-coach-prefs-store";
import { coachingModeFromPrefs } from "@/lib/member-coaching-mode";
import {
  ensureMemberProfile,
  getBusinessUpgradeQueuePlaceForUser,
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
import { setUserUsername } from "@/lib/byow-guest";
import { calorieThresholdsAreSet } from "@/lib/food-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const nullableString = z.string().max(4000).nullable().optional();

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  username: z.string().max(24).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  dailyReminderTime: z.string().max(10).nullable().optional(),
  smsReminderCadence: z.enum(["consistent", "minimum"]).nullable().optional(),
  weightLbs: z.string().max(20).nullable().optional(),
  startWeightLbs: z.string().max(20).nullable().optional(),
  goalWeightLbs: z.string().max(20).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  weightLossGoal: z.string().max(240).nullable().optional(),
  weightLossTimeline: z.string().max(80).nullable().optional(),
  primaryGoal: z.string().max(120).nullable().optional(),
  workoutSchedule: z.string().max(40).nullable().optional(),
  calorieMin: z.number().int().min(0).max(20000).nullable().optional(),
  calorieRangeMax: z.number().int().min(0).max(20000).nullable().optional(),
  calorieHardMax: z.number().int().min(0).max(20000).nullable().optional(),
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
  const upgradePlace =
    profile.businessUpgradeStatus === "pending"
      ? await getBusinessUpgradeQueuePlaceForUser(userId)
      : null;

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  return {
    userId,
    email: accountRow.email,
    name: accountRow.account.name,
    username: userRow?.username || "",
    createdAt: accountRow.account.createdAt,
    planLabel: signupPlanLabel(profile.plan),
    coachingMode,
    profile,
    businessUpgradeQueuePosition: upgradePlace?.position ?? null,
    businessUpgradeQueueSize: upgradePlace?.size ?? null,
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

  if (body.username !== undefined) {
    try {
      await setUserUsername(userId, blankToNull(body.username) ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That username is taken.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

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

  const calorieFields = [body.calorieMin, body.calorieRangeMax, body.calorieHardMax];
  if (calorieFields.some((value) => value !== undefined)) {
    const min = body.calorieMin ?? null;
    const rangeMax = body.calorieRangeMax ?? null;
    const hardMax = body.calorieHardMax ?? null;
    const existingProfile = await getMemberProfile(userId);
    const intakeSigned = Boolean(existingProfile?.coachIntakeCompleteAt);
    if (intakeSigned && !calorieThresholdsAreSet(min, rangeMax, hardMax)) {
      return NextResponse.json(
        {
          error:
            "After the intro, keep a minimum, range top, and hard total. Change the numbers anytime — don't clear them.",
        },
        { status: 400 },
      );
    }
    const setCount = [min, rangeMax, hardMax].filter((value) => value != null).length;
    if (!intakeSigned && setCount !== 0 && setCount !== 3) {
      return NextResponse.json(
        { error: "Set the calorie minimum, range, and hard total together." },
        { status: 400 },
      );
    }
    if (
      !intakeSigned &&
      min != null &&
      rangeMax != null &&
      hardMax != null &&
      !calorieThresholdsAreSet(min, rangeMax, hardMax)
    ) {
      return NextResponse.json(
        { error: "Calorie minimum must be below the range, and the range below the hard total." },
        { status: 400 },
      );
    }
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
    ...(body.smsReminderCadence !== undefined
      ? { smsReminderCadence: body.smsReminderCadence }
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
    ...(body.calorieMin !== undefined ? { calorieMin: body.calorieMin } : {}),
    ...(body.calorieRangeMax !== undefined ? { calorieRangeMax: body.calorieRangeMax } : {}),
    ...(body.calorieHardMax !== undefined ? { calorieHardMax: body.calorieHardMax } : {}),
    ...(body.notes !== undefined ? { notes: blankToNull(body.notes) ?? null } : {}),
    ...(body.city !== undefined ? { city: blankToNull(body.city) ?? null } : {}),
    ...(body.state !== undefined ? { state: blankToNull(body.state) ?? null } : {}),
  });

  const card = await loadCard(userId);
  return NextResponse.json({ ok: true, ...card });
}
