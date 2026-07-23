import "server-only";

import { applyOfferBenefitsAfterPayment } from "@/lib/apply-offer-payment";
import { recordAuditEvent } from "@/lib/audit-event";
import type { AuditActor } from "@/lib/audit-request";
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
  /** Staff or system actor for M&A audit trail. */
  actor?: AuditActor;
  /** e.g. admin.mark_paid | stripe.webhook | stripe.confirm */
  auditSource?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const profile = await getMemberProfile(input.userId);
  if (!profile) return null;

  const paidAt = new Date().toISOString();
  const plan = input.plan ? normalizeSignupPlan(input.plan) : profile.plan;
  const method = input.method ?? profile.paymentMethod ?? "manual";
  const wasPaid = profile.paymentStatus === "paid";
  const patch: Parameters<typeof updateMemberProfile>[1] = {
    plan,
    paymentStatus: "paid",
    paidAt,
    paymentMethod: method,
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

  await recordAuditEvent({
    action: "member.mark_paid",
    outcome: "success",
    actorUserId: input.actor?.userId ?? null,
    actorEmail: input.actor?.email ?? null,
    actorRole: input.actor?.role ?? (input.auditSource?.startsWith("stripe") ? "system" : null),
    entityType: "member_profile",
    entityId: input.userId,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: {
      source: input.auditSource ?? "unknown",
      method,
      plan,
      wasPaid,
      note: input.note ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      customOfferId: input.customOfferId ?? null,
    },
  });

  return updated;
}

export async function attachPaidMemberCookies(
  res: NextResponse,
  userId: string,
  profile: Awaited<ReturnType<typeof markMemberPaid>>,
) {
  if (profile) {
    await syncMemberGateCookies(res, { userId, profile });
  }
}