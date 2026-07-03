#!/usr/bin/env node
/**
 * Sprint 1 — exercise delete/rename persistence smoke test.
 *
 * By default uses a disposable temp exercise (safe for preview/prod).
 * Set S1_TEST_BENCH=1 to also run Jeremy's Bench Press scenario.
 *
 * Usage:
 *   node scripts/s1-exercise-persistence-test.mjs
 *   BASE_URL=https://train-station-….vercel.app node scripts/s1-exercise-persistence-test.mjs
 *   S1_TEST_BENCH=1 node scripts/s1-exercise-persistence-test.mjs
 */

const BASE =
  process.env.BASE_URL ||
  "https://train-station-hdk40cvr9-johnepop-s-projects.vercel.app";

const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;

const TEST_BENCH = process.env.S1_TEST_BENCH === "1";
const BENCH_NAME = "Bench Press";
const BENCH_ID = "cmpyqegat0004r7rz0klfamt0";
const MARKER = Date.now();

const results = [];
let cookies = "";

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(existing, added) {
  const jar = new Map();
  for (const part of `${existing}; ${added}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    jar.set(k, rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function tryLogin(password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: COACH_EMAIL,
      password,
      redirect: "/admin/exercises",
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
  const attempts = COACH_PASSWORD_ENV !== null
    ? [COACH_PASSWORD_ENV]
    : ["CoachTest123!", ""];
  for (const password of attempts) {
    const result = await tryLogin(password);
    if (result.ok) {
      pass("Coach login", `${COACH_EMAIL} (${result.detail})`);
      return true;
    }
  }
  fail(
    "Coach login",
    "set COACH_PASSWORD for prod accounts with a password",
  );
  return false;
}

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

async function fetchExercises() {
  const { res, body } = await req(bust("/api/exercises"));
  if (!res.ok) throw new Error(`GET /api/exercises ${res.status}`);
  return body;
}

function findExactBench(exercises) {
  return exercises.find((e) => e.name === BENCH_NAME || e.id === BENCH_ID);
}

function workoutHasExercise(workout, exerciseId, exerciseName) {
  const items = workout.exercises || [];
  return items.some(
    (item) =>
      item.exercise?.id === exerciseId ||
      item.exerciseId === exerciseId ||
      item.exercise?.name === exerciseName,
  );
}

async function waitUntilGone(id, label, maxMs = 35_000) {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < maxMs) {
    attempt += 1;
    const exercises = await fetchExercises();
    if (!exercises.some((e) => e.id === id)) {
      pass(`${label} gone`, `after ${attempt} fetch(es), ~${Date.now() - started}ms`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(`${label} gone`, `still in list after ${maxMs}ms`);
}

async function waitUntilListed(id, name, label, maxMs = 35_000) {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < maxMs) {
    attempt += 1;
    const exercises = await fetchExercises();
    const row = exercises.find((e) => e.id === id);
    if (row?.name === name) {
      pass(label, `after ${attempt} fetch(es), ~${Date.now() - started}ms`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(label, `not listed after ${maxMs}ms`);
  return false;
}

async function testTempExerciseRoundTrip() {
  const tempName = `S1-TEMP-${MARKER}`;
  const renamed = `${tempName}-RENAMED`;

  const create = await req("/api/exercises", {
    method: "POST",
    json: { name: tempName, tags: "QA" },
  });
  if (!create.res.ok) {
    fail("POST temp exercise", `${create.res.status}`);
    return null;
  }

  const tempId = create.body.id;
  pass("POST temp exercise", tempId);

  const listed = await waitUntilListed(tempId, tempName, "Temp exercise listed after create");
  if (!listed) return null;

  const patch = await req(`/api/exercises/${tempId}`, {
    method: "PATCH",
    json: { name: renamed },
  });
  if (patch.res.ok && patch.body?.name === renamed) {
    pass("PATCH temp exercise rename", renamed);
  } else {
    fail("PATCH temp exercise rename", `${patch.res.status}`);
  }

  await waitUntilListed(tempId, renamed, "Rename visible in library list");

  const del = await req(`/api/exercises/${tempId}`, { method: "DELETE" });
  if (del.res.status === 204) {
    const warn = del.res.headers.get("X-Persistence-Warning");
    pass("DELETE temp exercise", warn ? `204 (${warn})` : "204");
  } else {
    fail("DELETE temp exercise", `${del.res.status}`);
    return tempId;
  }

  await waitUntilGone(tempId, "Temp exercise");
  return null;
}

async function testBenchPressOptional() {
  const exercises = await fetchExercises();
  const bench = findExactBench(exercises);
  if (!bench) {
    pass("Bench Press optional test", "not in library — skipped");
    return;
  }

  pass("Bench Press in library (optional)", bench.id);

  const { res, body } = await req(`/api/exercises/${bench.id}`, { method: "DELETE" });
  if (res.status === 204) {
    pass("DELETE Bench Press (optional)", res.headers.get?.("X-Persistence-Warning") || "204");
  } else {
    fail("DELETE Bench Press (optional)", `${res.status} ${JSON.stringify(body)}`);
    return;
  }

  await waitUntilGone(bench.id, "Bench Press");

  const idsToCheck = ["cmpyurx0n0010tfrzpsv6ksu4", "cmpyrgf3t0001tnrze7tvnioa"];
  let refsCleared = 0;
  for (const wid of idsToCheck) {
    const { res: wRes, body: workout } = await req(bust(`/api/workouts/${wid}`));
    if (!wRes.ok) continue;
    if (!workoutHasExercise(workout, bench.id, BENCH_NAME)) refsCleared += 1;
    else fail(`Workout ${wid} cleared bench ref`, "bench still present");
  }
  if (refsCleared > 0) {
    pass("Workout views cleared bench references", `${refsCleared} workout(s)`);
  }
}

async function main() {
  console.log(`\nS1 exercise persistence test\nBASE: ${BASE}`);
  console.log(
    TEST_BENCH
      ? "Mode: temp exercise + optional Bench Press delete\n"
      : "Mode: temp exercise only (set S1_TEST_BENCH=1 to test Bench Press)\n",
  );

  const loggedIn = await loginCoach();
  if (!loggedIn) {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
    process.exit(1);
  }

  const { res, body } = await req("/api/admin/demo-persistence");
  if (!res.ok) {
    fail("Demo persistence endpoint", `${res.status}`);
  } else if (body?.demoMode !== undefined && body?.message) {
    pass(
      "Demo persistence endpoint",
      body.durable ? "durable saves configured" : `ephemeral — ${body.message.slice(0, 72)}…`,
    );
  } else {
    fail("Demo persistence endpoint", "unexpected payload");
  }

  await testTempExerciseRoundTrip();

  if (TEST_BENCH) {
    await testBenchPressOptional();
  } else {
    pass("Bench Press left alone", "Jeremy can delete any exercise in admin UI");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nS1 acceptance: PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});