import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { localTodayIso } from "@/lib/program-calendar";
import { sendResendEmail } from "@/lib/resend-mail";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import type { MemberProfile } from "@/lib/member-profiles-types";

/** John + Jeremy by default; override with STAFF_GRANT_NOTIFY_EMAILS=a@x,b@y */
export function staffGrantNotifyEmails(): string[] {
  const raw =
    process.env.STAFF_GRANT_NOTIFY_EMAILS?.trim() ||
    "john@thetrainstation.co,jeremy@thetrainstation.co";
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

/**
 * Staff grants expire at the start of the next calendar month (app TZ).
 * Admins reapprove on/after the 1st via Admin → Members.
 */
export function nextStaffGrantExpiryIso(from = new Date()): string {
  const todayIso = localTodayIso(from);
  const [ys, ms] = todayIso.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  // Noon UTC on the 1st avoids edge TZ flips for the civil date.
  return new Date(Date.UTC(nextY, nextM - 1, 1, 12, 0, 0)).toISOString();
}

export function isStaffGrantActive(
  profile: Pick<
    MemberProfile,
    "paymentMethod" | "paymentStatus" | "staffGrantExpiresAt" | "staffGrantedAt"
  > | null,
  now = new Date(),
): boolean {
  if (!profile) return false;
  if (profile.paymentMethod !== "manual") return false;
  if (!profile.staffGrantedAt && !profile.staffGrantExpiresAt) {
    // Legacy manual paid without expiry fields — treat as grant until migrated.
    return profile.paymentStatus === "paid";
  }
  if (!profile.staffGrantExpiresAt) return profile.paymentStatus === "paid";
  return new Date(profile.staffGrantExpiresAt).getTime() > now.getTime();
}

/** True when this paid access came from staff grant and the calendar period ended. */
export function isStaffGrantExpired(
  profile: Pick<MemberProfile, "paymentMethod" | "staffGrantExpiresAt" | "staffGrantedAt"> | null,
  now = new Date(),
): boolean {
  if (!profile) return false;
  if (profile.paymentMethod !== "manual") return false;
  if (!profile.staffGrantExpiresAt) return false;
  return new Date(profile.staffGrantExpiresAt).getTime() <= now.getTime();
}

export type StaffGrantEvent =
  | "granted"
  | "reapproved"
  | "expired"
  | "reminder";

export async function notifyStaffGrantAdmins(params: {
  event: StaffGrantEvent;
  memberName: string;
  memberEmail: string;
  plan: SignupPlan | string;
  expiresAt?: string | null;
  note?: string | null;
  actorEmail?: string | null;
  extraLines?: string[];
}): Promise<{ sent: number; failed: number }> {
  const emails = staffGrantNotifyEmails();
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const planLabel = signupPlanLabel(params.plan as SignupPlan);
  const membersUrl = `${appBaseUrl()}/admin/members`;
  const eventTitle =
    params.event === "granted"
      ? "Staff grant applied"
      : params.event === "reapproved"
        ? "Staff grant reapproved"
        : params.event === "expired"
          ? "Staff grant expired — reapprove needed"
          : "Staff grant reminder";

  const lines = [
    eventTitle,
    "",
    `Member: ${params.memberName} <${params.memberEmail}>`,
    `Plan: ${planLabel}`,
    params.expiresAt
      ? `Valid through: ${new Date(params.expiresAt).toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          dateStyle: "medium",
          timeStyle: "short",
        })} (reapprove on the 1st)`
      : null,
    params.actorEmail ? `By: ${params.actorEmail}` : null,
    params.note ? `Note: ${params.note}` : null,
    ...(params.extraLines || []),
    "",
    `Open Members: ${membersUrl}`,
  ].filter(Boolean) as string[];

  const text = lines.join("\n");
  let sent = 0;
  let failed = 0;
  for (const to of emails) {
    const ok = await sendResendEmail({
      to,
      subject: `${eventTitle} · ${params.memberName} — ${BRAND_NAME}`,
      text,
      ctaUrl: membersUrl,
      ctaLabel: "Open Admin Members",
      tags: [
        { name: "category", value: "staff-grant" },
        { name: "event", value: params.event },
      ],
    });
    if (ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
