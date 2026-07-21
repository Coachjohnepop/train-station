import "server-only";

/**
 * Optional tip line items at membership Checkout.
 *
 * Stripe Dashboard "Cross-sells" alone do not always appear on API-created
 * embedded Checkout — we pass `optional_items` with Live tip Price IDs.
 *
 * Env (any subset is fine):
 *   STRIPE_PRICE_TIP_5=price_…
 *   STRIPE_PRICE_TIP_10=price_…
 *   STRIPE_PRICE_TIP_25=price_…
 *   STRIPE_PRICE_TIP_50=price_…
 *   STRIPE_PRICE_TIP_CUSTOM=price_…   # usually $1 one-time + adjustable qty
 *   STRIPE_PRICE_TIPS=price_a,price_b  # comma list fallback
 *
 * Custom tip: create a $1 one-time price, set STRIPE_PRICE_TIP_CUSTOM, and
 * adjustable quantity 1–200 ≈ tip $1–$200.
 */

export type CheckoutOptionalTipItem = {
  price: string;
  quantity: number;
  adjustable_quantity?: {
    enabled: boolean;
    minimum?: number;
    maximum?: number;
  };
};

function uniquePriceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t.startsWith("price_") || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Fixed tip presets from env (not adjustable). */
export function tipPresetPriceIdsFromEnv(): string[] {
  const named = [
    process.env.STRIPE_PRICE_TIP_5,
    process.env.STRIPE_PRICE_TIP_10,
    process.env.STRIPE_PRICE_TIP_25,
    process.env.STRIPE_PRICE_TIP_50,
  ]
    .map((s) => s?.trim() || "")
    .filter(Boolean);

  const list = (process.env.STRIPE_PRICE_TIPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return uniquePriceIds([...named, ...list]);
}

/** $1 (or unit) tip price with adjustable quantity for custom amounts. */
export function tipCustomPriceIdFromEnv(): string | null {
  const id = process.env.STRIPE_PRICE_TIP_CUSTOM?.trim() || "";
  return id.startsWith("price_") ? id : null;
}

export function buildMembershipTipOptionalItems(): CheckoutOptionalTipItem[] {
  const items: CheckoutOptionalTipItem[] = [];

  for (const price of tipPresetPriceIdsFromEnv()) {
    items.push({
      price,
      // Start unselected: quantity 0 is allowed for optional items when adjustable.
      quantity: 0,
      adjustable_quantity: {
        enabled: true,
        minimum: 0,
        maximum: 1,
      },
    });
  }

  const custom = tipCustomPriceIdFromEnv();
  if (custom) {
    items.push({
      price: custom,
      quantity: 0,
      adjustable_quantity: {
        enabled: true,
        minimum: 0,
        // unit price should be $1 → max tip $200
        maximum: 200,
      },
    });
  }

  // Cap Stripe optional_items count (keep Checkout UI tidy).
  return items.slice(0, 8);
}

export function membershipTipsConfigured(): boolean {
  return buildMembershipTipOptionalItems().length > 0;
}
