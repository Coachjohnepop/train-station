#!/usr/bin/env node
/**
 * End-to-end auth smoke test — coach login, member login, signup, forgot/reset password.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/auth-flow-test.mjs
 *
 * Optional env:
 *   MEMBER_TEST_EMAIL=coachjohnepop@yahoo.com
 *   MEMBER_TEST_PASSWORD=TestPass123!
 *   COACH_TEST_EMAIL=jeremy@thetrainstation.co
 *   COACH_TEST_PASSWORD=CoachTest123!
 */
import { createHash, randomBytes, scryptSync } from "crypto";
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

if (process.env.VERCEL !== "1") {
  dotenv.config({ path: ".env.vercel.prod" });
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MEMBER_EMAIL = process.env.MEMBER_TEST_EMAIL || "coachjohnepop@yahoo.com";
const MEMBER_PASSWORD = process.env.MEMBER_TEST_PASSWORD || "TestPass123!";
const COACH_EMAIL = process.env.COACH_TEST_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_TEST_PASSWORD || "CoachTest123!";
const RESET_PASSWORD = process.env.RESET_TEST_PASSWORD || "ResetTest456!";
const TOKENS_PATH = "demo/password-reset-tokens.json";

const results = [];
let cookies = "";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, redirect: opts.redirect ?? "follow" });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = Object.fromEntries(
      (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
    );
    for (const raw of setCookie) {
      const part = raw.split(";")[0];
      const [k, ...v] = part.split("=");
      jar[k] = v.join("=");
    }
    cookies = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function blobOptions() {
  const storeId = process.env.BLOB_STORE_ID?.startsWith("store_")
    ? process.env.BLOB_STORE_ID
    : process.env.BLOB_STORE_ID
      ? `store_${process.env.BLOB_STORE_ID}`
      : null;
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.TS_BLOB_TOKEN;
  if (storeId && process.env.VERCEL_OIDC_TOKEN) {
    return { access: "public", storeId, oidcToken: process.env.VERCEL_OIDC_TOKEN };
  }
  if (token) return { access: "public", token };
  return null;
}

async function readTokenStore(opts) {
  try {
    const meta = await head(TOKENS_PATH, opts);
    const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {
    /* fresh store */
  }
  return {};
}

async function injectResetToken(email) {
  const opts = blobOptions();
  if (!opts) return null;

  const token = randomBytes(32).toString("hex");
  const key = createHash("sha256").update(token).digest("hex");

  for (let attempt = 0; attempt < 5; attempt++) {
    const now = Date.now();
    const store = await readTokenStore(opts);
    const next = { ...store };

    for (const [k, entry] of Object.entries(next)) {
      if (entry?.email === email) delete next[k];
    }

    next[key] = {
      email,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 3600000).toISOString(),
    };

    const putResult = await put(TOKENS_PATH, JSON.stringify(next, null, 2), {
      ...opts,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const verifyRes = await fetch(`${putResult.url}?_verify=${Date.now()}`, {
      cache: "no-store",
    });
    if (verifyRes.ok) {
      const verifyStore = await verifyRes.json();
      if (verifyStore[key]?.email === email) return token;
    }

    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }

  return token;
}

async function waitForResetToken(email, key, attempts = 8) {
  const opts = blobOptions();
  if (!opts) return false;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 500 + i * 400));
    const store = await readTokenStore(opts);
    if (store[key]?.email === email.trim().toLowerCase()) return true;
  }
  return false;
}

