import "server-only";

import { getLatestPaidPaymentFact } from "@/lib/analytics-facts";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isPaidMembershipPlan, normalizeSignupPlan } from "@/lib/signup-plans";

/** Monthly tickets get a short grace so a mid-cycle re-onboard still counts. */
const PAID_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;

export type PaidCoverage = {
  ok: boolean;
  plan: string | null;
  periodEnd: string | null;
  reason: string;
};

function sameEmail(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function inPaidWindow(paidAt: Date | null, periodEnd: Date | null, now: Date): boolean {
  if (periodEnd && periodEnd.getTime() >= now.getTime()) return true;
  if (paidAt && now.getTime() - paidAt.getTime() <= PAID_WINDOW_MS) return true;
  return false;
}

/**
 * Strict pass for re-onboard: this signed-in email already paid the requested
 * ticket for the current period. Do not trust a bare paid stamp alone.
 */
export async function resolvePaidCoverage(input: {
  userId: string;
  sessionEmail?: string | null;
  requestedPlan?: string | null;
}): Promise<PaidCoverage> {
  const requested = normalizeSignupPlan(input.requestedPlan);
  const profile = await getMemberProfile(input.userId);
  if (!profile) {
    return { ok: false, plan: null, periodEnd: null, reason: "no_profile" };
  }
  if (input.sessionEmail && !sameEmail(input.sessionEmail, profile.email)) {
    return { ok: false, plan: profile.plan, periodEnd: null, reason: "email_mismatch" };
  }
  if (profile.paymentStatus !== "paid") {
    return { ok: false, plan: profile.plan, periodEnd: null, reason: "not_paid" };
  }
  if (!isPaidMembershipPlan(profile.plan)) {
    return { ok: false, plan: profile.plan, periodEnd: null, reason: "not_paid_ticket" };
  }
  if (isPaidMembershipPlan(requested) && requested !== profile.plan) {
    return { ok: false, plan: profile.plan, periodEnd: null, reason: "plan_mismatch" };
  }

  const now = new Date();
  if (
    profile.paymentMethod === "manual" &&
    profile.staffGrantExpiresAt &&
    new Date(profile.staffGrantExpiresAt).getTime() <= now.getTime()
  ) {
    return { ok: false, plan: profile.plan, periodEnd: profile.staffGrantExpiresAt, reason: "grant_expired" };
  }

  const fact = await getLatestPaidPaymentFact(input.userId);
  const paidAt = profile.paidAt ? new Date(profile.paidAt) : fact?.paidAt ?? null;
  const periodEnd = fact?.periodEnd ?? (profile.staffGrantExpiresAt ? new Date(profile.staffGrantExpiresAt) : null);

  const hasProof = Boolean(paidAt || fact || (profile.paymentMethod === "manual" && profile.staffGrantedAt));
  if (!hasProof) {
    return { ok: false, plan: profile.plan, periodEnd: null, reason: "no_payment_proof" };
  }
  if (!inPaidWindow(paidAt, periodEnd, now)) {
    return {
      ok: false,
      plan: profile.plan,
      periodEnd: periodEnd?.toISOString() ?? null,
      reason: "period_ended",
    };
  }

  return {
    ok: true,
    plan: profile.plan,
    periodEnd: periodEnd?.toISOString() ?? null,
    reason: fact?.periodEnd ? "ledger_period" : profile.staffGrantedAt ? "staff_grant" : "paid_window",
  };
}
