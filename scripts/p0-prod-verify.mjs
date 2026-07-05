#!/usr/bin/env node
/**
 * P0 production verify — Dashboard, Go to Today, Zoom (SESSION_STATUS checklist).
 *
 * Usage:
 *   node scripts/p0-prod-verify.mjs [baseUrl]
 *   BASE_URL=https://www.thetrainstation.co npm run test:p0-prod
 *   node scripts/p0-prod-verify.mjs --browser   # optional Playwright UI checks
 *
 * Env:
 *   COACH_EMAIL / COACH_PASSWORD (default: jeremy@ + CoachTest123!)
 *   P0_STRICT_ZOOM=1  — fail if ZAK credentials missing (default: warn only)
 */

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const BROWSER = process.argv.includes("--browser");
const BASE = (process.env.BASE_URL || args[0] || "https://www.thetrainstation.co").replace(
  /\/$/,
  "",
);
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD =
  process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "CoachTest123!";
const STRICT_ZOOM = process.env.P0_STRICT_ZOOM === "1";

const results = [];

function record(name, ok, detail = "", level = "required") {
  results.push({ name, ok, detail, level });
  const icon = ok ? "✅" : level === "warn" ? "⚠️" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function pass(name, detail = "") {
  record(name, true, detail);
}
function fail(name, detail = "") {
  record(name, false, detail);
}
function warn(name, detail = "") {
  record(name, false, detail, "warn");
}

let cookies = "";

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

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  if (res.headers.getSetCookie?.()?.length) {
    cookies = mergeSetCookie(cookies, res.headers);
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text, location: res.headers.get("location") || "" };
}

async function coachLogin() {
  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: COACH_EMAIL, password: COACH_PASSWORD, redirect: "/admin/day" },
  });
  if (!login.res.ok || !cookies.includes("ts_session")) {
    fail("Coach login", login.body?.error || `status ${login.res.status}`);
    return false;
  }
  pass("Coach login", COACH_EMAIL);
  return true;
}

async function verifyDashboard() {
  const day = await req("/admin/day");
  if (day.res.status !== 200) {
    fail("Dashboard /admin/day", `status ${day.res.status}`);
    return;
  }
  pass("Dashboard /admin/day", "200");

  const markers = [
    ["coach-dashboard", "dashboard shell"],
    ["coach-class-day-band", "day band"],
    ["coach-day-cell", "square day cells"],
    ["Go to Today", "Go to Today CTA"],
  ];
  for (const [needle, label] of markers) {
    if (day.text.includes(needle)) pass(`Dashboard: ${label}`);
    else fail(`Dashboard: ${label}`, `missing "${needle}"`);
  }

  const plan = await req("/admin/day?plan=1");
  if (plan.res.status !== 200) {
    fail("Dashboard plan mode", `status ${plan.res.status}`);
  } else if (
    plan.text.includes("Grok interprets") ||
    plan.text.includes("Cancel override") ||
    plan.text.includes("Publishing to")
  ) {
    pass("Dashboard plan mode", "lesson plan builder open");
  } else {
    fail("Dashboard plan mode", "lesson plan builder not found");
  }
}

async function verifyPlanRedirect() {
  const res = await req("/admin/plan");
  const loc = res.location.replace(BASE, "");
  if ((res.res.status === 307 || res.res.status === 308) && loc.includes("/admin/day") && loc.includes("plan=1")) {
    pass("/admin/plan redirect", loc);
  } else {
    fail("/admin/plan redirect", `status=${res.res.status} loc=${loc || "(none)"}`);
  }

  const dated = await req("/admin/plan?date=2026-07-10");
  const datedLoc = dated.location.replace(BASE, "");
  if (
    (dated.res.status === 307 || dated.res.status === 308) &&
    datedLoc.includes("date=2026-07-10") &&
    datedLoc.includes("plan=1")
  ) {
    pass("/admin/plan?date= redirect", datedLoc);
  } else {
    fail("/admin/plan?date= redirect", `status=${dated.res.status} loc=${datedLoc || "(none)"}`);
  }
}

