import "server-only";

import { applyOfferBenefitsAfterPayment } from "@/lib/apply-offer-payment";
import { syncMemberGateCookies } from "@/lib/auth";
import { updateCustomTrainingOffer } from "@/lib/custom-training-offers-store";
import { stripeAutoApproveOnPay } from "@/lib/member-gates";
import {
  getMemberProfile,
  updateMemberProfile,
  type PaymentMethod,
} from "@/lib/member-profiles-store";
import { sendWelcomeSignupIfNeeded } from "@/lib/member-welcome";
import { normalizeSignupPlan } from "@/lib/signup-plans";
import type { NextResponse } from "next/server";

export type { PaymentMethod };

export async function markMemberPaid(input: {
  userId: string;
  method?: PaymentMethod;
  note?: string | null;
  plan?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  customOfferId?: string | null;
}) {
  const profile = await getMemberProfile(input.userId);
  if (!profile) return null;

  const paidAt = new Date().toISOString();
  const plan = input.plan ? normalizeSignupPlan(input.plan) : profile.plan;
  const patch: Parameters<typeof updateMemberProfile>[1] = {
    plan,
    paymentStatus: "paid",
    paidAt,
    paymentMethod: input.method ?? profile.paymentMethod ?? "manual",
    paymentNote: input.note ?? profile.paymentNote ?? null,
    stripeCustomerId: input.stripeCustomerId ?? profile.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId ?? profile.stripeSubscriptionId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? profile.stripeCheckoutSessionId,
    ...(input.customOfferId ? { customTrainingOfferId: input.customOfferId } : {}),
  };

  if (stripeAutoApproveOnPay() && profile.approvalStatus === "pending") {
    patch.approvalStatus = "approved";
    patch.approvedAt = paidAt;
  }

  let updated = await updateMemberProfile(input.userId, patch);
  updated = await applyOfferBenefitsAfterPayment(input.userId, plan, updated);

  if (input.customOfferId) {
    try {
      await updateCustomTrainingOffer(input.customOfferId, { status: "paid" });
    } catch {
      /* offer may already be updated */
    }
  }

  await sendWelcomeSignupIfNeeded(input.userId);

  return updated;
}

export function attachPaidMemberCookies(
  res: NextResponse,
  userId: string,
  profile: Awaited<ReturnType<typeof markMemberPaid>>,
) {
  if (profile) {
    syncMemberGateCookies(res, { userId, profile });
  }
}