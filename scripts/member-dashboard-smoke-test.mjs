#!/usr/bin/env node
/**
 * Member dashboard smoke test (no email / Resend).
 * Usage: node scripts/member-dashboard-smoke-test.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");
const MEMBER = { email: "coachjohnepop@yahoo.com", password: "TestPass123!" };

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function loginMember(page) {
  await page.goto(`${BASE}/login?switch=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#login-username", { timeout: 15000 });
  await page.fill("#login-username", MEMBER.email);
  await page.click('button:has-text("Sign in with password")').catch(() => {});
  if (!(await page.isVisible("#login-password"))) {
    await page.getByRole("button", { name: /Sign in with password/i }).click().catch(() => {});
  }
  await page.waitForSelector("#login-password", { timeout: 10000 });
  await page.fill("#login-password", MEMBER.password);
  await page.click('button[type="submit"]:has-text("Sign in")');
  await page.waitForURL(/\/member|\/setup-quick-auth/, { timeout: 25000 });
  if (page.url().includes("setup-quick-auth")) {
    await page.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });
  }
}

async function expectNoCrash(page, label) {
  const err = await page
    .getByRole("heading", { name: /application error|something went wrong/i })
    .count();
  if (err) fail(label, "error copy on page");
  else pass(label);
}

async function main() {
  console.log(`\nMember dashboard smoke → ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginMember(page);
    pass("Login", page.url().replace(BASE, ""));

    await page.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });
    await expectNoCrash(page, "Today page loads");

    const todayHeading = await page.getByRole("heading", { name: /^Today$/ }).count();
    if (todayHeading) pass("Today heading");
    else fail("Today heading");

    for (const tab of ["Today", "Messages", "Scores", "Book Call", "Account"]) {
      const n = await page.getByRole("link", { name: tab, exact: true }).count();
      if (n) pass(`Nav: ${tab}`);
      else fail(`Nav: ${tab}`);
    }

    if (await page.locator(".day-wheel-shell").count()) pass("Day wheel");
    else fail("Day wheel");

    if (await page.getByRole("heading", { name: "Warm-up" }).count()) pass("Warm-up block");
    else fail("Warm-up block");

    if (await page.getByText(/Schedule your 15-minute intake/i).count()) pass("Intake intro card");
    else fail("Intake intro card");

    if ((await page.locator("button.warmup-nav-arrow").count()) === 2) pass("Warm-up side arrows");
    else fail("Warm-up side arrows");

    if (await page.getByText("Coach messages").count()) pass("Hub: Coach messages");
    else fail("Hub: Coach messages");

    if (await page.getByText(/SCORES|Scores →/i).count()) pass("Hub: Scores card");
    else fail("Hub: Scores card");

    if (await page.getByText("Account").count()) pass("Hub: Account card");
    else fail("Hub: Account card");

    // Sub-pages (no email triggers)
    await page.goto(`${BASE}/member/chat`, { waitUntil: "networkidle" });
    if (await page.getByRole("heading", { name: "Messages" }).count()) pass("Messages page");
    else fail("Messages page");

    await page.goto(`${BASE}/member/leaderboard`, { waitUntil: "networkidle" });
    await expectNoCrash(page, "Scores page loads");
    if (await page.getByText(/leaderboard|your score|my program/i).count()) pass("Scores page content");
    else fail("Scores page content");

    await page.goto(`${BASE}/member/account`, { waitUntil: "networkidle" });
    if (await page.getByText(/Quick sign-in|Account|Membership/i).count()) pass("Account page");
    else fail("Account page");

    await page.goto(`${BASE}/member/book`, { waitUntil: "networkidle" });
    await expectNoCrash(page, "Book Call page loads");
    if (await page.getByText(/book|call|calendly|intro/i).count()) pass("Book Call page content");
    else fail("Book Call page content");

    await context.close();

    // Mobile quick check
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const mpage = await mobile.newPage();
    await loginMember(mpage);
    await mpage.goto(`${BASE}/member/today`, { waitUntil: "networkidle" });
    if (await mpage.getByRole("button", { name: /Prev day/i }).isVisible()) pass("Mobile warm-up nav");
    else fail("Mobile warm-up nav");
    if (await mpage.getByRole("heading", { name: "Warm-up" }).isVisible()) pass("Mobile warm-up block");
    else fail("Mobile warm-up block");
    await mobile.close();
  } catch (e) {
    fail("Smoke test error", e.message);
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
  console.log("\nReady for manual testing.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});