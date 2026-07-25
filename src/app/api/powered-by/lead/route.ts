import { NextResponse } from "next/server";
import { z } from "zod";
import { addToWaitlist } from "@/lib/waitlist";
import { notifyNewLead } from "@/lib/lead-notify";
import { sendResendEmail } from "@/lib/resend-mail";
import { BRAND_NAME } from "@/lib/brand";

const schema = z.object({
  companyName: z.string().min(1).max(120),
  contactName: z.string().min(1).max(80),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  modules: z.array(z.string().max(80)).max(20).optional().default([]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in company, contact name, and a valid email." },
      { status: 400 },
    );
  }

  const { companyName, contactName, email, phone, about, modules } = parsed.data;
  const nameParts = contactName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || contactName;
  const lastName = nameParts.slice(1).join(" ") || null;

  const entry = await addToWaitlist({
    email: email.trim().toLowerCase(),
    firstName,
    lastName,
    phone: phone?.trim() || null,
    plan: null,
    source: `powered-by:${companyName.trim().slice(0, 80)}`,
  });

  const moduleLine =
    modules && modules.length ? modules.join(", ") : "(none selected)";

  await notifyNewLead({
    email: entry.email,
    name: entry.name,
    phone: entry.phone,
    plan: null,
    source: `powered-by · ${companyName.trim()}`,
    createdAt: entry.createdAt,
  });

  // Richer note to lead recipients (and durable via Resend → OutboundNotification)
  const leadTo = (process.env.LEAD_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (leadTo.length && process.env.RESEND_API_KEY) {
    await sendResendEmail({
      to: leadTo,
      subject: `Platform interest: ${companyName.trim()} (${entry.email})`,
      text:
        `Someone wants the platform behind ${BRAND_NAME}.\n\n` +
        `Company:  ${companyName.trim()}\n` +
        `Contact:  ${contactName.trim()}\n` +
        `Email:    ${entry.email}\n` +
        `Phone:    ${phone?.trim() || "—"}\n` +
        `Modules:  ${moduleLine}\n\n` +
        `About:\n${(about || "—").trim()}\n\n` +
        `Source: powered-by page · ${entry.createdAt}\n`,
      tags: [{ name: "category", value: "powered-by-lead" }],
    });
  }

  return NextResponse.json({ ok: true, id: entry.id });
}
