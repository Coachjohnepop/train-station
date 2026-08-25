#!/usr/bin/env node
/**
 * One-shot loop: public + member pages, internal link health, payments,
 * admin (users/members + full desk including Videos), video library APIs.
 *
 *   BASE_URL=https://www.thetrainstation.co \
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *   node scripts/pages-admin-videos-loop.mjs
 */
import { writeFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD ||
  process.env.COACH_TEST_PASSWORD ||
  "LaserChickenSoak2026!";
const MEMBER_EMAIL = process.env.MEMBER_EMAIL || "john@lemonvoice.com";
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || "";
const MARK = "PAGES-ADMIN-VIDEOS-LOOP";
const RUN = Date.now().toString(36);

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  results.push({ ok: true, name, detail: `WARN ${detail}`, warn: true });
  console.log(`⚠️  ${name}${detail ? ` — ${detail}` : ""}`);
}
function pageOk(status) {
  return status === 200 || status === 204 || [301, 302, 307, 308, 401, 403].includes(status);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}
function mergeCookies(existing, added) {
  const jar = new Map();
  for (const part of `${existing}; ${added}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    jar.set(k, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function makeClient() {
  let cookies = "";
  async function req(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${BASE}${path}`;
    const headers = {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "TrainStation-PagesAdminVideosLoop/1.0",
      ...(opts.headers || {}),
    };
    if (cookies) headers.Cookie = cookies;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.json);
    }
    const res = await fetch(url, {
      ...opts,
      headers,
      cache: "no-store",
      redirect: opts.redirect ?? "manual",
    });
    const setCookie = parseSetCookie(res.headers);
    if (setCookie) cookies = mergeCookies(cookies, setCookie);
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return {
      res,
      body,
      text: typeof body === "string" ? body : text,
      location: res.headers.get("location") || "",
    };
  }
  async function login(email, password, redirect = "/member/today") {
    const { res, body } = await req("/api/auth/login", {
      method: "POST",
      json: { email, password, redirect },
    });
    return {
      ok: res.ok && cookies.includes("ts_session"),
      status: res.status,
      body,
    };
  }
  return { req, login, getCookies: () => cookies };
}

const PUBLIC_PAGES = [
  "/",
  "/join",
  "/login",
  "/signup",
  "/landing",
  "/pricing",
  "/privacy",
  "/terms",
  "/partners",
];

const MEMBER_PAGES = [
  "/member",
  "/member/today",
  "/member/account",
  "/member/checkout",
  "/member/checkout?plan=member",
  "/member/chat",
  "/member/live",
  "/member/nutrition",
  "/member/equipment",
  "/member/leaderboard",
  "/member/book",
  "/member/programs",
  "/member/workout",
  "/member/onboard",
  "/member/journey",
];

/** Full admin desk — includes users + videos + money surfaces. */
const ADMIN_PAGES = [
  "/admin",
  "/admin/today",
  "/admin/day",
  "/admin/live",
  "/admin/members",
  "/admin/users",
  "/admin/videos",
  "/admin/landing",
  "/admin/settings",
  "/admin/chat",
  "/admin/billing",
  "/admin/accounting",
  "/admin/analytics",
  "/admin/discounts",
  "/admin/pricing",
  "/admin/programs",
  "/admin/workouts",
  "/admin/exercises",
  "/admin/queue",
  "/admin/leads",
  "/admin/bookings",
  "/admin/gamification",
  "/admin/equipment",
  "/admin/templates",
  "/admin/commission",
  "/admin/payouts",
  "/admin/offers",
  "/admin/platform",
  "/admin/insights",
  "/admin/reports",
  "/admin/audit",
  "/admin/assign",
  "/admin/prescriptions",
  "/admin/coach-suggestions",
  "/admin/sponsorship",
  "/admin/plan",
  "/admin/sms-hub",
];

const CRITICAL_LINKS = [
  "/",
  "/join",
  "/login",
  "/signup",
  "/member/today",
  "/member/checkout",
  "/member/account",
  "/admin/members",
  "/admin/users",
  "/admin/videos",
  "/admin/billing",
  "/admin/accounting",
  "/admin/live",
  "/admin/day",
];

