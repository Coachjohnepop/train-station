import "server-only";

import { getStripe, getStripeLegacy } from "@/lib/stripe";

type StripeClient = import("stripe").default;
type StripeEvent = import("stripe").Stripe.Event;
type StripeSubscription = import("stripe").Stripe.Subscription;

export function webhookSecrets(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_LEGACY,
  ]) {
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
 * Fetch a subscription from the current merchant, then the leftover Eco account.
 * Cutover leaves Ali/Bella/Jeremy2 subs on Eco until they re-subscribe on Jeremy.
 */
export async function retrieveSubscriptionAnyAccount(
  subscriptionId: string,
): Promise<StripeSubscription> {
  const primary = getStripe();
  if (!primary) throw new Error("Stripe is not configured.");
  try {
    return await primary.subscriptions.retrieve(subscriptionId);
  } catch (primaryErr) {
    const legacy = getStripeLegacy();
    if (!legacy) throw primaryErr;
    try {
      return await legacy.subscriptions.retrieve(subscriptionId);
    } catch {
      throw primaryErr;
    }
  }
}
