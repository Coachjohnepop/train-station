#!/usr/bin/env node
/**
 * Landing → Join week / Free Tour engagement loop.
 *
 * Checks that cold traffic can have fun, every public link works, and the
 * path points at a 7-day look in the app (not a ticket maze or paywall first).
 *
 *   BASE_URL=https://www.thetrainstation.co node scripts/landing-join-engagement-loop.mjs
 *   ROUNDS=2 VIEWPORTS=mobile,desktop node scripts/landing-join-engagement-loop.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 2));
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

async function httpPublicPages() {
  console.log("\n=== HTTP public pages ===");
  const pages = [
    "/",
    "/join",
    "/join#tickets",
    "/signup?plan=explorer&week=1",
    "/signup?plan=explorer",
    "/signup?plan=member",
    "/login",
    "/free",
    "/pricing",
    "/privacy",
    "/terms",
    "/powered-by",
    "/coming-soon",
  ];
  for (const p of pages) {
    const { status, url } = await statusOf(p);
    if (status >= 200 && status < 400) pass(`GET ${p}`, `${status} → ${url.replace(BASE, "")}`);
    else fail(`GET ${p}`, `HTTP ${status}`);
  }
}

async function httpWeekRegister() {
  console.log("\n=== Week Join register (API) ===");
  const mark = `loop-week-${Date.now()}`;
  const email = `${mark}@example.com`;
  const res = await fetch(`${BASE}/api/signup/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "manual",
    body: JSON.stringify({
      email,
      firstName: "Loop",
      lastName: "Week",
      phone: "9165550199",
      plan: "explorer",
      password: "LoopWeek9!",
      week: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.ok) {
    fail("week register", `${res.status} ${JSON.stringify(body)}`);
    return;
  }
  const redirect = String(body.redirectTo || "");
  if (redirect.includes("/member/onboard")) {
    pass("week register → onboard", redirect);
  } else if (redirect.includes("checkout") || redirect.includes("payment-setup")) {
    fail("week register → onboard", `paywalled: ${redirect}`);
  } else {
    fail("week register → onboard", redirect || "(empty)");
  }

  const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  if (cookies.includes("ts_") || cookies.toLowerCase().includes("session") || cookies) {
    pass("week register set session cookie", cookies.split("; ").map((c) => c.split("=")[0]).join(", "));
  } else {
    warn("week register session cookie", "no obvious session cookie names");
  }

  const onboard = await fetch(`${BASE}/member/onboard?plan=explorer`, {
    headers: { Cookie: cookies },
    redirect: "follow",
  });
  if (onboard.ok) pass("onboard with week session", `HTTP ${onboard.status}`);
  else fail("onboard with week session", `HTTP ${onboard.status}`);

  const membership = await fetch(`${BASE}/api/member/membership`, {
    headers: { Cookie: cookies },
  });
  const snap = await membership.json().catch(() => ({}));
  if (membership.ok) {
    pass("membership API after week join", JSON.stringify({
      plan: snap.plan,
      paymentStatus: snap.paymentStatus,
      statusLabel: snap.statusLabel,
    }));
  } else {
    warn("membership API after week join", `${membership.status} ${JSON.stringify(snap).slice(0, 160)}`);
  }
}

async function crawlLandingHrefs(page, label) {
  const hrefs = await page.$$eval("a[href]", (as) =>
    [...new Set(as.map((a) => a.getAttribute("href") || "").filter(Boolean))],
  );
  const internal = hrefs.filter((h) => h.startsWith("/") || h.startsWith(BASE));
  const skip = new Set(["#", "javascript:void(0)"]);
  for (const href of internal) {
    if (skip.has(href) || href.startsWith("#")) continue;
    const path = href.startsWith("http") ? href : href;
    const { status } = await statusOf(path);
    if (status >= 400) fail(`${label} link ${href}`, `HTTP ${status}`);
    else pass(`${label} link ${href}`, String(status));
  }
  return hrefs;
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
  if (/Still here/i.test(headline)) {
    warn(`${tag} first visit headline`, `already return mode: ${headline}`);
  } else if (/Train with/i.test(headline)) {
    pass(`${tag} first visit headline`, headline);
  } else {
    fail(`${tag} first visit headline`, headline);
  }

  const join = page.locator('a[data-analytics-action="hero-start-membership"], a[data-analytics-action="hero-start-membership-return"]').first();
  const tour = page.locator('button[data-analytics-action="hero-free-tour"], button[data-analytics-action="hero-free-tour-return"]').first();
  if (await join.isVisible()) pass(`${tag} hero Start membership visible`);
  else fail(`${tag} hero Start membership visible`);
  if (await tour.isVisible()) pass(`${tag} hero Free Tour visible`);
  else fail(`${tag} hero Free Tour visible`);

  const joinHref = await join.getAttribute("href");
  if (joinHref && joinHref.includes("/join")) {
    pass(`${tag} Start membership → tickets`, joinHref);
  } else {
    fail(`${tag} Start membership → tickets`, String(joinHref));
  }

  const bodyText = await page.locator("body").innerText();
  if (/7 days|free week|7 free days/i.test(bodyText)) {
    fail(`${tag} no 7-day ad on landing`, bodyText.slice(0, 160));
  } else {
    pass(`${tag} no 7-day ad on landing`);
  }

  await crawlLandingHrefs(page, `${tag} home`);

  // Fun: tour opens
  await tour.click();
  await page.waitForTimeout(600);
  const tourOpen = await page.locator('[data-landing-tour], [data-landing-tour="open"]').count()
    .catch(() => 0);
  const tourVisible =
    (await page.locator("text=Free Quick Tour").count()) > 0 ||
    (await page.locator("text=Where next").count()) > 0 ||
    (await page.locator("text=Skip").count()) > 0 ||
    tourOpen > 0 ||
    (await page.locator("text=Create Account").count()) > 0 ||
    (await page.locator("text=set 1").count()) > 0 ||
    (await page.getAttribute("html", "data-landing-tour")) === "open";
  if (tourVisible || (await page.getAttribute("html", "data-landing-tour")) === "open") {
    pass(`${tag} Free Tour opens`);
  } else {
    const htmlTour = await page.evaluate(() => document.documentElement.getAttribute("data-landing-tour"));
    if (htmlTour === "open") pass(`${tag} Free Tour opens`, "html flag");
    else fail(`${tag} Free Tour opens`, "overlay not detected");
  }

  const closeTour = page.locator('[aria-label="Close tour"]');
  if (await closeTour.count()) {
    await closeTour.click({ timeout: 5000 }).catch(() => {});
    await page.locator('[role="dialog"][aria-labelledby="see-inside-title"]').waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  } else {
    await page.keyboard.press("Escape").catch(() => {});
  }

  // Menu abandon → return mode (mobile)
  if (viewportName === "mobile") {
    const openMenu = page.locator('[aria-label="Open menu"]');
    if (await openMenu.count()) {
      await openMenu.click();
      await page.waitForTimeout(250);
      const closeMenu = page.locator('[aria-label="Close menu"]');
      if (await closeMenu.count()) await closeMenu.click();
      await page.waitForTimeout(400);
      const after = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
      if (/Pick a seat|Still here/i.test(after)) pass(`${tag} menu abandon → return hook`, after);
      else warn(`${tag} menu abandon → return hook`, after);
    }
  }

  // Start membership → ticket picker (Free first)
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('a[data-analytics-action^="hero-start-membership"]');
  await page.locator('a[data-analytics-action^="hero-start-membership"]').first().click();
  await page.waitForURL(/join/, { timeout: 20000 });
  const signupUrl = page.url();
  if (signupUrl.includes("/join")) {
    pass(`${tag} Start membership lands on tickets`, signupUrl.replace(BASE, ""));
  } else {
    fail(`${tag} Start membership lands on tickets`, signupUrl);
  }

  const confettiCanvas = await page.locator("canvas").count();
  if (confettiCanvas > 0) pass(`${tag} confetti canvas after Join`);
  else warn(`${tag} confetti canvas after Join`, "may have finished before paint");

  await crawlLandingHrefs(page, `${tag} signup`);

  // Tickets still exist as a later path
  await page.goto(`${BASE}/join#tickets`, { waitUntil: "domcontentloaded" });
  const joinPage = await page.locator("body").innerText();
  if (/Choose your ticket|Coach Class|Explorer|1st Class/i.test(joinPage)) {
    pass(`${tag} /join still has ticket menu`);
  } else {
    fail(`${tag} /join still has ticket menu`);
  }

  // Login page
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  if ((await page.locator("input[type='password'], input[name='password'], #login-password").count()) > 0
    || (await page.locator("text=Sign in").count()) > 0) {
    pass(`${tag} login page usable`);
  } else {
    fail(`${tag} login page usable`);
  }

  // Footer legal
  await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/privacy") && (await page.locator("h1, h2").count()) > 0) {
    pass(`${tag} privacy`);
  } else fail(`${tag} privacy`, page.url());

  await context.close();
}

async function engagementSmellTest() {
  console.log("\n=== Engagement smell (copy / dead ends) ===");
  const home = await htmlOf("/");
  if (home.html.includes("Create Account &amp; Pay") || home.html.includes("Create Account & Pay")) {
    fail("home does not lead with paywall", "Create Account & Pay on first paint");
  } else {
    pass("home does not lead with paywall");
  }
  if (home.html.includes("/join") && !home.html.includes("week=1")) {
    pass("home Start membership goes to tickets");
  } else if (home.html.includes("/join#tickets") || home.html.includes("join#tickets")) {
    pass("home Start membership goes to tickets");
  } else {
    fail("home Start membership goes to tickets", "expected /join#tickets");
  }

  const tourSrc = await htmlOf("/");
  // Tour end copy is client-only; check the JS bundle
  const chunks = [...tourSrc.html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]);
  let tourPay = false;
  let tourWeek = false;
  let tourFun = false;
  for (const chunk of chunks.slice(0, 80)) {
    try {
      const js = await (await fetch(`${BASE}${chunk}`)).text();
      if (js.includes("Create Account & Pay") || js.includes("Create Account &amp; Pay")) tourPay = true;
      if (js.includes("Continue with Free")) tourWeek = true;
      if (js.includes("Free Quick Tour") || js.includes("Free Tour")) tourFun = true;
    } catch {
      /* skip */
    }
  }
  if (tourFun) pass("bundle still has Free Tour");
  else fail("bundle still has Free Tour");
  if (tourPay) {
    fail(
      "tour end asks to pay, not join the free week",
      "See Inside Tour still says Create Account & Pay",
    );
  } else {
    pass("tour end is not a paywall");
  }
}

async function main() {
  console.log(`Landing join engagement loop → ${BASE}`);
  console.log(`rounds=${ROUNDS} viewports=${VIEWPORTS.join(",")}\n`);

  await httpPublicPages();
  await engagementSmellTest();
  await httpWeekRegister();

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  try {
    for (let r = 1; r <= ROUNDS; r++) {
      for (const vp of VIEWPORTS) {
        await browserRound(browser, vp, r);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const warned = results.filter((r) => r.warn);
  console.log(
    `\n—— ${results.length} checks · ${results.length - failed.length} ok · ${warned.length} warn · ${failed.length} fail ——`,
  );
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
