import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

function sessionCustomerId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.customer === "string") return session.customer;
  if (session.customer && typeof session.customer === "object" && "id" in session.customer) {
    return session.customer.id;
  }
  return null;
}

async function paymentMethodIdFromCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"],
    });
    const dpm = sub.default_payment_method;
    if (typeof dpm === "string") return dpm;
    if (dpm && typeof dpm === "object") return dpm.id;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
    const pm = pi.payment_method;
    if (typeof pm === "string") return pm;
    if (pm && typeof pm === "object") return pm.id;
  }

  return null;
}

/** Attach checkout PM to customer and allow prefilling on future embedded checkouts. */
export async function persistCheckoutPaymentMethod(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe || session.payment_status !== "paid") return;

  const customerId = sessionCustomerId(session);
  if (!customerId) return;

  const paymentMethodId = await paymentMethodIdFromCheckout(stripe, session);
  if (!paymentMethodId) return;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } else if (pm.customer !== customerId) {
      return;
    }
  } catch (e: unknown) {
    console.error("[stripe] payment method attach failed:", e);
    return;
  }

  try {
    await stripe.paymentMethods.update(paymentMethodId, {
      allow_redisplay: "always",
    });
  } catch (e: unknown) {
    console.error("[stripe] payment method allow_redisplay update failed:", e);
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (e: unknown) {
    console.error("[stripe] customer default payment method update failed:", e);
  }
}

export function checkoutCustomerId(session: Stripe.Checkout.Session): string | null {
  return sessionCustomerId(session);
}