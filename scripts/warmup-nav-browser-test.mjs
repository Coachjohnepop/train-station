#!/usr/bin/env node
/**
 * Browser tests for warm-up day navigator arrows + mobile controls.
 * Usage: node scripts/warmup-nav-browser-test.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");
const RAMP_MEMBER = { email: "coachjohnepop@yahoo.com", password: "TestPass123!" };

const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function loginMember(page, creds) {
  await page.goto(`${BASE}/login?switch=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#login-username", { timeout: 15000 });
  await page.fill("#login-username", creds.email);
  await page.click('button:has-text("Sign in with password")').catch(() => {});
  if (!(await page.isVisible("#login-password"))) {
    await page.getByRole("button", { name: /Sign in with password/i }).click().catch(() => {});
  }
  await page.waitForSelector("#login-password", { timeout: 10000 });
  await page.fill("#login-password", creds.password);
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL(/\/member|\/setup-quick-auth/, { timeout: 25000 });
  if (page.url().includes("setup-quick-auth")) {
    await page.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });
  }
}

async function main() {
  console.log(`\nWarm-up navigator tests → ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });

  try {
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await loginMember(page, RAMP_MEMBER);
      await page.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });

      pass("Member login + /member/today", page.url().replace(BASE, ""));

      const warmupHeading = await page.getByRole("heading", { name: "Warm-up" }).count();
      const dayWheel = await page.locator(".day-wheel").count();
      const sideArrows = page.locator("button.warmup-nav-arrow");
      const sideArrowCount = await sideArrows.count();
      const mobilePrev = page.getByRole("button", { name: /Prev day/i });
      const swipeHint = await page.getByText(/Swipe left or right/i).isVisible();

      if (warmupHeading) pass("Warm-up section visible");
      else fail("Warm-up section visible", "heading not found");

      if (dayWheel) pass("Day wheel present");
      else fail("Day wheel present", "intake ramp placeholder days should render wheel");

      const arrowBox = sideArrowCount > 0 ? await sideArrows.first().boundingBox() : null;
      const arrowVisible = sideArrowCount > 0 && (await sideArrows.first().isVisible());
      const arrowDisplay =
        sideArrowCount > 0
          ? await sideArrows.first().evaluate((el) => getComputedStyle(el).display)
          : "n/a";

      if (sideArrowCount === 2) pass("Two side arrow buttons in DOM", `display=${arrowDisplay}`);
      else fail("Two side arrow buttons in DOM", `count=${sideArrowCount}`);

      if (arrowVisible && arrowBox && arrowBox.width > 20)
        pass("Side arrows visible at 1280px desktop", `${Math.round(arrowBox.width)}x${Math.round(arrowBox.height)}`);
      else
        fail(
          "Side arrows visible at 1280px desktop",
          `visible=${arrowVisible} display=${arrowDisplay} box=${arrowBox ? JSON.stringify(arrowBox) : "null"}`,
        );

      const mobilePrevVisible = await mobilePrev.isVisible().catch(() => false);
      if (!mobilePrevVisible) pass("Mobile prev/next hidden at desktop");
      else fail("Mobile prev/next hidden at desktop");

      if (!swipeHint) pass("Swipe hint hidden at desktop");
      else fail("Swipe hint hidden at desktop");

      const nextArrow = page.locator("button.warmup-nav-arrow--next");
      const nextDisabled = await nextArrow.isDisabled().catch(() => true);
      if (!nextDisabled) {
        await nextArrow.click();
        await page.waitForURL(/date=/, { timeout: 5000 });
        pass("Next arrow advances day", page.url().replace(BASE, ""));
      } else {
        fail("Next arrow enabled on ramp window", "expected future days to navigate");
      }

      await context.close();
    }

    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      });
      const page = await context.newPage();
      await loginMember(page, RAMP_MEMBER);
      await page.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });

      const sideArrows = page.locator("button.warmup-nav-arrow");
      const sideVisible = (await sideArrows.count()) > 0 ? await sideArrows.first().isVisible() : false;
      const mobilePrev = page.getByRole("button", { name: /Prev day/i });
      const swipeHint = await page.getByText(/Swipe left or right/i).isVisible();

      if (!sideVisible) pass("Side arrows hidden at 390px mobile");
      else fail("Side arrows hidden at 390px mobile");

      if (await mobilePrev.isVisible()) pass("Mobile prev/next visible");
      else fail("Mobile prev/next visible");

      if (swipeHint) pass("Swipe hint visible on mobile");
      else fail("Swipe hint visible on mobile");

      await context.close();
    }
  } catch (e) {
    fail("Test error", e.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});