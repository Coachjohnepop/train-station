#!/usr/bin/env node
/**
 * Browser OAuth loop — coach login → Connect Zoom → wait for Settings success.
 *
 * Defaults to Brave on macOS (not Chrome).
 *
 * Usage:
 *   npm run test:zoom-oauth-loop
 *   HEADLESS=0 npm run test:zoom-oauth-loop
 *
 * Env:
 *   BROWSER=brave|chromium   (default: brave on darwin, else chromium)
 *   BROWSER_PROFILE_DIR        Brave/Chrome user-data dir for saved Zoom login
 *   BROWSER_EXECUTABLE         override app path
 */

import { chromium } from "playwright";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD ?? "";
const HEADLESS = process.env.HEADLESS !== "0";

const BRAVE_EXECUTABLE =
  process.env.BROWSER_EXECUTABLE ||
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BRAVE_PROFILE_DEFAULT =
  process.env.BROWSER_PROFILE_DIR ||
  `${process.env.HOME}/Library/Application Support/BraveSoftware/Brave-Browser`;

function browserKind() {
  if (process.env.BROWSER) return process.env.BROWSER;
  return process.platform === "darwin" ? "brave" : "chromium";
}

function launchOptions(headless) {
  const kind = browserKind();
  if (kind === "brave") {
    return {
      headless,
      executablePath: BRAVE_EXECUTABLE,
    };
  }
  return {
    headless,
    channel: process.env.PW_CHANNEL || "chrome",
  };
}

async function main() {
  const kind = browserKind();
  console.log(`\nZoom OAuth loop → ${BASE}`);
  console.log(`Coach: ${COACH_EMAIL} | browser=${kind} | headless=${HEADLESS}\n`);

  const { req, loginCoach, getCookies } = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  if (!(await loginCoach({
    onPass: (n, d) => console.log(`✅ ${n} — ${d}`),
    onFail: (n, d) => { console.log(`❌ ${n} — ${d}`); process.exit(1); },
  }))) process.exit(1);

  const sessionCookies = getCookies()
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf("=");
      return {
        name: p.slice(0, i),
        value: p.slice(i + 1),
        domain: "www.thetrainstation.co",
        path: "/",
      };
    });

  const diag = await req(`/api/admin/zoom/diagnose?_=${Date.now()}`);
  if (diag.res.ok) {
    console.log("Pre-flight:", diag.body.hint || "diagnostics ok");
    if (diag.body.diagnostics?.tokenProbe === "invalid_client") {
      console.log("❌ Fix Vercel ZOOM_CLIENT_ID/SECRET before browser Connect");
      process.exit(1);
    }
  }

  const profileDir = process.env.BROWSER_PROFILE_DIR || "";
  let browser;
  let context;
  let page;

  if (profileDir) {
    console.log(`Using browser profile: ${profileDir}`);
    console.log("Tip: quit Brave first or profile launch may fail.\n");
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions(false),
    });
    browser = null;
    page = context.pages()[0] || (await context.newPage());
    await context.addCookies(sessionCookies);
  } else {
    browser = await chromium.launch(launchOptions(HEADLESS));
    context = await browser.newContext();
    await context.addCookies(sessionCookies);
    page = await context.newPage();
  }

  try {
    await page.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
    const connect = page.getByRole("link", { name: /Connect Zoom account/i });
    await connect.waitFor({ timeout: 15000 });
    console.log("✅ Settings loaded — clicking Connect");

    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
      connect.click(),
    ]);

    const zoomPage = popup || page;
    await zoomPage.waitForLoadState("domcontentloaded");
    const zoomUrl = zoomPage.url();
    console.log("Zoom step:", zoomUrl.slice(0, 120));

    if (/zoom\.us\/(oauth\/authorize|signin)/.test(zoomUrl)) {
      console.log("⏳ Sign into Zoom in Brave if prompted, then click Allow");
      await zoomPage.waitForURL(/thetrainstation\.co\/admin\/settings|zoom=connected|zoom=error/, {
        timeout: 300000,
      }).catch(() => {});
    }

    await page.goto(`${BASE}/admin/settings?_=1`, { waitUntil: "networkidle" });
    const banner = await page.locator('[role="status"]').first().textContent().catch(() => "");
    console.log("Settings banner:", banner?.trim() || "(none)");

    const statusRes = await req(`/api/admin/zoom/status?_=${Date.now()}`);
    const connected = Boolean(statusRes.body?.connected);
    console.log(connected ? "✅ Zoom connected" : "❌ Zoom still not connected", statusRes.body?.account || "");

    process.exit(connected ? 0 : 1);
  } catch (e) {
    console.error("❌ OAuth loop failed:", e.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    else await context?.close();
  }
}

main();