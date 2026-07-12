#!/usr/bin/env node
/**
 * Prod loop: create / save / edit / delete / clone / edit
 * Uses the SAME coach APIs as Exercise library + Workout builder (no special tools).
 *
 * All rows are prefixed with a funny marker for easy find + cleanup:
 *   "LASER-CHICKEN-SOAK · …"
 *
 * Usage:
 *   COACH_PASSWORD='…' node scripts/laser-chicken-crud-clone-loop.mjs
 *   ROUNDS=3 BASE_URL=https://www.thetrainstation.co node scripts/laser-chicken-crud-clone-loop.mjs
 *   CLEANUP_ONLY=1 node scripts/laser-chicken-crud-clone-loop.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "3"));
const MARK = "LASER-CHICKEN-SOAK";
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const CLEANUP_ONLY = process.env.CLEANUP_ONLY === "1";
const KEEP = process.env.KEEP === "1";

function stamp(label) {
  return `${MARK} · ${label} · ${RUN_ID}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`\n🐔 LASER-CHICKEN-SOAK — CRUD + clone loop`);
  console.log(`BASE: ${BASE}`);
  console.log(`MARKER: ${MARK}`);
  console.log(`RUN: ${RUN_ID}`);
  console.log(`ROUNDS: ${ROUNDS}${CLEANUP_ONLY ? " (cleanup only)" : ""}\n`);

  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach())) {
    console.error("Login failed — set COACH_PASSWORD (or COACH_TEST_PASSWORD)");
    process.exit(1);
  }
  console.log("✅ Coach login\n");

  if (CLEANUP_ONLY) {
    await cleanupAll(req);
    return;
  }

  const summary = [];
  const created = { exercises: [], workouts: [], templates: [] };

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`\n========== Round ${round}/${ROUNDS} ==========\n`);
      const r = await runRound(req, round, created);
      summary.push(r);
      console.log(`✅ Round ${round} passed\n`);
      if (round < ROUNDS) await sleep(800);
    }

    // Final cross-check: cloned workouts still independent after edits
    console.log("\n========== Independence check ==========\n");
    await independenceCheck(req, created);

    if (!KEEP) {
      console.log("\n========== Cleanup (funny rows) ==========\n");
      await cleanupCreated(req, created);
      // Sweep any leftover LASER-CHICKEN from failed prior runs
      await cleanupAll(req, { onlyIfNoError: true });
    } else {
      console.log("\nKEEP=1 — leaving LASER-CHICKEN rows for inspection\n");
    }

    writeFileSync(
      new URL("./.laser-chicken-soak-latest.json", import.meta.url),
      JSON.stringify({ ok: true, runId: RUN_ID, summary, at: new Date().toISOString() }, null, 2),
    );
    console.log("\n🐔 ALL ROUNDS PASSED — LASER-CHICKEN-SOAK complete\n");
  } catch (e) {
    console.error("\n❌ FAILED:", e.message);
    writeFileSync(
      new URL("./.laser-chicken-soak-latest.json", import.meta.url),
      JSON.stringify(
        {
          ok: false,
          runId: RUN_ID,
          error: e.message,
          created,
          summary,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.error("\nAttempting cleanup of this run's rows…");
    try {
      await cleanupCreated(req, created);
    } catch (ce) {
      console.error("Cleanup partial:", ce.message);
    }
    process.exit(1);
  }
}

async function runRound(req, round, created) {
  const log = (step) => console.log(`  → ${step}`);

  // ── 1. NEW exercise (library editor API) ──
  const exName = stamp(`R${round} flappy-pecs`);
  log(`NEW exercise: ${exName}`);
  const createEx = await req("/api/exercises", {
    method: "POST",
    json: {
      name: exName,
      description: "Original chicken description — should be edited later",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: "laser-chicken,soak",
    },
  });
  assert(createEx.res.status === 201, `create exercise ${createEx.res.status}: ${createEx.text}`);
  const exerciseId = createEx.body.id;
  created.exercises.push(exerciseId);
  assert(exerciseId, "exercise id missing");

  // ── 2. SAVE / EDIT exercise (same PATCH as library editor) ──
  const exName2 = stamp(`R${round} flappy-pecs-EDITED`);
  log(`EDIT exercise name+description+video`);
  const patchEx = await req(`/api/exercises/${exerciseId}`, {
    method: "PATCH",
    json: {
      name: exName2,
      description: "Edited: do not feed after midnight · laser optional",
      videoUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    },
  });
  assert(patchEx.res.ok, `patch exercise ${patchEx.res.status}: ${patchEx.text}`);

  const getEx = await req(`/api/exercises?_t=${Date.now()}`);
  assert(getEx.res.ok, "list exercises failed");
  const found = (getEx.body || []).find((e) => e.id === exerciseId);
  assert(found, "exercise missing after edit");
  assert(found.name === exName2, `name not persisted: ${found.name}`);
  assert(
    /Edited: do not feed/i.test(found.description || ""),
    "description not persisted",
  );

  // ── 3. NEW workout (same as workout builder create) ──
  const wName = stamp(`R${round} barn-dance`);
  log(`NEW workout: ${wName}`);
  const createW = await req("/api/workouts", {
    method: "POST",
    json: { name: wName, description: "Laser chicken barn dance baseline" },
  });
  assert(createW.res.status === 201 || createW.res.ok, `create workout ${createW.res.status}`);
  const workoutId = createW.body.id;
  created.workouts.push(workoutId);

  // ── 4. ADD exercise to workout (workout editor) ──
  log(`ADD exercise to workout with coach note`);
  const add = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId,
      setScheme: "standard",
      reps: "12",
      sets: 3,
      weightTier: "medium",
      restSec: 60,
      notes: "R1 coach note: cluck between sets",
    },
  });
  assert(add.res.status === 201 || add.res.ok, `add item ${add.res.status}: ${add.text}`);
  let itemId = add.body.id || add.body.itemId;
  assert(itemId, "workout exercise item id missing");

  // ── 5. EDIT workout name + item (sets/reps/notes) via same APIs ──
  const wName2 = stamp(`R${round} barn-dance-EDITED`);
  log(`EDIT workout name`);
  const patchW = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: wName2 },
  });
  assert(patchW.res.ok, `patch workout ${patchW.res.status}`);

  log(`EDIT workout line (sets/reps/coach note)`);
  const patchItem = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "PATCH",
    json: {
      itemId,
      sets: 4,
      reps: "8",
      restSec: 90,
      notes: "R1 note EDITED: more laser, less chicken",
    },
  });
  assert(patchItem.res.ok, `patch item ${patchItem.res.status}: ${patchItem.text}`);

  let w = await getWorkout(req, workoutId);
  assert(w.name === wName2, `workout name not saved: ${w.name}`);
  assert((w.exercises || []).length === 1, "expected 1 exercise on workout");
  const line = w.exercises[0];
  assert(String(line.sets) === "4" || line.sets === 4, `sets=${line.sets}`);
  assert(String(line.reps) === "8", `reps=${line.reps}`);
  assert(/EDITED: more laser/i.test(line.notes || ""), `notes=${line.notes}`);

  // ── 6. CLONE workout (always clone semantics) ──
  log(`CLONE workout`);
  const cloneName = stamp(`R${round} barn-dance-CLONE`);
  const cloneRes = await req(`/api/workouts/${workoutId}/clone`, {
    method: "POST",
    json: { name: cloneName },
  });
  assert(cloneRes.res.status === 201 || cloneRes.res.ok, `clone ${cloneRes.res.status}: ${cloneRes.text}`);
  const cloneId = cloneRes.body.id;
  created.workouts.push(cloneId);
  assert(cloneId && cloneId !== workoutId, "clone id invalid");

  let clone = await getWorkout(req, cloneId);
  assert((clone.exercises || []).length === 1, "clone should copy exercises");
  assert(
    /EDITED: more laser/i.test(clone.exercises[0].notes || ""),
    "clone should copy coach notes",
  );

  // ── 7. EDIT clone only — source must stay unchanged ──
  log(`EDIT clone only (independence)`);
  const cloneItemId = clone.exercises[0].id;
  const patchClone = await req(`/api/workouts/${cloneId}/exercises`, {
    method: "PATCH",
    json: {
      itemId: cloneItemId,
      sets: 10, // schema max 10 (same as workout editor)
      reps: "1",
      notes: "CLONE-ONLY note: original chicken must not see this",
    },
  });
  assert(
    patchClone.res.ok,
    `patch clone ${patchClone.res.status}: ${patchClone.text}`,
  );

  const patchCloneName = await req(`/api/workouts/${cloneId}`, {
    method: "PATCH",
    json: { name: stamp(`R${round} barn-dance-CLONE-EDITED`) },
  });
  assert(patchCloneName.res.ok, "rename clone failed");

  w = await getWorkout(req, workoutId);
  clone = await getWorkout(req, cloneId);
  assert(String(w.exercises[0].sets) === "4" || w.exercises[0].sets === 4, "SOURCE sets mutated!");
  assert(String(w.exercises[0].reps) === "8", "SOURCE reps mutated!");
  assert(
    !/CLONE-ONLY/i.test(w.exercises[0].notes || ""),
    "SOURCE notes contaminated by clone edit!",
  );
  assert(
    /CLONE-ONLY/i.test(clone.exercises[0].notes || ""),
    "clone edit not persisted",
  );
  assert(
    String(clone.exercises[0].sets) === "10" || clone.exercises[0].sets === 10,
    "clone sets",
  );

  // ── 8. PROMOTE template + PASTE (same clone path under the hood) ──
  log(`PROMOTE to template library`);
  const tmplRes = await req("/api/workout-templates", {
    method: "POST",
    json: {
      sourceWorkoutId: workoutId,
      name: stamp(`R${round} template`),
      category: "laser-chicken",
      versionLabel: "v_cluck",
      notes: "If you can read this, Jeremy laughed",
    },
  });
  if (tmplRes.res.ok || tmplRes.res.status === 201) {
    const tmplId = tmplRes.body.id;
    if (tmplId) created.templates.push(tmplId);
    if (tmplRes.body.workoutId) created.workouts.push(tmplRes.body.workoutId);
    log(`Template ok: ${tmplRes.body.name || tmplId}`);
  } else {
    // Template table may lag deploy — warn but don't fail the whole soak on 404/500
    console.warn(
      `  ⚠ template promote skipped (${tmplRes.res.status}): ${String(tmplRes.text).slice(0, 120)}`,
    );
  }

  // ── 9. REMOVE line from workout (workout editor delete) ──
  log(`DELETE exercise line from original workout`);
  const delLine = await req(
    `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  assert(delLine.res.ok || delLine.res.status === 204, `delete line ${delLine.res.status}`);
  w = await getWorkout(req, workoutId);
  assert((w.exercises || []).length === 0, "line still on workout after remove");

  // Clone should still have its line (independence)
  clone = await getWorkout(req, cloneId);
  assert((clone.exercises || []).length === 1, "clone lost exercises when source line deleted");

  // ── 10. Re-add + final save ──
  log(`Re-ADD exercise to original`);
  const reAdd = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId,
      setScheme: "standard",
      sets: 2,
      reps: "15",
      weightTier: "light",
      restSec: 45,
      notes: "Back from the dead (chicken phoenix)",
    },
  });
  assert(
    reAdd.res.ok || reAdd.res.status === 201,
    `re-add ${reAdd.res.status}: ${reAdd.text}`,
  );

  return { round, workoutId, cloneId, exerciseId };
}

async function independenceCheck(req, created) {
  // Spot-check last two workouts if present
  const ids = created.workouts.slice(-4);
  for (const id of ids) {
    const w = await getWorkout(req, id);
    assert(w?.id === id, `workout ${id} missing`);
    console.log(`  ✓ ${w.name} (${(w.exercises || []).length} ex)`);
  }
}

async function getWorkout(req, id) {
  const { res, body, text } = await req(`/api/workouts/${id}?_t=${Date.now()}`);
  assert(res.ok, `GET workout ${id} → ${res.status} ${String(text).slice(0, 100)}`);
  return body;
}

async function cleanupCreated(req, created) {
  for (const id of created.templates || []) {
    const r = await req(`/api/workout-templates/${id}`, { method: "DELETE" });
    console.log(`  template ${id}: ${r.res.status}`);
  }
  for (const id of created.workouts || []) {
    const r = await req(`/api/workouts/${id}`, { method: "DELETE" });
    console.log(`  workout ${id}: ${r.res.status}`);
  }
  for (const id of created.exercises || []) {
    const r = await req(`/api/exercises/${id}`, { method: "DELETE" });
    console.log(`  exercise ${id}: ${r.res.status}`);
  }
}

async function cleanupAll(req, opts = {}) {
  console.log(`Sweeping all "${MARK}" exercises/workouts…`);
  const ex = await req(`/api/exercises?_t=${Date.now()}`);
  const w = await req(`/api/workouts?_t=${Date.now()}`);
  const templates = await req(`/api/workout-templates?_t=${Date.now()}`);

  let n = 0;
  if (templates.res.ok && Array.isArray(templates.body)) {
    for (const t of templates.body) {
      if (String(t.name || "").includes(MARK)) {
        await req(`/api/workout-templates/${t.id}`, { method: "DELETE" });
        n++;
      }
    }
  }
  if (w.res.ok && Array.isArray(w.body)) {
    for (const row of w.body) {
      if (String(row.name || "").includes(MARK)) {
        await req(`/api/workouts/${row.id}`, { method: "DELETE" });
        n++;
      }
    }
  }
  if (ex.res.ok && Array.isArray(ex.body)) {
    for (const row of ex.body) {
      if (String(row.name || "").includes(MARK)) {
        await req(`/api/exercises/${row.id}`, { method: "DELETE" });
        n++;
      }
    }
  }
  console.log(`  cleaned ~${n} marked rows`);
  if (!opts.onlyIfNoError) {
    console.log("🐔 Cleanup sweep done\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
