import "server-only";

import { getLatestPaidPaymentFact } from "@/lib/analytics-facts";
import { isDatabaseConfigured } from "@/lib/database-config";
import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { prisma } from "@/lib/prisma";
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
    const restored = await restorePaidCoverageFromEmailHistory({
      userId: input.userId,
      email: input.sessionEmail || profile.email,
      requested,
    });
    if (restored) return restored;
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

/**
 * Same email paid this ticket earlier (then the account was purged / re-signed).
 * Audit survives the delete. Re-attach the paid stamp so checkout does not charge twice.
 */
async function restorePaidCoverageFromEmailHistory(input: {
  userId: string;
  email?: string | null;
  requested: ReturnType<typeof normalizeSignupPlan>;
}): Promise<PaidCoverage | null> {
  const email = input.email?.trim().toLowerCase();
  if (!email || !isDatabaseConfigured()) return null;

  try {
    const rows = await prisma.auditEvent.findMany({
      where: {
        action: "member.mark_paid",
        outcome: "success",
        actorEmail: { equals: email, mode: "insensitive" },
      },
      orderBy: { occurredAt: "desc" },
      take: 20,
    });
    const now = new Date();
    for (const row of rows) {
      const meta = (row.metadata ?? {}) as { plan?: unknown };
      const paidPlan = normalizeSignupPlan(
        typeof meta.plan === "string" ? meta.plan : input.requested,
      );
      if (!isPaidMembershipPlan(paidPlan)) continue;
      if (isPaidMembershipPlan(input.requested) && input.requested !== paidPlan) continue;
      if (!inPaidWindow(row.occurredAt, null, now)) continue;

      await updateMemberProfile(input.userId, {
        plan: paidPlan,
        paymentStatus: "paid",
        paymentMethod: "stripe",
        paidAt: row.occurredAt.toISOString(),
      });
      return {
        ok: true,
        plan: paidPlan,
        periodEnd: null,
        reason: "email_history",
      };
    }
  } catch (e) {
    console.warn(
      "[paid-coverage] email history lookup failed",
      email,
      e instanceof Error ? e.message : e,
    );
  }
  return null;
}
