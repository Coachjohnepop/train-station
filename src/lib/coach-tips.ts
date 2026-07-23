/**
 * Coach tip product — shared constants (safe for client + server).
 *
 * Money lands on Jeremy’s master Stripe (same as membership).
 * Tips never change membership plan or paymentStatus.
 *
 * Surfaces (smart homes):
 * 1. Account → “Tip Coach Jeremy” (evergreen primary)
 * 2. Membership Checkout → Stripe optional_items (wallet already open)
 * 3. Messages → soft link to Account tip card
 * Not on: live floor, mid-workout, nav chrome (avoids nagging)
 */

export const TIP_PRESET_DOLLARS = [5, 10, 25, 50] as const;
export type TipPresetDollars = (typeof TIP_PRESET_DOLLARS)[number];

/** Custom tip via $1 unit price quantity. */
export const TIP_CUSTOM_MIN_DOLLARS = 1;
export const TIP_CUSTOM_MAX_DOLLARS = 200;

export const COACH_TIP_METADATA_KIND = "coach_tip";

export function isCoachTipCheckoutMetadata(
  metadata: { kind?: string | null } | null | undefined,
): boolean {
  return metadata?.kind === COACH_TIP_METADATA_KIND;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatTipDollars(dollars: number): string {
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export type PublicTipConfig = {
  /** True when at least one tip price env is set and Stripe payments are on. */
  enabled: boolean;
  /** Fixed chip amounts available from env price IDs. */
  presets: TipPresetDollars[];
  /** Custom $1–$200 via STRIPE_PRICE_TIP_CUSTOM. */
  customEnabled: boolean;
  minCustomDollars: number;
  maxCustomDollars: number;
};
