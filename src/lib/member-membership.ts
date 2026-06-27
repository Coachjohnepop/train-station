import "server-only";

import { getMemberProfile, type MemberProfile } from "@/lib/member-profiles-store";
import { isPaidSignupPlan, isStripePaymentsEnabled } from "@/lib/member-gates";
import { getEffectiveMembershipOffer } from "@/lib/pricing-catalog";
import { getOfferDefinition } from "@/lib/product-offers";
import { customerHasSavedPaymentMethod } from "@/lib/stripe-customer";
import {
  signupPlanLabel,
  type MembershipPlan,
  type SignupPlan,
} from "@/lib/signup-plans";

const MEMBERSHIP_PLANS = new Set<MembershipPlan>(["explorer", "member", "business", "pro"]);

export type MemberMembershipSnapshot = {
  plan: SignupPlan;
  planLabel: string;
  priceDisplay: string | null;
  checkoutMode: string | null;
  paymentStatus: MemberProfile["paymentStatus"];
  paymentMethod: MemberProfile["paymentMethod"];
  paidAt: string | null;
  approvalStatus: MemberProfile["approvalStatus"];
  referralCode: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  canManageBilling: boolean;
  canCompleteCheckout: boolean;
  hasSavedPaymentMethod: boolean;
  switchablePlans: SignupPlan[];
  intensive: {
    sessionsTotal: number | null;
    sessionsRemaining: number | null;
    expiresAt: string | null;
  } | null;
};

function paymentStatusLabel(status: MemberProfile["paymentStatus"]): string {
  switch (status) {
    case "paid":
      return "Active";
    case "pending":
      return "Payment pending";
    case "failed":
      return "Payment failed";
    default:
      return "No payment required";
  }
}

export async function getMemberMembershipSnapshot(
  userId: string,
): Promise<MemberMembershipSnapshot | null> {
  const profile = await getMemberProfile(userId);
  if (!profile) return null;

  const plan = profile.plan;
  const offer = getOfferDefinition(plan);
  const effective =
    MEMBERSHIP_PLANS.has(plan as MembershipPlan) && plan !== "explorer"
      ? await getEffectiveMembershipOffer(plan as MembershipPlan)
      : null;

  const isSubscription = offer?.checkoutMode === "subscription";
  const stripeReady = isStripePaymentsEnabled();
  const hasSavedPaymentMethod = profile.stripeCustomerId
    ? await customerHasSavedPaymentMethod(profile.stripeCustomerId)
    : false;

  const switchablePlans: SignupPlan[] =
    profile.paymentStatus === "paid" && profile.stripeSubscriptionId
      ? (["member", "business"] as SignupPlan[]).filter((candidate) => candidate !== plan)
      : [];

  return {
    plan,
    planLabel: signupPlanLabel(plan),
    priceDisplay: effective?.priceDisplay ?? offer?.priceLabel ?? null,
    checkoutMode: offer?.checkoutMode ?? null,
    paymentStatus: profile.paymentStatus,
    paymentMethod: profile.paymentMethod,
    paidAt: profile.paidAt,
    approvalStatus: profile.approvalStatus,
    referralCode: profile.referralCode,
    stripeCustomerId: profile.stripeCustomerId,
    stripeSubscriptionId: profile.stripeSubscriptionId,
    canManageBilling: Boolean(
      stripeReady &&
        profile.paymentMethod === "stripe" &&
        profile.stripeCustomerId &&
        (isSubscription || profile.stripeSubscriptionId),
    ),
    canCompleteCheckout: Boolean(
      isPaidSignupPlan(plan) && profile.paymentStatus !== "paid" && stripeReady,
    ),
    hasSavedPaymentMethod,
    switchablePlans,
    intensive:
      plan === "pro" && profile.intensiveSessionsTotal
        ? {
            sessionsTotal: profile.intensiveSessionsTotal,
            sessionsRemaining: profile.intensiveSessionsRemaining,
            expiresAt: profile.intensiveExpiresAt,
          }
        : null,
  };
}

export function formatMembershipPaymentStatus(snapshot: MemberMembershipSnapshot): string {
  return paymentStatusLabel(snapshot.paymentStatus);
}