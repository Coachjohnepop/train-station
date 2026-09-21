export const BUSINESS_UPGRADE_STATUSES = ["pending", "approved", "declined"] as const;
export type BusinessUpgradeStatus = (typeof BUSINESS_UPGRADE_STATUSES)[number];

export const BUSINESS_UPGRADE_REQUEST_COPY =
  "Like to join Live Zooms? Request Upgrade to Business Class";

export function normalizeBusinessUpgradeStatus(
  raw: string | null | undefined,
): BusinessUpgradeStatus | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "pending" || v === "approved" || v === "declined") return v;
  return null;
}

/** Paid Coach Class who has not already requested or been approved. */
export function canRequestBusinessClassUpgrade(profile: {
  plan: string | null | undefined;
  paymentStatus: string | null | undefined;
  businessUpgradeStatus?: string | null;
}): boolean {
  if (profile.plan !== "member") return false;
  if (profile.paymentStatus !== "paid") return false;
  const status = normalizeBusinessUpgradeStatus(profile.businessUpgradeStatus);
  if (status === "pending" || status === "approved") return false;
  return true;
}

export function isBusinessUpgradePending(profile: {
  plan?: string | null;
  businessUpgradeStatus?: string | null;
}): boolean {
  return (
    profile.plan === "member" &&
    normalizeBusinessUpgradeStatus(profile.businessUpgradeStatus) === "pending"
  );
}

export function appendPaymentNote(existing: string | null | undefined, line: string): string {
  const next = line.trim();
  if (!next) return existing?.trim() || "";
  const current = existing?.trim() || "";
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current}\n${next}`;
}

export function memberDisplayNameFromEmail(
  email: string,
  accountName?: string | null,
): string {
  const name = accountName?.trim();
  if (name) return name;
  return email.split("@")[0] || email;
}
