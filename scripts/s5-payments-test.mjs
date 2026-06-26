#!/usr/bin/env node
/**
 * S5 payments smoke test — Stripe config surface, Venmo public API, mark-paid route exists.
 * Usage: BASE_URL=https://www.thetrainstation.co npm run test:s5
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";

let cookies = "";
const results = [];

function ok(l) {
  results.push(true);
  console.log(`✅ ${l}`);
}
function bad(l, d = "") {
  results.push(false);
  console.log(`❌ ${l}${d ? ` — ${d}` : ""}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  for (const c of res.headers.getSetCookie?.() || []) {
    const jar = Object.fromEntries(
      cookies
        .split("; ")
        .filter(Boolean)
        .map((p) => p.split("="))
        .map(([k, ...v]) => [k, v.join("=")]),
    );
    const [kv] = c.split(";");
    const [k, ...v] = kv.split("=");
    jar[k] = v.join("=");
    cookies = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function main() {
  console.log(`S5 payments @ ${BASE}\n`);

  const { res, body } = await req(`/api/payments/public?_t=${Date.now()}`);
  if (res.ok && typeof body?.stripeEnabled === "boolean") {
    ok("payments/public exposes stripeEnabled");
  } else {
    bad("payments/public exposes stripeEnabled");
  }

  const coach = body?.memberships?.find((m) => m.plan === "member");
  const first = body?.memberships?.find((m) => m.plan === "pro");
  if (coach?.priceLabel?.includes("$25")) ok("Coach Class price label");
  else bad("Coach Class price label", coach?.priceLabel);

  if (first?.priceLabel?.includes("$850")) ok("1st Class price label");
  else bad("1st Class price label", first?.priceLabel);

  if (body?.venmo && typeof body.venmo.hasQr === "boolean") ok("venmo block in payments/public");
  else bad("venmo block in payments/public");

  const checkout = await req("/member/checkout?plan=member");
  if (checkout.res.ok && checkout.text.includes("Pay with Stripe")) {
    ok("checkout page renders Stripe CTA");
  } else if (checkout.res.ok && checkout.text.includes("Venmo")) {
    ok("checkout page renders Venmo section");
  } else if (checkout.res.ok) {
    ok("checkout page loads");
  } else {
    bad("checkout page loads", String(checkout.res.status));
  }

  const markPaid = await req("/api/admin/members/test-user/mark-paid", { method: "POST", json: {} });
  if (markPaid.res.status === 401) ok("mark-paid requires staff auth");
  else bad("mark-paid requires staff auth", String(markPaid.res.status));

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});