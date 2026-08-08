import { isSignupPlan, normalizeSignupPlan } from "@/lib/signup-plans";

export function memberCheckoutPath(plan?: string): string {
  const normalized = plan ? normalizeSignupPlan(plan) : null;
  const params = new URLSearchParams();
  if (normalized && isSignupPlan(normalized)) params.set("plan", normalized);
  const qs = params.toString();
  return qs ? `/member/checkout?${qs}` : "/member/checkout";
}

/** Free Explorer card-on-file setup ($0 Stripe Setup). */
export function memberFreePaymentSetupPath(): string {
  return "/member/payment-setup";
}

export const MEMBER_PENDING_PATH = "/member/pending";

/** Member routes reachable before first payment (coach contact, billing, intake booking). */
export const MEMBER_PATHS_EXEMPT_FROM_PAYMENT_GATE = [
  "/member/checkout",
  "/member/payment-setup",
  "/member/onboard",
  "/member/account",
  "/member/book",
  "/member/chat",
  "/member/pending",
  "/member/speaking",
  "/member/quote-received",
] as const;

export function isMemberPathExemptFromPaymentGate(pathname: string): boolean {
  return MEMBER_PATHS_EXEMPT_FROM_PAYMENT_GATE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function memberPathRequiresPayment(pathname: string): boolean {
  if (!pathname.startsWith("/member")) return false;
  return !isMemberPathExemptFromPaymentGate(pathname);
}