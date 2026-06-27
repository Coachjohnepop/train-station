import "server-only";

import { getStripe } from "@/lib/stripe";
import { MEMBERSHIP_STRIPE_PRICE_IDS } from "@/lib/stripe-price-ids";

export async function diagnoseMembershipStripePrices(): Promise<{
  keyMode: "test" | "live" | "missing" | "unknown";
  memberPriceId: string;
  memberPriceExists: boolean;
  memberPriceError: string | null;
  accountPrices: Array<{ id: string; amount: number | null; recurring: boolean }>;
}> {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const keyMode = !key
    ? "missing"
    : key.startsWith("sk_test_")
      ? "test"
      : key.startsWith("sk_live_")
        ? "live"
        : "unknown";

  const memberPriceId = MEMBERSHIP_STRIPE_PRICE_IDS.member;
  const stripe = getStripe();

  if (!stripe) {
    return {
      keyMode,
      memberPriceId,
      memberPriceExists: false,
      memberPriceError: "Stripe client not configured",
      accountPrices: [],
    };
  }

  let memberPriceExists = false;
  let memberPriceError: string | null = null;
  try {
    await stripe.prices.retrieve(memberPriceId);
    memberPriceExists = true;
  } catch (e: unknown) {
    memberPriceError = e instanceof Error ? e.message : "Price lookup failed";
  }

  let accountPrices: Array<{ id: string; amount: number | null; recurring: boolean }> = [];
  try {
    const listed = await stripe.prices.list({ limit: 20, active: true });
    accountPrices = listed.data.map((p) => ({
      id: p.id,
      amount: p.unit_amount,
      recurring: Boolean(p.recurring),
    }));
  } catch {
    // ignore list failures
  }

  return {
    keyMode,
    memberPriceId,
    memberPriceExists,
    memberPriceError,
    accountPrices,
  };
}