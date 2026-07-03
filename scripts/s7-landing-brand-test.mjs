#!/usr/bin/env node
/**
 * Sprint 7 — landing brand + admin phone save.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:s7
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;
const KATIE_EMAIL = process.env.KATIE_EMAIL || "kaite@thetrainstation.co";

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

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function tryLogin(password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: COACH_EMAIL,
      password,
      redirect: "/admin/users",
    }),
    redirect: "manual",
  });
  const setCookie = parseSetCookie(loginRes.headers);
  if (loginRes.ok && setCookie.includes("ts_session")) {
    cookies = setCookie;
    return true;
  }
  return false;
}

async function loginCoach() {
  const attempts =
    COACH_PASSWORD_ENV !== null ? [COACH_PASSWORD_ENV] : ["CoachTest123!", ""];
  for (const password of attempts) {
    if (await tryLogin(password)) {
      pass("Coach login", COACH_EMAIL);
      return true;
    }
  }
  fail("Coach login", "set COACH_PASSWORD for prod");
  return false;
}

async function main() {
  console.log(`\nS7 landing brand + admin users test\nBASE: ${BASE}\n`);

  const home = await fetch(`${BASE}/`, { cache: "no-store" });
  const html = await home.text();
  if (!home.ok) {
    fail("Landing page", `${home.status}`);
    process.exit(1);
  }
  if (!html.includes("The Train Station") && !html.includes("Train Station")) {
    fail("Landing wordmark", "expected brand name in HTML");
    process.exit(1);
  }
  if (!html.includes("logo") && !html.includes("logo-icon")) {
    fail("Landing logo asset", "expected logo image reference");
    process.exit(1);
  }
  pass("Landing brand", "wordmark + logo present");

  if (!(await loginCoach())) process.exit(1);

  const usersRes = await fetch(`${BASE}/api/users`, {
    headers: { Cookie: cookies, "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  const users = await usersRes.json();
  if (!usersRes.ok || !Array.isArray(users)) {
    fail("List users", `${usersRes.status}`);
    process.exit(1);
  }

  const katie = users.find(
    (u) => String(u.email || "").toLowerCase() === KATIE_EMAIL.toLowerCase(),
  );
  if (!katie) {
    fail("Find Katie test account", KATIE_EMAIL);
    process.exit(1);
  }
  if (katie.source !== "seed") {
    fail("Katie labeled test account", `source=${katie.source}`);
    process.exit(1);
  }
  pass("Katie test account", `${katie.name} · ${katie.email}`);

  const testPhone = `(555) ${String(Date.now()).slice(-7, -4)}-${String(Date.now()).slice(-4)}`;
  const patch = await fetch(`${BASE}/api/users/${encodeURIComponent(katie.id)}`, {
    method: "PATCH",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({ phone: testPhone }),
  });
  const patchBody = await patch.json().catch(() => ({}));
  if (!patch.ok) {
    fail("Save Katie phone", `${patch.status} ${JSON.stringify(patchBody)}`);
    process.exit(1);
  }
  pass("Save Katie phone", testPhone);

  const users2Res = await fetch(`${BASE}/api/users?q=kaite`, {
    headers: { Cookie: cookies, "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  const users2 = await users2Res.json();
  const katie2 = Array.isArray(users2)
    ? users2.find((u) => u.id === katie.id)
    : null;
  if (!katie2 || katie2.phone !== testPhone) {
    fail("Verify phone persisted", JSON.stringify(katie2?.phone));
    process.exit(1);
  }
  pass("Verify phone persisted", katie2.phone);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS7 acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});