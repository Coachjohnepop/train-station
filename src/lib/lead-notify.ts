/**
 * New-lead email notification (Resend).
 *
 * Stopgap so no pre-sign-up is lost while durable DB storage is being set up:
 * every captured lead emails the team. Safe to ship un-configured — if
 * RESEND_API_KEY or LEAD_NOTIFY_EMAIL is missing it just logs and returns,
 * so it never breaks the signup flow.
 *
 * Env:
 * - RESEND_API_KEY      Resend API key
 * - LEAD_NOTIFY_EMAIL   comma-separated recipients (where leads are emailed)
 * - LEAD_NOTIFY_FROM    verified sender; defaults to Resend's shared test
 *                       sender (only delivers to your Resend account email
 *                       until you verify a domain)
 */

const FROM =
  process.env.LEAD_NOTIFY_FROM || "Train Station Leads <onboarding@resend.dev>";

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
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || RECIPIENTS.length === 0) {
    console.log(
      `[LEAD] new pre-sign-up: ${lead.name || "Guest"} <${lead.email}>` +
        ` (email notify not configured — set RESEND_API_KEY + LEAD_NOTIFY_EMAIL)`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: RECIPIENTS,
        subject: `New lead: ${lead.name || "Guest"} (${lead.email})`,
        text:
          `New pre-sign-up from the landing page\n\n` +
          `Name:    ${lead.name || "Guest"}\n` +
          `Email:   ${lead.email}\n` +
          `Phone:   ${lead.phone || "—"}\n` +
          `Interest: ${lead.plan || "—"}\n` +
          `Source:  ${lead.source || "—"}\n` +
          `When:    ${lead.createdAt || new Date().toISOString()}\n`,
      }),
    });
    if (!res.ok) {
      console.error(`[LEAD] Resend send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    // Never let a notification failure break the signup.
    console.error("[LEAD] notify error:", err);
  }
}
