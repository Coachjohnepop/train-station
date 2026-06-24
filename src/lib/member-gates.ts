import "server-only";

import type { MemberProfile } from "@/lib/member-profiles-store";
import type { SignupPlan } from "@/lib/signup-plans";
import { isSignupPlan } from "@/lib/signup-plans";
import { isSecurityEnforced, stripeRequiredInProduction } from "@/lib/security-config";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "none" | "pending" | "paid" | "failed";

export const APPROVAL_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["none", "pending", "paid", "failed"];

export function isMemberApprovalRequired(): boolean {
  return process.env.REQUIRE_MEMBER_APPROVAL === "true";
}

export function isStripePaymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripeAutoApproveOnPay(): boolean {
  return process.env.STRIPE_AUTO_APPROVE === "true";
}

export function isPaidSignupPlan(plan: SignupPlan): boolean {
  return plan === "member" || plan === "pro";
}

/** Self-registered via ticket signup (blob store), not seeded demo/coach accounts. */
export function isSelfRegisteredMember(userId: string): boolean {
  return userId.startsWith("member-");
}

export function defaultApprovalStatus(): ApprovalStatus {
  return isMemberApprovalRequired() ? "pending" : "approved";
}

export function defaultPaymentStatus(plan: SignupPlan): PaymentStatus {
  if (!isPaidSignupPlan(plan)) return "none";
  if (!isStripePaymentsEnabled()) {
    if (stripeRequiredInProduction() || isSecurityEnforced()) return "pending";
    return "paid";
  }
  return "pending";
}

export function normalizeApprovalStatus(raw: unknown): ApprovalStatus {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "approved" || v === "rejected" || v === "pending") return v;
  // Legacy profiles without a stored status stay approved.
  return "approved";
}

export function normalizePaymentStatus(raw: unknown, plan?: SignupPlan): PaymentStatus {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "paid" || v === "pending" || v === "failed" || v === "none") return v;
  if (!plan || !isPaidSignupPlan(plan)) return "none";
  if (isSecurityEnforced()) return "pending";
  return "paid";
}

export function memberNeedsPayment(
  profile: Pick<MemberProfile, "plan" | "paymentStatus"> | null,
  userId: string,
): boolean {
  if (!isSelfRegisteredMember(userId)) return false;
  if (!isStripePaymentsEnabled()) {
    if (!stripeRequiredInProduction()) return false;
  }
  const plan = profile?.plan ?? "explorer";
  if (!isPaidSignupPlan(plan)) return false;
  return (profile?.paymentStatus ?? "pending") !== "paid";
}

export function memberNeedsApproval(
  profile: Pick<MemberProfile, "approvalStatus" | "onboardingComplete"> | null,
  userId: string,
): boolean {
  if (!isSelfRegisteredMember(userId)) return false;
  if (!isMemberApprovalRequired()) return false;
  if (!profile?.onboardingComplete) return false;
  return profile.approvalStatus === "pending";
}

export function memberHasFullAccess(profile: MemberProfile | null, userId: string): boolean {
  if (!isSelfRegisteredMember(userId)) return true;
  if (memberNeedsPayment(profile, userId)) return false;
  if (profile?.approvalStatus === "rejected") return false;
  if (memberNeedsApproval(profile, userId)) return false;
  return true;
}

export function memberCheckoutPath(plan?: string): string {
  const params = new URLSearchParams();
  if (plan && isSignupPlan(plan)) params.set("plan", plan);
  const qs = params.toString();
  return qs ? `/member/checkout?${qs}` : "/member/checkout";
}

export const MEMBER_PENDING_PATH = "/member/pending";