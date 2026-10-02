import { BRAND_NAME } from "@/lib/brand";
import { firstEmailAddress, sendResendEmail, transactionalSubject } from "@/lib/resend-mail";
import { appBaseUrl } from "@/lib/sms";

/**
 * New-lead email notification (Resend).
 */

const RECIPIENTS = (process.env.LEAD_NOTIFY_EMAIL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type Lead = {
  email: string;
  name?: string | null;
  phone?: string | null;
  plan?: string | null;
  source?: string | null;
  createdAt?: string;
};

/** Signup already emails via notifyCoachNewSignup — don't double. */
const SKIP_LEAD_EMAIL_SOURCES = new Set([
  "signup-register",
  "byow-signup",
  "signup",
]);

export async function notifyNewLead(lead: Lead): Promise<void> {
  const source = (lead.source || "").trim();
  if (SKIP_LEAD_EMAIL_SOURCES.has(source) || source.startsWith("quote:")) {
    return;
  }
  if (!process.env.RESEND_API_KEY || RECIPIENTS.length === 0) {
    console.log(
      `[LEAD] new pre-sign-up: ${lead.name || "Guest"} <${lead.email}>` +
        ` (email notify not configured — set RESEND_API_KEY + LEAD_NOTIFY_EMAIL)`
    );
    return;
  }

  try {
    const ok = await sendResendEmail({
      to: RECIPIENTS,
      replyTo:
        firstEmailAddress(process.env.LEAD_NOTIFY_REPLY_TO) ||
        firstEmailAddress(process.env.COACH_NOTIFY_EMAIL),
      subject: `New ${lead.source?.includes("signup") ? "signup" : "lead"}: ${lead.name || "Guest"} (${lead.email})`,
      text:
        `New ${lead.source?.includes("signup") ? "member signup" : "lead"}\n\n` +
        `Name:    ${lead.name || "Guest"}\n` +
        `Email:   ${lead.email}\n` +
        `Phone:   ${lead.phone || "—"}\n` +
        `Plan:    ${lead.plan || "—"}\n` +
        `Source:  ${lead.source || "—"}\n` +
        `When:    ${lead.createdAt || new Date().toISOString()}\n`,
      tags: [{ name: "category", value: "lead" }],
    });
    if (!ok) {
      console.error("[LEAD] Resend send failed");
    }
  } catch (err) {
    console.error("[LEAD] notify error:", err);
  }
}

function leadFirstName(name?: string | null, email?: string) {
  const fromName = (name || "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = (email || "").split("@")[0];
  return fromEmail || "there";
}

export function leadJoinUrl(): string {
  return `${appBaseUrl().replace(/\/$/, "")}/join#tickets`;
}

/** Coach convert action: email the public join link. */
export async function sendLeadJoinLinkEmail(lead: {
  email: string;
  name?: string | null;
}): Promise<boolean> {
  const hi = leadFirstName(lead.name, lead.email);
  const joinUrl = leadJoinUrl();
  const text =
    `Hey ${hi},\n\n` +
    `Jeremy here — ready when you are.\n\n` +
    `Pick your ticket and get on the floor:\n${joinUrl}\n\n` +
    `Jeremy\n` +
    `${BRAND_NAME}`;

  return sendResendEmail({
    to: lead.email,
    subject: transactionalSubject("join-link"),
    text,
    ctaUrl: joinUrl,
    ctaLabel: `Join ${BRAND_NAME}`,
    tags: [{ name: "category", value: "lead-join-link" }],
  });
}