#!/usr/bin/env node
/**
 * Slice 2d — nightly mart rollup cron.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:s2d
 *   BASE_URL=https://www.thetrainstation.co MART_ROLLUP_CRON_SECRET=… npm run test:s2d
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;
const CRON_SECRET =
  process.env.MART_ROLLUP_CRON_SECRET ?? process.env.CRON_SECRET ?? null;

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
  console.log(`\nS2d mart rollup test\nBASE: ${BASE}\n`);

  const dryRes = await fetch(`${BASE}/api/cron/mart-rollup?dryRun=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (dryRes.status === 401) {
    if (!(await loginCoach())) process.exit(1);
    const staffRes = await fetch(`${BASE}/api/cron/mart-rollup?dryRun=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: "{}",
      cache: "no-store",
    });
    const staffBody = await staffRes.json();
    if (!staffRes.ok) {
      fail("Staff dry-run rollup", `${staffRes.status} ${JSON.stringify(staffBody)}`);
      process.exit(1);
    }
    if (staffBody.metricDate === undefined) {
      fail("Rollup response shape", "missing metricDate");
      process.exit(1);
    }
    pass(
      "Staff dry-run rollup",
      staffBody.skipped
        ? `skipped (${staffBody.reason ?? "demo"})`
        : `${staffBody.memberSnapshots} snapshots`,
    );
  } else {
    const dryBody = await dryRes.json();
    if (!dryRes.ok) {
      fail("Cron dry-run rollup", `${dryRes.status} ${JSON.stringify(dryBody)}`);
      process.exit(1);
    }
    pass("Cron endpoint reachable without auth", "dev mode");
  }

  if (CRON_SECRET) {
    const cronRes = await fetch(`${BASE}/api/cron/mart-rollup?dryRun=true`, {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      cache: "no-store",
    });
    const cronBody = await cronRes.json();
    if (!cronRes.ok) {
      fail("Cron secret auth", `${cronRes.status}`);
      process.exit(1);
    }
    pass("Cron secret auth", cronBody.skipped ? "skipped (demo)" : cronBody.metricDate);
  } else {
    pass("Cron secret auth", "skipped — no MART_ROLLUP_CRON_SECRET set");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS2d acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});