async function verifyGoToToday() {
  const today = await req("/admin/today");
  if (today.res.status !== 200) {
    fail("Go to Today /admin/today", `status ${today.res.status}`);
    return;
  }
  pass("Go to Today /admin/today", "200");

  const markers = [
    ["coach-floor-shell", "floor shell (no sidebar)"],
    ["Go to Today", "floor header"],
    ["Start Video", "Start Video control"],
  ];
  for (const [needle, label] of markers) {
    if (today.text.includes(needle)) pass(`Go to Today: ${label}`);
    else fail(`Go to Today: ${label}`, `missing "${needle}"`);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const floor = await req(`/api/admin/live-floor?date=${todayKey}`);
  if (floor.res.ok) {
    const tiles = floor.body?.tiles?.length ?? 0;
    pass("Live floor API", `${tiles} tile(s) on ${floor.body?.sessionDate || todayKey}`);
  } else {
    fail("Live floor API", `status ${floor.res.status}`);
  }
}

async function verifyZoom() {
  const status = await req("/api/admin/zoom/status");
  if (!status.res.ok) {
    fail("Zoom status API", `status ${status.res.status}`);
    return;
  }
  const s = status.body || {};
  if (s.connected) pass("Zoom connected");
  else fail("Zoom connected", "coach not connected — Admin → Settings");
  if (s.sdkConfigured) pass("Zoom SDK configured");
  else fail("Zoom SDK configured", s.sdkConfigHint || "missing env");
  if (s.ready) pass("Zoom ready");
  else warn("Zoom ready", "OAuth or SDK not fully ready");

  const todayKey = new Date().toISOString().slice(0, 10);
  const creds = await req(`/api/admin/live-floor/zoom/credentials?date=${todayKey}&ensure=1`);
  if (creds.res.ok && creds.body?.zak) {
    pass("Zoom embed credentials (ZAK)", "zak token returned");
  } else if (creds.res.ok && creds.body?.demo) {
    pass("Zoom embed credentials", "demo mode (no ZAK needed)");
  } else {
    const err = creds.body?.error || `status ${creds.res.status}`;
    const scopeIssue = /user:read:token/i.test(String(err));
    const msg = scopeIssue
      ? `${err} — reconnect Zoom in Settings after scope deploy`
      : err;
    if (STRICT_ZOOM) fail("Zoom embed credentials (ZAK)", msg);
    else warn("Zoom embed credentials (ZAK)", msg);
  }
}

async function verifyBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    warn("Browser checks", "playwright not installed — skip (--browser)");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login?redirect=/admin/day`, { waitUntil: "networkidle" });
    await page.fill("#login-username", COACH_EMAIL);
    await page.click('button:has-text("Sign in with password")').catch(() => {});
    if (!(await page.isVisible("#login-password"))) {
      await page.getByRole("button", { name: /Sign in with password/i }).click().catch(() => {});
    }
    await page.waitForSelector("#login-password", { timeout: 10000 });
    await page.fill("#login-password", COACH_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign in")');
    await page.waitForURL(/\/admin/, { timeout: 25000 });
    pass("Browser: coach login", page.url().replace(BASE, ""));

    await page.goto(`${BASE}/admin/day`, { waitUntil: "networkidle" });
    const band = page.locator(".coach-class-day-band");
    if ((await band.count()) > 0) pass("Browser: day band visible");
    else fail("Browser: day band visible");

    const cells = page.locator(".coach-day-cell");
    const cellCount = await cells.count();
    if (cellCount >= 3) pass("Browser: day band cells", `${cellCount} cells`);
    else fail("Browser: day band cells", `only ${cellCount}`);

    await page.goto(`${BASE}/admin/today`, { waitUntil: "networkidle" });
    const floor = page.locator(".coach-floor-shell");
    if ((await floor.count()) > 0) pass("Browser: floor shell");
    else fail("Browser: floor shell");

    const startVideo = page.getByRole("button", { name: /Start Video|Video live/i });
    if ((await startVideo.count()) > 0) pass("Browser: Start Video button");
    else fail("Browser: Start Video button");

    const expand = page.locator('button[aria-label*="Expand"], button:has-text("▶")').first();
    if ((await expand.count()) > 0) {
      await expand.click();
      await page.waitForTimeout(800);
      const setBtns = page.locator(".coach-floor-set-btn");
      if ((await setBtns.count()) > 0) pass("Browser: square set buttons after expand");
      else warn("Browser: square set buttons", "no tiles expanded or no set buttons");
    } else {
      warn("Browser: expand member card", "no roster tiles today");
    }
  } catch (e) {
    fail("Browser checks", e.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\nP0 prod verify → ${BASE}`);
  console.log(`Coach: ${COACH_EMAIL}${STRICT_ZOOM ? " | STRICT_ZOOM" : ""}${BROWSER ? " | browser" : ""}\n`);

  if (!(await coachLogin())) {
    summarize();
    return;
  }

  await verifyDashboard();
  await verifyPlanRedirect();
  await verifyGoToToday();
  await verifyZoom();
  if (BROWSER) await verifyBrowser();

  summarize();
}

function summarize() {
  const required = results.filter((r) => r.level === "required");
  const warnings = results.filter((r) => r.level === "warn" && !r.ok);
  const failed = required.filter((r) => !r.ok);

  console.log(`\n${required.length - failed.length}/${required.length} required passed`);
  if (warnings.length) {
    console.log(`${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w.name}: ${w.detail}`);
  }
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  if (warnings.length && STRICT_ZOOM) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});