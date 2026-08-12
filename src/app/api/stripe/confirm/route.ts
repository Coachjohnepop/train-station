import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyNewMemberOnboardingCookie,
  getSessionUser,
  syncMemberGateCookies,
} from "@/lib/auth";
import { isCoachTipCheckoutMetadata } from "@/lib/coach-tips";
import {
  paymentIntentIdFromUnknown,
  recordSubscriptionPaymentFact,
} from "@/lib/analytics-facts";
import { markMemberPaid, attachPaidMemberCookies } from "@/lib/mark-member-paid";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getStripe } from "@/lib/stripe";
import {
  checkoutCustomerId,
  checkoutSubscriptionId,
  persistCheckoutPaymentMethod,
} from "@/lib/stripe-payment-method-persist";
import { verifyPaidCheckoutSession } from "@/lib/stripe-payment-verify";

const schema = z.object({
  sessionId: z.string().min(1),
});

/** Browser return path after Stripe Checkout — confirms session and unlocks onboarding. */
export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "MEMBER") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing checkout session." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const checkout = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
    expand: ["subscription", "payment_intent"],
  });
  const userId = checkout.metadata?.userId || checkout.client_reference_id;
  if (!userId || userId !== sessionUser.id) {
    return NextResponse.json({ error: "Checkout session does not match this account." }, { status: 403 });
  }

  const verified = await verifyPaidCheckoutSession(stripe, checkout);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 409 });
  }

  await persistCheckoutPaymentMethod(checkout);

  // Standalone coach tip — never flip membership / plan.
  if (isCoachTipCheckoutMetadata(checkout.metadata)) {
    const tipCents = checkout.metadata?.tipAmountCents;
    const profile = await getMemberProfile(sessionUser.id);
    const res = NextResponse.json({
      ok: true,
      tip: true,
      tipAmountCents: tipCents ? Number(tipCents) : checkout.amount_total ?? null,
      redirectTo: "/member/account?tipped=1",
    });
    if (profile) {
      await syncMemberGateCookies(res, { userId: sessionUser.id, profile });
    }
    return res;
  }

  const amountCents = typeof checkout.amount_total === "number" ? checkout.amount_total : 0;
  const currency = checkout.currency ?? "usd";

  const updated = await markMemberPaid({
    userId: sessionUser.id,
    method: "stripe",
    plan: checkout.metadata?.plan ?? null,
    customOfferId: checkout.metadata?.customOfferId ?? null,
    stripeCustomerId: checkoutCustomerId(checkout),
    stripeSubscriptionId: checkoutSubscriptionId(checkout),
    stripeCheckoutSessionId: checkout.id,
    amountCents: amountCents > 0 ? amountCents : null,
    currency,
    actor: {
      userId: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
    },
    auditSource: "stripe.confirm",
  });

  if (!updated) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  if (amountCents > 0) {
    await recordSubscriptionPaymentFact({
      userId: sessionUser.id,
      stripePaymentIntentId: paymentIntentIdFromUnknown(checkout.payment_intent),
      stripeSubscriptionId: checkoutSubscriptionId(checkout),
      stripeCustomerId: checkoutCustomerId(checkout),
      amountCents,
      currency,
      status: "paid",
      planId: checkout.metadata?.plan ?? updated.plan,
      tierSlug: checkout.metadata?.plan ?? updated.plan,
      billingReason: checkout.mode === "subscription" ? "subscription_create" : "checkout",
      paidAt: new Date((checkout.created ?? Math.floor(Date.now() / 1000)) * 1000),
      properties: {
        kind: "membership_checkout",
        checkoutSessionId: checkout.id,
        mode: checkout.mode,
        source: "stripe.confirm",
        referralCode: checkout.metadata?.referralCode ?? null,
        amountSubtotal: checkout.amount_subtotal ?? null,
      },
    });
  }

  const plan = updated.plan;

  const res = NextResponse.json({
    ok: true,
    redirectTo: `/member/onboard?plan=${encodeURIComponent(plan)}`,
    amountCents: amountCents > 0 ? amountCents : null,
    currency: checkout.currency ?? "usd",
  });
  await syncMemberGateCookies(res, { userId: sessionUser.id, profile: updated });
  await attachPaidMemberCookies(res, sessionUser.id, updated);
  applyNewMemberOnboardingCookie(res, plan);
  return res;
}