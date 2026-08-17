import "server-only";

import { getLatestPaidPaymentFact } from "@/lib/analytics-facts";
import { getMemberProfile, type MemberProfile } from "@/lib/member-profiles-store";
import { isPaidSignupPlan, isStripePaymentsEnabled } from "@/lib/member-gates";
import { getEffectiveMembershipOffer } from "@/lib/pricing-catalog";
import { getOfferDefinition } from "@/lib/product-offers";
import {
  customerHasSavedPaymentMethod,
  repairMemberStripeBillingState,
} from "@/lib/stripe-customer";
import { promoteCustomerPaymentMethodsForCheckout } from "@/lib/stripe-payment-method-persist";
import {
  downgradeMembershipPlansFrom,
  signupPlanLabel,
  upgradeMembershipPlansFrom,
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
  onboardingComplete: boolean;
  referralCode: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Latest ledger amount from FactSubscriptionPayment (what she actually paid). */
  lastPaymentAmountCents: number | null;
  lastPaymentCurrency: string | null;
  lastPaymentAt: string | null;
  lastPaymentLabel: string | null;
  /** Re-onboard pass: this email already paid this ticket for the current period. */
  alreadyPaidPass: boolean;
  alreadyPaidPlan: string | null;
  alreadyPaidPeriodEnd: string | null;
  canManageBilling: boolean;
  canCompleteCheckout: boolean;
  hasSavedPaymentMethod: boolean;
  /** @deprecated Prefer upgradePlans — higher tiers only. */
  switchablePlans: SignupPlan[];
  /** Paid tiers above current (never show lower once upgraded). */
  upgradePlans: SignupPlan[];
  /** Paid tiers below current — Account membership only + confirm. */
  downgradePlans: SignupPlan[];
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
  try {
    await repairMemberStripeBillingState(userId);
  } catch (e: unknown) {
    console.warn(
      "[membership] repairMemberStripeBillingState failed:",
      userId,
      e instanceof Error ? e.message : e,
    );
  }

  let profile = await getMemberProfile(userId);
  // Older accounts may exist as User rows without a MemberProfile — ensure one so
  // Account settings does not 404.
  if (!profile) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true, name: true },
      });
      if (user?.email) {
        const { ensureMemberProfile } = await import("@/lib/member-profiles-store");
        profile = await ensureMemberProfile({
          userId: user.id,
          email: user.email,
          plan: "explorer",
          phone: user.phone,
        });
      }
    } catch {
      /* demo / no DB */
    }
  }
  if (!profile) return null;

  const plan = profile.plan;
  const offer = getOfferDefinition(plan);
  let effective: Awaited<ReturnType<typeof getEffectiveMembershipOffer>> | null = null;
  try {
    effective =
      MEMBERSHIP_PLANS.has(plan as MembershipPlan) && plan !== "explorer"
        ? await getEffectiveMembershipOffer(plan as MembershipPlan)
        : null;
  } catch {
    effective = null;
  }

  const isSubscription = offer?.checkoutMode === "subscription";
  const stripeReady = isStripePaymentsEnabled();
  if (profile.stripeCustomerId) {
    try {
      await promoteCustomerPaymentMethodsForCheckout(
        profile.stripeCustomerId,
        profile.stripeSubscriptionId,
      );
    } catch (e: unknown) {
      console.warn(
        "[membership] promoteCustomerPaymentMethodsForCheckout failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  let hasSavedPaymentMethod = false;
  if (profile.stripeCustomerId) {
    try {
      hasSavedPaymentMethod = await customerHasSavedPaymentMethod(
        profile.stripeCustomerId,
        profile.stripeSubscriptionId,
      );
    } catch {
      hasSavedPaymentMethod = false;
    }
  }

  const paidActive = profile.paymentStatus === "paid";
  // Upgrades: paid subscribers, or explorer/pending who can checkout higher tiers.
  const upgradePlans: SignupPlan[] =
    plan === "explorer" || !paidActive
      ? upgradeMembershipPlansFrom(plan === "explorer" ? "explorer" : plan)
      : profile.stripeSubscriptionId || offer?.checkoutMode === "subscription"
        ? upgradeMembershipPlansFrom(plan)
        : upgradeMembershipPlansFrom(plan);

  // Explorer sees all paid as "upgrades"
  const explorerUpgrades: SignupPlan[] =
    plan === "explorer" ? (["member", "business", "pro"] as SignupPlan[]) : upgradePlans;

  const finalUpgrades = plan === "explorer" ? explorerUpgrades : upgradePlans;

  // Downgrades only for active paid members (settings + confirm)
  const downgradePlans: SignupPlan[] = paidActive ? downgradeMembershipPlansFrom(plan) : [];

  let alreadyPaidPass = false;
  let alreadyPaidPlan: string | null = null;
  let alreadyPaidPeriodEnd: string | null = null;
  try {
    const { resolvePaidCoverage } = await import("@/lib/paid-coverage");
    const coverage = await resolvePaidCoverage({
      userId,
      sessionEmail: profile.email,
      requestedPlan: plan,
    });
    alreadyPaidPass = coverage.ok;
    alreadyPaidPlan = coverage.plan;
    alreadyPaidPeriodEnd = coverage.periodEnd;
    if (coverage.ok && profile.paymentStatus !== "paid") {
      const repaired = await getMemberProfile(userId);
      if (repaired) profile = repaired;
    }
  } catch {
    alreadyPaidPass = false;
  }
  const lastPay =
    profile.paymentStatus === "paid" ? await getLatestPaidPaymentFact(userId) : null;
  const lastPaymentAmountCents = lastPay?.amountCents ?? null;
  const lastPaymentCurrency = lastPay?.currency ?? null;
  const lastPaymentAt = lastPay?.paidAt ? lastPay.paidAt.toISOString() : null;
  const lastPaymentLabel =
    lastPaymentAmountCents != null
      ? formatMoneyCents(lastPaymentAmountCents, lastPaymentCurrency || "usd")
      : null;

  return {
    plan,
    planLabel: signupPlanLabel(plan),
    priceDisplay: effective?.priceDisplay ?? offer?.priceLabel ?? null,
    checkoutMode: offer?.checkoutMode ?? null,
    paymentStatus: profile.paymentStatus,
    paymentMethod: profile.paymentMethod,
    paidAt: profile.paidAt,
    approvalStatus: profile.approvalStatus,
    onboardingComplete: Boolean(profile.onboardingComplete),
    referralCode: profile.referralCode,
    stripeCustomerId: profile.stripeCustomerId,
    stripeSubscriptionId: profile.stripeSubscriptionId,
    lastPaymentAmountCents,
    lastPaymentCurrency,
    lastPaymentAt,
    lastPaymentLabel,
    alreadyPaidPass,
    alreadyPaidPlan,
    alreadyPaidPeriodEnd,
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
    switchablePlans: finalUpgrades,
    upgradePlans: finalUpgrades,
    downgradePlans,
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

function formatMoneyCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/** Signed-in member who finished setup or has an active paid plan — not a prospect picking a ticket. */
export function isEstablishedMember(profile: MemberProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.onboardingComplete) return true;
  if (profile.paymentStatus === "paid" && profile.plan !== "explorer") return true;
  return false;
}