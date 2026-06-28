import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyNewMemberOnboardingCookie,
  getSessionUser,
  syncMemberGateCookies,
} from "@/lib/auth";
import { markMemberPaid, attachPaidMemberCookies } from "@/lib/mark-member-paid";
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

  const updated = await markMemberPaid({
    userId: sessionUser.id,
    method: "stripe",
    plan: checkout.metadata?.plan ?? null,
    customOfferId: checkout.metadata?.customOfferId ?? null,
    stripeCustomerId: checkoutCustomerId(checkout),
    stripeSubscriptionId: checkoutSubscriptionId(checkout),
    stripeCheckoutSessionId: checkout.id,
  });

  if (!updated) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const plan = updated.plan;

  const res = NextResponse.json({
    ok: true,
    redirectTo: `/member/onboard?plan=${encodeURIComponent(plan)}`,
  });
  syncMemberGateCookies(res, { userId: sessionUser.id, profile: updated });
  attachPaidMemberCookies(res, sessionUser.id, updated);
  applyNewMemberOnboardingCookie(res, plan);
  return res;
}