#!/usr/bin/env node
/**
 * Create Live/Test "Tip your coach" product + one-time prices, print env lines.
 *
 *   STRIPE_SECRET_KEY=sk_… npx tsx scripts/create-stripe-tip-products.mjs
 *   # or with Vercel secrets injected:
 *   vercel env run -e production -- npx tsx scripts/create-stripe-tip-products.mjs
 *
 * Idempotent: reuses existing product named "Tip your coach" if present.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env.go-prod", override: true });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const mode = key.startsWith("sk_live") ? "live" : key.startsWith("sk_test") ? "test" : "unknown";
console.log(`Stripe mode: ${mode} (key len ${key.length})`);

const Stripe = (await import("stripe")).default;
const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });

const PRODUCT_NAME = "Tip your coach";
const PRESETS = [
  { amount: 500, nickname: "Tip $5", env: "STRIPE_PRICE_TIP_5" },
  { amount: 1000, nickname: "Tip $10", env: "STRIPE_PRICE_TIP_10" },
  { amount: 2500, nickname: "Tip $25", env: "STRIPE_PRICE_TIP_25" },
  { amount: 5000, nickname: "Tip $50", env: "STRIPE_PRICE_TIP_50" },
];
const CUSTOM = { amount: 100, nickname: "Custom tip ($1 units)", env: "STRIPE_PRICE_TIP_CUSTOM" };

async function findOrCreateProduct() {
  // Prefer list (works on all accounts); search is optional.
  let startingAfter = undefined;
  for (let page = 0; page < 10; page += 1) {
    const listed = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: startingAfter,
    });
    const hit = listed.data.find((p) => p.name === PRODUCT_NAME);
    if (hit) {
      console.log(`Reusing product ${hit.id}`);
      return hit;
    }
    if (!listed.has_more) break;
    startingAfter = listed.data[listed.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "Optional tip — thank you! One-time support for Coach Jeremy / The Train Station.",
    metadata: { kind: "coach_tip", app: "train-station" },
  });
  console.log(`Created product ${product.id}`);
  return product;
}

async function findOrCreatePrice(productId, amountCents, nickname) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const hit = prices.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.currency === "usd" &&
      p.type === "one_time" &&
      !p.recurring,
  );
  if (hit) {
    console.log(`Reusing price ${hit.id} ($${amountCents / 100})`);
    return hit;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    nickname,
    metadata: { kind: "coach_tip" },
  });
  console.log(`Created price ${price.id} ($${amountCents / 100})`);
  return price;
}

async function main() {
  const acct = await stripe.accounts.retrieve();
  console.log(`Account: ${acct.id} ${acct.settings?.dashboard?.display_name || acct.business_profile?.name || ""}`);

  const product = await findOrCreateProduct();
  const envLines = [];

  for (const preset of PRESETS) {
    const price = await findOrCreatePrice(product.id, preset.amount, preset.nickname);
    envLines.push(`${preset.env}=${price.id}`);
  }
  const custom = await findOrCreatePrice(product.id, CUSTOM.amount, CUSTOM.nickname);
  envLines.push(`${CUSTOM.env}=${custom.id}`);

  console.log("\n=== Vercel Production env (copy/add) ===");
  for (const line of envLines) console.log(line);
  console.log("\n=== Done ===");
  console.log(JSON.stringify({ productId: product.id, env: Object.fromEntries(envLines.map((l) => l.split("="))) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
