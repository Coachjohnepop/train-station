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
  profile: Pick<
    MemberProfile,
    | "plan"
    | "paymentStatus"
    | "onboardingComplete"
    | "paymentMethod"
    | "staffGrantExpiresAt"
    | "staffGrantedAt"
  > | null,
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
  if ((profile?.paymentStatus ?? "pending") !== "paid") return true;

  // Manual staff grants expire monthly (1st) until reapproved.
  if (
    profile?.paymentMethod === "manual" &&
    profile.staffGrantExpiresAt &&
    new Date(profile.staffGrantExpiresAt).getTime() <= Date.now()
  ) {
    return true;
  }
  return false;
}

/** Free Explorer already has a card saved ($0 setup) — not the same as paid. */
export function freeMemberHasCardOnFile(
  profile: Pick<MemberProfile, "paymentMethod" | "paymentStatus" | "stripeCustomerId"> | null,
): boolean {
  if (!profile) return false;
  if (profile.paymentMethod === "card_on_file") return true;
  // Paid stripe/venmo also implies a rail exists (upgrade path).
  if (profile.paymentStatus === "paid" && profile.paymentMethod === "stripe") return true;
  return false;
}

/**
 * Free Explorer must complete card-on-file when admin lever is ON.
 * Sync path: only uses profile stamp (card_on_file). Prefer async for Stripe live check.
 */
export function memberNeedsFreePaymentMethod(
  profile: Pick<
    MemberProfile,
    "plan" | "paymentMethod" | "paymentStatus" | "stripeCustomerId"
  > | null,
  userId: string,
  freeRequiresPaymentMethod: boolean,
): boolean {
  if (!freeRequiresPaymentMethod) return false;
  if (!isSelfRegisteredMember(userId)) return false;
  if (!isStripePaymentsEnabled()) return false;
  const plan = profile?.plan ?? "explorer";
  if (isPaidSignupPlan(plan)) return false;
  if (freeMemberHasCardOnFile(profile)) return false;
  return true;
}

/**
 * Async Free card gate: respects lever + Stripe customer payment methods.
 * Staff manual grants on free (rare) skip via paymentMethod manual + paid.
 */
export async function memberNeedsFreePaymentMethodAsync(
  profile: Pick<
    MemberProfile,
    "plan" | "paymentMethod" | "paymentStatus" | "stripeCustomerId"
  > | null,
  userId: string,
): Promise<boolean> {
  try {
    const { getGamificationLevers } = await import("@/lib/gamification-config-store");
    const levers = await getGamificationLevers();
    if (!levers.freeRequiresPaymentMethod) return false;
    if (!memberNeedsFreePaymentMethod(profile, userId, true)) return false;
    // Live Stripe check: card may exist without profile stamp (race / legacy).
    if (profile?.stripeCustomerId) {
      const { customerHasSavedPaymentMethod } = await import("@/lib/stripe-customer");
      const has = await customerHasSavedPaymentMethod(profile.stripeCustomerId);
      if (has) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Same as memberNeedsPayment, but claimed free-week promos grant access without a
 * paid Stripe/Venmo stamp (product access only — not money).
 */
export async function memberNeedsPaymentAsync(
  profile: Pick<
    MemberProfile,
    | "plan"
    | "paymentStatus"
    | "onboardingComplete"
    | "paymentMethod"
    | "staffGrantExpiresAt"
    | "staffGrantedAt"
  > | null,
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
  memberFreePaymentSetupPath,
  MEMBER_PENDING_PATH,
  MEMBER_PATHS_EXEMPT_FROM_PAYMENT_GATE,
  isMemberPathExemptFromPaymentGate,
  memberPathRequiresPayment,
} from "@/lib/member-route-gates";