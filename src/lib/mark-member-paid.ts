import "server-only";

import { syncMemberGateCookies } from "@/lib/auth";
import { stripeAutoApproveOnPay } from "@/lib/member-gates";
import {
  getMemberProfile,
  updateMemberProfile,
  type PaymentMethod,
} from "@/lib/member-profiles-store";
import type { NextResponse } from "next/server";

export type { PaymentMethod };

export async function markMemberPaid(input: {
  userId: string;
  method?: PaymentMethod;
  note?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
}) {
  const profile = await getMemberProfile(input.userId);
  if (!profile) return null;

  const paidAt = new Date().toISOString();
  const patch: Parameters<typeof updateMemberProfile>[1] = {
    paymentStatus: "paid",
    paidAt,
    paymentMethod: input.method ?? profile.paymentMethod ?? "manual",
    paymentNote: input.note ?? profile.paymentNote ?? null,
    stripeCustomerId: input.stripeCustomerId ?? profile.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId ?? profile.stripeSubscriptionId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? profile.stripeCheckoutSessionId,
  };

  if (stripeAutoApproveOnPay() && profile.approvalStatus === "pending") {
    patch.approvalStatus = "approved";
    patch.approvedAt = paidAt;
  }

  return updateMemberProfile(input.userId, patch);
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