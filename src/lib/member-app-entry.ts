/**
 * Edge-safe member entry paths + landing isolation.
 * Cookie-only helpers for middleware. DB-backed resolve lives in member-app-entry-server.
 */
import {
  MEMBER_PENDING_PATH,
  memberCheckoutPath,
  memberFreePaymentSetupPath,
} from "@/lib/member-route-gates";

export type MemberGateCookieSnapshot = {
  needsPayment: boolean;
  needsFreePm: boolean;
  needsOnboard: boolean;
  pendingApproval: boolean;
  plan?: string | null;
};

export function memberOnboardEntryPath(plan?: string | null): string {
  if (!plan) return "/member/onboard";
  return `/member/onboard?plan=${encodeURIComponent(plan)}`;
}

export function memberTodayEntryPath(): string {
  return "/member/today";
}

/** Edge / middleware: cookie-only entry (no DB). Prefer sync-gates to keep cookies honest. */
export function memberAppEntryFromGateCookies(
  cookies: MemberGateCookieSnapshot,
): string {
  const plan = cookies.plan || undefined;
  if (cookies.needsPayment) {
    return memberCheckoutPath(plan);
  }
  if (cookies.needsFreePm) {
    return memberFreePaymentSetupPath();
  }
  if (cookies.needsOnboard) {
    return memberOnboardEntryPath(plan);
  }
  if (cookies.pendingApproval) {
    return MEMBER_PENDING_PATH;
  }
  return memberTodayEntryPath();
}

/** Marketing / cold-traffic routes signed-in members should not linger on. */
export function isMemberLandingSidePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/join" || pathname.startsWith("/join/")) return true;
  if (pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")) return true;
  if (pathname === "/landing" || pathname.startsWith("/landing/")) return true;
  return false;
}
