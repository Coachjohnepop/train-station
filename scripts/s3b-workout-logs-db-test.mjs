#!/usr/bin/env node
/**
 * Slice 3b — workout logs + member progress on Postgres.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:s3b
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

function firstWorkoutIdFromProgram(program) {
  for (const week of program.weeks || []) {
    for (const day of week.days || []) {
      if (day.workoutId) return day.workoutId;
      const opt = (day.options || []).find((o) => o.workoutId);
      if (opt?.workoutId) return opt.workoutId;
    }
  }
  return null;
}

async function main() {
  console.log(`\nS3b workout logs DB test\nBASE: ${BASE}\nUSER: ${MEMBER_USER_ID}\n`);

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
  pass("Database mode", "workout logs path is Postgres");

  const summary0 = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/log-summary`,
  );
  if (!summary0.res.ok || typeof summary0.body?.workoutLogs !== "number") {
    fail("Read log summary", `${summary0.res.status} ${JSON.stringify(summary0.body)}`);
    process.exit(1);
  }
  const baseline = summary0.body.workoutLogs;
  pass(
    "Read log summary",
    `${baseline} logs · ${summary0.body.performances} perfs · strength ${summary0.body.strengthScore}`,
  );

  const programs = await req("/api/programs");
  if (!programs.res.ok || !Array.isArray(programs.body)) {
    fail("Programs API", `${programs.res.status}`);
    process.exit(1);
  }
  const adult = programs.body.find((p) => p.slug === PROGRAM_SLUG);
  if (!adult) {
    fail("Program in catalog", PROGRAM_SLUG);
    process.exit(1);
  }
  const workoutId = process.env.WORKOUT_ID || firstWorkoutIdFromProgram(adult);
  if (!workoutId) {
    fail("Resolve workout id", "no workout on program schedule");
    process.exit(1);
  }
  pass("Resolve workout", workoutId);

  const workout = await req(`/api/workouts/${encodeURIComponent(workoutId)}`);
  if (!workout.res.ok || !workout.body?.exercises?.length) {
    fail("Load workout exercises", `${workout.res.status}`);
    process.exit(1);
  }
  const exercises = workout.body.exercises.slice(0, 2).map((ex) => ({
    workoutExerciseId: ex.id,
    exerciseId: ex.exerciseId || ex.exercise?.id,
    setScheme: ex.setScheme || "standard",
    weightTier: ex.weightTier || "medium",
    startingWeightLbs: 95,
    repsCompleted: 30,
    setsCompleted: 3,
  }));
  if (!exercises.every((e) => e.exerciseId)) {
    fail("Exercise ids on workout");
    process.exit(1);
  }

  const logRes = await req(`/api/workouts/${encodeURIComponent(workoutId)}/log`, {
    method: "POST",
    json: {
      targetUserId: MEMBER_USER_ID,
      programSlug: PROGRAM_SLUG,
      progress: 100,
      exercises,
    },
  });
  if (!logRes.res.ok || !logRes.body?.ok) {
    fail("POST workout log", `${logRes.res.status} ${JSON.stringify(logRes.body)}`);
    process.exit(1);
  }
  pass("POST workout log", `log ${logRes.body.logId}`);

  const summary1 = await req(
    `/api/admin/users/${encodeURIComponent(MEMBER_USER_ID)}/log-summary`,
  );
  if (!summary1.res.ok) {
    fail("Verify log summary", `${summary1.res.status}`);
    process.exit(1);
  }
  if (summary1.body.workoutLogs < baseline + 1) {
    fail(
      "Verify persisted log count",
      `expected >= ${baseline + 1}, got ${summary1.body.workoutLogs}`,
    );
    process.exit(1);
  }
  if (!summary1.body.loggedWorkoutIds?.includes(workoutId)) {
    fail("Verify logged workout id in set", workoutId);
    process.exit(1);
  }
  pass(
    "Verify persisted logs",
    `${summary1.body.workoutLogs} logs · includes ${workoutId}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
  console.log("\nS3b acceptance: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});