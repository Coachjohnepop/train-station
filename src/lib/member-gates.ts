import "server-only";

import type { MemberProfile } from "@/lib/member-profiles-store";
import type { SignupPlan } from "@/lib/signup-plans";
import { isPaidOffer } from "@/lib/product-offers";
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
  return isPaidOffer(plan);
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
  profile: Pick<MemberProfile, "plan" | "paymentStatus" | "onboardingComplete"> | null,
  userId: string,
): boolean {
  // Payment is independent of onboarding. Members may complete profile setup while
  // still unpaid (onboard/chat/book stay open), but training routes stay gated
  // until paymentStatus === "paid". Do NOT clear the payment gate when
  // onboardingComplete flips true — that previously unlocked Today for free.
  // Prefer memberNeedsPaymentAsync when free-week promos should also unlock.
  if (!isSelfRegisteredMember(userId)) return false;
  if (!isStripePaymentsEnabled()) {
    if (!stripeRequiredInProduction()) return false;
  }
  const plan = profile?.plan ?? "explorer";
  if (!isPaidSignupPlan(plan)) return false;
  return (profile?.paymentStatus ?? "pending") !== "paid";
}

/**
 * Same as memberNeedsPayment, but claimed free-week promos grant access without a
 * paid Stripe/Venmo stamp (product access only — not money).
 */
export async function memberNeedsPaymentAsync(
  profile: Pick<MemberProfile, "plan" | "paymentStatus" | "onboardingComplete"> | null,
  userId: string,
): Promise<boolean> {
  if (!memberNeedsPayment(profile, userId)) return false;
  try {
    const { getActiveAccessOverride } = await import("@/lib/gamification-promos");
    const override = await getActiveAccessOverride(userId);
    if (override) return false;
  } catch {
    /* keep payment gate */
  }
  return true;
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

/** Full access including free-week promo override. Use on server request paths. */
export async function memberHasFullAccessAsync(
  profile: MemberProfile | null,
  userId: string,
): Promise<boolean> {
  if (!isSelfRegisteredMember(userId)) return true;
  if (await memberNeedsPaymentAsync(profile, userId)) return false;
  if (profile?.approvalStatus === "rejected") return false;
  if (memberNeedsApproval(profile, userId)) return false;
  return true;
}

export {
  memberCheckoutPath,
  MEMBER_PENDING_PATH,
  MEMBER_PATHS_EXEMPT_FROM_PAYMENT_GATE,
  isMemberPathExemptFromPaymentGate,
  memberPathRequiresPayment,
} from "@/lib/member-route-gates";