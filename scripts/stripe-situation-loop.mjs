#!/usr/bin/env node
/**
 * Stripe situation loop test — production public surfaces only.
 * No secret keys required.
 */
const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const LOOPS = Number(process.env.LOOPS || 3);
const results = [];

function log(ok, name, detail = "") {
  results.push({ ok, name, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text?.slice?.(0, 200); }
  return { res, body, text };
}

async function once(i) {
  console.log(`\n── loop ${i + 1}/${LOOPS} ──`);
  const { res, body } = await get("/api/payments/public");
  if (!res.ok) {
    log(false, "public payments API", `HTTP ${res.status}`);
    return;
  }
  log(true, "public payments API", `HTTP ${res.status}`);

  const enabled = !!body.stripeEnabled;
  log(enabled, "stripe enabled", String(enabled));

  const pk = body.stripePublishableKey || "";
  const live = pk.startsWith("pk_live_");
  const test = pk.startsWith("pk_test_");
  log(live, "publishable key mode", live ? "LIVE" : test ? "TEST" : `unknown (${pk.slice(0, 12)}…)`);
  if (live) log(true, "account key prefix", pk.slice(0, 20) + "…");

  const memberships = body.memberships || [];
  for (const m of memberships) {
    log(!!m.stripeReady, `price ready: ${m.label}`, `${m.priceLabel} / ${m.checkoutMode}`);
  }

  // Tip products
  const tip = await get("/api/stripe/tip");
  if (tip.res.ok) {
    const tips = tip.body?.prices || tip.body?.amounts || tip.body;
    log(true, "tip endpoint", typeof tips === "object" ? JSON.stringify(tips).slice(0, 120) : String(tip.res.status));
  } else {
    log(tip.res.status === 401 || tip.res.status === 405, "tip endpoint", `HTTP ${tip.res.status} (auth may be required)`);
  }

  // Unauthenticated checkout should fail cleanly, not 500
  const co = await fetch(`${BASE}/api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "member" }),
    cache: "no-store",
  });
  const coText = await co.text();
  let coBody = null;
  try { coBody = JSON.parse(coText); } catch { coBody = { raw: coText.slice(0, 120) }; }
  log(
    co.status === 401 || co.status === 403 || (co.status === 400 && coBody?.error),
    "checkout without session",
    `HTTP ${co.status} ${coBody?.error || coBody?.message || ""}`.trim(),
  );

  // Commission payout without auth should not run
  const pay = await fetch(`${BASE}/api/stripe/commission/payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRun: true }),
    cache: "no-store",
  });
  log(
    pay.status === 401 || pay.status === 403,
    "commission payout gated",
    `HTTP ${pay.status}`,
  );

  // Platform admin fee gated
  const paf = await get("/api/stripe/commission/platform-admin-fee");
  log(
    paf.res.status === 401 || paf.res.status === 403,
    "platform admin fee gated",
    `HTTP ${paf.res.status}`,
  );
}

async function main() {
  console.log(`Stripe loop test @ ${BASE}`);
  console.log("Money model reminder:");
  console.log("  • Member card charges settle on JEREMY'S master Stripe (merchant of record).");
  console.log("  • John commission is NOT at swipe — Connect transfer later from that balance.");
  console.log("  • Discounted checkouts still show as Payment/Charge if amount > $0.");
  console.log("  • $0 / 100% off coupons may not create a transferrable charge.");

  for (let i = 0; i < LOOPS; i++) await once(i);

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`${ok} passed / ${bad} failed across ${LOOPS} loops (${results.length} checks)`);

  // Consistent live mode across loops
  const liveChecks = results.filter((r) => r.name === "publishable key mode");
  const allLive = liveChecks.every((r) => r.ok);
  console.log(`Live mode stable across loops: ${allLive ? "YES" : "NO"}`);

  if (allLive && bad === 0) {
    console.log("\nSite Stripe wiring looks LIVE and healthy from public surfaces.");
    console.log("If Jeremy still sees $0 in Dashboard:");
    console.log("  1. Confirm Dashboard is LIVE mode (not Test toggle).");
    console.log("  2. Confirm login is Jeremy’s Train Station Live account (not John’s personal Stripe).");
  console.log("     Admin → Billing must show Jeremy’s email / business name on the platform tab.");
    console.log("  3. Payments → look for succeeded PaymentIntents / Charges, not Connect balance.");
    console.log("  4. If promo was 100% off, amount charged can be $0 → nothing to settle.");
    console.log("  5. Pending bank payouts ≠ zero balance; check Balance + Payouts separately.");
  }
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
