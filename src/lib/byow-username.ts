/** Auto-minted names from See the program → Let’s begin. */
export const GUEST_EMAIL_DOMAIN = "guest.thetrainstation.co";

export function isPlaceholderGuestUsername(name: string | null | undefined): boolean {
  return /^Guest[a-z0-9]{6,}$/i.test((name || "").trim());
}

export function isGuestStubEmail(email: string | null | undefined): boolean {
  return (email || "").toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

const USE_DAYS_COOKIE = "ts-guest-use-days";
export const GUEST_SAVE_AFTER_DAYS = 2;

export function pacificTodayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function recordGuestUseDay(): string[] {
  if (typeof document === "undefined") return [];
  const today = pacificTodayIso();
  const raw = readCookie(USE_DAYS_COOKIE);
  const days = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  days.add(today);
  const list = [...days].sort();
  document.cookie = `${USE_DAYS_COOKIE}=${list.join(",")}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  return list;
}

export function guestUseDayCount(): number {
  return recordGuestUseDay().length;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const hit = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}