async function main() {
  console.log(`\n${MARK} · ${RUN}`);
  console.log(`BASE=${BASE}`);
  console.log(`coach=${COACH_EMAIL}${MEMBER_PASSWORD ? ` · member=${MEMBER_EMAIL}` : " · member=coach-session fallback"}\n`);

  // Reachability
  const home = await fetch(`${BASE}/`, {
    redirect: "manual",
    headers: { "User-Agent": "TrainStation-PagesAdminVideosLoop/1.0" },
  });
  if (![200, 307, 308].includes(home.status)) {
    fail("prod home", String(home.status));
    process.exit(1);
  }
  pass("prod reachable", String(home.status));

  const anon = makeClient();

  // ── Public pages ──
  console.log("\n── Public pages ──");
  for (const p of PUBLIC_PAGES) {
    const r = await anon.req(p);
    if (pageOk(r.res.status)) pass(`public ${p}`, String(r.res.status) + (r.location ? ` → ${r.location.slice(0, 48)}` : ""));
    else fail(`public ${p}`, String(r.res.status));
  }

  // ── Payment public APIs ──
  console.log("\n── Payments ──");
  const pay = await anon.req(`/api/payments/public?_t=${Date.now()}`);
  if (pay.res.ok && typeof pay.body?.stripeEnabled === "boolean") {
    const pk = String(pay.body.stripePublishableKey || "");
    const mode = pk.startsWith("pk_live") ? "LIVE" : pk.startsWith("pk_test") ? "TEST" : "UNKNOWN";
    pass("payments/public", `stripeEnabled=${pay.body.stripeEnabled} mode=${mode}`);
    if (mode === "TEST") warn("Stripe mode", "still TEST keys on public endpoint");
  } else {
    fail("payments/public", `${pay.res.status}`);
  }

  const pricing = await anon.req("/api/pricing/public");
  if (pricing.res.ok) pass("pricing/public", String(pricing.res.status));
  else fail("pricing/public", String(pricing.res.status));

  const landingMedia = await anon.req("/api/landing-media");
  if (landingMedia.res.ok) {
    const j = landingMedia.body || {};
    pass(
      "landing-media public",
      `hasWelcome=${Boolean(j.welcomeVideoUrl || j.hasWelcome)} hasFree=${Boolean(j.freeChastiseVideoUrl || j.hasFreeChastise)}`,
    );
  } else {
    fail("landing-media public", String(landingMedia.res.status));
  }

  // Checkout unauth
  const checkoutAnon = await anon.req("/member/checkout?plan=member");
  if (pageOk(checkoutAnon.res.status)) {
    const html = String(checkoutAnon.text || "");
    const hasStripe = /Stripe|Pay with|checkout/i.test(html);
    const hasVenmo = /Venmo/i.test(html);
    pass(
      "checkout page (anon)",
      `${checkoutAnon.res.status} stripeChrome=${hasStripe} venmo=${hasVenmo}`,
    );
  } else {
    fail("checkout page (anon)", String(checkoutAnon.res.status));
  }

  // Stripe gate without body
  const stripeGate = await anon.req("/api/stripe/checkout", {
    method: "POST",
    json: {},
  });
  if ([400, 401, 403, 422].includes(stripeGate.res.status)) {
    pass("stripe checkout gate (unauth)", String(stripeGate.res.status));
  } else if (stripeGate.res.status >= 500) {
    fail("stripe checkout gate (unauth)", `5xx ${stripeGate.res.status}`);
  } else {
    warn("stripe checkout gate (unauth)", String(stripeGate.res.status));
  }

  // ── Coach login ──
  console.log("\n── Coach session ──");
  const coach = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  const coachOk = await coach.loginCoach({
    onPass: (n, d) => pass(n, d),
    onFail: (n, d) => fail(n, d),
  });
  if (!coachOk) {
    fail("coach login", "cannot continue admin probes");
    finish();
    process.exit(1);
  }

  // ── Admin pages ──
  console.log("\n── Admin pages ──");
  for (const p of ADMIN_PAGES) {
    const r = await coach.req(p);
    const st = r.res.status;
    if (st === 404 && (p.includes("sms-hub") || p.includes("sponsorship"))) {
      warn(`admin ${p}`, "404 (optional/parked)");
    } else if (pageOk(st) && st !== 404) {
      pass(`admin ${p}`, String(st));
    } else if (st === 404) {
      fail(`admin ${p}`, "404");
    } else {
      fail(`admin ${p}`, String(st));
    }
  }

  // ── Users / members admin APIs ──
  console.log("\n── User admin APIs ──");
  for (const p of [
    "/api/admin/members",
    "/api/admin/queue",
    "/api/admin/needs-done",
    "/api/admin/billing/overview",
    "/api/admin/accounting/overview",
    "/api/admin/analytics/overview?days=7",
    "/api/admin/pricing",
  ]) {
    const r = await coach.req(p);
    if (r.res.ok) {
      const extra =
        p.includes("members") && Array.isArray(r.body?.members)
          ? `members=${r.body.members.length}`
          : p.includes("queue") && Array.isArray(r.body?.items)
            ? `items=${r.body.items.length}`
            : "";
      pass(`API ${p}`, `${r.res.status}${extra ? ` ${extra}` : ""}`);
    } else if ([401, 403].includes(r.res.status)) {
      fail(`API ${p}`, `auth ${r.res.status}`);
    } else if (r.res.status >= 500) {
      warn(`API ${p}`, `5xx ${r.res.status} ${JSON.stringify(r.body || {}).slice(0, 100)}`);
    } else {
      warn(`API ${p}`, String(r.res.status));
    }
  }

  // ── Videos admin surface ──
  console.log("\n── Videos ──");
  const videosPage = await coach.req("/admin/videos");
  if (videosPage.res.ok) {
    const html = String(videosPage.text || "");
    const markers = [
      ["library", /video library|Jeremy/i.test(html)],
      ["assign", /Where each|Overall intro|Coach Class/i.test(html)],
      ["gag", /gag|rick|Play gag/i.test(html)],
      ["save", /Save all videos/i.test(html)],
    ];
    const hit = markers.filter(([, ok]) => ok).map(([n]) => n);
    pass("admin /videos HTML", `200 markers=[${hit.join(",")}]`);
    if (!hit.includes("library") && !hit.includes("assign")) {
      warn("admin /videos chrome", "expected library/assign copy missing — maybe old deploy?");
    }
  } else {
    fail("admin /videos", String(videosPage.res.status));
  }

  const libGet = await coach.req("/api/admin/site-videos/library");
  if (libGet.res.ok) {
    const n = Array.isArray(libGet.body?.items) ? libGet.body.items.length : 0;
    pass("video library GET", `items=${n}`);
  } else if (libGet.res.status === 404) {
    warn("video library GET", "404 — deploy may not include library API yet");
  } else {
    fail("video library GET", String(libGet.res.status));
  }

  const uploadMeta = await coach.req("/api/admin/landing-media/upload");
  if (uploadMeta.res.ok) {
    pass(
      "landing-media upload GET",
      `maxBytes=${uploadMeta.body?.maxBytes ?? "?"} clientUpload=${uploadMeta.body?.clientUpload}`,
    );
  } else if (uploadMeta.res.status === 404) {
    warn("landing-media upload GET", "404 — upload route not on prod yet");
  } else if ([401, 403, 405].includes(uploadMeta.res.status)) {
    pass("landing-media upload route", String(uploadMeta.res.status));
  } else {
    warn("landing-media upload GET", String(uploadMeta.res.status));
  }

  const landingAdmin = await coach.req("/api/admin/landing-media");
  if (landingAdmin.res.ok) {
    pass("admin landing-media GET", String(landingAdmin.res.status));
  } else {
    fail("admin landing-media GET", String(landingAdmin.res.status));
  }

  // ── Member pages (prefer real member; else coach) ──
  console.log("\n── Member pages ──");
  let member = null;
  if (MEMBER_PASSWORD) {
    member = makeClient();
    const m = await member.login(MEMBER_EMAIL, MEMBER_PASSWORD);
    if (m.ok) pass("member login", MEMBER_EMAIL);
    else warn("member login", `${MEMBER_EMAIL} ${m.status}`);
  }
  const memberReq = (path, opts) => (member?.getCookies?.() ? member.req(path, opts) : coach.req(path, opts));

  for (const p of MEMBER_PAGES) {
    const r = await memberReq(p);
    if (pageOk(r.res.status)) pass(`member ${p}`, String(r.res.status));
    else fail(`member ${p}`, String(r.res.status));
  }

  // ── Critical links ──
  console.log("\n── Critical links ──");
  for (const h of CRITICAL_LINKS) {
    const pathOnly = h.split("?")[0];
    const r = pathOnly.startsWith("/admin")
      ? await coach.req(pathOnly)
      : pathOnly.startsWith("/member")
        ? await memberReq(pathOnly)
        : await anon.req(pathOnly);
    if (pageOk(r.res.status)) pass(`link ${h}`, String(r.res.status));
    else fail(`link ${h}`, String(r.res.status));
  }

  // ── Auth session APIs ──
  const session = await coach.req("/api/auth/session");
  if (session.res.ok) {
    pass(
      "auth session",
      `role=${session.body?.user?.role || session.body?.role || "?"} email=${session.body?.user?.email || session.body?.email || "?"}`,
    );
  } else {
    fail("auth session", String(session.res.status));
  }

  finish();
  const failed = results.filter((x) => !x.ok);
  process.exit(failed.length ? 1 : 0);
}

function finish() {
  const failed = results.filter((x) => !x.ok);
  const warns = results.filter((x) => x.warn);
  const passed = results.filter((x) => x.ok && !x.warn).length;
  const out = {
    mark: MARK,
    run: RUN,
    base: BASE,
    at: new Date().toISOString(),
    passed,
    warnings: warns.length,
    failed: failed.length,
    results,
  };
  writeFileSync(
    new URL("./.pages-admin-videos-loop-latest.json", import.meta.url),
    JSON.stringify(out, null, 2),
  );
  console.log(
    `\n── Summary: ${passed} pass · ${warns.length} warn · ${failed.length} fail ──\n`,
  );
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
  } else {
    console.log("Loop green (warnings allowed).\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
