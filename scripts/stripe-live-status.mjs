#!/usr/bin/env node
/**
 * Stripe live readiness check (prod or BASE_URL).
 *   node scripts/stripe-live-status.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";

async function main() {
  const res = await fetch(`${BASE}/api/payments/public`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  console.log(`Stripe status @ ${BASE}\n`);

  if (!body.stripeEnabled) {
    console.log("❌ Stripe not enabled (missing STRIPE_SECRET_KEY?)");
    process.exit(1);
  }

  const pk = body.stripePublishableKey || "";
  const testMode = body.stripeTestMode === true || pk.startsWith("pk_test_");
  console.log(testMode ? "⚠️  TEST MODE" : "✅ LIVE MODE");
  console.log(`   Publishable: ${pk ? pk.slice(0, 12) + "…" : "missing"}`);

  if (body.stripeDiag?.keyMode) {
    console.log(`   Secret key mode: ${body.stripeDiag.keyMode}`);
  }

  for (const m of body.memberships || []) {
    const ok = m.stripeReady ? "✓" : "✗";
    console.log(`   ${ok} ${m.label} (${m.plan}) — ${m.priceLabel}`);
  }

  if (testMode) {
    console.log("\nTo go live:");
    console.log("  1. Stripe Dashboard → Live mode → create products/prices");
    console.log("  2. Vercel → sk_live_…, pk_live_…, live price_… IDs, live whsec_…");
    console.log("  3. Webhook: https://www.thetrainstation.co/api/stripe/webhook");
    console.log("  4. Redeploy → run this script again (expect LIVE MODE)");
    process.exit(0);
  }

  console.log("\n✅ Stripe appears live. Do one real $25 signup (refund if needed) and check webhook 200.");
}

main();