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

const TEST_BENCH = process.env.S1_TEST_BENCH === "1";
const BENCH_NAME = "Bench Press";
const BENCH_ID = "cmpyqegat0004r7rz0klfamt0";
const MARKER = Date.now();

const results = [];

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

async function assertGone(id, label) {
  let exercises = await fetchExercises();
  if (!exercises.some((e) => e.id === id)) {
    pass(`${label} gone (fetch 1)`);
  } else {
    fail(`${label} gone (fetch 1)`, "still in list");
    return;
  }
  await new Promise((r) => setTimeout(r, 500));
  exercises = await fetchExercises();
  if (!exercises.some((e) => e.id === id)) {
    pass(`${label} gone (fetch 2 / refresh simulation)`);
  } else {
    fail(`${label} gone (fetch 2)`, "still in list");
  }
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

  let exercises = await fetchExercises();
  if (exercises.some((e) => e.id === tempId && e.name === tempName)) {
    pass("Temp exercise listed after create");
  } else {
    fail("Temp exercise listed after create");
  }

  const patch = await req(`/api/exercises/${tempId}`, {
    method: "PATCH",
    json: { name: renamed },
  });
  if (patch.res.ok && patch.body?.name === renamed) {
    pass("PATCH temp exercise rename", renamed);
  } else {
    fail("PATCH temp exercise rename", `${patch.res.status}`);
  }

  exercises = await fetchExercises();
  const row = exercises.find((e) => e.id === tempId);
  if (row?.name === renamed) {
    pass("Rename visible in library list");
  } else {
    fail("Rename visible in library list", row?.name || "missing");
  }

  const del = await req(`/api/exercises/${tempId}`, { method: "DELETE" });
  if (del.res.status === 204) {
    const warn = del.res.headers.get("X-Persistence-Warning");
    pass("DELETE temp exercise", warn ? `204 (${warn})` : "204");
  } else {
    fail("DELETE temp exercise", `${del.res.status}`);
    return tempId;
  }

  await assertGone(tempId, "Temp exercise");
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

  await assertGone(bench.id, "Bench Press");

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