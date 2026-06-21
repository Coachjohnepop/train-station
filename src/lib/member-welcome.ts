import "server-only";

import { BRAND_NAME, COACH_CALENDLY_URL } from "@/lib/brand";
import { memberProgramStartPath } from "@/lib/member-destinations";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import { appBaseUrl } from "@/lib/sms";

const FROM =
  process.env.MEMBER_WELCOME_FROM ||
  process.env.LEAD_NOTIFY_FROM ||
  "The Train Station <onboarding@resend.dev>";

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

async function sendResendToMember(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[WELCOME EMAIL — not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error(`[WELCOME EMAIL] Resend failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WELCOME EMAIL] send error:", err);
    return false;
  }
}

export async function sendMemberWelcomeEmail(input: WelcomeEmailInput): Promise<boolean> {
  const base = appBaseUrl();
  const hi = firstName(input.name, input.email);
  const planLabel = signupPlanLabel(
    (input.plan || "explorer") as SignupPlan,
  );

  if (input.stage === "signup") {
    const onboardUrl = `${base}/member/onboard?plan=${encodeURIComponent(String(input.plan || "explorer"))}`;
    const subject = `Welcome to ${BRAND_NAME} — finish your setup`;
    const text =
      `Hi ${hi},\n\n` +
      `Thanks for joining ${BRAND_NAME} (${planLabel}).\n\n` +
      `Next step: complete your 2-minute setup so we can tailor workouts and daily texts:\n` +
      `${onboardUrl}\n\n` +
      `— Coach Jeremy\n` +
      `${base}`;
    return sendResendToMember(input.email, subject, text);
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

  return sendResendToMember(input.email, subject, text);
}