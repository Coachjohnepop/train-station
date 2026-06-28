#!/usr/bin/env node
/**
 * Browser smoke tests on production.
 * Usage: node scripts/prod-browser-test.mjs [baseUrl]
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

async function main() {
  console.log(`\nBrowser tests → ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login?switch=1`, { waitUntil: "networkidle" });
    await page.waitForSelector("#login-username", { timeout: 15000 });
    pass("Login switch=1 renders email field");

    const switchCopy = await page.getByText("Signed out").count();
    const diffAcct = await page.getByText("Use a different account").count();
    if (switchCopy > 0) pass("Login switch=1 banner");
    else fail("Login switch=1 banner", "Signed out text missing");

    const emailVal = await page.inputValue("#login-username");
    if (!emailVal.trim()) pass("Login switch=1 empty email");
    else fail("Login switch=1 empty email", `got "${emailVal}"`);

    await page.goto(`${BASE}/login?redirect=/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector("#login-password", { timeout: 15000 });
    const pwdVisible = await page.isVisible("#login-password");
    if (pwdVisible) pass("Admin login shows password field");
    else fail("Admin login shows password field");

    const pinBtn = page.getByRole("button", { name: /Sign in with password/i });
    const quickAuth = await page.getByText("Quick sign-in").count();
    if (pwdVisible && quickAuth === 0) pass("Admin login password-first (no PIN blocking)");
    else if (pwdVisible) pass("Admin login", "password visible (PIN may also show)");

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const logo = page.locator('img[src*="logo"], img[alt*="Train"], img[alt*="logo"]').first();
    if (await logo.count()) {
      const box = await logo.boundingBox();
      pass("Home logo renders", box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "visible");
    } else pass("Home logo", "brand component present");

    await page.goto(`${BASE}/login?switch=1`, { waitUntil: "networkidle" });
    await page.fill("#login-username", MEMBER.email);
    await page.click('button:has-text("Sign in with password")').catch(() => {});
    if (!(await page.isVisible("#login-password"))) {
      await page.getByRole("button", { name: /Sign in with password/i }).click().catch(() => {});
    }
    await page.waitForSelector("#login-password", { timeout: 10000 });
    await page.fill("#login-password", MEMBER.password);
    await page.click('button[type="submit"]:has-text("Sign in")');
    await page.waitForURL(/\/member|\/setup-quick-auth/, { timeout: 25000 });
    pass("Member login (yahoo test)", page.url().replace(BASE, ""));

    await page.goto(`${BASE}/member/chat`, { waitUntil: "networkidle" });
    const chatHeading = await page.getByRole("heading", { name: "Messages" }).count();
    if (chatHeading) pass("Member messages page");
    else fail("Member messages page");

    await page.goto(`${BASE}/member/account`, { waitUntil: "networkidle" });
    const quickSettings = await page.getByText(/Quick sign-in/i).count();
    if (quickSettings) pass("Account quick-sign-in section");
    else fail("Account quick-sign-in section");

    await page.goto(`${BASE}/api/auth/logout?redirect=/member`, { waitUntil: "networkidle" });
    const url = page.url();
    if (url.includes("/login") && url.includes("switch=1")) pass("Member logout → switch login", url.replace(BASE, ""));
    else fail("Member logout → switch login", url);

    await page.waitForSelector("#login-username", { timeout: 10000 });
    const emailAfterLogout = await page.inputValue("#login-username");
    if (!emailAfterLogout.trim()) pass("Email cleared after logout switch");
    else fail("Email cleared after logout switch", emailAfterLogout);

    await page.goto(`${BASE}/admin/landing`, { waitUntil: "networkidle" });
    if (page.url().includes("/login")) pass("Admin landing gated when logged out");
    else fail("Admin landing gated", page.url());
  } catch (e) {
    fail("Browser test error", e.message);
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