import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { resolveAlertChannels, type CoachAlertEvent } from "@/lib/alert-channels";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { getMemberCoachPrefs } from "@/lib/member-coach-prefs-store";
import { postCoachSystemMessage } from "@/lib/coach-chat";
import { sendResendEmail, transactionalSubject } from "@/lib/resend-mail";
import { deliverSms } from "@/lib/sms";
import { isDemoMode } from "@/lib/demo-enrollments";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.thetrainstation.co";
}

const DEFAULT_COACH_EMAIL = "jeremy@thetrainstation.co";

/** Onboarding funnel — never skip email when a coach address is known. */
const FORCE_EMAIL_EVENTS: ReadonlySet<CoachAlertEvent> = new Set([
  "newMember",
  "equipmentSelected",
  "programStartChosen",
  "messagesOpened",
]);

/**
 * One-shot claim so equipment toggles / repeated message opens don't spam.
 * Uses OutboundNotification as durable claim ledger (no schema migration).
 */
export async function claimCoachNotifyOnce(params: {
  memberUserId: string;
  claimKey: string;
}): Promise<boolean> {
  if (isDemoMode()) return true;
  const userId = params.memberUserId?.trim();
  const category = `coach-once:${params.claimKey}`.slice(0, 80);
  if (!userId) return false;

  try {
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.outboundNotification.findFirst({
      where: { userId, category, status: "sent" },
      select: { id: true },
    });
    if (existing) return false;

    await prisma.outboundNotification.create({
      data: {
        channel: "in_app",
        category,
        status: "sent",
        userId,
        subject: `claim:${params.claimKey}`,
        bodyPreview: "coach notify once claim",
        provider: "coach-notify-once",
      },
    });
    return true;
  } catch (e) {
    console.warn("[coach-notify] claim once failed — allowing notify", e);
    return true;
  }
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
  /**
   * Force email for funnel events even if coach prefs turned email off.
   * Default: true for signup / equipment / start / messages-open.
   */
  forceEmail?: boolean;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean; push: boolean }> {
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
  const forceEmail =
    params.forceEmail !== undefined
      ? params.forceEmail
      : FORCE_EMAIL_EVENTS.has(params.event);
  if (forceEmail) channels.email = true;

  const link = params.deepLink || `${appBaseUrl()}/admin/members`;
  const result = { inApp: false, email: false, sms: false, push: false };

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
    DEFAULT_COACH_EMAIL;

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

  // Web push to staff devices that enabled alerts (Jeremy / John).
  try {
    const { sendPushToUserIds } = await import("@/lib/web-push");
    const { prisma } = await import("@/lib/prisma");
    if (!isDemoMode()) {
      const staff = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "INSTRUCTOR", "PLATFORM_ADMIN"] } },
        select: { id: true },
      });
      const ids = staff.map((s) => s.id);
      if (ids.length) {
        const push = await sendPushToUserIds(ids, {
          title: params.subject,
          body: `${params.memberName}: ${params.message.split("\n")[0] || params.subject}`.slice(
            0,
            160,
          ),
          url: link.replace(appBaseUrl(), "") || "/admin/members",
          tag: `coach-${params.event}-${params.memberUserId || "x"}`,
        });
        result.push = push.sent > 0;
      }
    }
  } catch (e) {
    console.warn("[coach-notify] push failed", e);
  }

  if (!result.inApp && !result.email && !result.sms && !result.push) {
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
  /** Program Day 1 ISO date when known */
  programStartDate?: string | null;
  programSlug?: string | null;
  equipmentSummary?: string | null;
  phone?: string | null;
}): Promise<void> {
  const startLine = params.programStartDate?.trim()
    ? `\nProgram start (Day 1): ${params.programStartDate.trim()}`
    : "";
  const programLine = params.programSlug?.trim()
    ? `\nProgram: ${params.programSlug.trim()}`
    : "";
  const equipLine = params.equipmentSummary?.trim()
    ? `\nHome equipment: ${params.equipmentSummary.trim()}`
    : "";
  const phoneLine = params.phone?.trim() ? `\nPhone: ${params.phone.trim()}` : "";

  await notifyCoachForMemberEvent({
    event: "newMember",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "New member finished onboarding",
    message:
      `${params.name} completed setup and is ready for a 15-minute intake.\n` +
      `Plan: ${params.plan}${programLine}${startLine}${equipLine}${phoneLine}`,
    deepLink: `${appBaseUrl()}/admin/members`,
  });

  // Explicit start-date event so funnel dashboards / prefs can treat it separately.
  if (params.programStartDate?.trim()) {
    await notifyCoachProgramStartChosen({
      userId: params.userId,
      name: params.name,
      email: params.email,
      plan: params.plan,
      programStartDate: params.programStartDate.trim(),
      programSlug: params.programSlug || null,
    });
  }
}

