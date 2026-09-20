#!/usr/bin/env node
/**
 * Landing A/B loop on prod (or BASE_URL). Live = tour vs jeremy (get started).
 *
 *   BASE_URL=https://www.thetrainstation.co node scripts/landing-ab-loop.mjs
 *   ROUNDS=2 VIEWPORTS=mobile,desktop FRESH=12 node scripts/landing-ab-loop.mjs
 *
 * UI checks do not keep accounts. With LOOP_INGEST=1 (default) it also
 * POSTs guest-start for own + Jeremy paths, then the purge script deletes them.
 *
 *   LOOP_INGEST=0 to skip creating guest members.
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 2));
const FRESH = Math.max(8, Number(process.env.FRESH || 12));
const LOOP_INGEST = process.env.LOOP_INGEST !== "0";
const LOOP_UA_TOKEN = "TrainStationLoop/1";
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

const VIEW = {
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 ${LOOP_UA_TOKEN}`,
  },
  desktop: {
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ${LOOP_UA_TOKEN}`,
  },
};

async function cookieFromGet() {
  const res = await fetch(BASE + "/", { redirect: "follow", headers: { "cache-control": "no-cache" } });
  const set = res.headers.getSetCookie?.() || [];
  const raw = set.find((c) => c.startsWith("ts_landing=")) || "";
  const variant = /ts_landing=([^;]+)/.exec(raw)?.[1] || "";
  return { status: res.status, variant, url: res.url };
}

async function httpDoors() {
  console.log("\n=== HTTP doors ===");
  for (const p of ["/", "/l/tour", "/l/jeremy", "/l/floor", "/l/class", "/l/nope"]) {
    const res = await fetch(BASE + p, { redirect: "follow" });
    const html = await res.text();
    const marker = /data-landing-variant="([^"]+)"/.exec(html)?.[1] || "(none)";
    const cookie = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith("ts_landing=")) || "";
    const cookieV = /ts_landing=([^;]+)/.exec(cookie)?.[1] || "";
    if (p === "/l/nope") {
      if (res.ok && (res.url.endsWith("/") || marker === "tour" || marker === "jeremy")) {
        pass(`GET ${p} bounced home`, `${res.status} variant=${marker}`);
      } else fail(`GET ${p}`, `${res.status} ${res.url}`);
      continue;
    }
    if (res.ok) pass(`GET ${p}`, `${res.status} html=${marker} cookie=${cookieV || "—"}`);
    else fail(`GET ${p}`, `HTTP ${res.status}`);
  }
}

async function httpSplit() {
  console.log(`\n=== Fresh / split (${FRESH} requests, no cookie) ===`);
  const counts = { tour: 0, jeremy: 0, floor: 0, class: 0, other: 0 };
  for (let i = 0; i < FRESH; i++) {
    const { status, variant } = await cookieFromGet();
    if (status !== 200) {
      fail(`fresh ${i + 1}`, `HTTP ${status}`);
      continue;
    }
    if (variant === "tour" || variant === "jeremy" || variant === "floor" || variant === "class") {
      counts[variant] += 1;
    } else counts.other += 1;
  }
  console.log(
    `  mix  tour=${counts.tour}  class=${counts.class}  jeremy=${counts.jeremy}  floor=${counts.floor}  other=${counts.other}`,
  );
  if (counts.floor > 0) fail("live split excludes C", `floor=${counts.floor}`);
  else pass("live split excludes C");
  if (counts.class > 0) fail("live split excludes preview D", `class=${counts.class}`);
  else pass("live split excludes preview D");
  if (counts.tour > 0 && counts.jeremy > 0) {
    pass("live split hits A and B", `tour=${counts.tour} jeremy=${counts.jeremy}`);
  } else fail("live split hits A and B", JSON.stringify(counts));
}

async function withBrowser(name, viewportKey, fn) {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext(VIEW[viewportKey] || VIEW.desktop);
  const page = await context.newPage();
  try {
    await fn(page, context);
  } finally {
    await browser.close();
  }
}

async function assertVariant(page, expect, label) {
  const attr = await page.locator("[data-landing-variant]").first().getAttribute("data-landing-variant");
  const body = await page.locator("body").innerText();
  if (attr !== expect) {
    fail(`${label} variant attr`, `got ${attr}`);
    return { attr, body };
  }
  pass(`${label} variant attr`, expect);
  if (expect === "tour") {
    if (/Start membership/i.test(body) && /How it Works/i.test(body)) pass(`${label} tour CTAs`);
    else fail(`${label} tour CTAs`, body.slice(0, 120));
    if (/Meet your\s+coach/i.test(body)) fail(`${label} tour must not be B headline`);
    else pass(`${label} tour is not B`);
  }
  if (expect === "jeremy") {
    if (/Start membership/i.test(body) && /See the program/i.test(body) && /I workout today/i.test(body)) {
      pass(`${label} B fork`);
    } else fail(`${label} B fork`, body.slice(0, 180));
  }
  if (expect === "floor") {
    if (/This is/i.test(body) && /Start Free/i.test(body)) pass(`${label} C CTAs`);
    else fail(`${label} C CTAs`, body.slice(0, 160));
  }
  if (expect === "class") {
    if (/6:30am/i.test(body) && /Join the 6:30am class/i.test(body)) pass(`${label} D CTAs`);
    else fail(`${label} D CTAs`, body.slice(0, 160));
  }
  return { attr, body };
}

async function browserDoors(viewportKey) {
  console.log(`\n=== Browser doors (${viewportKey}) ===`);
  for (const [path, expect] of [
    ["/l/tour", "tour"],
    ["/l/jeremy", "jeremy"],
    ["/l/floor", "floor"],
    ["/l/class", "class"],
  ]) {
    await withBrowser(path, viewportKey, async (page, context) => {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(800);
      await assertVariant(page, expect, `${viewportKey} ${path}`);
      const cookies = await context.cookies();
      const v = cookies.find((c) => c.name === "ts_landing")?.value;
      if (v === expect) pass(`${viewportKey} ${path} cookie`, v);
      else fail(`${viewportKey} ${path} cookie`, String(v));
    });
  }
}

async function browserStickiness(viewportKey) {
  console.log(`\n=== Stickiness (${viewportKey}) ===`);
  await withBrowser("sticky", viewportKey, async (page, context) => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    const first = await page.locator("[data-landing-variant]").first().getAttribute("data-landing-variant");
    if (first === "tour" || first === "jeremy") pass(`${viewportKey} / assigned`, first);
    else fail(`${viewportKey} / assigned`, String(first));
    if (first === "floor") fail(`${viewportKey} / must not assign C`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const second = await page.locator("[data-landing-variant]").first().getAttribute("data-landing-variant");
    if (second === first) pass(`${viewportKey} reload sticky`, second);
    else fail(`${viewportKey} reload sticky`, `${first} → ${second}`);

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const third = await page.locator("[data-landing-variant]").first().getAttribute("data-landing-variant");
    if (third === first) pass(`${viewportKey} second hit sticky`, third);
    else fail(`${viewportKey} second hit sticky`, `${first} → ${third}`);
  });
}

async function browserCtas(viewportKey) {
  console.log(`\n=== B fork + D CTA (${viewportKey}) ===`);
  await withBrowser("cta", viewportKey, async (page) => {
    await page.goto(BASE + "/l/jeremy", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);
    const start = page.getByRole("link", { name: "Start membership" });
    const see = page.locator('[data-analytics-action="hero-b-want-jeremy"]');
    const own = page.locator('[data-analytics-action="hero-b-have-workout"]');
    if ((await start.count()) > 0 && (await see.count()) > 0 && (await own.count()) > 0) {
      pass(`${viewportKey} B choices`);
    } else fail(`${viewportKey} B choices`, (await page.locator("body").innerText()).slice(0, 180));
    if ((await page.getByText("Play").count()) === 0) {
      pass(`${viewportKey} meet Jeremy hidden at start`);
    } else fail(`${viewportKey} meet Jeremy hidden at start`);
    await page.waitForTimeout(2500);
    if ((await page.getByText("Play").count()) > 0) pass(`${viewportKey} meet Jeremy after 3s`);
    else fail(`${viewportKey} meet Jeremy after 3s`);

    await own.first().click();
    await page.waitForTimeout(400);
    const learn = page.getByRole("button", { name: "Learn About The Train Station" });
    const upload = page.getByRole("button", { name: "Upload Your Own Workout" });
    if ((await learn.count()) > 0 && (await upload.count()) > 0) pass(`${viewportKey} B today split`);
    else fail(`${viewportKey} B today split`);
    await upload.first().click();
    await page.waitForTimeout(400);
    if ((await page.getByPlaceholder("Username").count()) > 0) pass(`${viewportKey} B username`);
    else fail(`${viewportKey} B username`);
    if ((await page.locator("textarea").count()) > 0) pass(`${viewportKey} B paste`);
    else fail(`${viewportKey} B paste`);
    await page.getByRole("button", { name: "Close" }).first().click();
    await page.waitForTimeout(300);
    await own.first().click();
    await page.waitForTimeout(300);
    await learn.first().click();
    await page.waitForTimeout(500);
    if ((await page.getByRole("button", { name: "Play" }).count()) > 0) pass(`${viewportKey} B learn Play`);
    else fail(`${viewportKey} B learn Play`);
    if ((await page.getByRole("button", { name: "Memberships" }).count()) > 0) pass(`${viewportKey} B learn Memberships`);
    else fail(`${viewportKey} B learn Memberships`);
    const closeTour = page.getByRole("button", { name: "Close tour" });
    if ((await closeTour.count()) > 0) await closeTour.first().click();
    await page.waitForTimeout(300);
    await see.first().click();
    await page.waitForTimeout(600);
    if ((await page.getByPlaceholder("Username").count()) === 0) pass(`${viewportKey} B program no username yet`);
    else fail(`${viewportKey} B program no username yet`);
    if ((await page.getByText("Today").count()) > 0 || (await page.getByText("Live session").count()) > 0) {
      pass(`${viewportKey} B program preview`);
    } else fail(`${viewportKey} B program preview`);
    const playProg = page.locator('[data-analytics-action="b-program-play"]');
    if ((await playProg.count()) > 0) await playProg.first().click();
    await page.waitForTimeout(400);
    const next = page.locator('[data-analytics-action="b-program-next"]');
    if ((await next.count()) > 0) await next.first().click();
    await page.waitForTimeout(400);
    if ((await playProg.count()) > 0) await playProg.first().click();
    await page.waitForTimeout(300);
    if ((await next.count()) > 0) await next.first().click();
    await page.waitForTimeout(400);
    if ((await page.getByText("Like what you see").count()) > 0) pass(`${viewportKey} B program username last`);
    else fail(`${viewportKey} B program username last`);
    if ((await page.getByPlaceholder("Username").count()) > 0) pass(`${viewportKey} B program username field`);
    else fail(`${viewportKey} B program username field`);
  });
  await withBrowser("cta-class", viewportKey, async (page) => {
    await page.goto(BASE + "/l/class", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    const join = page.locator('a[data-analytics-action="hero-join-class"]');
    if ((await join.count()) > 0) {
      const href = await join.first().getAttribute("href");
      if (href && href.includes("plan=member")) pass(`${viewportKey} D Join class href`, href);
      else fail(`${viewportKey} D Join class href`, String(href));
    } else fail(`${viewportKey} D Join class missing`);
  });
}

async function liveGuestStart() {
  console.log("\n=== Guest start (own + Jeremy) ===");
  if (!LOOP_INGEST) {
    pass("guest-start skipped", "LOOP_INGEST=0");
    return;
  }
  const stamp = Date.now().toString(36).replace(/[^a-z0-9]/gi, "").slice(-5);
  const ownName = `Loopown${stamp}`;
  const jerName = `Loopjer${stamp}`;
  const notes = "Air Squats\n3x10\nPush Ups\n3x8";
  const headers = { "Content-Type": "application/json", "User-Agent": `node ${LOOP_UA_TOKEN}` };

  const ownRes = await fetch(BASE + "/api/byow/guest-start", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: ownName, path: "own", rawText: notes }),
  });
  const own = await ownRes.json().catch(() => ({}));
  if (ownRes.ok && typeof own.redirectTo === "string" && own.redirectTo.includes("byow=")) {
    pass("guest-start own", `${ownName} → ${own.redirectTo}`);
  } else fail("guest-start own", `${ownRes.status} ${JSON.stringify(own).slice(0, 180)}`);

  const jerRes = await fetch(BASE + "/api/byow/guest-start", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: jerName, path: "jeremy" }),
  });
  const jer = await jerRes.json().catch(() => ({}));
  if (jerRes.ok && typeof jer.redirectTo === "string" && jer.redirectTo.includes("/member/today")) {
    pass("guest-start jeremy", `${jerName} → ${jer.redirectTo}`);
  } else fail("guest-start jeremy", `${jerRes.status} ${JSON.stringify(jer).slice(0, 180)}`);
}

async function main() {
  console.log(
    `Landing A/B loop  ${BASE}  rounds=${ROUNDS}  ${VIEWPORTS.join(",")}  fresh=${FRESH}  ingest=${LOOP_INGEST ? "on" : "off"}`,
  );
  await httpDoors();
  await httpSplit();
  await liveGuestStart();
  for (let r = 1; r <= ROUNDS; r++) {
    console.log(`\n── round ${r}/${ROUNDS} ──`);
    for (const vp of VIEWPORTS) {
      await browserDoors(vp);
      await browserStickiness(vp);
      await browserCtas(vp);
    }
  }
  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok).length;
  const out = { base: BASE, at: new Date().toISOString(), ok, fail: failed.length, results };
  writeFileSync(new URL("./.landing-ab-loop-latest.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(`\n${ok} passed, ${failed.length} failed`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL  ${f.name}  ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
