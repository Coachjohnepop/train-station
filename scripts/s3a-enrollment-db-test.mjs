#!/usr/bin/env node
/**
 * Slice 3a — users + enrollments on Postgres (database mode).
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:s3a
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

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
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
  return { res, body };
}

async function main() {
  console.log(`\nS3a enrollment DB test\nBASE: ${BASE}\nUSER: ${MEMBER_USER_ID}\n`);

  if (!(await loginCoach())) process.exit(1);

  const persistence = await req("/api/admin/demo-persistence");
  if (!persistence.res.ok) {
    fail("Persistence status", `${persistence.res.status}`);
    process.exit(1);
  }
  if (persistence.body.demoMode) {
    fail("Database mode", "still demo/blob — set POSTGRES_PRISMA_URL on prod");
    process.exit(1);
  }
  pass("Database mode", "enrollments path is Postgres");

  const get0 = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position?programSlug=${PROGRAM_SLUG}`,
  );
  if (!get0.res.ok || !get0.body?.currentWeek) {
    fail("Read enrollment position", `${get0.res.status} ${JSON.stringify(get0.body)}`);
    process.exit(1);
  }
  pass(
    "Read enrollment",
    `W${get0.body.currentWeek}D${get0.body.currentDay} · day ${get0.body.enrollmentDayNumber}`,
  );

  const origWeek = get0.body.currentWeek;
  const origDay = get0.body.currentDay;
  const targetWeek = origWeek === 1 ? 2 : 1;
  const targetDay = 3;

  try {
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
    if (!patch.res.ok || !patch.body?.ok) {
      fail("Set enrollment position", `${patch.res.status} ${JSON.stringify(patch.body)}`);
      process.exit(1);
    }
    pass("Set enrollment position", `W${targetWeek}D${targetDay}`);

    const get1 = await req(
      `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position?programSlug=${PROGRAM_SLUG}`,
    );
    if (
      !get1.res.ok ||
      get1.body.currentWeek !== targetWeek ||
      get1.body.currentDay !== targetDay
    ) {
      fail("Verify persisted position", JSON.stringify(get1.body));
      process.exit(1);
    }
    pass("Verify persisted position", `W${get1.body.currentWeek}D${get1.body.currentDay}`);
  } finally {
    await req(
      `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/program-position`,
      {
        method: "PATCH",
        json: {
          programSlug: PROGRAM_SLUG,
          currentWeek: origWeek,
          currentDay: origDay,
        },
      },
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS3a acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});