/** Member saved home equipment (first meaningful selection). */
export async function notifyCoachEquipmentSelected(params: {
  userId: string;
  name: string;
  email: string;
  plan?: string | null;
  equipmentNames: string[];
}): Promise<{ inApp: boolean; email: boolean; sms: boolean; push: boolean } | null> {
  const claimed = await claimCoachNotifyOnce({
    memberUserId: params.userId,
    claimKey: "equipment-selected",
  });
  if (!claimed) return null;

  const names = params.equipmentNames.filter((n) => n?.trim()).slice(0, 40);
  const list =
    names.length > 0
      ? names.map((n) => `• ${n}`).join("\n")
      : "• (saved equipment list — no items checked yet)";
  const more =
    params.equipmentNames.length > 40
      ? `\n• … +${params.equipmentNames.length - 40} more`
      : "";

  return notifyCoachForMemberEvent({
    event: "equipmentSelected",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "Member selected home equipment",
    message:
      `${params.name} updated what they have at home.\n` +
      (params.plan ? `Plan: ${params.plan}\n` : "") +
      `\n${list}${more}`,
    deepLink: `${appBaseUrl()}/admin/members`,
  });
}

/** Member chose program Day 1 (usually at onboarding complete). */
export async function notifyCoachProgramStartChosen(params: {
  userId: string;
  name: string;
  email: string;
  plan: string;
  programStartDate: string;
  programSlug?: string | null;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean; push: boolean } | null> {
  const claimed = await claimCoachNotifyOnce({
    memberUserId: params.userId,
    claimKey: `program-start:${params.programStartDate}`,
  });
  if (!claimed) return null;

  return notifyCoachForMemberEvent({
    event: "programStartChosen",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "Member chose program start date",
    message:
      `${params.name} set Day 1 to ${params.programStartDate}.\n` +
      `Plan: ${params.plan}` +
      (params.programSlug ? `\nProgram: ${params.programSlug}` : ""),
    deepLink: `${appBaseUrl()}/admin/members`,
  });
}

/** Member opened Messages (first time only). */
export async function notifyCoachMessagesOpened(params: {
  userId: string;
  name: string;
  email: string;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean; push: boolean } | null> {
  const claimed = await claimCoachNotifyOnce({
    memberUserId: params.userId,
    claimKey: "messages-opened",
  });
  if (!claimed) return null;

  return notifyCoachForMemberEvent({
    event: "messagesOpened",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "Member opened Messages",
    message: `${params.name} opened the Messages hub for the first time.`,
    deepLink: `${appBaseUrl()}/admin/chat?member=${encodeURIComponent(params.userId)}`,
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

/**
 * Short confirmation to the member after they log a workout.
 * Non-fatal caller responsibility; does not post to Messages.
 */
export async function notifyMemberWorkoutLogged(params: {
  name: string;
  email: string;
  workoutName: string;
  sessionDate: string;
  progress: number;
  maintain?: boolean;
  late?: boolean;
}): Promise<boolean> {
  const email = params.email?.trim();
  if (!email || !email.includes("@")) return false;

  const hi = (params.name || email.split("@")[0] || "there").trim().split(/\s+/)[0] || "there";
  const kind = params.maintain ? "Quick maintain" : "workout";
  const progressLabel =
    params.progress >= 100
      ? "100% complete"
      : `${Math.max(0, Math.min(100, params.progress))}% logged`;
  const lateLine = params.late
    ? "\n(Catch-up day — score is reduced a bit for logging late.)\n"
    : "\n";
  const todayUrl = `${appBaseUrl()}/member/today`;

  const text =
    `Hi ${hi},\n\n` +
    `Nice work — your ${kind} is saved.\n\n` +
    `${params.workoutName}\n` +
    `Date: ${params.sessionDate} · ${progressLabel}` +
    lateLine +
    `Your coach can see this in Messages. Day Complete is on for today — come back tomorrow for the next session.\n\n` +
    `— ${BRAND_NAME}\n` +
    todayUrl;

  return sendResendEmail({
    to: email,
    subject: transactionalSubject("workout-complete"),
    text,
    ctaUrl: todayUrl,
    ctaLabel: "Open Today",
    tags: [{ name: "category", value: "workout-complete" }],
  });
}