#!/usr/bin/env node
/**
 * Slice 1b — WorkoutBuilder persistence smoke test.
 *
 * Creates a disposable workout, adds/edits/removes an exercise, renames the workout,
 * and verifies each change survives a fresh GET (simulates refresh).
 *
 * Usage:
 *   node scripts/s1b-workout-persistence-test.mjs
 *   BASE_URL=http://localhost:3000 npm run test:s1b
 */

const BASE =
  process.env.BASE_URL ||
  "https://train-station-hdk40cvr9-johnepop-s-projects.vercel.app";

const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;

const MARKER = Date.now();
const TEMP_WORKOUT = `S1B-Workout-${MARKER}`;
const TEMP_RENAMED = `${TEMP_WORKOUT}-RENAMED`;

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

function bust(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_t=${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      redirect: "/admin/workouts",
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
  fail("Coach login", "set COACH_PASSWORD for prod accounts with a password");
  return false;
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(opts.headers || {}),
  };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function fetchWorkout(workoutId) {
  const { res, body } = await req(bust(`/api/workouts/${workoutId}`));
  if (!res.ok) throw new Error(`GET workout ${res.status}`);
  return body;
}

async function pickLibraryExercise() {
  const { res, body } = await req(bust("/api/exercises"));
  if (!res.ok) throw new Error(`GET exercises ${res.status}`);
  const row = body.find((e) => e.name && !/S1B|S1-TEMP|QA smoke/i.test(e.name));
  if (!row) throw new Error("No library exercise found for add test");
  return row;
}

async function waitFor(predicate, label, maxMs = 35_000) {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < maxMs) {
    attempt += 1;
    if (await predicate()) {
      pass(label, `after ${attempt} check(s), ~${Date.now() - started}ms`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fail(label, `not satisfied after ${maxMs}ms`);
  return false;
}

async function main() {
  console.log(`\nS1b workout persistence test\nBASE: ${BASE}\n`);

  if (!(await loginCoach())) {
    process.exit(1);
  }

  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: TEMP_WORKOUT },
  });
  if (!create.res.ok) {
    fail("POST temp workout", `${create.res.status} ${JSON.stringify(create.body)}`);
    process.exit(1);
  }
  const workoutId = create.body.id;
  pass("POST temp workout", workoutId);

  const libraryEx = await pickLibraryExercise();
  pass("Library exercise for add", libraryEx.name);

  const add = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: libraryEx.id,
      setScheme: "standard",
      reps: "10",
      sets: 3,
      weightTier: "medium",
      notes: `S1B-NOTE-${MARKER}`,
    },
  });
  if (!add.res.ok) {
    fail("POST workout exercise", `${add.res.status} ${JSON.stringify(add.body)}`);
    process.exit(1);
  }
  const itemId = add.body.id;
  pass("POST workout exercise", itemId);

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return w.exercises?.some((row) => row.id === itemId);
  }, "Exercise listed after add");

  const patch = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "PATCH",
    json: { itemId, notes: `S1B-PATCHED-${MARKER}` },
  });
  if (!patch.res.ok || patch.body?.notes !== `S1B-PATCHED-${MARKER}`) {
    fail("PATCH workout exercise", `${patch.res.status}`);
  } else {
    pass("PATCH workout exercise", patch.body.notes);
  }

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    const row = w.exercises?.find((e) => e.id === itemId);
    return row?.notes === `S1B-PATCHED-${MARKER}`;
  }, "Patched notes survive refresh");

  const rename = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: TEMP_RENAMED },
  });
  if (!rename.res.ok || rename.body?.name !== TEMP_RENAMED) {
    fail("PATCH workout name", `${rename.res.status}`);
  } else {
    pass("PATCH workout name", TEMP_RENAMED);
  }

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return w.name === TEMP_RENAMED;
  }, "Renamed workout survives refresh");

  const del = await req(
    `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  if (del.res.status !== 204) {
    fail("DELETE workout exercise", `${del.res.status}`);
  } else {
    pass("DELETE workout exercise", "204");
  }

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return !w.exercises?.some((row) => row.id === itemId);
  }, "Removed exercise stays gone after refresh");

  const list = await req(bust("/api/workouts"));
  if (list.res.ok && list.body?.some((w) => w.id === workoutId && w.name === TEMP_RENAMED)) {
    pass("Workout list shows renamed workout", TEMP_RENAMED);
  } else {
    fail("Workout list shows renamed workout", "missing from /api/workouts");
  }

  const cleanup = await req(`/api/workouts/${workoutId}`, { method: "DELETE" });
  if (cleanup.res.status === 204) {
    pass("Cleanup temp workout", workoutId);
  } else {
    fail("Cleanup temp workout", `${cleanup.res.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nS1b acceptance: PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});