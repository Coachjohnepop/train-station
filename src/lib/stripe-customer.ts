import "server-only";

import { getMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { getStripe } from "@/lib/stripe";

export async function ensureStripeCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const profile = await getMemberProfile(input.userId);
  const existingId = profile?.stripeCustomerId;
  if (existingId) {
    try {
      const customer = await stripe.customers.retrieve(existingId);
      if (!("deleted" in customer && customer.deleted)) {
        const patch: import("stripe").Stripe.CustomerUpdateParams = {};
        if (!customer.email?.trim() && input.email.trim()) patch.email = input.email.trim();
        if (!customer.name?.trim() && input.name?.trim()) patch.name = input.name.trim();
        if (Object.keys(patch).length > 0) {
          await stripe.customers.update(existingId, patch);
        }
        return existingId;
      }
    } catch {
      /* create a fresh customer below */
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name || undefined,
    metadata: { userId: input.userId },
  });

  await updateMemberProfile(input.userId, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function customerHasSavedPaymentMethod(
  customerId: string,
  subscriptionId?: string | null,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  try {
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    if (methods.data.length > 0) return true;
  } catch {
    /* fall through */
  }

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (!("deleted" in customer && customer.deleted)) {
      const dpm = customer.invoice_settings?.default_payment_method;
      if (dpm) return true;
    }
  } catch {
    /* fall through */
  }

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["default_payment_method"],
      });
      if (sub.default_payment_method) return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

/** Repair profiles where payment completed but checkout race left status pending. */
export async function repairMemberStripeBillingState(userId: string): Promise<void> {
  const profile = await getMemberProfile(userId);
  if (!profile?.stripeCustomerId) return;

  const stripe = getStripe();
  if (!stripe) return;

  const patch: Parameters<typeof updateMemberProfile>[1] = {};

  if (profile.paymentStatus !== "paid" && profile.paidAt && profile.paymentMethod === "stripe") {
    patch.paymentStatus = "paid";
  }

  // Drop stale subscription ids (deleted in Dashboard / test→live mix) so home never 500s
  if (profile.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/No such subscription/i.test(msg) || /resource_missing/i.test(msg)) {
        console.warn(
          "[stripe] clearing missing subscription from profile",
          profile.stripeSubscriptionId,
          userId,
        );
        patch.stripeSubscriptionId = null;
      }
    }
  }

  if (!profile.stripeSubscriptionId && !("stripeSubscriptionId" in patch)) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: "all",
        limit: 5,
      });
      const active = subs.data.find((sub) => sub.status === "active" || sub.status === "trialing");
      if (active) {
        patch.stripeSubscriptionId = active.id;
        patch.paymentStatus = "paid";
      }
    } catch {
      /* ignore */
    }
  } else if (patch.stripeSubscriptionId === null) {
    // After clearing a dead id, try to attach a live one
    try {
      const subs = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: "all",
        limit: 5,
      });
      const active = subs.data.find((sub) => sub.status === "active" || sub.status === "trialing");
      if (active) {
        patch.stripeSubscriptionId = active.id;
        patch.paymentStatus = "paid";
      }
    } catch {
      /* ignore */
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateMemberProfile(userId, patch);
  }
}