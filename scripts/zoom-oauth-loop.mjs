#!/usr/bin/env node
/**
 * Browser OAuth loop — coach login → Connect Zoom → wait for Settings success.
 *
 * Requires: npx playwright install chromium
 *
 * Usage:
 *   npm run test:zoom-oauth-loop
 *   HEADLESS=0 npm run test:zoom-oauth-loop   # visible browser (complete Zoom login if prompted)
 */

import { chromium } from "playwright";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD ?? "";
const HEADLESS = process.env.HEADLESS !== "0";

async function main() {
  console.log(`\nZoom OAuth loop → ${BASE}`);
  console.log(`Coach: ${COACH_EMAIL} | headless=${HEADLESS}\n`);

  const { req, loginCoach } = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  if (!(await loginCoach({
    onPass: (n, d) => console.log(`✅ ${n} — ${d}`),
    onFail: (n, d) => { console.log(`❌ ${n} — ${d}`); process.exit(1); },
  }))) process.exit(1);

  const diag = await req(`/api/admin/zoom/diagnose?_=${Date.now()}`);
  if (diag.res.ok) {
    console.log("Pre-flight:", diag.body.hint || "diagnostics ok");
    if (diag.body.diagnostics?.tokenProbe === "invalid_client") {
      console.log("❌ Fix Vercel ZOOM_CLIENT_ID/SECRET before browser Connect");
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login?redirect=/admin/settings`, { waitUntil: "domcontentloaded" });
    await page.fill("#login-username", COACH_EMAIL);
    const pwdBtn = page.getByRole("button", { name: /Sign in with password/i });
    if (await pwdBtn.isVisible().catch(() => false)) await pwdBtn.click();
    if (COACH_PASSWORD) {
      await page.waitForSelector("#login-password", { timeout: 8000 });
      await page.fill("#login-password", COACH_PASSWORD);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 30000 });

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

    if (/zoom\.us\/oauth\/authorize/.test(zoomUrl)) {
      console.log("⏳ Approve on Zoom if prompted (headless may stall — use HEADLESS=0)");
      await zoomPage.waitForURL(/thetrainstation\.co\/admin\/settings|zoom=connected|zoom=error/, {
        timeout: 180000,
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
    await browser.close();
  }
}

main();