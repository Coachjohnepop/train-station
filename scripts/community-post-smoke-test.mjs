#!/usr/bin/env node
/**
 * Smoke test Patreon-style community posts (no SMS / Resend).
 * Usage: node scripts/community-post-smoke-test.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH = { email: "jeremy@thetrainstation.co", password: "CoachTest123!" };
const MEMBER = { email: "coachjohnepop@yahoo.com", password: "TestPass123!" };

const results = [];
function pass(n, d = "") {
  results.push({ ok: true, name: n, detail: d });
  console.log(`✅ ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  results.push({ ok: false, name: n, detail: d });
  console.log(`❌ ${n}${d ? ` — ${d}` : ""}`);
}

async function login(page, creds) {
  await page.goto(`${BASE}/login?switch=1`, { waitUntil: "networkidle" });
  await page.fill("#login-username", creds.email);
  await page.click('button:has-text("Sign in with password")').catch(() => {});
  await page.waitForSelector("#login-password");
  await page.fill("#login-password", creds.password);
  await page.click('button[type=submit]:has-text("Sign in")');
  await page.waitForURL(/admin|member|setup-quick-auth/, { timeout: 25000 });
}

async function main() {
  console.log(`\nCommunity post smoke → ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const stamp = `smoke-${Date.now()}`;

  try {
    const coachPage = await browser.newPage();
    await login(coachPage, COACH);
    await coachPage.goto(`${BASE}/admin/chat`, { waitUntil: "networkidle" });
    pass("Coach login + admin chat");

    const composeRes = await coachPage.request.post(`${BASE}/api/chat/compose`, {
      data: {
        audience: "cohort",
        programSlug: "adult",
        body: `Community smoke ${stamp}`,
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        memberIds: [],
        sendSmsAlert: false,
      },
    });
    const composeData = await composeRes.json();
    if (composeRes.ok && composeData.messages?.length) {
      pass("Community compose API", `${composeData.messages.length} message(s)`);
    } else {
      fail("Community compose API", composeData.error || String(composeRes.status()));
    }

    const memberPage = await browser.newPage();
    await login(memberPage, MEMBER);
    if (memberPage.url().includes("setup-quick-auth")) {
      await memberPage.goto(`${BASE}/member/chat`, { waitUntil: "networkidle" });
    } else {
      await memberPage.goto(`${BASE}/member/chat`, { waitUntil: "networkidle" });
    }
    pass("Member login + messages page");

    const communityBtn = memberPage.getByRole("button", { name: /Community/i });
    if (await communityBtn.count()) {
      await communityBtn.first().click();
      await memberPage.waitForTimeout(800);
      pass("Community tab visible");
    } else {
      fail("Community tab visible");
    }

    await memberPage.waitForTimeout(2000);
    const bodyText = await memberPage.locator("body").innerText();
    if (bodyText.includes(`Community smoke ${stamp}`)) pass("Member sees community post text");
    else fail("Member sees community post text", "post not in feed yet");

    if (bodyText.includes("youtube") || (await memberPage.locator("iframe").count()) > 0) {
      pass("YouTube embed present");
    } else {
      fail("YouTube embed present");
    }

    const uploadRes = await coachPage.request.post(`${BASE}/api/chat/upload`, {
      multipart: {
        kind: "image",
        file: {
          name: "pixel.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        },
      },
    });
    const uploadData = await uploadRes.json();
    if (uploadRes.ok && uploadData.url) pass("Image upload API");
    else fail("Image upload API", uploadData.error || String(uploadRes.status()));
  } catch (e) {
    fail("Smoke error", e.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});