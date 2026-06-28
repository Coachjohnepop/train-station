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

async function paymentMethodIdFromSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method", "latest_invoice.payment_intent.payment_method"],
  });

  const dpm = sub.default_payment_method;
  if (typeof dpm === "string") return dpm;
  if (dpm && typeof dpm === "object") return dpm.id;

  const latestInvoice = sub.latest_invoice;
  if (latestInvoice && typeof latestInvoice === "object") {
    const pi = (latestInvoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }).payment_intent;
    if (pi && typeof pi === "object") {
      const pm = pi.payment_method;
      if (typeof pm === "string") return pm;
      if (pm && typeof pm === "object") return pm.id;
    }
  }

  return null;
}

async function newestCustomerCardId(stripe: Stripe, customerId: string): Promise<string | null> {
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 10,
  });
  return methods.data[0]?.id ?? null;
}

function billingDetailsReadyForCheckoutPrefill(
  billing: Stripe.PaymentMethod.BillingDetails | null | undefined,
): boolean {
  if (!billing?.email?.trim() || !billing?.name?.trim()) return false;
  const country = billing.address?.country?.trim().toUpperCase();
  if (!country) return false;
  if (country === "US" || country === "CA" || country === "GB") {
    return Boolean(billing.address?.postal_code?.trim());
  }
  return true;
}

async function enrichPaymentMethodBillingForCheckout(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
): Promise<boolean> {
  try {
    const [pm, customer] = await Promise.all([
      stripe.paymentMethods.retrieve(paymentMethodId),
      stripe.customers.retrieve(customerId),
    ]);
    if ("deleted" in customer && customer.deleted) return false;

    const billingPatch: Stripe.PaymentMethodUpdateParams["billing_details"] = {
      email: pm.billing_details?.email?.trim() || customer.email || undefined,
      name: pm.billing_details?.name?.trim() || customer.name || undefined,
      phone: pm.billing_details?.phone?.trim() || customer.phone || undefined,
      address: {
        line1: pm.billing_details?.address?.line1 || customer.address?.line1 || undefined,
        line2: pm.billing_details?.address?.line2 || customer.address?.line2 || undefined,
        city: pm.billing_details?.address?.city || customer.address?.city || undefined,
        state: pm.billing_details?.address?.state || customer.address?.state || undefined,
        postal_code:
          pm.billing_details?.address?.postal_code || customer.address?.postal_code || undefined,
        country: pm.billing_details?.address?.country || customer.address?.country || undefined,
      },
    };

    const updated = await stripe.paymentMethods.update(paymentMethodId, {
      allow_redisplay: "always",
      billing_details: billingPatch,
    });
    return billingDetailsReadyForCheckoutPrefill(updated.billing_details);
  } catch (e: unknown) {
    console.error("[stripe] payment method billing enrich failed:", paymentMethodId, e);
    return false;
  }
}

async function paymentMethodIdFromCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  customerId: string,
): Promise<string | null> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const fromSub = await paymentMethodIdFromSubscription(stripe, subscriptionId);
    if (fromSub) return fromSub;
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

  return newestCustomerCardId(stripe, customerId);
}

/**
 * Subscription checkouts save cards with allow_redisplay=limited unless the member
 * checks "save for future use". Promote attached cards so embedded Checkout prefills them.
 */
export async function promoteCustomerPaymentMethodsForCheckout(
  customerId: string,
  subscriptionId?: string | null,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  let preferredId: string | null = null;
  if (subscriptionId) {
    preferredId = await paymentMethodIdFromSubscription(stripe, subscriptionId);
  }

  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 20,
  });

  if (!preferredId && methods.data.length > 0) {
    preferredId = methods.data[0].id;
  }

  for (const pm of methods.data) {
    if (pm.allow_redisplay === "always") continue;
    try {
      await stripe.paymentMethods.update(pm.id, { allow_redisplay: "always" });
    } catch (e: unknown) {
      console.error("[stripe] payment method allow_redisplay promote failed:", pm.id, e);
    }
  }

  if (!preferredId) return;

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ("deleted" in customer && customer.deleted) return;

    const existingDefault = customer.invoice_settings?.default_payment_method;
    const existingId =
      typeof existingDefault === "string"
        ? existingDefault
        : existingDefault && typeof existingDefault === "object"
          ? existingDefault.id
          : null;

    if (existingId !== preferredId) {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: preferredId },
      });
    }
  } catch (e: unknown) {
    console.error("[stripe] customer default payment method promote failed:", e);
  }

  await enrichPaymentMethodBillingForCheckout(stripe, customerId, preferredId);
  for (const pm of methods.data) {
    if (pm.id !== preferredId) {
      await enrichPaymentMethodBillingForCheckout(stripe, customerId, pm.id);
    }
  }
}

