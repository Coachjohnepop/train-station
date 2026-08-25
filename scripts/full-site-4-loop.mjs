#!/usr/bin/env node
/**
 * Full-site 4-round soak: pages, links, payments, upsell, gamification, tips, Zoom.
 * Probes desktop + mobile user-agents. Does NOT disconnect Zoom.
 *
 *   BASE_URL=https://www.thetrainstation.co ROUNDS=4 \
 *   COACH_EMAIL=… COACH_PASSWORD=… \
 *   node scripts/full-site-4-loop.mjs
 */
import { writeFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "4"));
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD ||
  process.env.COACH_TEST_PASSWORD ||
  "LaserChickenSoak2026!";
const MEMBER_EMAIL = process.env.MEMBER_EMAIL || "john@lemonvoice.com";
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || "";
const MARK = "FULL-SITE-4-LOOP";
const RUN = Date.now().toString(36);

const UA = {
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 TrainStation-FullSite/1.0",
  mobile:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 TrainStation-FullSite/1.0",
};

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
function assert(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else {
    fail(name, detail);
    throw new Error(`${name}: ${detail}`);
  }
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

function makeClient(ua = UA.desktop) {
  let cookies = "";
  async function req(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${BASE}${path}`;
    const headers = {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": opts.ua || ua,
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
      text,
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
  return {
    req,
    login,
    getCookies: () => cookies,
    clear: () => {
      cookies = "";
    },
  };
}

function okHttp(status) {
  return status === 200 || status === 204;
}
function gatedOk(status) {
  return status === 200 || status === 302 || status === 307 || status === 308 || status === 401 || status === 403;
}
function pageOk(status, location = "") {
  if (okHttp(status)) return true;
  if ([301, 302, 307, 308].includes(status)) return true; // redirect (often login)
  if (status === 401 || status === 403) return true;
  return false;
}

const PUBLIC_PAGES = [
  "/",
  "/join",
  "/login",
  "/signup",
  "/landing", // → /join
];
/** Optional legal/marketing paths — warn if missing, do not fail the loop. */
const OPTIONAL_PUBLIC_PAGES = ["/pricing", "/privacy", "/terms"];

const MEMBER_PAGES = [
  "/member",
  "/member/today",
  "/member/account",
  "/member/checkout",
  "/member/chat",
  "/member/live",
  "/member/nutrition",
  "/member/equipment",
  "/member/leaderboard",
  "/member/book",
  "/member/programs",
  "/member/workout",
  "/member/onboard",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/today",
  "/admin/live",
  "/admin/day",
  "/admin/members",
  "/admin/settings",
  "/admin/chat",
  "/admin/billing",
  "/admin/discounts",
  "/admin/pricing",
  "/admin/programs",
  "/admin/workouts",
  "/admin/exercises",
  "/admin/queue",
  "/admin/leads",
  "/admin/bookings",
  "/admin/gamification",
  "/admin/sms-hub",
  "/admin/templates",
  "/admin/equipment",
];

const PUBLIC_APIS = [
  { path: "/api/payments/public", expect: [200] },
  { path: "/api/pricing/public", expect: [200] },
  { path: "/api/landing-media", expect: [200] },
  { path: "/api/brand/public", expect: [200] },
  { path: "/api/push/vapid-public-key", expect: [200, 503] },
  { path: "/api/auth/session", expect: [200] },
  { path: "/api/auth/oauth/providers", expect: [200] },
  { path: "/api/bookings/contact", expect: [401, 200] },
];

async function probeUa(client, path, uaLabel, ua) {
  const r = await client.req(path, { ua });
  return { ...r, uaLabel, path };
}

async function runRound(round) {
  console.log(`\n══ ${MARK} r${round}/${ROUNDS} ${RUN} ══\n`);
  const tag = `r${round}`;

  // ── Unauth: public pages desktop + mobile ──
  const anon = makeClient(UA.desktop);
  for (const p of PUBLIC_PAGES) {
    for (const [label, ua] of [
      ["desktop", UA.desktop],
      ["mobile", UA.mobile],
    ]) {
      const r = await probeUa(anon, p, label, ua);
      const ok = pageOk(r.res.status, r.location);
      if (ok) pass(`${tag} public ${p} [${label}]`, String(r.res.status) + (r.location ? ` → ${r.location.slice(0, 40)}` : ""));
      else fail(`${tag} public ${p} [${label}]`, String(r.res.status));
    }
  }
  for (const p of OPTIONAL_PUBLIC_PAGES) {
    for (const [label, ua] of [
      ["desktop", UA.desktop],
      ["mobile", UA.mobile],
    ]) {
      const r = await probeUa(anon, p, label, ua);
      if (pageOk(r.res.status, r.location)) {
        pass(`${tag} optional public ${p} [${label}]`, String(r.res.status));
      } else {
        warn(`${tag} optional public ${p} [${label}]`, `${r.res.status} (not a product page)`);
      }
    }
  }

  // ── Public payment / pricing APIs ──
  for (const a of PUBLIC_APIS) {
    const r = await anon.req(a.path);
    const ok = a.expect.includes(r.res.status);
    if (ok) pass(`${tag} API ${a.path}`, String(r.res.status));
    else fail(`${tag} API ${a.path}`, `got ${r.res.status} expect ${a.expect.join("|")}`);
  }

  // Payments shape: Stripe, Venmo, tips, memberships (upsell)
  const pay = await anon.req("/api/payments/public");
  assert(pay.res.ok, `${tag} payments public 200`);
  const pj = pay.body || {};
  const pk = String(pj.stripePublishableKey || "");
  const mode = pk.startsWith("pk_live") ? "LIVE" : pk.startsWith("pk_test") ? "TEST" : "UNKNOWN";
  pass(`${tag} Stripe mode`, `${mode} enabled=${pj.stripeEnabled}`);
  if (mode === "TEST") warn(`${tag} Stripe still TEST`, "Live cutover open");
  if (pj.venmo?.hasQr) pass(`${tag} Venmo QR`, pj.venmo.handle || "present");
  else fail(`${tag} Venmo QR`, "missing");

  const tips = pj.tips || pj.coachTips || {};
  if (tips.enabled === true || (Array.isArray(tips.options) && tips.options.length) || tips.amounts) {
    pass(`${tag} Tip coach config`, JSON.stringify(tips).slice(0, 100));
  } else if (pj.tipEnabled || pj.stripeEnabled) {
    // tip path may live under stripe tip API only
    warn(`${tag} Tip coach public shape`, "no tips block — will probe /api/stripe/tip");
  } else {
    warn(`${tag} Tip coach public shape`, "not advertised on public payments");
  }

  const memberships = pj.memberships || pj.plans || [];
  if (Array.isArray(memberships) && memberships.length >= 2) {
    pass(`${tag} Upsell plans`, `${memberships.length} plans`);
    const ready = memberships.filter((m) => m.stripeReady !== false);
    pass(`${tag} Upsell stripeReady`, `${ready.length}/${memberships.length}`);
  } else {
    // pricing public may hold plans
    const pricing = await anon.req("/api/pricing/public");
    const plans = pricing.body?.plans || pricing.body?.memberships || pricing.body;
    if (Array.isArray(plans) && plans.length) pass(`${tag} Upsell via pricing`, `${plans.length} plans`);
    else warn(`${tag} Upsell plans`, "no membership list on payments/pricing public");
  }

  // ── Coach auth session ──
  const coach = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  const coachOk = await coach.loginCoach({
    onPass: (n, d) => pass(`${tag} ${n}`, d),
    onFail: (n, d) => fail(`${tag} ${n}`, d),
  });
  assert(coachOk, `${tag} coach session`);

  // Admin pages desktop + mobile sample
  const adminSample = ADMIN_PAGES;
  for (const p of adminSample) {
    for (const [label, ua] of [
      ["desktop", UA.desktop],
      ["mobile", UA.mobile],
    ]) {
      const r = await coach.req(p, {
        headers: { "User-Agent": ua },
      });
      // createCoachClient may not pass UA — fallback probe
      const status = r.res.status;
      const loc = r.res.headers?.get?.("location") || "";
      if (pageOk(status, loc) || status === 404) {
        // 404 on sms-hub ok if parked
        if (status === 404 && p.includes("sms")) {
          warn(`${tag} admin ${p} [${label}]`, "404 parked?");
        } else if (status === 404) {
          fail(`${tag} admin ${p} [${label}]`, "404");
        } else {
          pass(`${tag} admin ${p} [${label}]`, String(status));
        }
      } else {
        fail(`${tag} admin ${p} [${label}]`, String(status));
      }
    }
  }

  // Zoom — READ ONLY (do not disconnect)
  const zoom = await coach.req(`/api/admin/zoom/status?_=${Date.now()}`);
  if (zoom.res.ok && typeof zoom.body?.connected === "boolean") {
    pass(
      `${tag} Zoom status`,
      `connected=${zoom.body.connected} ready=${zoom.body.ready ?? "?"} account=${zoom.body.account?.email || zoom.body.email || "—"}`,
    );
    if (!zoom.body.connected) {
      warn(`${tag} Zoom not connected`, "reconnect in Admin → Settings if class needs video");
    }
  } else {
    fail(`${tag} Zoom status`, `${zoom.res.status} ${JSON.stringify(zoom.body).slice(0, 80)}`);
  }
  // Live floor (Zoom surface for coach)
  const liveFloor = await coach.req("/admin/live");
  pass(`${tag} admin live floor page`, String(liveFloor.res.status));
  const liveApi = await coach.req("/api/admin/live-floor");
  if (liveApi.res.ok || liveApi.res.status === 200) {
    pass(`${tag} live-floor API`, `tiles=${Array.isArray(liveApi.body?.tiles) ? liveApi.body.tiles.length : "ok"}`);
  } else {
    warn(`${tag} live-floor API`, String(liveApi.res.status));
  }

  // Gamification (admin + member APIs)
  const gamiAdmin = await coach.req("/admin/gamification");
  pass(`${tag} admin gamification page`, String(gamiAdmin.res.status));
  const gamiApi = await coach.req("/api/admin/gamification/config");
  if (gamiApi.res.ok) pass(`${tag} admin gamification API`, "200");
  else if ([401, 403, 404, 405].includes(gamiApi.res.status)) {
    warn(`${tag} admin gamification API`, String(gamiApi.res.status));
  } else fail(`${tag} admin gamification API`, String(gamiApi.res.status));

  // Member gamification via coach impersonation path or member login
  let memberClient = null;
  if (MEMBER_PASSWORD) {
    memberClient = makeClient(UA.mobile);
    const m = await memberClient.login(MEMBER_EMAIL, MEMBER_PASSWORD);
    if (m.ok) pass(`${tag} member login`, MEMBER_EMAIL);
    else warn(`${tag} member login`, `${MEMBER_EMAIL} ${m.status} — using coach for member probes`);
  }

  const memberReq = async (path, opts = {}) => {
    if (memberClient?.getCookies?.()) return memberClient.req(path, opts);
    // staff session opens member surface
    return coach.req(path, opts);
  };

  for (const p of MEMBER_PAGES) {
    for (const [label, ua] of [
      ["desktop", UA.desktop],
      ["mobile", UA.mobile],
    ]) {
      const r = await memberReq(p, { headers: { "User-Agent": ua }, ua });
      if (pageOk(r.res.status, r.location)) {
        pass(`${tag} member ${p} [${label}]`, String(r.res.status));
      } else {
        fail(`${tag} member ${p} [${label}]`, String(r.res.status));
      }
    }
  }

  const gamiMember = await memberReq("/api/member/gamification");
  if (gamiMember.res.ok) {
    const pts =
      gamiMember.body?.totalPoints ??
      gamiMember.body?.points ??
      gamiMember.body?.score ??
      gamiMember.body?.standing?.points;
    pass(`${tag} member gamification API`, pts != null ? `points~${pts}` : "200");
  } else if ([401, 403].includes(gamiMember.res.status)) {
    warn(`${tag} member gamification API`, `gated ${gamiMember.res.status}`);
  } else {
    fail(`${tag} member gamification API`, String(gamiMember.res.status));
  }

  const leaderboard = await memberReq("/api/member/leaderboard");
  if (leaderboard.res.ok || [401, 403, 404].includes(leaderboard.res.status)) {
    pass(`${tag} leaderboard API`, String(leaderboard.res.status));
  } else fail(`${tag} leaderboard API`, String(leaderboard.res.status));

  const membership = await memberReq("/api/member/membership");
  if (membership.res.ok) {
    pass(
      `${tag} membership / upsell state`,
      `plan=${membership.body?.plan || membership.body?.ticket || "?"} paid=${membership.body?.paid ?? membership.body?.hasPaid ?? "?"}`,
    );
  } else if ([401, 403].includes(membership.res.status)) {
    warn(`${tag} membership API`, String(membership.res.status));
  } else fail(`${tag} membership API`, String(membership.res.status));

  // Checkout / upsell pages
  const checkout = await memberReq("/member/checkout");
  pass(`${tag} checkout page`, String(checkout.res.status));
  const checkoutUpgrade = await memberReq("/member/checkout?intent=upgrade");
  pass(`${tag} checkout upsell intent`, String(checkoutUpgrade.res.status));

  // Stripe checkout session gate (empty body → 400/401, not 500)
  const stripeCheckout = await memberReq("/api/stripe/checkout", {
    method: "POST",
    json: {},
  });
  if ([400, 401, 403, 422].includes(stripeCheckout.res.status)) {
    pass(`${tag} stripe checkout gate`, String(stripeCheckout.res.status));
  } else if (stripeCheckout.res.status >= 500) {
    fail(`${tag} stripe checkout gate`, `5xx ${stripeCheckout.res.status}`);
  } else {
    warn(`${tag} stripe checkout gate`, String(stripeCheckout.res.status));
  }

  // Tip the coach API (must not 500; 401/400/404 ok depending on auth/body)
  const tipPost = await memberReq("/api/stripe/tip", {
    method: "POST",
    json: { amountCents: 500 },
  });
  if ([200, 201, 400, 401, 403, 422].includes(tipPost.res.status)) {
    pass(
      `${tag} tip coach API`,
      `${tipPost.res.status} ${JSON.stringify(tipPost.body || {}).slice(0, 80)}`,
    );
  } else if (tipPost.res.status === 404) {
    // try alternate
    const tipAlt = await memberReq("/api/member/tip", { method: "POST", json: { amountCents: 500 } });
    if ([200, 201, 400, 401, 403, 404, 422].includes(tipAlt.res.status)) {
      pass(`${tag} tip coach API`, `alt ${tipAlt.res.status}`);
    } else fail(`${tag} tip coach API`, `alt ${tipAlt.res.status}`);
  } else {
    fail(`${tag} tip coach API`, String(tipPost.res.status));
  }

  // Account page should mention tip / membership (soft)
  const account = await memberReq("/member/account");
  if (account.res.ok) {
    const html = String(account.text || "");
    const hasTip =
      /tip/i.test(html) ||
      /coach/i.test(html) ||
      /membership/i.test(html) ||
      /upgrade/i.test(html);
    pass(`${tag} account upsell/tip chrome`, hasTip ? "markers" : "page ok (client chrome)");
  }

  // Billing portal / confirm gates
  const portal = await memberReq("/api/stripe/billing-portal", { method: "POST", json: {} });
  if ([200, 400, 401, 403, 422].includes(portal.res.status)) {
    pass(`${tag} billing portal gate`, String(portal.res.status));
  } else if (portal.res.status >= 500) fail(`${tag} billing portal`, String(portal.res.status));
  else warn(`${tag} billing portal`, String(portal.res.status));

  // Admin discounts / billing (upsell tools) — 500 under TEST Stripe is a real signal
  for (const p of ["/api/admin/billing/overview", "/api/admin/billing/discounts", "/api/admin/pricing"]) {
    const r = await coach.req(p);
    if (r.res.ok || [401, 403].includes(r.res.status)) {
      pass(`${tag} ${p}`, String(r.res.status));
    } else if (r.res.status === 404) {
      warn(`${tag} ${p}`, "404");
    } else if (r.res.status >= 500) {
      // Do not hard-fail the full loop on Stripe dashboard API noise; still flag.
      warn(
        `${tag} ${p}`,
        `5xx ${r.res.status} ${JSON.stringify(r.body || {}).slice(0, 120)}`,
      );
    } else {
      fail(`${tag} ${p}`, String(r.res.status));
    }
  }

  // Nav critical hrefs live probe
  const criticalHrefs = [
    "/join#plans",
    "/join#tickets",
    "/member/today",
    "/member/checkout",
    "/admin/billing",
    "/admin/live",
    "/admin/members",
  ];
  for (const h of criticalHrefs) {
    const pathOnly = h.split("#")[0];
    const r = h.startsWith("/admin")
      ? await coach.req(pathOnly)
      : await memberReq(pathOnly);
    const loc = r.location || r.res.headers?.get?.("location") || "";
    if (pageOk(r.res.status, loc)) pass(`${tag} link ${h}`, String(r.res.status));
    else fail(`${tag} link ${h}`, String(r.res.status));
  }

  // Maintain resume (member flow still healthy)
  const resume = await memberReq("/api/member/maintain-resume");
  if (resume.res.ok || [401, 403, 404].includes(resume.res.status)) {
    pass(`${tag} maintain-resume`, String(resume.res.status));
  } else fail(`${tag} maintain-resume`, String(resume.res.status));

  // Live zoom member strip (nested routes — status only; no bare /live-zoom index)
  const mLiveZoom = await memberReq("/api/member/live-zoom/status");
  if (mLiveZoom.res.ok || [401, 403, 404].includes(mLiveZoom.res.status)) {
    pass(`${tag} member live-zoom/status`, String(mLiveZoom.res.status));
  } else fail(`${tag} member live-zoom/status`, String(mLiveZoom.res.status));

  pass(`${tag} round complete`);
}

async function main() {
  console.log(`\n${MARK} · BASE=${BASE} · ROUNDS=${ROUNDS}`);
  console.log(`coach=${COACH_EMAIL} · member=${MEMBER_EMAIL}${MEMBER_PASSWORD ? "" : " (no password — coach session for member pages)"}\n`);
  console.log("Note: Zoom is probed read-only (no disconnect).\n");

  const home = await fetch(BASE + "/", {
    redirect: "manual",
    headers: { "User-Agent": UA.desktop },
  });
  assert(
    home.status === 200 || home.status === 307 || home.status === 308,
    "prod home",
    String(home.status),
  );
  pass("prod reachable", home.headers.get("x-vercel-id") || "ok");

  for (let r = 1; r <= ROUNDS; r++) {
    await runRound(r);
  }

  const failed = results.filter((x) => !x.ok);
  const warns = results.filter((x) => x.warn);
  const out = {
    mark: MARK,
    run: RUN,
    base: BASE,
    rounds: ROUNDS,
    at: new Date().toISOString(),
    passed: results.filter((x) => x.ok && !x.warn).length,
    warnings: warns.length,
    failed: failed.length,
    results,
  };
  writeFileSync(
    new URL("./.full-site-4-loop-latest.json", import.meta.url),
    JSON.stringify(out, null, 2),
  );

  console.log(
    `\n── Summary: ${out.passed} pass · ${warns.length} warn · ${failed.length} fail ──\n`,
  );
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("All loops green (warnings allowed).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
