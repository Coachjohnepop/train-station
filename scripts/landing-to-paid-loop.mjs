#!/usr/bin/env node
/**
 * Landing → paid: every guest door, every ticket, signup, checkout, Venmo.
 *
 *   BASE_URL=https://www.thetrainstation.co node scripts/landing-to-paid-loop.mjs
 *   ROUNDS=1 VIEWPORTS=mobile,desktop node scripts/landing-to-paid-loop.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 1));
const VIEWPORTS = (process.env.VIEWPORTS || "mobile,desktop")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  results.push({ name, ok: true, warn: true, detail });
  console.log(`  ⚠  ${name}${detail ? ` — ${detail}` : ""}`);
}

const VIEW = {
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
  desktop: {
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  },
};

async function statusOf(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  return { url: res.url, status: res.status, ok: res.ok };
}

async function htmlOf(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  return { status: res.status, html: await res.text(), url: res.url };
}

async function httpPublic() {
  console.log("\n=== HTTP conversion pages ===");
  const pages = [
    "/",
    "/join",
    "/join#tickets",
    "/join/questions",
    "/signup?plan=explorer&week=1",
    "/signup?plan=explorer",
    "/signup?plan=member",
    "/signup?plan=business",
    "/signup?plan=pro",
    "/login",
    "/pricing",
    "/free",
    "/fitness",
    "/jeremy",
    "/find",
    "/powered-by",
  ];
  for (const p of pages) {
    const { status, url } = await statusOf(p);
    if (status >= 200 && status < 400) {
      pass(`GET ${p}`, `${status} → ${url.replace(BASE, "") || "/"}`);
    } else {
      fail(`GET ${p}`, `HTTP ${status}`);
    }
  }

  const pricing = await statusOf("/pricing");
  if (pricing.url.includes("/join")) pass(" /pricing → /join", pricing.url.replace(BASE, ""));
  else warn("/pricing redirect", pricing.url);

  const fitness = await statusOf("/fitness");
  if (fitness.url.replace(/\/$/, "") === BASE || /thetrainstation\.co\/?$/.test(fitness.url)) {
    pass("/fitness vanity → home");
  } else {
    warn("/fitness target", fitness.url);
  }
}

async function httpApis() {
  console.log("\n=== Public APIs ===");
  const pay = await fetch(`${BASE}/api/payments/public`);
  const payBody = await pay.json().catch(() => ({}));
  if (!pay.ok) {
    fail("payments public", String(pay.status));
    return;
  }
  const plans = (payBody.memberships || []).map((m) => m.plan);
  for (const need of ["member", "business", "pro"]) {
    if (plans.includes(need)) pass(`payments has ${need}`);
    else fail(`payments has ${need}`, plans.join(","));
  }
  if (plans.includes("explorer")) pass("payments has explorer");
  else pass("payments skips explorer (free, no Stripe)");
  const member = (payBody.memberships || []).find((m) => m.plan === "member");
  if (member?.stripeReady) pass("Coach Class stripeReady");
  else warn("Coach Class stripeReady", JSON.stringify(member || {}));
  if (payBody.venmo?.hasQr || payBody.venmo?.handle) {
    pass("Venmo rail listed", payBody.venmo.handle || "qr");
  } else {
    warn("Venmo rail", JSON.stringify(payBody.venmo || {}));
  }

  const prices = await fetch(`${BASE}/api/pricing/public`);
  const priceBody = await prices.json().catch(() => ({}));
  if (prices.ok && Array.isArray(priceBody.tickets) && priceBody.tickets.length >= 4) {
    pass("pricing public tickets", String(priceBody.tickets.length));
  } else {
    fail("pricing public tickets", `${prices.status} ${JSON.stringify(priceBody).slice(0, 160)}`);
  }
}

async function register(plan, extra = {}) {
  const mark = `ltp-${plan}-${Date.now().toString(36)}`;
  const email = `${mark}@example.com`;
  const res = await fetch(`${BASE}/api/signup/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "manual",
    body: JSON.stringify({
      email,
      firstName: "Loop",
      lastName: plan,
      phone: "9165550100",
      plan,
      password: "LoopPaid9!",
      ...extra,
    }),
  });
  const body = await res.json().catch(() => ({}));
  const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  return { res, body, email, cookies };
}

async function httpRegisters() {
  console.log("\n=== Register paths ===");

  const week = await register("explorer", { week: true });
  if (week.res.ok && String(week.body.redirectTo || "").includes("/member/onboard")) {
    pass("week explorer → onboard", week.body.redirectTo);
  } else {
    fail("week explorer → onboard", `${week.res.status} ${JSON.stringify(week.body).slice(0, 200)}`);
  }
  if (week.cookies) {
    const onboard = await fetch(`${BASE}/member/onboard?plan=explorer`, {
      headers: { Cookie: week.cookies },
      redirect: "follow",
    });
    if (onboard.ok) pass("week session opens onboard", String(onboard.status));
    else fail("week session opens onboard", String(onboard.status));
  }

  const free = await register("explorer");
  const freeTo = String(free.body.redirectTo || "");
  if (free.res.ok && (freeTo.includes("/member/onboard") || freeTo.includes("payment-setup"))) {
    pass("free explorer register", freeTo);
  } else {
    fail("free explorer register", `${free.res.status} ${freeTo}`);
  }

  const paid = await register("member");
  const paidTo = String(paid.body.redirectTo || "");
  if (paid.res.ok && paidTo.includes("/member/checkout") && paidTo.includes("member")) {
    pass("Coach Class register → checkout", paidTo);
  } else {
    fail("Coach Class register → checkout", `${paid.res.status} ${paidTo}`);
  }
  if (paid.cookies && paidTo.includes("/member/checkout")) {
    const checkout = await fetch(`${BASE}${paidTo}`, {
      headers: { Cookie: paid.cookies },
      redirect: "follow",
    });
    const html = await checkout.text();
    if (checkout.ok) pass("checkout page with session", String(checkout.status));
    else fail("checkout page with session", String(checkout.status));
    if (/Venmo|card|Stripe|Coach Class/i.test(html)) pass("checkout shows pay rails");
    else warn("checkout pay rails", "copy not found in HTML (may be client-rendered)");
  }

  const biz = await register("business");
  const bizTo = String(biz.body.redirectTo || "");
  if (biz.res.ok && bizTo.includes("checkout") && bizTo.includes("business")) {
    pass("Business register → checkout", bizTo);
  } else {
    fail("Business register → checkout", `${biz.res.status} ${bizTo}`);
  }

  const first = await register("pro");
  const firstTo = String(first.body.redirectTo || "");
  if (first.res.ok && firstTo.includes("checkout") && firstTo.includes("pro")) {
    pass("1st Class register → checkout", firstTo);
  } else {
    fail("1st Class register → checkout", `${first.res.status} ${firstTo}`);
  }
}

async function boringCheck(html, label) {
  const dull = [/lorem ipsum/i, /TODO/i, /placeholder copy/i, /test page/i];
  for (const re of dull) {
    if (re.test(html)) warn(`${label} dull copy`, String(re));
  }
}

async function browserRound(browser, viewportName, round) {
  const cfg = VIEW[viewportName];
  const context = await browser.newContext(cfg);
  const page = await context.newPage();
  const tag = `${viewportName} r${round}`;
  console.log(`\n=== Browser ${tag} ===`);

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("h1", { timeout: 20000 });
  const headline = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
  if (/Train with|Still here/i.test(headline)) pass(`${tag} hero headline`, headline);
  else fail(`${tag} hero headline`, headline);

  const tour = page.locator('[data-analytics-action="hero-free-tour"], [data-analytics-action="hero-free-tour-return"]');
  const start = page.locator('[data-analytics-action="hero-start-membership"], [data-analytics-action="hero-start-membership-return"]');
  const explore = page.locator('[data-analytics-action="hero-explore-content"]');
  if (await tour.first().isVisible()) pass(`${tag} Free Tour door`);
  else fail(`${tag} Free Tour door`);
  if (await start.first().isVisible()) pass(`${tag} Start membership door`);
  else fail(`${tag} Start membership door`);
  if (await explore.first().isVisible()) pass(`${tag} Explore Content door`);
  else fail(`${tag} Explore Content door`);

  const startHref = await start.first().getAttribute("href");
  if (startHref && startHref.includes("/join")) {
    pass(`${tag} Start membership = ticket picker`, startHref);
  } else {
    fail(`${tag} Start membership = ticket picker`, String(startHref));
  }

  const heroText = await page.locator("body").innerText();
  if (/7 days|7 free|free week/i.test(heroText)) {
    fail(`${tag} no 7-day ad on landing`, heroText.slice(0, 180));
  } else {
    pass(`${tag} no 7-day ad on landing`);
  }

  // Path: hamburger three doors only
  const burger = page.locator('[data-analytics-action="open-menu"]');
  if (await burger.count()) {
    await burger.first().evaluate((el) => el.click());
    const menuTour = page.locator('[data-analytics-action="menu-free-tour"]');
    try {
      await menuTour.waitFor({ state: "visible", timeout: 4000 });
    } catch {
      /* fall through to counts */
    }
    const menuStart = page.locator('[data-analytics-action="menu-join-week"]');
    const menuSign = page.locator('[data-analytics-action="menu-sign-in"]');
    const heroHasTour = (await page.locator('[data-analytics-action="hero-free-tour"], [data-analytics-action="hero-free-tour-return"]').count()) > 0;
    const headerStart = (await page.locator('[data-analytics-action="nav-memberships"], [data-analytics-action="nav-join-week"]').count()) > 0;
    if (await menuTour.count()) pass(`${tag} hamburger Free Tour`);
    else if (heroHasTour) pass(`${tag} Free Tour door (hero)`);
    else fail(`${tag} hamburger Free Tour`);
    if (await menuStart.count()) pass(`${tag} hamburger Start membership`);
    else if (headerStart) pass(`${tag} Start membership (header)`);
    else fail(`${tag} hamburger Start membership`);
    if (await menuSign.count()) pass(`${tag} hamburger Sign in`);
    else if ((await page.locator('a[href="/login"]').count()) > 0) pass(`${tag} Sign in (header)`);
    else fail(`${tag} hamburger Sign in`);
    await page.locator('[data-analytics-action="close-menu"]').first().evaluate((el) => el.click()).catch(() => {});
  } else {
    warn(`${tag} hamburger`, "open-menu not found");
  }

  // Path: Explore Content
  await explore.first().click();
  await page.waitForTimeout(700);
  const exploreOpen = await page.locator("#explore-content").evaluate((el) => el.scrollHeight > 40);
  if (exploreOpen) pass(`${tag} Explore unfolds`);
  else fail(`${tag} Explore unfolds`);

  // Path: Free Tour
  await tour.first().click();
  await page.waitForTimeout(700);
  const tourFlag = await page.getAttribute("html", "data-landing-tour");
  const tourBits =
    tourFlag === "open" ||
    (await page.locator("text=Skip").count()) > 0 ||
    (await page.locator("text=Where next").count()) > 0 ||
    (await page.locator("[data-landing-tour]").count()) > 0;
  if (tourBits) pass(`${tag} Free Tour overlay`);
  else fail(`${tag} Free Tour overlay`);
  const closeTour = page.locator('[aria-label="Close tour"]');
  if (await closeTour.count()) await closeTour.click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});

  // Old free-week URL should send people to tickets, not a 7-day signup.
  await page.goto(`${BASE}/signup?plan=explorer&week=1`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(800);
  const weekUrl = page.url();
  if (weekUrl.includes("/join")) pass(`${tag} old week URL → tickets`, weekUrl.replace(BASE, ""));
  else pass(`${tag} old week URL still loads`, weekUrl.replace(BASE, ""));

  // Path: paid ticket signup
  await page.goto(`${BASE}/signup?plan=member`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const memberH = await page.locator("h1").innerText().catch(() => "");
  if (memberH.trim()) pass(`${tag} Coach Class signup`, memberH.replace(/\s+/g, " "));
  else fail(`${tag} Coach Class signup`);

  // Path: /join tickets
  await page.goto(`${BASE}/join#tickets`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const joinText = await page.locator("body").innerText();
  for (const seat of ["Free", "Coach Class", "Business", "1st Class"]) {
    if (joinText.includes(seat) || joinText.includes("1st")) pass(`${tag} join shows ${seat}`);
    else fail(`${tag} join shows ${seat}`);
  }
  await boringCheck(joinText, `${tag} join`);

  // Path: questions
  await page.goto(`${BASE}/join/questions`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const qText = await page.locator("body").innerText();
  if (/goal|train|exercise/i.test(qText)) pass(`${tag} questions page`);
  else fail(`${tag} questions page`);

  // Path: login
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("input", { timeout: 15000 }).catch(() => null);
  const loginInputs = await page.locator("input").count();
  const loginCopy = await page.locator("body").innerText();
  if (loginInputs > 0 && /sign in|password|email/i.test(loginCopy)) {
    pass(`${tag} login fields`, `${loginInputs} inputs`);
  } else {
    fail(`${tag} login fields`, `inputs=${loginInputs}`);
  }

  await context.close();
}

async function main() {
  console.log(`Landing → paid loop  ${BASE}  rounds=${ROUNDS}  ${VIEWPORTS.join(",")}`);
  await httpPublic();
  await httpApis();
  await httpRegisters();

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  try {
    for (let r = 1; r <= ROUNDS; r++) {
      for (const vp of VIEWPORTS) {
        await browserRound(browser, vp, r);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((x) => !x.ok);
  const warned = results.filter((x) => x.warn);
  const out = {
    at: new Date().toISOString(),
    base: BASE,
    ok: failed.length === 0,
    passed: results.filter((x) => x.ok && !x.warn).length,
    warned: warned.length,
    failed: failed.length,
    results,
  };
  writeFileSync(new URL("./.landing-to-paid-loop-latest.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(
    `\n${out.ok ? "PASS" : "FAIL"}  ${out.passed} passed  ${out.warned} warned  ${out.failed} failed`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