/** True when Stripe Checkout can prefill/select the customer's default card. */
export async function customerSavedCardReadyForCheckoutPrefill(
  customerId: string,
  subscriptionId?: string | null,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  await promoteCustomerPaymentMethodsForCheckout(customerId, subscriptionId);

  let paymentMethodId: string | null = null;
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ("deleted" in customer && customer.deleted) return false;
    const dpm = customer.invoice_settings?.default_payment_method;
    paymentMethodId =
      typeof dpm === "string" ? dpm : dpm && typeof dpm === "object" ? dpm.id : null;
  } catch {
    return false;
  }

  if (!paymentMethodId && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["default_payment_method"],
      });
      const dpm = sub.default_payment_method;
      paymentMethodId =
        typeof dpm === "string" ? dpm : dpm && typeof dpm === "object" ? dpm.id : null;
    } catch {
      /* ignore */
    }
  }

  if (!paymentMethodId) {
    paymentMethodId = await newestCustomerCardId(stripe, customerId);
  }
  if (!paymentMethodId) return false;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    return (
      pm.allow_redisplay === "always" &&
      billingDetailsReadyForCheckoutPrefill(pm.billing_details)
    );
  } catch {
    return false;
  }
}

/** Attach checkout PM to customer and allow prefilling on future embedded checkouts. */
export async function persistCheckoutPaymentMethod(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe || session.payment_status !== "paid") return;

  const customerId = sessionCustomerId(session);
  if (!customerId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let paymentMethodId = await paymentMethodIdFromCheckout(stripe, session, customerId);

  if (!paymentMethodId) {
    // Subscription first invoice can lag behind checkout.session.completed — retry briefly.
    for (let attempt = 0; attempt < 5 && !paymentMethodId; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      paymentMethodId = await paymentMethodIdFromCheckout(stripe, session, customerId);
    }
  }

  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (!pm.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      } else if (pm.customer !== customerId) {
        return;
      }

      const details = session.customer_details;
      const billingPatch: Stripe.PaymentMethodUpdateParams["billing_details"] = {};
      if (details?.email) billingPatch.email = details.email;
      if (details?.name) billingPatch.name = details.name;
      if (details?.address) {
        billingPatch.address = {
          line1: details.address.line1 ?? undefined,
          line2: details.address.line2 ?? undefined,
          city: details.address.city ?? undefined,
          state: details.address.state ?? undefined,
          postal_code: details.address.postal_code ?? undefined,
          country: details.address.country ?? undefined,
        };
      }

      await stripe.paymentMethods.update(paymentMethodId, {
        allow_redisplay: "always",
        ...(Object.keys(billingPatch).length > 0 ? { billing_details: billingPatch } : {}),
      });
    } catch (e: unknown) {
      console.error("[stripe] payment method attach failed:", e);
      paymentMethodId = null;
    }
  }

  await promoteCustomerPaymentMethodsForCheckout(customerId, subscriptionId);

  if (!paymentMethodId) return;

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (e: unknown) {
    console.error("[stripe] customer default payment method update failed:", e);
  }
}

export async function promoteCustomerFromInvoice(
  invoice: Stripe.Invoice,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return;

  const subscriptionRef = (invoice as { subscription?: string | null }).subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : null;

  let paymentMethodId: string | null = null;
  const piRef = (invoice as { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent;
  if (typeof piRef === "string") {
    const pi = await stripe.paymentIntents.retrieve(piRef, { expand: ["payment_method"] });
    const pm = pi.payment_method;
    paymentMethodId = typeof pm === "string" ? pm : pm && typeof pm === "object" ? pm.id : null;
  } else if (piRef && typeof piRef === "object") {
    const pm = piRef.payment_method;
    paymentMethodId = typeof pm === "string" ? pm : pm && typeof pm === "object" ? pm.id : null;
  }

  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (!pm.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      }
    } catch (e: unknown) {
      console.error("[stripe] invoice payment method attach failed:", e);
    }
  }

  await promoteCustomerPaymentMethodsForCheckout(customerId, subscriptionId);
}

export function checkoutCustomerId(session: Stripe.Checkout.Session): string | null {
  return sessionCustomerId(session);
}

export function checkoutSubscriptionId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.subscription === "string") return session.subscription;
  if (session.subscription && typeof session.subscription === "object" && "id" in session.subscription) {
    return session.subscription.id;
  }
  return null;
}