async function testLogin(label, email, password, expectRedirectPrefix) {
  cookies = "";
  const { res, body } = await req("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });
  if (!res.ok) {
    fail(`${label} login`, body?.error || `HTTP ${res.status}`);
    return false;
  }
  if (!body?.ok) {
    fail(`${label} login`, "missing ok");
    return false;
  }
  const dest = body.redirect || "";
  if (expectRedirectPrefix && !dest.startsWith(expectRedirectPrefix)) {
    fail(`${label} login redirect`, `got ${dest}, expected ${expectRedirectPrefix}*`);
    return false;
  }
  pass(`${label} login`, dest || "ok");
  return true;
}

async function testForgot(label, email, expectEmailed) {
  const { res, body } = await req("/api/auth/forgot-password", {
    method: "POST",
    json: { email },
  });
  if (!res.ok || !body?.ok) {
    fail(`${label} forgot password`, body?.error || `HTTP ${res.status}`);
    return false;
  }
  if (expectEmailed && !body.emailed) {
    fail(`${label} forgot password send`, body.message || "emailed=false");
    return false;
  }
  if (!expectEmailed && body.emailed) {
    fail(`${label} forgot password (unknown email)`, "should not email");
    return false;
  }
  pass(`${label} forgot password`, body.emailed ? "emailed" : "generic response");
  return true;
}

async function testResetRoundTrip(label, email, newPassword) {
  if (!blobOptions()) {
    fail(`${label} reset inject`, "blob not configured — skip");
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const token = await injectResetToken(normalized);
  const key = createHash("sha256").update(token).digest("hex");
  const visible = await waitForResetToken(normalized, key);
  if (!visible) {
    fail(`${label} reset inject`, "token not visible in blob before reset");
    return false;
  }

  const { res, body } = await req("/api/auth/reset-password", {
    method: "POST",
    json: { token, password: newPassword },
  });
  if (!res.ok || !body?.ok) {
    fail(`${label} reset password`, body?.error || `HTTP ${res.status}`);
    return false;
  }
  pass(`${label} reset password`, body.email || email);

  const ok = await testLogin(`${label} after reset`, email, newPassword, "/");
  if (ok) {
    // restore original password for repeat runs
    const { setAccountPassword } = await import("./set-account-password.mjs");
    const restore = label.includes("Coach") ? COACH_PASSWORD : MEMBER_PASSWORD;
    await setAccountPassword(email, restore);
    pass(`${label} restore password`, restore);
  }
  return ok;
}

async function testSignupAndLogin() {
  const marker = Date.now();
  const email = `qa-auth-${marker}@example.com`;
  const password = "QaSignupPass123!";

  const { res, body } = await req("/api/signup/register", {
    method: "POST",
    json: {
      email,
      firstName: "QA",
      lastName: "Signup",
      plan: "explorer",
      password,
    },
  });

  if (!res.ok || !body?.ok) {
    fail("New signup", body?.error || `HTTP ${res.status}`);
    return;
  }
  pass("New signup", body.redirectTo || "ok");

  cookies = "";
  let loginOk = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await new Promise((r) => setTimeout(r, 400 * attempt));
    const login = await req("/api/auth/login", {
      method: "POST",
      json: { email, password },
    });
    if (login.res.ok && login.body?.ok) {
      pass("New member login after signup", login.body.redirect || "ok");
      loginOk = true;
      break;
    }
    if (attempt === 4) {
      fail("New member login after signup", login.body?.error || `HTTP ${login.res.status}`);
    }
  }
  if (!loginOk) return;

  await testForgot("New member", email, true);
}

async function testQuickAuthStatus(email) {
  const { res, body } = await req("/api/auth/quick-auth/status", {
    method: "POST",
    json: { email, deviceId: "qa-auth-flow-device" },
  });
  if (!res.ok) {
    fail("Quick-auth status", `HTTP ${res.status}`);
    return;
  }
  pass("Quick-auth status", `enabled=${Boolean(body?.enabled)} pin=${Boolean(body?.pin)}`);
}

async function testPages() {
  for (const path of ["/login", "/forgot-password", "/reset-password?token=bad"]) {
    const res = await fetch(`${BASE}${path}`);
    if (res.ok) pass(`Page loads ${path}`, `HTTP ${res.status}`);
    else fail(`Page loads ${path}`, `HTTP ${res.status}`);
  }
}

async function main() {
  console.log(`\nAuth flow test — ${BASE}\n`);

  await testPages();

  await testForgot("Unknown email", "not-a-real-user@example.com", false);

  const coachOk = await testLogin("Coach", COACH_EMAIL, COACH_PASSWORD, "/admin");
  const memberOk = await testLogin("Member test", MEMBER_EMAIL, MEMBER_PASSWORD, "/member/today");

  await testResetRoundTrip("Coach reset", COACH_EMAIL, RESET_PASSWORD);
  await testResetRoundTrip("Member reset", MEMBER_EMAIL, RESET_PASSWORD);

  await testForgot("Coach", COACH_EMAIL, true);
  await testForgot("Member test", MEMBER_EMAIL, true);

  if (memberOk) {
    cookies = "";
    await req("/api/auth/login", {
      method: "POST",
      json: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
    });
    const { res, body } = await req("/api/member/membership");
    if (res.ok && body?.hasSavedPaymentMethod) {
      pass("Member saved payment on file", `customer=${body.stripeCustomerId || "linked"}`);
    } else {
      fail(
        "Member saved payment on file",
        body?.hasSavedPaymentMethod === false
          ? "no saved card — use coachjohnepop@yahoo.com not +test alias"
          : body?.error || `HTTP ${res.status}`,
      );
    }
    const checkout = await req("/api/stripe/checkout", {
      method: "POST",
      json: { plan: "member" },
    });
    if (checkout.res.ok && checkout.body?.hasSavedCard) {
      pass("Checkout offers saved card", "hasSavedCard=true");
    } else if (checkout.body?.planChanged || checkout.body?.redirectTo) {
      pass("Checkout skipped (already paid)", checkout.body.redirectTo || "plan ok");
    } else {
      fail("Checkout saved card", checkout.body?.error || "hasSavedCard=false");
    }
  }

  if (!coachOk) {
    console.log(`\n⚠ Coach login failed — run: npm run set-account-password -- ${COACH_EMAIL} '${COACH_PASSWORD}'`);
  }
  if (!memberOk) {
    console.log(`\n⚠ Member login failed — run: npm run set-account-password -- ${MEMBER_EMAIL} '${MEMBER_PASSWORD}'`);
  }

  await testQuickAuthStatus(MEMBER_EMAIL);

  await testSignupAndLogin();

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