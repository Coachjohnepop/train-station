#!/usr/bin/env node
/**
 * Quick-auth PIN login loop smoke test.
 *
 *   BASE_URL=https://www.thetrainstation.co \
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *   node scripts/quick-auth-login-smoke.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const PASSWORD = process.env.COACH_PASSWORD || process.env.COACH_TEST_PASSWORD || "";
const TEST_PIN = process.env.QUICK_AUTH_TEST_PIN || "2468";
const NEW_PIN = process.env.QUICK_AUTH_NEW_PIN || "1357";
const ADMIN_REDIRECT = "/admin/day";

let cookies = "";

function parseCookies(setCookieList) {
  const jar = Object.fromEntries(
    (cookies ? cookies.split("; ").map((p) => p.split("=")) : []).filter(([k]) => k),
  );
  for (const raw of setCookieList) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    jar[part.slice(0, eq)] = part.slice(eq + 1);
  }
  cookies = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
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
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) parseCookies(setCookie);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 300);
  }
  return { res, body };
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`Quick-auth PIN smoke @ ${BASE}\n`);

  if (!PASSWORD) {
    fail("Set COACH_PASSWORD (or COACH_TEST_PASSWORD) for the test account.");
  }

  const device = await req("/api/auth/quick-auth/device", { method: "GET" });
  const deviceId = device.body?.deviceId;
  if (!device.res.ok || !deviceId) {
    fail(`device bootstrap failed: ${device.res.status} ${JSON.stringify(device.body)}`);
  }
  console.log(`✓ device id ${deviceId.slice(0, 8)}…`);

  const login = await req("/api/auth/login", {
    method: "POST",
    json: { email: EMAIL, password: PASSWORD, redirect: ADMIN_REDIRECT },
  });
  if (!login.res.ok) {
    fail(`password login failed: ${login.res.status} ${JSON.stringify(login.body)}`);
  }
  console.log("✓ password login");

  const setup = await req("/api/auth/quick-auth/setup-pin", {
    method: "POST",
    json: { pin: TEST_PIN, deviceId },
  });
  if (!setup.res.ok) {
    fail(`setup-pin failed: ${setup.res.status} ${JSON.stringify(setup.body)}`);
  }
  console.log("✓ PIN saved on device");

  const statusAuthed = await req("/api/auth/quick-auth/status", {
    method: "POST",
    json: { email: EMAIL, deviceId },
  });
  if (!statusAuthed.body?.pin || !statusAuthed.body?.enabled) {
    fail(`status after setup expected pin+enabled: ${JSON.stringify(statusAuthed.body)}`);
  }
  console.log("✓ status reports PIN enabled");

  await req("/api/auth/logout", { method: "GET" });
  console.log("✓ logged out");

  const statusLoggedOut = await req("/api/auth/quick-auth/status", {
    method: "POST",
    json: { email: EMAIL, deviceId },
  });
  if (!statusLoggedOut.body?.pin || !statusLoggedOut.body?.enabled) {
    fail(`status when logged out should still show PIN: ${JSON.stringify(statusLoggedOut.body)}`);
  }
  console.log("✓ status still shows PIN before login (login page should offer PIN pad)");

  const pinLogin = await req("/api/auth/quick-auth/pin-login", {
    method: "POST",
    json: { email: EMAIL, pin: TEST_PIN, deviceId, redirect: ADMIN_REDIRECT },
  });
  if (!pinLogin.res.ok) {
    fail(`pin-login failed: ${pinLogin.res.status} ${JSON.stringify(pinLogin.body)}`);
  }
  const dest = pinLogin.body?.redirect || "";
  if (!dest.includes("/admin")) {
    fail(`pin-login redirect expected admin path, got: ${dest}`);
  }
  console.log(`✓ PIN login → ${dest}`);

  const changePin = await req("/api/auth/quick-auth/setup-pin", {
    method: "POST",
    json: { pin: NEW_PIN, deviceId },
  });
  if (!changePin.res.ok) {
    fail(`change-pin (setup-pin) failed: ${changePin.res.status} ${JSON.stringify(changePin.body)}`);
  }
  console.log("✓ PIN changed via setup-pin");

  await req("/api/auth/logout", { method: "GET" });

  const oldPinLogin = await req("/api/auth/quick-auth/pin-login", {
    method: "POST",
    json: { email: EMAIL, pin: TEST_PIN, deviceId, redirect: ADMIN_REDIRECT },
  });
  if (oldPinLogin.res.ok) {
    fail("old PIN should fail after change");
  }
  console.log("✓ old PIN rejected after change");

  const newPinLogin = await req("/api/auth/quick-auth/pin-login", {
    method: "POST",
    json: { email: EMAIL, pin: NEW_PIN, deviceId, redirect: ADMIN_REDIRECT },
  });
  if (!newPinLogin.res.ok) {
    fail(`new PIN login failed: ${newPinLogin.res.status} ${JSON.stringify(newPinLogin.body)}`);
  }
  console.log("✓ new PIN login works after change");

  const loginHtml = await req(`/login?redirect=${encodeURIComponent(ADMIN_REDIRECT)}`);
  if (!loginHtml.res.ok) {
    fail(`login page failed: ${loginHtml.res.status}`);
  }
  const html = typeof loginHtml.body === "string" ? loginHtml.body : "";
  if (html.includes("coachLogin") || html.includes("showPasswordForm(true)")) {
    console.log("⚠ login page HTML may still force password for admin (check client bundle)");
  }
  console.log("✓ login page loads for admin redirect");

  console.log("\nAll quick-auth PIN checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});