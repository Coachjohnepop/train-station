import "server-only";

import { getStripe } from "@/lib/stripe";
import { resolveStripePriceId } from "@/lib/pricing-catalog";

const TIP_PRODUCT_NAME = "Tip your coach";
const FEEDBACK_CODE = "FEEDBACK50";

const TIP_PRESETS = [
  { amount: 500, nickname: "Tip $5", env: "STRIPE_PRICE_TIP_5" },
  { amount: 1000, nickname: "Tip $10", env: "STRIPE_PRICE_TIP_10" },
  { amount: 2500, nickname: "Tip $25", env: "STRIPE_PRICE_TIP_25" },
  { amount: 5000, nickname: "Tip $50", env: "STRIPE_PRICE_TIP_50" },
] as const;

const TIP_CUSTOM = {
  amount: 100,
  nickname: "Custom tip ($1 units)",
  env: "STRIPE_PRICE_TIP_CUSTOM",
} as const;

export type OpsBootstrapResult = {
  mode: "test" | "live" | "unknown";
  accountId: string | null;
  tipProductId: string;
  tipEnv: Record<string, string>;
  feedback: {
    code: string;
    couponId: string;
    promotionCodeId: string;
    active: boolean;
    appliesToProductIds: string[];
  };
  notes: string[];
};

async function findOrCreateTipProduct(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
): Promise<string> {
  let startingAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    const listed = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: startingAfter,
    });
    const hit = listed.data.find((p) => p.name === TIP_PRODUCT_NAME);
    if (hit) return hit.id;
    if (!listed.has_more) break;
    startingAfter = listed.data[listed.data.length - 1]?.id;
  }
  const product = await stripe.products.create({
    name: TIP_PRODUCT_NAME,
    description:
      "Optional tip — thank you! One-time support for Coach Jeremy / The Train Station.",
    metadata: { kind: "coach_tip", app: "train-station" },
  });
  return product.id;
}

async function findOrCreateOneTimePrice(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  productId: string,
  amountCents: number,
  nickname: string,
): Promise<string> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const hit = prices.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.currency === "usd" &&
      p.type === "one_time" &&
      !p.recurring,
  );
  if (hit) return hit.id;
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    nickname,
    metadata: { kind: "coach_tip" },
  });
  return price.id;
}

async function recurringMembershipProductIds(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
): Promise<string[]> {
  const planIds = ["member", "business"] as const;
  const out = new Set<string>();
  for (const planId of planIds) {
    const priceId = await resolveStripePriceId(planId);
    if (!priceId) continue;
    try {
      const price = await stripe.prices.retrieve(priceId);
      const prod =
        typeof price.product === "string" ? price.product : price.product?.id;
      if (prod) out.add(prod);
    } catch {
      /* skip */
    }
  }
  return [...out];
}

async function ensureFeedback50(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  productIds: string[],
): Promise<OpsBootstrapResult["feedback"]> {
  const existing = await stripe.promotionCodes.list({
    code: FEEDBACK_CODE,
    limit: 1,
  });
  if (existing.data[0]) {
    const p = existing.data[0];
    if (!p.active) {
      await stripe.promotionCodes.update(p.id, { active: true });
    }
    const promoCoupon = p.promotion?.coupon;
    const couponId =
      typeof promoCoupon === "string"
        ? promoCoupon
        : promoCoupon && typeof promoCoupon === "object" && "id" in promoCoupon
          ? String((promoCoupon as { id: string }).id)
          : "";
    return {
      code: FEEDBACK_CODE,
      couponId,
      promotionCodeId: p.id,
      active: true,
      appliesToProductIds: productIds,
    };
  }

  const coupon = await stripe.coupons.create({
    name: "Feedback · 50% × 3 months",
    percent_off: 50,
    duration: "repeating",
    duration_in_months: 3,
    ...(productIds.length > 0 ? { applies_to: { products: productIds } } : {}),
    metadata: {
      source: "train-station-ops-bootstrap",
      applies_to: "subscription",
      code: FEEDBACK_CODE,
    },
  });

  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: FEEDBACK_CODE,
    metadata: {
      source: "train-station-ops-bootstrap",
      applies_to: "subscription",
    },
  });

  return {
    code: FEEDBACK_CODE,
    couponId: coupon.id,
    promotionCodeId: promo.id,
    active: true,
    appliesToProductIds: productIds,
  };
}

/**
 * Idempotent: tip product/prices + FEEDBACK50 on the Stripe account behind STRIPE_SECRET_KEY.
 */
export async function runStripeOpsBootstrap(): Promise<
  OpsBootstrapResult | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured (STRIPE_SECRET_KEY)." };

  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const mode = key.startsWith("sk_live")
    ? "live"
    : key.startsWith("sk_test")
      ? "test"
      : "unknown";

  let accountId: string | null = null;
  try {
    // Some Stripe type packs require an account id; empty string = platform account.
    const acct = await stripe.accounts.retrieve("");
    accountId = acct.id;
  } catch {
    /* claimable keys may block accounts.retrieve */
  }

  const notes: string[] = [];
  const tipProductId = await findOrCreateTipProduct(stripe);
  const tipEnv: Record<string, string> = {};

  for (const preset of TIP_PRESETS) {
    tipEnv[preset.env] = await findOrCreateOneTimePrice(
      stripe,
      tipProductId,
      preset.amount,
      preset.nickname,
    );
  }
  tipEnv[TIP_CUSTOM.env] = await findOrCreateOneTimePrice(
    stripe,
    tipProductId,
    TIP_CUSTOM.amount,
    TIP_CUSTOM.nickname,
  );

  const productIds = await recurringMembershipProductIds(stripe);
  if (productIds.length === 0) {
    notes.push(
      "No membership product IDs resolved — FEEDBACK50 created without applies_to restriction. Set STRIPE_PRICE_MEMBER/BUSINESS and re-run to restrict.",
    );
  }

  const feedback = await ensureFeedback50(stripe, productIds);
  notes.push(
    "Paste tipEnv into Vercel Production and redeploy so tips.enabled becomes true.",
  );
  notes.push(
    "Members enter FEEDBACK50 at checkout (no env var). Connect Express still required for platform admin payouts.",
  );

  return {
    mode,
    accountId,
    tipProductId,
    tipEnv,
    feedback,
    notes,
  };
}
