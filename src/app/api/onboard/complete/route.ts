import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearNewMemberOnboardingCookie,
  getSessionUser,
} from "@/lib/auth";
import {
  ensureMemberProfile,
  getMemberProfile,
  updateMemberProfile,
} from "@/lib/member-profiles-store";
import { isDemoMode, updateDemoUserSettings } from "@/lib/demo-reminders";

import { notifyNewLead } from "@/lib/lead-notify";
import { syncMemberGateCookies } from "@/lib/auth";
import { memberPostOnboardPathAsync } from "@/lib/member-destinations";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { sendWelcomeSms } from "@/lib/sms";
import { notifyCoachNewMember } from "@/lib/coach-member-notify";
import { awardGamificationPoints } from "@/lib/member-gamification-store";
import { enrollUserInProgram } from "@/lib/data/user-data";
import { isValidProgramStartDate, recommendedProgramStartDate } from "@/lib/member-program-block";
import { localTodayIso } from "@/lib/program-calendar";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";
import { resolveEffectiveMembershipPlan } from "@/lib/signup-plans";
import { isWomanOnboardPath, normalizeOnboardGender } from "@/lib/onboard-path";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  measurements: z
    .object({
      weight: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  gender: z.string().max(20).optional(),
  weightLossGoal: z.string().max(240).optional(),
  weightLossTimeline: z.string().max(80).optional(),
  notes: z.string().optional(),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  phone: z.string().optional(),
  dailyReminderTime: z.string().optional(),
  programSlug: z.string().optional(),
  programStartDate: z.string().optional(),
  plan: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ detail: body.error.flatten() }, { status: 400 });
  }

  const {
    measurements,
    gender,
    weightLossGoal,
    weightLossTimeline,
    notes,
    location,
    phone,
    dailyReminderTime,
    programSlug,
    programStartDate,
    plan,
  } = body.data;
  const genderNorm = normalizeOnboardGender(gender);
  if (!genderNorm) {
    return NextResponse.json(
      { error: "Pick man or woman so we can set the right goals." },
      { status: 400 },
    );
  }
  const womanPath = isWomanOnboardPath(genderNorm);

  const todayIso = localTodayIso();
  const coachSettings = await getCoachSettings();
  const startSettings = programStartSettingsFromCoach(coachSettings);
  const startIso =
    programStartDate?.trim() ||
    recommendedProgramStartDate(todayIso, startSettings);
  if (!isValidProgramStartDate(startIso, todayIso, startSettings.maxOffsetDays)) {
    return NextResponse.json(
      {
        error: `Start date must be between today and ${startSettings.maxOffsetDays} days from now.`,
      },
      { status: 400 },
    );
  }

  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan: plan || "explorer",
    phone: phone || null,
  });

  const existingProfile = await getMemberProfile(session.id);
  let signupPlan: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { signupPlan: true },
    });
    signupPlan = user?.signupPlan ?? null;
  } catch {
    /* non-fatal */
  }
  const nextPlan = resolveEffectiveMembershipPlan({
    profilePlan: plan || existingProfile?.plan,
    signupPlan,
    paymentStatus: existingProfile?.paymentStatus ?? null,
  });

  const completedAt = new Date().toISOString();
  const profile = await updateMemberProfile(session.id, {
    phone: phone || null,
    dailyReminderTime: dailyReminderTime || null,
    weightLbs: womanPath ? null : measurements?.weight || null,
    gender: genderNorm,
    weightLossGoal: womanPath ? weightLossGoal?.trim() || null : null,
    weightLossTimeline: womanPath ? weightLossTimeline?.trim() || null : null,
    notes: measurements?.notes || notes || null,
    city: location?.city || null,
    state: location?.state || null,
    plan: nextPlan,
    onboardingComplete: true,
    completedAt,
    rampStartedAt: completedAt,
  });

  const enrolledSlug = programSlug || "adult";

  await enrollUserInProgram(enrolledSlug, session.id, {
    programStartDate: startIso,
    blockDays: startSettings.blockDays,
  });

  if (isDemoMode()) {
    await updateDemoUserSettings(session.id, {
      phone: phone || undefined,
      dailyReminderTime: dailyReminderTime || undefined,
    });
  }

  const coachEmail = "jeremy@thetrainstation.co";
  const subject = "New member completed onboarding";
  const message = `
${session.name} <${session.email}> finished setup.

Ticket plan: ${profile.plan}
Program context: ${programSlug || "general"}
Program start (Day 1): ${startIso}

${
    womanPath
      ? `Goals:
