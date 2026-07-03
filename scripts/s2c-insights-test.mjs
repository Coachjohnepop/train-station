#!/usr/bin/env node
/**
 * Slice 2c — admin insights / analytics overview API.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:s2c
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;

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
      redirect: "/admin/insights",
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
  console.log(`\nS2c insights test\nBASE: ${BASE}\n`);

  if (!(await loginCoach())) process.exit(1);

  const overview = await fetch(`${BASE}/api/admin/analytics/overview?days=7`, {
    headers: { Cookie: cookies },
    cache: "no-store",
  });
  const body = await overview.json();
  if (!overview.ok) {
    fail("Analytics overview API", `${overview.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }

  const required = [
    "storage",
    "pageViews",
    "pageClicks",
    "uniqueSessions",
    "topPages",
    "topClicks",
    "payments",
  ];
  for (const key of required) {
    if (body[key] === undefined) {
      fail("Overview shape", `missing ${key}`);
      process.exit(1);
    }
  }
  pass("Overview API shape", `${body.storage} storage`);

  if (!Array.isArray(body.topPages) || !Array.isArray(body.topClicks)) {
    fail("Top lists are arrays");
    process.exit(1);
  }
  pass(
    "Metrics",
    `${body.pageViews} views · ${body.pageClicks} clicks · ${body.uniqueSessions} sessions`,
  );

  const page = await fetch(`${BASE}/admin/insights`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  if (page.status !== 200 && page.status !== 307 && page.status !== 308) {
    fail("Insights page", `status ${page.status}`);
  } else {
    pass("Insights page reachable", `status ${page.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS2c acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});