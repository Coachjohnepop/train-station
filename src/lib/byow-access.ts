import type { SessionUser } from "@/lib/auth-session";

export const BYOW_COOKIE = "ts_byow";

export function isByowProfile(profile: { paymentNote?: string | null } | null | undefined): boolean {
  return (profile?.paymentNote || "").trim().toLowerCase() === "byow";
}

/** John-only BYOW desk. Jeremy (INSTRUCTOR) does not see this library. */
export function canAccessByowAdmin(session: { role: string; email?: string | null } | null): boolean {
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  const email = session.email?.trim().toLowerCase() || "";
  return email === "john@thetrainstation.co" || email === "john@lemonvoice.com";
}

export function canUseByowUpload(session: SessionUser | null): boolean {
  if (!session) return false;
  return session.role === "MEMBER" || session.role === "ADMIN" || session.role === "INSTRUCTOR";
}
