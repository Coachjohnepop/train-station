import "server-only";

import { BRAND_NAME, COACH_CALENDLY_URL } from "@/lib/brand";
import { sendResendEmail, transactionalSubject } from "@/lib/resend-mail";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";

function firstName(name: string | null | undefined, email: string) {
  const n = (name || email.split("@")[0] || "there").trim().split(/\s+/)[0];
  return n || "there";
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function recentlySentBookingConfirm(email: string): Promise<boolean> {
  if (isDemoMode()) return false;
  try {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const row = await prisma.outboundNotification.findFirst({
      where: {
        category: "booking-confirm",
        toAddress: email,
        createdAt: { gte: since },
        status: "sent",
      },
      select: { id: true },
    });
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function sendMemberIntroBookedEmail(input: {
  email: string;
  name?: string | null;
  scheduledAt?: string | null;
  rescheduleUrl?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (!email) return false;
  if (await recentlySentBookingConfirm(email)) return true;

  const hi = firstName(input.name, email);
  const when = formatWhen(input.scheduledAt);
  const changeUrl = input.rescheduleUrl?.trim() || COACH_CALENDLY_URL;
  const usingCalendlyReschedule = Boolean(input.rescheduleUrl?.trim());
  const whenLine = when ? `It's on the board for ${when} PT.\n\n` : "";
  const changeLine = usingCalendlyReschedule
    ? `Need a different time (like 7:30)? Change the appointment here:\n${changeUrl}\n`
    : `Need a different time? Pick another slot:\n${changeUrl}\n`;

  const text =
    `Hey ${hi},\n\n` +
    `You're booked with Jeremy.\n\n` +
    whenLine +
    changeLine +
    `\nJeremy`;

  return sendResendEmail({
    to: email,
    subject: transactionalSubject("intro booked"),
    text,
    ctaUrl: changeUrl,
    ctaLabel: usingCalendlyReschedule ? "Change appointment" : "Pick a time",
    tags: [{ name: "category", value: "booking-confirm" }],
  });
}

export function bookingChangeUrl(booking: {
  calendlyRescheduleUrl?: string | null;
} | null): string | null {
  const url = booking?.calendlyRescheduleUrl?.trim();
  return url || null;
}
