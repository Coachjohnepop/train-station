#!/usr/bin/env node
/**
 * Sprint 1 — exercise delete/rename persistence smoke test.
 *
 * Usage:
 *   node scripts/s1-exercise-persistence-test.mjs
 *   BASE_URL=https://train-station-….vercel.app node scripts/s1-exercise-persistence-test.mjs
 *   BASE_URL=http://localhost:3000 node scripts/s1-exercise-persistence-test.mjs
 */

const BASE =
  process.env.BASE_URL ||
  "https://train-station-hdk40cvr9-johnepop-s-projects.vercel.app";

const BENCH_NAME = "Bench Press";
const BENCH_ID = "cmpyqegat0004r7rz0klfamt0";
const RENAME_MARKER = `S1-RENAME-${Date.now()}`;

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
  return exercises.find(
    (e) => e.name === BENCH_NAME || e.id === BENCH_ID,
  );
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

async function main() {
  console.log(`\nS1 exercise persistence test\nBASE: ${BASE}\n`);

  // 1. Persistence status banner API
  {
    const { res, body } = await req("/api/admin/demo-persistence");
    if (!res.ok) {
      fail("Demo persistence endpoint", `${res.status}`);
    } else if (body?.demoMode !== undefined && body?.message) {
      pass(
        "Demo persistence endpoint",
        body.durable
          ? "durable saves configured"
          : `ephemeral — ${body.message.slice(0, 72)}…`,
      );
    } else {
      fail("Demo persistence endpoint", "unexpected payload");
    }
  }

  // 2. Baseline: bench exists + usage refs
  let exercises = await fetchExercises();
  let bench = findExactBench(exercises);
  let workoutIds = [];

  if (bench) {
    pass("Bench Press in library (baseline)", bench.id);
    const { res, body } = await req(bust("/api/exercises/usage"));
    if (!res.ok) {
      fail("Exercise usage API", `${res.status}`);
    } else {
      const usage = body[bench.id];
      workoutIds = usage
        ? [...new Set(usage.programs?.flatMap((p) => p.references?.map((r) => r.workoutId) || []) || [])]
        : [];
      if (workoutIds.length > 0) {
        pass("Bench used in workouts (baseline)", `${workoutIds.length} workout(s)`);
      } else {
        pass("Bench usage lookup", "no program refs (may still be in workouts)");
      }
    }
  } else {
    pass("Bench Press already absent", "skipping delete — testing rename only");
  }

  // 3. Delete bench press
  if (bench) {
    const { res, body } = await req(`/api/exercises/${bench.id}`, { method: "DELETE" });
    if (res.status === 204) {
      const warn = res.headers.get("X-Persistence-Warning");
      pass("DELETE Bench Press", warn ? `204 (${warn})` : "204");
    } else {
      fail("DELETE Bench Press", `${res.status} ${JSON.stringify(body)}`);
    }

    exercises = await fetchExercises();
    if (!findExactBench(exercises)) {
      pass("Bench gone after delete (fetch 1)");
    } else {
      fail("Bench gone after delete (fetch 1)", "still in list");
    }

    await new Promise((r) => setTimeout(r, 500));
    exercises = await fetchExercises();
    if (!findExactBench(exercises)) {
      pass("Bench gone after delete (fetch 2 / refresh simulation)");
    } else {
      fail("Bench gone after delete (fetch 2)", "still in list");
    }

    const idsToCheck =
      workoutIds.length > 0
        ? workoutIds
        : ["cmpyurx0n0010tfrzpsv6ksu4", "cmpyrgf3t0001tnrze7tvnioa"];

    let refsCleared = 0;
    for (const wid of idsToCheck) {
      const { res, body } = await req(bust(`/api/workouts/${wid}`));
      if (!res.ok) continue;
      if (!workoutHasExercise(body, bench.id, BENCH_NAME)) {
        refsCleared += 1;
      } else {
        fail(`Workout ${wid} cleared bench ref`, "bench still present");
      }
    }
    if (refsCleared > 0) {
      pass("Workout views cleared bench references", `${refsCleared} workout(s)`);
    }
  }

  // 4. Rename propagation
  exercises = await fetchExercises();
  const renameTarget =
    exercises.find((e) => /squat/i.test(e.name)) ||
    exercises.find((e) => e.name && e.name !== BENCH_NAME);

  if (!renameTarget) {
    fail("Rename propagation", "no suitable exercise found");
  } else {
    const originalName = renameTarget.name;
    const renamed = `${originalName} ${RENAME_MARKER}`;

    const patch = await req(`/api/exercises/${renameTarget.id}`, {
      method: "PATCH",
      json: { name: renamed },
    });
    if (!patch.res.ok) {
      fail("PATCH exercise rename", `${patch.res.status} ${JSON.stringify(patch.body)}`);
    } else if (patch.body?.name === renamed) {
      pass("PATCH exercise rename", renameTarget.id);
    } else {
      fail("PATCH exercise rename", "response name mismatch");
    }

    const { res: usageRes, body: usageBody } = await req(bust("/api/exercises/usage"));
    if (usageRes.ok && usageBody[renameTarget.id]) {
      pass("Usage API sees renamed exercise", renameTarget.id);
    }

    const usage = usageRes.ok ? usageBody[renameTarget.id] : null;
    const renameWorkoutIds = usage
      ? [...new Set(usage.programs?.flatMap((p) => p.references?.map((r) => r.workoutId) || []) || [])]
      : [];

    let renameHits = 0;
    for (const wid of renameWorkoutIds.slice(0, 3)) {
      const { res, body } = await req(bust(`/api/workouts/${wid}`));
      if (!res.ok) continue;
      const items = body.exercises || [];
      const hit = items.find((item) => item.exercise?.id === renameTarget.id);
      if (hit?.exercise?.name === renamed) {
        renameHits += 1;
        pass(`Workout ${wid} shows renamed exercise`, renamed.slice(0, 48));
      } else if (hit) {
        fail(`Workout ${wid} rename propagation`, `got "${hit.exercise?.name}"`);
      }
    }
    if (renameWorkoutIds.length === 0) {
      pass("Rename propagation check", "exercise not in scheduled workouts (name patch OK)");
    } else if (renameHits === 0 && renameWorkoutIds.length > 0) {
      fail("Rename in workout views", "no workouts reflected new name");
    }

    const restore = await req(`/api/exercises/${renameTarget.id}`, {
      method: "PATCH",
      json: { name: originalName },
    });
    if (restore.res.ok && restore.body?.name === originalName) {
      pass("Restored renamed exercise", originalName);
    } else {
      fail("Restored renamed exercise", `${restore.res.status}`);
    }
  }

  // 5. Temp exercise create → delete (isolated round-trip)
  const tempName = `S1-TEMP-${Date.now()}`;
  const create = await req("/api/exercises", {
    method: "POST",
    json: { name: tempName, tags: "QA" },
  });
  if (!create.res.ok) {
    fail("POST temp exercise", `${create.res.status}`);
  } else {
    const tempId = create.body.id;
    pass("POST temp exercise", tempId);

    const del = await req(`/api/exercises/${tempId}`, { method: "DELETE" });
    if (del.res.status !== 204) {
      fail("DELETE temp exercise", `${del.res.status}`);
    } else {
      pass("DELETE temp exercise", "204");
    }

    exercises = await fetchExercises();
    if (!exercises.some((e) => e.id === tempId)) {
      pass("Temp exercise gone after delete");
    } else {
      fail("Temp exercise gone after delete", "still listed");
    }
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