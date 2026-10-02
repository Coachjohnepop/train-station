import "server-only";

import { getStripe } from "@/lib/stripe";

type StripeClient = import("stripe").default;
type StripeEvent = import("stripe").Stripe.Event;
type StripeSubscription = import("stripe").Stripe.Subscription;

export function webhookSecrets(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Jeremy's Train Station Stripe only. The Eco Delight legacy secret was
  // removed 2026-10-02: no Train Station charge, webhook or lookup goes
  // through Eco anymore.
  for (const raw of [process.env.STRIPE_WEBHOOK_SECRET]) {
    const s = raw?.trim();
    if (!s || !s.startsWith("whsec_") || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function constructStripeWebhookEvent(
  stripe: StripeClient,
  body: string,
  signature: string,
): StripeEvent {
  const secrets = webhookSecrets();
  if (!secrets.length) {
    throw new Error("Stripe webhook is not configured.");
  }
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Invalid signature");
}

/**
 * Fetch a subscription from Jeremy's Train Station Stripe (the only merchant).
 * The Eco Delight fallback was removed 2026-10-02; every Train Station
 * subscription that lived on Eco was cancelled that day.
 */
export async function retrieveSubscriptionAnyAccount(
  subscriptionId: string,
): Promise<StripeSubscription> {
  const primary = getStripe();
  if (!primary) throw new Error("Stripe is not configured.");
  return primary.subscriptions.retrieve(subscriptionId);
}
