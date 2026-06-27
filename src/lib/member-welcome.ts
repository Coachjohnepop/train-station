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
      `Hi ${hi},\n\n` +
      `Thanks for joining ${BRAND_NAME} (${planLabel}).\n\n` +
      `Next step: complete your 2-minute setup so we can tailor workouts and coach messages.\n\n` +
      `— Coach Jeremy`;
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

  const subject = `You're in — start Day 1 with Coach Jeremy`;
  const text =
    `Hi ${hi},\n\n` +
    `Welcome to ${BRAND_NAME}! Your setup is complete.\n\n` +
    `Start Day 1:\n${startUrl}\n\n` +
    `Book your 15-min intro call (Zoom via Calendly):\n${bookUrl}\n` +
    `Or open Calendly directly: ${COACH_CALENDLY_URL}\n\n` +
    `Message your coach anytime:\n${messagesUrl}\n\n` +
    `Plan: ${planLabel}\n\n` +
    `— Coach Jeremy\n` +
    `${base}`;

  return sendResendEmail({
    to: input.email,
    subject: transactionalSubject("welcome"),
    text,
    ctaUrl: startUrl,
    ctaLabel: "Start Day 1",
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