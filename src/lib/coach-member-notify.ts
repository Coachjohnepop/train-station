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
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const [settings, memberPrefs] = await Promise.all([
    getCoachSettings(),
    getMemberCoachPrefs(params.memberUserId),
  ]);

  const channels = resolveAlertChannels(settings.alertPrefs, memberPrefs.alertOverrides, params.event);
  const link = params.deepLink || `${appBaseUrl()}/admin/members`;
  const result = { inApp: false, email: false, sms: false };

  if (channels.inApp) {
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

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export async function notifyCoachIntakeReady(params: {
  userId: string;
  name: string;
  email: string;
  plan: string;
  paymentStatus?: string;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const paymentPending =
    isPaidPlan(params.plan) && params.paymentStatus !== "paid" && params.paymentStatus !== "none";

  const paymentNote = paymentPending
    ? "\n\nPayment is still pending — use Queue to mark paid (Venmo/cash) when you accept them."
    : "";

  return notifyCoachForMemberEvent({
    event: "intakeScheduled",
    memberUserId: params.userId,
    memberName: params.name,
    memberEmail: params.email,
    subject: "Intake sign-off needed",
    message: `${params.name} is ready for coach intake sign-off.${paymentNote}\n\nPlan: ${params.plan}`,
    deepLink: `${appBaseUrl()}/admin/queue`,
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