import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearNewMemberOnboardingCookie,
  getSessionUser,
} from "@/lib/auth";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { isDemoMode, updateDemoUserSettings } from "@/lib/demo-reminders";
import { enrollDemo } from "@/lib/demo-enrollments";
import { notifyNewLead } from "@/lib/lead-notify";
import { memberProgramStartPath } from "@/lib/member-destinations";
import { sendMemberWelcomeEmail } from "@/lib/member-welcome";
import { sendWelcomeSms } from "@/lib/sms";

const schema = z.object({
  measurements: z
    .object({
      weight: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  phone: z.string().optional(),
  dailyReminderTime: z.string().optional(),
  calendlyOpened: z.boolean().optional(),
  programSlug: z.string().optional(),
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
    notes,
    location,
    phone,
    dailyReminderTime,
    calendlyOpened,
    programSlug,
    plan,
  } = body.data;

  await ensureMemberProfile({
    userId: session.id,
    email: session.email,
    plan: plan || "explorer",
    phone: phone || null,
  });

  const completedAt = new Date().toISOString();
  const profile = await updateMemberProfile(session.id, {
    phone: phone || null,
    dailyReminderTime: dailyReminderTime || null,
    weightLbs: measurements?.weight || null,
    notes: measurements?.notes || notes || null,
    city: location?.city || null,
    state: location?.state || null,
    onboardingComplete: true,
    completedAt,
  });

  const enrolledSlug = programSlug || "adult";

  if (isDemoMode()) {
    enrollDemo(enrolledSlug, session.id);
    updateDemoUserSettings(session.id, {
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

Measurements:
- Weight: ${measurements?.weight || "not provided"} lbs
- Notes: ${measurements?.notes || notes || "none"}

Location: ${location?.city || "—"}, ${location?.state || "—"}
SMS phone: ${phone || "not set"}
Daily reminder: ${dailyReminderTime || "not set"}
Calendly opened: ${calendlyOpened ? "yes" : "no"}
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

  const res = NextResponse.json({
    success: true,
    redirectTo: memberProgramStartPath(enrolledSlug),
    profile,
  });
  clearNewMemberOnboardingCookie(res);

  if (location?.city && location?.state) {
    res.cookies.set("ts_city", location.city, { path: "/", maxAge: 365 * 24 * 60 * 60 });
    res.cookies.set("ts_state", location.state.toUpperCase(), { path: "/", maxAge: 365 * 24 * 60 * 60 });
  }

  return res;
}