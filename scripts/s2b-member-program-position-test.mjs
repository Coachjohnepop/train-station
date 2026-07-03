#!/usr/bin/env node
/**
 * Slice 2b — coach set member program week/day (API level).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:s2b
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;
const MEMBER_USER_ID = process.env.MEMBER_USER_ID || "demo-user-john-steph";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";

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
  const loginBody = await loginRes.json().catch(() => ({}));
  const setCookie = parseSetCookie(loginRes.headers);
  if (loginRes.ok && setCookie.includes("ts_session")) {
    cookies = setCookie;
    return { ok: true, detail: password ? "password" : "no password" };
  }
  return { ok: false, detail: loginBody.error || `status ${loginRes.status}` };
}

async function loginCoach() {
  const attempts =
    COACH_PASSWORD_ENV !== null ? [COACH_PASSWORD_ENV] : ["CoachTest123!", ""];
  for (const password of attempts) {
    const result = await tryLogin(password);
    if (result.ok) {
      pass("Coach login", `${COACH_EMAIL} (${result.detail})`);
      return true;
    }
  }
  fail("Coach login", "set COACH_PASSWORD for prod");
  return false;
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    "Cache-Control": "no-cache",
    ...(opts.headers || {}),
  };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function linearDay(week, day) {
  return (week - 1) * 7 + day;
}

async function main() {
  console.log(`\nS2b member program position test\nBASE: ${BASE}\nUSER: ${MEMBER_USER_ID}\n`);

  if (!(await loginCoach())) process.exit(1);

  const get0 = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position`,
  );
  if (!get0.res.ok) {
    fail("GET positions", `${get0.res.status} ${get0.text}`);
    process.exit(1);
  }
  const before =
    get0.body.positions?.find((p) => p.programSlug === PROGRAM_SLUG) ??
    get0.body.positions?.[0] ??
    null;
  if (before) {
    pass(
      "GET positions",
      `W${before.currentWeek}D${before.currentDay} Day ${before.enrollmentDayNumber}`,
    );
  } else {
    pass("GET positions", "none yet — PATCH will enroll");
  }

  const targetWeek = 1;
  const targetDay = 2;
  const patch = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position`,
    {
      method: "PATCH",
      json: {
        programSlug: PROGRAM_SLUG,
        currentWeek: targetWeek,
        currentDay: targetDay,
      },
    },
  );
  if (!patch.res.ok) {
    fail("PATCH position", `${patch.res.status} ${patch.text}`);
    process.exit(1);
  }
  if (
    patch.body.currentWeek !== targetWeek ||
    patch.body.currentDay !== targetDay
  ) {
    fail("PATCH returned week/day", JSON.stringify(patch.body));
    process.exit(1);
  }
  const expectedDayN = linearDay(targetWeek, targetDay);
  if (patch.body.enrollmentDayNumber !== expectedDayN) {
    fail("PATCH enrollmentDayNumber", `expected ${expectedDayN}`);
    process.exit(1);
  }
  pass("PATCH position", `W${targetWeek}D${targetDay} = Day ${expectedDayN}`);

  const get1 = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position?programSlug=${PROGRAM_SLUG}`,
  );
  if (!get1.res.ok) {
    fail("GET after patch", `${get1.res.status}`);
    process.exit(1);
  }
  if (get1.body.currentWeek !== targetWeek || get1.body.currentDay !== targetDay) {
    fail("Position persisted", JSON.stringify(get1.body));
    process.exit(1);
  }
  pass("Position persisted after GET");

  if (!before) {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
    console.log("\nS2b acceptance: PASS\n");
    return;
  }

  const restoreWeek = before.currentWeek;
  const restoreDay = before.currentDay;
  const restore = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position`,
    {
      method: "PATCH",
      json: {
        programSlug: PROGRAM_SLUG,
        currentWeek: restoreWeek,
        currentDay: restoreDay,
      },
    },
  );
  if (!restore.res.ok) {
    fail("Restore original position", restore.text);
  } else {
    pass("Restore original position", `W${restoreWeek}D${restoreDay}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS2b acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});