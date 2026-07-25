import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { resolveAlertChannels, type CoachAlertEvent } from "@/lib/alert-channels";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { getMemberCoachPrefs } from "@/lib/member-coach-prefs-store";
import { postCoachSystemMessage } from "@/lib/coach-chat";
import { sendResendEmail } from "@/lib/resend-mail";
import { deliverSms } from "@/lib/sms";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
}

export async function notifyCoachForMemberEvent(params: {
  event: CoachAlertEvent;
  memberUserId: string;
  memberName: string;
  memberEmail: string;
  subject: string;
  message: string;
  deepLink?: string;
  /** Skip Messages thread (e.g. Calendly guest with no member account). */
  skipInApp?: boolean;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const [settings, memberPrefs] = await Promise.all([
    getCoachSettings(),
    params.skipInApp
      ? Promise.resolve(null)
      : getMemberCoachPrefs(params.memberUserId),
  ]);

  const channels = resolveAlertChannels(
    settings.alertPrefs,
    memberPrefs?.alertOverrides,
    params.event,
  );
  const link = params.deepLink || `${appBaseUrl()}/admin/members`;
  const result = { inApp: false, email: false, sms: false };

  if (channels.inApp && !params.skipInApp && params.memberUserId) {
    try {
      await postCoachSystemMessage({
        memberId: params.memberUserId,
        body: `${params.subject}\n\n${params.message}`,
        sessionDate: new Date().toISOString().slice(0, 10),
      });
      result.inApp = true;
    } catch (e) {
      console.error("[coach-notify] in-app failed", e);
    }
  }

  const coachEmail =
    settings.coachEmail?.trim() ||
    process.env.COACH_NOTIFY_EMAIL?.trim() ||
    process.env.LEAD_NOTIFY_EMAIL?.split(",")[0]?.trim() ||
    "";

  if (channels.email && coachEmail) {
    result.email = await sendResendEmail({
      to: coachEmail,
      subject: `${params.subject} — ${BRAND_NAME}`,
      text: `${params.message}\n\nMember: ${params.memberName} <${params.memberEmail}>\n\nOpen: ${link}`,
      ctaUrl: link,
      ctaLabel: "Open coach dashboard",
      tags: [{ name: "category", value: `coach-${params.event}` }],
    });
  }

  const coachPhone = settings.coachPhone?.trim();
  if (channels.sms && coachPhone) {
    const smsBody = `${params.subject}: ${params.memberName} — ${link}`;
    result.sms = await deliverSms(coachPhone, smsBody);
  }

  if (!result.inApp && !result.email && !result.sms) {
    console.log(
      `[coach-notify:${params.event}] ${params.memberName} — channels off or unconfigured`,
    );
  }

  return result;
}

const COACH_TZ =
  process.env.APP_TIMEZONE?.trim() ||
  process.env.TZ?.trim() ||
  "America/Los_Angeles";

/** Human-readable meeting time for coach emails / Messages. */
export function formatCoachMeetingWhen(
  iso: string | null | undefined,
  timeZone: string = COACH_TZ,
): string {
  if (!iso?.trim()) {
    return "Time chosen in Calendly — check your Calendly calendar or confirmation email for the exact slot";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "Time chosen in Calendly — check your Calendly calendar for the exact slot";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

export async function notifyCoachNewMember(params: {
  userId: string;
  name: string;
  email: string;
  plan: string;
}): Promise<void> {
  await notifyCoachForMemberEvent({
    event: "newMember",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "New member finished onboarding",
    message: `${params.name} completed setup and is ready for a 15-minute intake.\nPlan: ${params.plan}`,
    deepLink: `${appBaseUrl()}/admin/members`,
  });
}

/** Fired at account create (signup) — email + in-app Messages. */
export async function notifyCoachNewSignup(params: {
  userId: string;
  name: string;
  email: string;
  plan: string;
  phone?: string | null;
  source?: string | null;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const phoneLine = params.phone?.trim() ? `\nPhone: ${params.phone.trim()}` : "";
  const sourceLine = params.source ? `\nSource: ${params.source}` : "";
  return notifyCoachForMemberEvent({
    event: "newMember",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "New signup",
    message:
      `${params.name} just created an account.\n` +
      `Plan: ${params.plan}${phoneLine}${sourceLine}\n\n` +
      `They still need to finish setup / payment and book their intro call.`,
    deepLink: `${appBaseUrl()}/admin/queue`,
  });
}

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export async function notifyCoachIntakeReady(params: {
  userId: string;
  name: string;
  email: string;
  plan: string;
  paymentStatus?: string;
  /** ISO start of the intro/follow-up call when known */
  scheduledAt?: string | null;
  /** calendly | app_slots | manual */
  bookingSource?: string | null;
  phone?: string | null;
  skipInApp?: boolean;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const paymentPending =
    isPaidPlan(params.plan) && params.paymentStatus !== "paid" && params.paymentStatus !== "none";

  const paymentNote = paymentPending
    ? "\n\nPayment is still pending — use Queue to mark paid (Venmo/cash) when you accept them."
    : "";

  const when = formatCoachMeetingWhen(params.scheduledAt);
  const source =
    params.bookingSource === "app_slots"
      ? "In-app slot request"
      : params.bookingSource === "calendly"
        ? "Calendly"
        : params.bookingSource || "Booking";
  const phoneLine = params.phone?.trim() ? `\nPhone: ${params.phone.trim()}` : "";

  return notifyCoachForMemberEvent({
    event: "intakeScheduled",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "Intro call booked",
    message:
      `${params.name} booked a coach call.\n\n` +
      `When: ${when}\n` +
      `Via: ${source}\n` +
      `Plan: ${params.plan}${phoneLine}${paymentNote}\n\n` +
      `Open Queue / Bookings to confirm and send Zoom if needed.`,
    deepLink: `${appBaseUrl()}/admin/bookings`,
    skipInApp: params.skipInApp,
  });
}

export async function notifyCoachWarmupStarted(params: {
  userId: string;
  name: string;
  email: string;
  sessionDate: string;
}): Promise<void> {
  await notifyCoachForMemberEvent({
    event: "warmupStarted",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: `${params.name} started warm-ups`,
    message: `They're checking off warm-up sets before your live session on ${params.sessionDate}. More time for main lifts.`,
    deepLink: `${appBaseUrl()}/member/today?forUser=${encodeURIComponent(params.userId)}&asInstructor=true&date=${params.sessionDate}`,
  });
}

export type WorkoutLogExerciseSummary = {
  name: string;
  setsCompleted?: number | null;
  repsCompleted?: number | null;
  startingWeightLbs?: number | null;
};

/**
 * Member finished / logged a workout — Messages thread + coach email with what they did.
 */
export async function notifyCoachWorkoutLogged(params: {
  userId: string;
  name: string;
  email: string;
  workoutName: string;
  workoutId: string;
  sessionDate: string;
  progress: number;
  programSlug?: string | null;
  exercises?: WorkoutLogExerciseSummary[];
  late?: boolean;
  maintain?: boolean;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const progressLabel =
    params.progress >= 100
      ? "Completed 100%"
      : `Logged ${Math.max(0, Math.min(100, params.progress))}%`;
  const kind = params.maintain ? "Quick maintain" : "Workout";
  const programLine = params.programSlug
    ? `\nProgram: ${params.programSlug}`
    : "";
  const lateLine = params.late ? "\nLate catch-up (score reduced)." : "";

  const lines: string[] = [];
  const exercises = params.exercises?.filter((e) => e.name?.trim()) ?? [];
  if (exercises.length > 0) {
    lines.push("", "What they logged:");
    for (const ex of exercises.slice(0, 24)) {
      const bits: string[] = [];
      if (ex.setsCompleted != null) bits.push(`${ex.setsCompleted} set${ex.setsCompleted === 1 ? "" : "s"}`);
      if (ex.repsCompleted != null) bits.push(`${ex.repsCompleted} reps`);
      if (ex.startingWeightLbs != null && ex.startingWeightLbs > 0) {
        bits.push(`${ex.startingWeightLbs} lb`);
      }
      lines.push(`• ${ex.name}${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
    }
    if (exercises.length > 24) {
      lines.push(`• … +${exercises.length - 24} more`);
    }
  }

  const deepLink =
    `${appBaseUrl()}/member/today?forUser=${encodeURIComponent(params.userId)}` +
    `&asInstructor=1&date=${encodeURIComponent(params.sessionDate)}` +
    (params.maintain
      ? `&maintain=${encodeURIComponent(params.workoutId)}`
      : "");

  return notifyCoachForMemberEvent({
    event: "workoutLogged",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: `${params.name} finished: ${params.workoutName}`,
    message:
      `${kind}: ${params.workoutName}\n` +
      `Date: ${params.sessionDate}\n` +
      `${progressLabel}${programLine}${lateLine}` +
      lines.join("\n") +
      `\n\nOpen their Today to review sets and silhouettes.`,
    deepLink,
  });
}