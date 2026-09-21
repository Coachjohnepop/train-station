import "server-only";

import { BRAND_NAME } from "@/lib/brand";
import { memberDisplayNameFromEmail } from "@/lib/business-upgrade";
import { sendResendEmail } from "@/lib/resend-mail";
import { signupPlanLabel } from "@/lib/signup-plans";
import { staffGrantNotifyEmails } from "@/lib/staff-grants";

export {
  appendPaymentNote,
  BUSINESS_UPGRADE_REQUEST_COPY,
  BUSINESS_UPGRADE_STATUSES,
  canRequestBusinessClassUpgrade,
  isBusinessUpgradePending,
  memberDisplayNameFromEmail,
  normalizeBusinessUpgradeStatus,
  type BusinessUpgradeStatus,
} from "@/lib/business-upgrade";

export type BusinessUpgradeNotifyEvent = "requested" | "approved" | "declined";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

export async function notifyBusinessUpgradeAdmins(params: {
  event: BusinessUpgradeNotifyEvent;
  memberName: string;
  memberEmail: string;
  actorEmail?: string | null;
  hasStripeSubscription: boolean;
  note?: string | null;
  extraLines?: string[];
}): Promise<{ sent: number; failed: number }> {
  const emails = staffGrantNotifyEmails();
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const membersUrl = `${appBaseUrl()}/admin/members`;
  const eventTitle =
    params.event === "requested"
      ? "Business Class upgrade requested"
      : params.event === "approved"
        ? "Business Class upgrade approved"
        : "Business Class upgrade declined";

  const lines = [
    eventTitle,
    "",
    `Member: ${params.memberName} <${params.memberEmail}>`,
    `From: ${signupPlanLabel("member")} → ${signupPlanLabel("business")}`,
    params.hasStripeSubscription
      ? "Stripe subscription: on file. Approval does not change the price."
      : "Stripe subscription: none on file. Approval stamps the seat only.",
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
      subject: `${eventTitle} · ${params.memberName} · ${BRAND_NAME}`,
      text,
      ctaUrl: membersUrl,
      ctaLabel: "Open Admin Members",
      tags: [
        { name: "category", value: "business-upgrade" },
        { name: "event", value: params.event },
      ],
    });
    if (ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

export function memberDisplayName(
  email: string,
  accountName?: string | null,
): string {
  return memberDisplayNameFromEmail(email, accountName);
}
