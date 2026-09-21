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

export type BusinessUpgradeQueuePlace = {
  position: number;
  size: number;
  ahead: number;
};

/** 1 → 1st, 2 → 2nd, 3 → 3rd, 11 → 11th (Delta-style list place). */
export function ordinalPlace(n: number): string {
  const v = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1));
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}

export function businessUpgradeQueuePlace(
  position: number,
  size: number,
): BusinessUpgradeQueuePlace {
  const pos = Math.max(1, Math.floor(position));
  const sz = Math.max(pos, Math.floor(size) || pos);
  return { position: pos, size: sz, ahead: Math.max(0, pos - 1) };
}

export function sortBusinessUpgradeQueue<
  T extends { userId: string; requestedAt: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const at = a.requestedAt || "";
    const bt = b.requestedAt || "";
    if (at !== bt) return at.localeCompare(bt);
    return a.userId.localeCompare(b.userId);
  });
}

export function placeInBusinessUpgradeQueue(
  queue: { userId: string }[],
  userId: string,
): BusinessUpgradeQueuePlace | null {
  const idx = queue.findIndex((row) => row.userId === userId);
  if (idx < 0) return null;
  return businessUpgradeQueuePlace(idx + 1, queue.length);
}

export function businessUpgradeQueueHeadline(place: BusinessUpgradeQueuePlace): string {
  return `You're ${ordinalPlace(place.position)} on the upgrade list`;
}

export function businessUpgradeQueueDetail(place: BusinessUpgradeQueuePlace): string {
  if (place.ahead === 0) {
    return place.size <= 1
      ? "No one ahead of you — you're first in line for a Business Class seat."
      : `No one ahead of you · ${place.size} on the list.`;
  }
  if (place.ahead === 1) {
    return `1 request ahead of you · ${place.size} on the list.`;
  }
  return `${place.ahead} requests ahead of you · ${place.size} on the list.`;
}
