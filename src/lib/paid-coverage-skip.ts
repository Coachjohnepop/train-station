export type PaidCoverageSkipInput = {
  ok: boolean;
};

/**
 * House stamps / grants without a Jeremy Live customer still need Checkout
 * so a card can land. Do not skip them as already paid.
 */
export function checkoutShouldSkipAsAlreadyPaid(
  coverage: PaidCoverageSkipInput,
  profile: { stripeCustomerId?: string | null } | null,
): boolean {
  if (!coverage.ok) return false;
  if (!profile?.stripeCustomerId) return false;
  return true;
}
