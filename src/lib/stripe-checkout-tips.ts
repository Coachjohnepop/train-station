import "server-only";

import {
  COACH_TIP_METADATA_KIND,
  TIP_CUSTOM_MAX_DOLLARS,
  TIP_CUSTOM_MIN_DOLLARS,
  TIP_PRESET_DOLLARS,
  type PublicTipConfig,
  type TipPresetDollars,
  dollarsToCents,
} from "@/lib/coach-tips";
import { isStripePaymentsEnabled } from "@/lib/member-gates";

/**
 * Optional tip line items at membership Checkout + standalone tip sessions.
 *
 * Stripe Dashboard "Cross-sells" alone do not always appear on API-created
 * embedded Checkout — we pass `optional_items` with tip Price IDs.
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

const PRESET_ENV: Record<TipPresetDollars, string> = {
  5: "STRIPE_PRICE_TIP_5",
  10: "STRIPE_PRICE_TIP_10",
  25: "STRIPE_PRICE_TIP_25",
  50: "STRIPE_PRICE_TIP_50",
};

/** Fixed tip presets from env (not adjustable). */
export function tipPresetPriceIdsFromEnv(): string[] {
  const named = TIP_PRESET_DOLLARS.map((d) => process.env[PRESET_ENV[d]]?.trim() || "").filter(
    Boolean,
  );

  const list = (process.env.STRIPE_PRICE_TIPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return uniquePriceIds([...named, ...list]);
}

export function tipPriceIdForPreset(dollars: TipPresetDollars): string | null {
  const id = process.env[PRESET_ENV[dollars]]?.trim() || "";
  return id.startsWith("price_") ? id : null;
}

/** $1 (or unit) tip price with adjustable quantity for custom amounts. */
export function tipCustomPriceIdFromEnv(): string | null {
  const id = process.env.STRIPE_PRICE_TIP_CUSTOM?.trim() || "";
  return id.startsWith("price_") ? id : null;
}

export function availableTipPresets(): TipPresetDollars[] {
  return TIP_PRESET_DOLLARS.filter((d) => Boolean(tipPriceIdForPreset(d)));
}

/**
 * Membership Checkout tip add-ons.
 *
 * Stripe requires each optional_item `quantity >= 1` (cannot start unselected).
 * Stacking $5+$10+$25+$50 by default would overcharge — so we only attach
 * **one** tip line (prefer $10, then other presets, then $1 custom units).
 * Members can set quantity to 0 (remove) or bump custom units.
 *
 * Full chip picker lives on Account → Tip Coach (standalone Checkout).
 */
export function buildMembershipTipOptionalItems(): CheckoutOptionalTipItem[] {
  // Prefer a mid-size chip if configured.
  const preferredOrder: TipPresetDollars[] = [10, 5, 25, 50];
  for (const dollars of preferredOrder) {
    const price = tipPriceIdForPreset(dollars);
    if (!price) continue;
    return [
      {
        price,
        quantity: 1,
        adjustable_quantity: {
          enabled: true,
          minimum: 0,
          maximum: 1,
        },
      },
    ];
  }

  // Any extra price ids from STRIPE_PRICE_TIPS
  const extras = tipPresetPriceIdsFromEnv();
  if (extras[0]) {
    return [
      {
        price: extras[0],
        quantity: 1,
        adjustable_quantity: {
          enabled: true,
          minimum: 0,
          maximum: 1,
        },
      },
    ];
  }

  const custom = tipCustomPriceIdFromEnv();
  if (custom) {
    return [
      {
        price: custom,
        // $1 default; member can zero out or raise to $200
        quantity: 1,
        adjustable_quantity: {
          enabled: true,
          minimum: 0,
          maximum: TIP_CUSTOM_MAX_DOLLARS,
        },
      },
    ];
  }

  return [];
}

export function membershipTipsConfigured(): boolean {
  return buildMembershipTipOptionalItems().length > 0;
}

/** Public / UI tip config (no secrets). */
export function publicTipConfig(): PublicTipConfig {
  const presets = availableTipPresets();
  const customEnabled = Boolean(tipCustomPriceIdFromEnv());
  const enabled =
    isStripePaymentsEnabled() && (presets.length > 0 || customEnabled || membershipTipsConfigured());
  return {
    enabled,
    presets,
    customEnabled,
    minCustomDollars: TIP_CUSTOM_MIN_DOLLARS,
    maxCustomDollars: TIP_CUSTOM_MAX_DOLLARS,
  };
}

export type ResolvedTipLineItem = {
  price: string;
  quantity: number;
  amountCents: number;
  label: string;
};

/**
 * Resolve a member-chosen tip amount to a Stripe line item.
 * Prefers fixed preset prices; falls back to $1 custom units.
 */
export function resolveCoachTipLineItem(amountCents: number): ResolvedTipLineItem | { error: string } {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Pick a tip amount." };
  }
  if (amountCents % 100 !== 0) {
    return { error: "Tips are whole dollars only." };
  }
  const dollars = amountCents / 100;
  if (dollars < TIP_CUSTOM_MIN_DOLLARS || dollars > TIP_CUSTOM_MAX_DOLLARS) {
    return {
      error: `Tip must be between $${TIP_CUSTOM_MIN_DOLLARS} and $${TIP_CUSTOM_MAX_DOLLARS}.`,
    };
  }

  // Prefer dedicated preset price when amount matches.
  if ((TIP_PRESET_DOLLARS as readonly number[]).includes(dollars)) {
    const preset = dollars as TipPresetDollars;
    const price = tipPriceIdForPreset(preset);
    if (price) {
      return {
        price,
        quantity: 1,
        amountCents,
        label: `Tip your coach · $${preset}`,
      };
    }
  }

  const custom = tipCustomPriceIdFromEnv();
  if (custom) {
    return {
      price: custom,
      quantity: dollars,
      amountCents,
      label: `Tip your coach · $${dollars}`,
    };
  }

  // Last resort: if only other named prices exist via STRIPE_PRICE_TIPS, reject custom.
  if (membershipTipsConfigured()) {
    return {
      error: "That amount isn’t available. Choose a listed tip chip.",
    };
  }

  return {
    error: "Tips aren’t configured yet. Ask your coach — or try again later.",
  };
}

export { COACH_TIP_METADATA_KIND, dollarsToCents };
