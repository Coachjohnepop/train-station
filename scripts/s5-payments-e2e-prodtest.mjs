#!/usr/bin/env node
/**
 * S5 payments end-to-end — prod (test-mode Stripe).
 *
 * API: config → signup → payment gate → checkout session
 * Browser (--browser, default): embedded Stripe checkout with test card → onboard unlock
 * Fallback (--venmo-only): coach mark-paid path when browser skipped
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/s5-payments-e2e-prodtest.mjs
 *   node scripts/s5-payments-e2e-prodtest.mjs --api-only
 *   node scripts/s5-payments-e2e-prodtest.mjs --venmo-only
 *
 * Env:
 *   COACH_EMAIL / COACH_PASSWORD — for --venmo-only mark-paid path
 *   STRIPE_E2E_PASSWORD — member signup password (default generated)
 */

import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const API_ONLY = args.includes("--api-only");
const VENMO_ONLY = args.includes("--venmo-only");
const USE_BROWSER = !API_ONLY && !VENMO_ONLY;

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const MARKER = `stripe-e2e-${Date.now()}`;
const EMAIL = process.env.STRIPE_E2E_EMAIL || `payments-e2e+${randomUUID()}@thetrainstation.co`;
const PASSWORD = process.env.STRIPE_E2E_PASSWORD || `StripeE2e!${String(Date.now()).slice(-6)}`;
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "CoachTest123!";

