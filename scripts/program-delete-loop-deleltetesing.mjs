#!/usr/bin/env node
/**
 * Program builder delete loop — add/remove exercises repeatedly on Postgres prod.
 * Mirrors ProgramCalendarBuilder removeSlot API calls (DELETE + cache-bust GET).
 *
 * All created rows use MARKER "deleltetesing" for cleanup.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/program-delete-loop-deleltetesing.mjs
 *   npm run test:deleltetesing-loop
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const MARKER = process.env.TEST_MARKER || "deleltetesing";
const RUN_ID = Date.now();
const ROUNDS = Number(process.env.DELELTETESING_ROUNDS || "3");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const { req, loginCoach } = createCoachClient(BASE, { coachEmail: COACH_EMAIL });

const results = [];
const manifest = {
  marker: MARKER,
  runId: RUN_ID,
  base: BASE,
  coachEmail: COACH_EMAIL,
  created: { workouts: [], exercises: [] },
};

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

async function fetchWorkout(workoutId) {
  const g = await req(bust(`/api/workouts/${workoutId}`));
  if (!g.res.ok) throw new Error(`GET workout ${g.res.status}: ${g.text?.slice?.(0, 120) || ""}`);
  return g.body;
}

async function addExercise(workoutId, exerciseId, sortOrder) {
  const add = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId,
      setScheme: "standard",
      reps: "10",
      sets: 3,
      weightTier: "medium",
      restSec: 45,
    },
  });
  if (!add.res.ok || !add.body?.id) {
    throw new Error(`POST exercise ${add.res.status}: ${add.text?.slice?.(0, 120) || ""}`);
  }
  if (sortOrder != null) {
    const patch = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "PATCH",
      json: { itemId: add.body.id, sortOrder },
    });
    if (!patch.res.ok) {
      throw new Error(`PATCH sortOrder ${patch.res.status}`);
    }
  }
  return add.body.id;
}

async function deleteExercise(workoutId, itemId) {
  return req(
    `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE", cache: "no-store" },
  );
}

function exerciseNames(workout) {
  return (workout.exercises || []).map((it) => it.exercise?.name || it.exerciseId);
}

async function seedWorkout(picks, round) {
  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: `${MARKER} delete loop round ${round} — ${RUN_ID}` },
  });
  if (!create.res.ok || !create.body?.id) {
    throw new Error(`create workout ${create.res.status}`);
  }
  const workoutId = create.body.id;
  manifest.created.workouts.push({ id: workoutId, name: create.body.name, round });

  const itemIds = [];
  for (let i = 0; i < picks.length; i++) {
    const id = await addExercise(workoutId, picks[i].id, i);
    itemIds.push(id);
  }

  const loaded = await fetchWorkout(workoutId);
  const names = exerciseNames(loaded);
  const expected = picks.map((p) => p.name);
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`seed order mismatch: got [${names.join(", ")}]`);
  }
  return { workoutId, itemIds, picks };
}

async function assertCount(workoutId, expected, label) {
  const w = await fetchWorkout(workoutId);
  const count = w.exercises?.length ?? 0;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} exercises, got ${count}`);
  }
  return w;
}

async function cleanupWorkout(workoutId) {
  const del = await req(`/api/workouts/${workoutId}`, { method: "DELETE" });
  if (!del.res.ok && del.res.status !== 404) {
    console.warn(`warn: workout cleanup ${workoutId} → ${del.res.status}`);
  }
}

async function runDeleteSequence(workoutId, itemIds, picks, deleteOrder, roundLabel) {
  const pickByItemId = new Map(itemIds.map((id, i) => [id, picks[i]]));
  let remainingIds = [...itemIds];

  for (let step = 0; step < deleteOrder.length; step++) {
    const itemId = deleteOrder[step];
    const expectedName = pickByItemId.get(itemId)?.name;
    if (!expectedName) {
      throw new Error(`${roundLabel} step ${step}: unknown itemId ${itemId}`);
    }

    const before = await fetchWorkout(workoutId);
    const target = before.exercises?.find((e) => e.id === itemId);
    if (!target) {
      throw new Error(`${roundLabel} step ${step}: item ${itemId} missing before delete`);
    }
    if (target.exercise?.name !== expectedName) {
      throw new Error(
        `${roundLabel} step ${step}: expected ${expectedName}, got ${target.exercise?.name}`,
      );
    }

    const del = await deleteExercise(workoutId, itemId);
    if (del.res.status !== 204) {
      throw new Error(`${roundLabel} delete ${itemId} → ${del.res.status} ${del.text?.slice?.(0, 80)}`);
    }

    remainingIds = remainingIds.filter((id) => id !== itemId);

    const after = await assertCount(
      workoutId,
      remainingIds.length,
      `${roundLabel} after delete step ${step}`,
    );
    const namesAfter = exerciseNames(after);
    const expectedAfter = remainingIds.map((id) => pickByItemId.get(id).name);
    if (JSON.stringify(namesAfter) !== JSON.stringify(expectedAfter)) {
      throw new Error(
        `${roundLabel} step ${step}: order [${namesAfter.join(", ")}] != [${expectedAfter.join(", ")}]`,
      );
    }

    const ghost = await deleteExercise(workoutId, itemId);
    if (ghost.res.status !== 404) {
      throw new Error(`${roundLabel} double-delete expected 404, got ${ghost.res.status}`);
    }
  }
}

async function testPatchGuards(hostWorkoutId, foreignItemId) {
  const crossWorkout = await req(`/api/workouts/${hostWorkoutId}/exercises`, {
    method: "PATCH",
    json: { itemId: foreignItemId, sets: 5 },
  });
  if (crossWorkout.res.status !== 404) {
    throw new Error(`PATCH cross-workout expected 404, got ${crossWorkout.res.status}`);
  }

  const bogus = await req(`/api/workouts/${hostWorkoutId}/exercises`, {
    method: "PATCH",
    json: { itemId: "deleltetesing-nonexistent-item", sets: 5 },
  });
  if (bogus.res.status !== 404) {
    throw new Error(`PATCH bogus itemId expected 404, got ${bogus.res.status}`);
  }
}

async function main() {
  console.log(`\nProgram delete loop [${MARKER}]\nBASE: ${BASE}\nCOACH: ${COACH_EMAIL}\nROUNDS: ${ROUNDS}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const lib = await req(bust("/api/exercises"));
  if (!lib.res.ok) {
    fail("Exercise library", lib.res.status);
    process.exit(1);
  }
  const picks = (lib.body || []).filter((e) => e?.id && e?.name).slice(0, 5);
  if (picks.length < 3) {
    fail("Exercise library", `need ≥3 exercises, got ${picks.length}`);
    process.exit(1);
  }
  pass("Exercise library", `${picks.length} picks`);

  const noItem = await req(`/api/workouts/deleltetesing-fake/exercises?itemId=fake`, {
    method: "DELETE",
  });
  if (noItem.res.status !== 404) {
    fail("DELETE bogus workout", `expected 404, got ${noItem.res.status}`);
  } else {
    pass("DELETE bogus workout", "404");
  }

  for (let round = 1; round <= ROUNDS; round++) {
    const label = `Round ${round}`;
    try {
      const { workoutId, itemIds } = await seedWorkout(picks, round);

      if (round === 1) {
        const order = [itemIds[2], itemIds[0], itemIds[4], itemIds[1], itemIds[3]].filter(Boolean);
        await runDeleteSequence(workoutId, itemIds, picks, order, label);
      } else if (round === 2) {
        const order = [...itemIds].reverse();
        await runDeleteSequence(workoutId, itemIds, picks, order, label);
      } else {
        const order = [...itemIds];
        await runDeleteSequence(workoutId, itemIds, picks, order, label);
      }

      const empty = await assertCount(workoutId, 0, `${label} final`);
      if ((empty.exercises?.length ?? 0) !== 0) {
        throw new Error(`${label}: workout not empty`);
      }

      if (round === 1) {
        const { workoutId: donorId, itemIds: donorItems } = await seedWorkout(picks.slice(0, 2), 99);
        await testPatchGuards(workoutId, donorItems[0]);
        await cleanupWorkout(donorId);
        pass(`${label} PATCH guards`, "foreign item on host workout + bogus id → 404");
      }

      await cleanupWorkout(workoutId);
      pass(label, `deleted ${picks.length} exercises, order verified each step`);
    } catch (e) {
      fail(label, e.message);
    }
  }

  const manifestPath = join(scriptDir, `.deleltetesing-manifest-${RUN_ID}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${manifestPath}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n══ Summary: ${results.length - failed.length}/${results.length} passed ══\n`);
  if (failed.length) {
    for (const f of failed) console.log(`  ❌ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("✅ program-delete-loop-deleltetesing passed\n");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});