- Weight loss: ${weightLossGoal?.trim() || "not provided"}
- Timeline: ${weightLossTimeline?.trim() || "not provided"}
- Notes: ${measurements?.notes || notes || "none"}`
      : `Measurements:
- Weight: ${measurements?.weight || "not provided"} lbs
- Notes: ${measurements?.notes || notes || "none"}`
  }

Location: ${location?.city || "—"}, ${location?.state || "—"}
SMS phone: ${phone || "not set"}
Daily reminder: ${dailyReminderTime || "not set"}
Coach intro booking: on dashboard after setup
`;

  if (isDemoMode()) {
    console.log(`\n[ONBOARD COMPLETE] To: ${coachEmail}\nSubject: ${subject}\n${message}\n`);
  }

  await notifyNewLead({
    email: session.email,
    name: session.name,
    phone: phone || null,
    plan: profile.plan,
    source: "onboard-complete",
    createdAt: completedAt,
  });

  // Summarize home gear for coach email (best-effort).
  let equipmentSummary: string | null = null;
  try {
    const { getMemberEquipmentWithStatus } = await import("@/lib/equipment-store");
    const gear = await getMemberEquipmentWithStatus(session.id);
    const have = gear.filter((g) => g.hasAtHome).map((g) => g.name);
    equipmentSummary =
      have.length > 0
        ? `${have.slice(0, 20).join(", ")}${have.length > 20 ? ` (+${have.length - 20} more)` : ""}`
        : "none checked";
  } catch {
    /* ignore */
  }

  await notifyCoachNewMember({
    userId: session.id,
    name: session.name || "Member",
    email: session.email,
    plan: profile.plan,
    programStartDate: startIso,
    programSlug: enrolledSlug,
    equipmentSummary,
    phone: phone || profile.phone || null,
    gender: genderNorm,
    weightLbs: womanPath ? null : measurements?.weight || null,
    weightLossGoal: womanPath ? weightLossGoal?.trim() || null : null,
    weightLossTimeline: womanPath ? weightLossTimeline?.trim() || null : null,
  });

  await awardGamificationPoints({
    userId: session.id,
    eventId: "onboarding:complete",
    type: "onboarding_complete",
    programSlug: enrolledSlug,
  });

  const welcomePatch: Parameters<typeof updateMemberProfile>[1] = {};

  if (!profile.welcomeCompleteEmailSentAt) {
    const emailSent = await sendMemberWelcomeEmail({
      email: session.email,
      name: session.name,
      plan: profile.plan,
      stage: "complete",
      programSlug: enrolledSlug,
    });
    if (emailSent) {
      welcomePatch.welcomeCompleteEmailSentAt = new Date().toISOString();
    }
  }

  const smsPhone = phone || profile.phone;
  if (smsPhone && !profile.welcomeSmsSentAt) {
    const smsResult = await sendWelcomeSms({
      userId: session.id,
      phone: smsPhone,
      name: session.name,
      programSlug: enrolledSlug,
    });
    if (smsResult.sent > 0) {
      welcomePatch.welcomeSmsSentAt = new Date().toISOString();
    }
  }

  if (Object.keys(welcomePatch).length > 0) {
    await updateMemberProfile(session.id, welcomePatch);
  }

  const latestProfile = Object.keys(welcomePatch).length > 0
    ? await getMemberProfile(session.id)
    : profile;

  const res = NextResponse.json({
    success: true,
    redirectTo: await memberPostOnboardPathAsync(latestProfile, session.id, enrolledSlug),
    profile: latestProfile,
  });
  clearNewMemberOnboardingCookie(res);
  await syncMemberGateCookies(res, { userId: session.id, profile: latestProfile });

  if (location?.city && location?.state) {
    res.cookies.set("ts_city", location.city, { path: "/", maxAge: 365 * 24 * 60 * 60 });
    res.cookies.set("ts_state", location.state.toUpperCase(), { path: "/", maxAge: 365 * 24 * 60 * 60 });
  }

  return res;
}