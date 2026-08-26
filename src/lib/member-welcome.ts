import "server-only";

import { BRAND_NAME, COACH_CALENDLY_URL } from "@/lib/brand";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import {
  getMemberProfile,
  updateMemberProfile,
} from "@/lib/member-profiles-store";
import { memberProgramStartPath } from "@/lib/member-destinations";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import { appBaseUrl } from "@/lib/sms";
import { sendResendEmail, transactionalSubject } from "@/lib/resend-mail";

type WelcomeEmailInput = {
  email: string;
  name: string;
  plan?: SignupPlan | string | null;
  stage: "signup" | "complete";
  programSlug?: string;
  userId?: string;
  /** Extra paragraph (e.g. duplicate apology). */
  note?: string;
};

function firstName(name: string, email: string) {
  const n = (name || email.split("@")[0] || "there").trim().split(/\s+/)[0];
  return n || "there";
}

export async function sendMemberWelcomeEmail(input: WelcomeEmailInput): Promise<boolean> {
  const base = appBaseUrl();
  const hi = firstName(input.name, input.email);
  const planLabel = signupPlanLabel(
    (input.plan || "explorer") as SignupPlan,
  );

  if (input.stage === "signup") {
    const onboardUrl = `${base}/member/onboard?plan=${encodeURIComponent(String(input.plan || "explorer"))}`;
    const text =
      `Hey ${hi},\n\n` +
      `You're in on ${planLabel} at ${BRAND_NAME}.\n\n` +
      (input.note ? `${input.note}\n\n` : "") +
      `Take a couple minutes and finish setup so we can get your workouts lined up.\n\n` +
      `Jeremy`;
    return sendResendEmail({
      to: input.email,
      subject: transactionalSubject("welcome"),
      text,
      ctaUrl: onboardUrl,
      ctaLabel: "Finish setup",
      tags: [{ name: "category", value: "welcome-signup" }],
    });
  }

  const programSlug = input.programSlug || "adult";
  const startUrl = `${base}${memberProgramStartPath(programSlug)}`;
  const bookUrl = `${base}/member/book`;
  const messagesUrl = `${base}/member/chat`;

  let changeUrl = COACH_CALENDLY_URL;
  let changeLabel = "Book a 15-min intro";
  try {
    const { getLatestMemberBooking } = await import("@/lib/booking");
    const booking = await getLatestMemberBooking(input.userId || "", input.email);
    const reschedule = booking?.calendlyRescheduleUrl?.trim();
    if (reschedule) {
      changeUrl = reschedule;
      changeLabel = "Change appointment";
    }
  } catch {
    /* keep Calendly new-meeting fallback */
  }

  const subject = `You're in. Start Day 1`;
  const text =
    `Hey ${hi},\n\n` +
    `Setup's done. You're in.\n\n` +
    `Start Day 1:\n${startUrl}\n\n` +
    `${changeLabel}:\n${changeUrl}\n` +
    (changeUrl === COACH_CALENDLY_URL ? `Or in the app: ${bookUrl}\n\n` : `\n`) +
    `Message me anytime:\n${messagesUrl}\n\n` +
    `${planLabel}\n\n` +
    `Jeremy\n` +
    `${base}`;

  return sendResendEmail({
    to: input.email,
    subject: transactionalSubject("welcome"),
    text,
    ctaUrl: changeUrl !== COACH_CALENDLY_URL ? changeUrl : startUrl,
    ctaLabel: changeUrl !== COACH_CALENDLY_URL ? "Change appointment" : "Start Day 1",
    tags: [{ name: "category", value: "welcome-complete" }],
  });
}

/** Send the signup welcome email once — after payment for paid plans. */
export async function sendWelcomeSignupIfNeeded(userId: string): Promise<boolean> {
  const profile = await getMemberProfile(userId);
  if (!profile?.email || profile.welcomeSignupEmailSentAt) return false;

  const accountRow = await getAccountByUserId(userId);
  const sent = await sendMemberWelcomeEmail({
    email: profile.email,
    name: accountRow?.account.name || profile.email,
    plan: profile.plan,
    stage: "signup",
  });
  if (sent) {
    await updateMemberProfile(userId, {
      welcomeSignupEmailSentAt: new Date().toISOString(),
    });
  }
  return sent;
}