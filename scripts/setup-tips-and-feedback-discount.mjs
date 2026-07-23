#!/usr/bin/env node
/**
 * One-shot on Jeremy’s Stripe (Test or Live — uses whatever key you pass):
 *  1) Tip product + price IDs (idempotent)
 *  2) FEEDBACK50 = 50% off for 3 months on recurring membership products
 *
 *   STRIPE_SECRET_KEY='sk_test_…' npx tsx scripts/setup-tips-and-feedback-discount.mjs
 *
 * Then paste printed STRIPE_PRICE_TIP_* into Vercel Production and redeploy.
 * FEEDBACK50 is a Stripe promotion code — no env var required (members type it at checkout).
 */
import dotenv from "dotenv";

const keyFromShell = process.env.STRIPE_SECRET_KEY?.trim();
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
if (keyFromShell) process.env.STRIPE_SECRET_KEY = keyFromShell;

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const mode = key.startsWith("sk_live") ? "live" : key.startsWith("sk_test") ? "test" : "unknown";
console.log(`Stripe mode: ${mode}`);

const Stripe = (await import("stripe")).default;
const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });

const TIP_NAME = "Tip your coach";
const PRESETS = [
  { amount: 500, nickname: "Tip $5", env: "STRIPE_PRICE_TIP_5" },
  { amount: 1000, nickname: "Tip $10", env: "STRIPE_PRICE_TIP_10" },
  { amount: 2500, nickname: "Tip $25", env: "STRIPE_PRICE_TIP_25" },
  { amount: 5000, nickname: "Tip $50", env: "STRIPE_PRICE_TIP_50" },
];
const CUSTOM = { amount: 100, nickname: "Custom tip ($1 units)", env: "STRIPE_PRICE_TIP_CUSTOM" };
const FEEDBACK_CODE = "FEEDBACK50";

async function findOrCreateTipProduct() {
  let startingAfter;
  for (let page = 0; page < 10; page++) {
    const listed = await stripe.products.list({ active: true, limit: 100, starting_after: startingAfter });
    const hit = listed.data.find((p) => p.name === TIP_NAME);
    if (hit) {
      console.log(`Tip product: reuse ${hit.id}`);
      return hit;
    }
    if (!listed.has_more) break;
    startingAfter = listed.data[listed.data.length - 1]?.id;
  }
  const product = await stripe.products.create({
    name: TIP_NAME,
    description: "Optional tip — thank you! One-time support for Coach Jeremy / The Train Station.",
    metadata: { kind: "coach_tip", app: "train-station" },
  });
  console.log(`Tip product: created ${product.id}`);
  return product;
}

async function findOrCreatePrice(productId, amountCents, nickname) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const hit = prices.data.find(
    (p) => p.unit_amount === amountCents && p.currency === "usd" && p.type === "one_time" && !p.recurring,
  );
  if (hit) {
    console.log(`  price reuse ${hit.id} ($${amountCents / 100})`);
    return hit;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    nickname,
    metadata: { kind: "coach_tip" },
  });
  console.log(`  price create ${price.id} ($${amountCents / 100})`);
  return price;
}

async function productIdsForMembershipRecurring() {
  const envKeys = ["STRIPE_PRICE_MEMBER", "STRIPE_PRICE_BUSINESS"];
  const productIds = new Set();
  for (const envKey of envKeys) {
    const priceId = process.env[envKey]?.trim();
    if (!priceId?.startsWith("price_")) {
      console.log(`  (skip ${envKey} — not set)`);
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(priceId);
      const prod = typeof price.product === "string" ? price.product : price.product?.id;
      if (prod) {
        productIds.add(prod);
        console.log(`  ${envKey} → product ${prod}`);
      }
    } catch (e) {
      console.log(`  ${envKey} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return [...productIds];
}

async function ensureFeedback50(productIds) {
  // Existing promo?
  const existing = await stripe.promotionCodes.list({ code: FEEDBACK_CODE, limit: 1 });
  if (existing.data[0]) {
    const p = existing.data[0];
    console.log(`FEEDBACK50: reuse promo ${p.id} active=${p.active}`);
    if (!p.active) {
      await stripe.promotionCodes.update(p.id, { active: true });
      console.log("  re-enabled");
    }
    return p;
  }

  const coupon = await stripe.coupons.create({
    name: "Feedback · 50% × 3 months",
    percent_off: 50,
    duration: "repeating",
    duration_in_months: 3,
    ...(productIds.length > 0 ? { applies_to: { products: productIds } } : {}),
    metadata: {
      source: "train-station-setup-script",
      applies_to: "subscription",
      code: FEEDBACK_CODE,
    },
  });
  console.log(`FEEDBACK50 coupon ${coupon.id}${productIds.length ? ` applies_to ${productIds.length} products` : " (unrestricted — set STRIPE_PRICE_MEMBER/BUSINESS)"}`);

  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: FEEDBACK_CODE,
    metadata: { source: "train-station-setup-script", applies_to: "subscription" },
  });
  console.log(`FEEDBACK50 promo ${promo.id}`);
  return promo;
}

async function main() {
  const acct = await stripe.accounts.retrieve().catch(() => null);
  if (acct) console.log(`Account ${acct.id}`);

  console.log("\n=== Tips ===");
  const tipProduct = await findOrCreateTipProduct();
  const tipEnv = [];
  for (const preset of PRESETS) {
    const price = await findOrCreatePrice(tipProduct.id, preset.amount, preset.nickname);
    tipEnv.push(`${preset.env}=${price.id}`);
  }
  const custom = await findOrCreatePrice(tipProduct.id, CUSTOM.amount, CUSTOM.nickname);
  tipEnv.push(`${CUSTOM.env}=${custom.id}`);

  console.log("\n=== FEEDBACK50 (50% × 3 months, recurring) ===");
  const productIds = await productIdsForMembershipRecurring();
  await ensureFeedback50(productIds);

  console.log("\n=== Vercel Production env (paste / vercel env add) ===");
  for (const line of tipEnv) console.log(line);
  console.log("\nMembers use code FEEDBACK50 at checkout (no env var).");
  console.log("Redeploy after saving tip price IDs.");
  console.log(
    JSON.stringify(
      {
        mode,
        tips: Object.fromEntries(tipEnv.map((l) => l.split("="))),
        feedbackCode: FEEDBACK_CODE,
        recurringProducts: productIds,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
