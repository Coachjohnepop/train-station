import "server-only";

import type Stripe from "stripe";

export function isCheckoutSessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid";
}

export function isSubscriptionActive(sub: Stripe.Subscription): boolean {
  const status = sub.status;
  return status === "active" || status === "trialing";
}

export async function verifyPaidCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isCheckoutSessionPaid(session)) {
    return { ok: false, reason: "Checkout payment is not complete." };
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (!isSubscriptionActive(sub)) {
      return { ok: false, reason: "Subscription is not active." };
    }
  }

  return { ok: true };
}