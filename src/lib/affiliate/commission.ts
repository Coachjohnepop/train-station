/**
 * A 20% pool shared by the customer discount
 * and the affiliate. A 5% floor keeps a small commission until the discount
 * reaches 40%, which pays nothing.
 *
 * discount is a decimal (0.10 = 10%).
 */

export const COMMISSION_POOL = 0.2;
export const COMMISSION_FLOOR = 0.05;
export const COMMISSION_MAX_DISCOUNT = 0.4;
export const DEFAULT_COMMISSION_RATE = 0.2;
export const MINIMUM_PAYOUT_CENTS = 5000;

export function calculateCommissionRate(discountPercent?: number): number {
  const discount = discountPercent ?? 0;
  if (discount >= COMMISSION_MAX_DISCOUNT) return 0;
  const rate = Math.max(COMMISSION_FLOOR, COMMISSION_POOL - discount);
  return Math.round(rate * 100) / 100;
}

/** Commission on the amount actually charged (already after discount). */
export function commissionCents(chargedCents: number, rate: number): number {
  if (chargedCents <= 0 || rate <= 0) return 0;
  return Math.round(chargedCents * rate);
}