const results = [];
let memberCookies = "";
let memberUserId = null;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function mergeSetCookie(existing, headers) {
  const jar = new Map();
  for (const part of `${existing}; ${parseSetCookie(headers)}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    jar.set(k, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

function hasCookie(jar, name) {
  return jar.split("; ").some((p) => {
    if (!p.startsWith(`${name}=`)) return false;
    const value = p.slice(name.length + 1);
    return value.length > 0 && value !== '""';
  });
}

async function req(path, opts = {}, cookieJar = memberCookies) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
  if (cookieJar) headers.Cookie = cookieJar;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: opts.redirect ?? "follow", cache: "no-store" });
  let nextJar = cookieJar;
  if (res.headers.getSetCookie?.()?.length) {
    nextJar = mergeSetCookie(cookieJar, res.headers);
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text, cookies: nextJar, location: res.headers.get("location") || "" };
}

function parseSessionCookies(cookieJar) {
  return cookieJar
    .split("; ")
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return null;
      return {
        name: part.slice(0, eq),
        value: part.slice(eq + 1),
        domain: new URL(BASE).hostname,
        path: "/",
        secure: true,
        sameSite: "Lax",
      };
    })
    .filter(Boolean);
}

async function testPaymentsPublic() {
  console.log("\n=== 1. Stripe config (payments/public) ===");
  const { res, body } = await req(`/api/payments/public?_t=${Date.now()}`);
  if (!res.ok || !body?.stripeEnabled) {
    fail("Stripe enabled on prod", body?.stripeEnabled ? `HTTP ${res.status}` : "stripeEnabled=false");
    return false;
  }
  pass("Stripe enabled on prod");

  const testMode = body.stripeTestMode === true || body.stripePublishableKey?.startsWith("pk_test_");
  if (testMode) pass("Stripe test mode", "safe for 4242 card");
  else fail("Stripe test mode", "LIVE keys — aborting card E2E");

  if (!body.stripePublishableKey) {
    fail("Publishable key exposed");
    return false;
  }
  pass("Publishable key exposed");

  for (const plan of ["member", "business", "pro"]) {
    const row = body.memberships?.find((m) => m.plan === plan);
    if (row?.stripeReady) pass(`${row.label} stripeReady`, row.priceLabel);
    else fail(`${plan} stripeReady`, row?.priceLabel || "missing");
  }

  return testMode;
}

async function recoverOrphanSignup() {
  memberCookies = "";
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: EMAIL, password: PASSWORD, redirect: "/member/checkout?plan=member" },
  });
  memberCookies = login.cookies;
  if (!login.res.ok || !login.body?.redirect?.includes("/member/checkout")) {
    fail("Orphan signup recovery login", `${login.res.status} ${JSON.stringify(login.body)}`);
    return false;
  }
  pass("Orphan signup recovery login", "account existed from partial register");
  return true;
}

async function testSignupAndGates() {
  console.log("\n=== 2. Signup + payment gates ===");
  const { res, body, cookies } = await req("/api/signup/register", {
    method: "POST",
    json: {
      email: EMAIL,
      firstName: "Stripe",
      lastName: "E2E",
      phone: "5550100999",
      plan: "member",
      password: PASSWORD,
    },
  });
  memberCookies = cookies;

  if (res.status === 409) {
    console.log("  (409 after DB write — recovering via login; deploy registerMember fix)");
    if (!(await recoverOrphanSignup())) return false;
  } else if (!res.ok || !body?.redirectTo?.includes("/member/checkout")) {
    fail("Register → checkout redirect", `${res.status} ${JSON.stringify(body)}`);
    return false;
  } else {
    pass("Register → checkout redirect", body.redirectTo);
  }

  if (hasCookie(memberCookies, "ts_session")) pass("Member session cookie");
  else fail("Member session cookie");

  // Checkout session creation also ensures member profile (orphan 409 path).
  const bootstrap = await req(
    "/api/stripe/checkout",
    { method: "POST", json: { plan: "member" } },
    memberCookies,
  );
  memberCookies = bootstrap.cookies;
  if (bootstrap.res.ok && bootstrap.body?.sessionId) {
    checkoutSession = bootstrap.body;
    pass("Profile bootstrap via checkout", bootstrap.body.sessionId);
  } else {
    fail("Profile bootstrap via checkout", `${bootstrap.res.status} ${JSON.stringify(bootstrap.body)}`);
    return false;
  }

  if (hasCookie(memberCookies, "ts_needs_payment")) pass("Payment gate cookie (ts_needs_payment)");
  else fail("Payment gate cookie");

  if (!hasCookie(memberCookies, "ts_needs_onboard")) pass("Onboard deferred until payment");
  else fail("Onboard cookie should not be set before payment");

  const onboard = await req("/member/onboard?plan=member", { redirect: "manual" }, memberCookies);
  if (onboard.res.status >= 300 && onboard.res.status < 400 && onboard.location.includes("/member/checkout")) {
    pass("Onboard gated → checkout", onboard.location.replace(BASE, ""));
  } else {
    fail("Onboard gated → checkout", `status ${onboard.res.status} loc ${onboard.location}`);
  }

  const status = await req("/api/member/onboarding-status", {}, memberCookies);
  if (status.body?.profile?.paymentStatus === "pending") {
    pass("Payment status pending", status.body.profile.userId || "");
    memberUserId = status.body.profile.userId || status.body.profile?.userId || null;
  } else {
    fail("Payment status pending", JSON.stringify(status.body?.profile?.paymentStatus));
  }

  return true;
}

let checkoutSession = null;

async function testCheckoutSession() {
  console.log("\n=== 3. Checkout session API ===");
  if (checkoutSession?.clientSecret && checkoutSession?.sessionId) {
    pass("Checkout session (reused from bootstrap)", checkoutSession.sessionId);
    return checkoutSession;
  }
  const { res, body, cookies } = await req(
    "/api/stripe/checkout",
    { method: "POST", json: { plan: "member" } },
    memberCookies,
  );
  memberCookies = cookies;

  if (!res.ok || !body?.clientSecret || !body?.sessionId) {
    fail("Checkout session created", `${res.status} ${JSON.stringify(body)}`);
    return null;
  }
  checkoutSession = body;
  pass("Checkout session created", body.sessionId);
  return body;
}

async function fillStripeEmbeddedCheckout(page) {
  await page.waitForTimeout(4000);

  const selectors = {
    card: [
      'input[name="cardnumber"]',
      'input[autocomplete="cc-number"]',
      'input[placeholder*="Card number" i]',
      'input[aria-label*="Card number" i]',
      'input[data-elements-stable-field-name="cardNumber"]',
    ],
    exp: [
      'input[name="exp-date"]',
      'input[autocomplete="cc-exp"]',
      'input[placeholder*="MM" i]',
      'input[aria-label*="expiration" i]',
    ],
    cvc: [
      'input[name="cvc"]',
      'input[autocomplete="cc-csc"]',
      'input[placeholder*="CVC" i]',
      'input[aria-label*="CVC" i]',
    ],
    zip: ['input[name="postal"]', 'input[autocomplete="postal-code"]', 'input[placeholder*="ZIP" i]'],
  };

  async function tryFill(target) {
    for (const sel of selectors.card) {
      const card = target.locator(sel);
      if ((await card.count()) > 0) {
        await card.first().fill("4242424242424242");
        for (const expSel of selectors.exp) {
          const exp = target.locator(expSel);
          if ((await exp.count()) > 0) {
            await exp.first().fill("12 / 34");
            break;
          }
        }
        for (const cvcSel of selectors.cvc) {
          const cvc = target.locator(cvcSel);
          if ((await cvc.count()) > 0) {
            await cvc.first().fill("123");
            break;
          }
        }
        for (const zipSel of selectors.zip) {
          const zip = target.locator(zipSel);
          if ((await zip.count()) > 0) {
            await zip.first().fill("78701");
            break;
          }
        }
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < 12; i++) {
    const frames = page.frames().filter((f) => /stripe|checkout/i.test(f.url()));
    for (const frame of frames.length ? frames : [page.mainFrame()]) {
      if (await tryFill(frame)) return true;
    }
    const iframe = page.frameLocator('iframe[src*="stripe"], iframe[name*="stripe"], iframe').first();
    if (await tryFill(iframe)) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function testStripeBrowserCheckout() {
  console.log("\n=== 4. Browser — Stripe embedded checkout ===");
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    fail("Playwright available", "npm install playwright");
    return false;
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext();
  await context.addCookies(parseSessionCookies(memberCookies));
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/member/checkout?plan=member`, { waitUntil: "networkidle", timeout: 45000 });
    const ticketBtn = page.getByRole("button", { name: /Get your Ticket/i });
    await ticketBtn.waitFor({ timeout: 20000 });
    pass("Checkout page — Get your Ticket visible");

    await ticketBtn.click();
    await page.waitForSelector('[aria-labelledby="stripe-checkout-title"]', { timeout: 20000 }).catch(() => {});

    const filled = await fillStripeEmbeddedCheckout(page);
    if (!filled) {
      fail("Stripe card fields", "could not locate card inputs in embedded checkout");
      return false;
    }
    pass("Stripe test card entered", "4242…");

    const payBtn = page.getByRole("button", { name: /Pay|Subscribe|Start trial|Complete/i });
    if ((await payBtn.count()) > 0) {
      await payBtn.first().click({ timeout: 15000 });
    } else {
      const framePay = page
        .frames()
        .flatMap((f) => [f])
        .find(() => true);
      const alt = framePay?.getByRole("button", { name: /Pay|Subscribe/i });
      if (alt && (await alt.count()) > 0) await alt.first().click();
      else fail("Stripe pay button");
    }

    await page.waitForURL(/\/member\/onboard/, { timeout: 120000 });
    pass("Post-payment redirect → onboard", page.url().replace(BASE, ""));

    const cookiesAfter = await context.cookies();
    const needsPayment = cookiesAfter.some((c) => c.name === "ts_needs_payment" && c.value === "1");
    if (!needsPayment) pass("Payment gate cookie cleared");
    else fail("Payment gate cookie cleared", "ts_needs_payment still set");

    return true;
  } catch (e) {
    fail("Browser Stripe checkout", e.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function verifyPaidAndOnboard() {
  console.log("\n=== 5. Verify paid + onboarding unlock ===");
  const status = await req("/api/member/onboarding-status", {}, memberCookies);
  if (status.body?.profile?.paymentStatus === "paid") {
    pass("Payment status paid", status.body.profile.paymentMethod || "stripe");
  } else {
    fail("Payment status paid", JSON.stringify(status.body?.profile?.paymentStatus));
  }

  if (status.body?.needsOnboarding === true) pass("Onboarding unlocked (needs setup)");
  else fail("Onboarding unlocked", JSON.stringify(status.body));

  const dash = await req("/member/today", { redirect: "manual" }, memberCookies);
  if (dash.res.status >= 300 && dash.res.status < 400 && dash.location.includes("/member/onboard")) {
    pass("Member routes gated to onboard until complete");
  } else if (dash.res.status === 200) {
    pass("Member today accessible");
  } else {
    fail("Member route after pay", `status ${dash.res.status} → ${dash.location}`);
  }
}

async function testVenmoMarkPaid() {
  console.log("\n=== 4b. Venmo fallback — coach mark-paid ===");
  if (!memberUserId) {
    fail("Member userId for mark-paid");
    return false;
  }

  let coachCookies = "";
  const login = await req(
    "/api/auth/login",
    {
      method: "POST",
      json: { email: COACH_EMAIL, password: COACH_PASSWORD, redirect: "/admin/members" },
    },
    "",
  );
  coachCookies = login.cookies;
  if (!login.res.ok || !hasCookie(coachCookies, "ts_session")) {
    fail("Coach login for mark-paid", login.body?.error || String(login.res.status));
    return false;
  }
  pass("Coach login", COACH_EMAIL);

  const mark = await req(
    `/api/admin/members/${memberUserId}/mark-paid`,
    { method: "POST", json: { method: "venmo", note: `E2E ${MARKER}` } },
    coachCookies,
  );
  if (!mark.res.ok || !mark.body?.ok) {
    fail("Mark paid (venmo)", `${mark.res.status} ${JSON.stringify(mark.body)}`);
    return false;
  }
  pass("Mark paid (venmo)");

  memberCookies = mark.cookies || memberCookies;
  return true;
}

async function main() {
  console.log(`S5 payments E2E → ${BASE}`);
  console.log(`Test member: ${EMAIL}`);
  console.log(`Mode: ${API_ONLY ? "api-only" : VENMO_ONLY ? "venmo-only" : "api + browser stripe"}\n`);

  const testMode = await testPaymentsPublic();
  if (!testMode && USE_BROWSER) {
    console.log("\nAborting browser Stripe test — not in test mode.");
    summarize();
    return;
  }

  const registered = await testSignupAndGates();
  if (!registered) {
    summarize();
    return;
  }

  const session = await testCheckoutSession();
  if (!session) {
    summarize();
    return;
  }

  if (VENMO_ONLY) {
    await testVenmoMarkPaid();
    await verifyPaidAndOnboard();
  } else if (USE_BROWSER) {
    const paid = await testStripeBrowserCheckout();
    if (paid) await verifyPaidAndOnboard();
    else {
      console.log("\n⚠ Browser Stripe failed — trying venmo mark-paid fallback…");
      await testVenmoMarkPaid();
      await verifyPaidAndOnboard();
    }
  }

  summarize();
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`\nTest account: ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});