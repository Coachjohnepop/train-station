import { sendResendEmail } from "@/lib/resend-mail";

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

export async function notifyNewLead(lead: Lead): Promise<void> {
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
      replyTo: process.env.LEAD_NOTIFY_REPLY_TO?.trim() || process.env.COACH_NOTIFY_EMAIL?.trim(),
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