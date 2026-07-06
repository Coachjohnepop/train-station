#!/usr/bin/env node
/**
 * Single jerdog admin soak — exercises, workouts, text upload, cycle assign.
 *
 * Usage:
 *   COACH_EMAIL=john@thetrainstation.co BASE_URL=https://www.thetrainstation.co \
 *     node scripts/jerdog-admin-soak-run.mjs
 */

import { writeFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const MARKER = process.env.TEST_MARKER || "jerdog";
const RUN_ID = process.env.JERDOG_RUN_ID || String(Date.now());
const CYCLE_DAY = Number(process.env.JERDOG_CYCLE_DAY || "28");

const { req, loginCoach } = createCoachClient(BASE, { coachEmail: COACH_EMAIL });
const results = [];
const manifest = {
  marker: MARKER,
  runId: RUN_ID,
  base: BASE,
  coachEmail: COACH_EMAIL,
  startedAt: new Date().toISOString(),
  created: { exercises: [], workouts: [], cycleAssignments: [] },
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

async function waitFor(fn, label, maxMs = 25_000) {
  const started = Date.now();
  let n = 0;
  while (Date.now() - started < maxMs) {
    n += 1;
    if (await fn()) {
      pass(label, `check ${n}, ${Date.now() - started}ms`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  fail(label, `timeout ${maxMs}ms`);
  return false;
}

async function main() {
  console.log(`\n=== jerdog admin soak run ${RUN_ID} ===\nBASE: ${BASE}\nCOACH: ${COACH_EMAIL}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    writeReport(true);
    process.exit(1);
  }

  const status = await req(bust("/api/admin/catalog/status"));
  if (status.res.ok && status.body?.storage === "database" && status.body?.durable) {
    pass("Catalog on production database", status.body.counts?.workouts + " workouts");
  } else {
    fail("Catalog on production database", JSON.stringify(status.body));
  }

  const persist = await req(bust("/api/admin/demo-persistence"));
  if (persist.res.ok && persist.body?.demoMode === false) {
    pass("Persistence API", persist.body.message);
  } else {
    fail("Persistence API", JSON.stringify(persist.body));
  }

  // --- Exercise create / rename / delete ---
  const exName = `${MARKER} Temp Curl ${RUN_ID}`;
  const exRenamed = `${MARKER} Renamed Curl ${RUN_ID}`;
  const exCreate = await req("/api/exercises", {
    method: "POST",
    json: { name: exName, description: `${MARKER} soak test`, tags: MARKER },
  });
  if (!exCreate.res.ok || !exCreate.body?.id) {
    fail("POST exercise", `${exCreate.res.status} ${JSON.stringify(exCreate.body)}`);
    writeReport(true);
    process.exit(1);
  }
  const exerciseId = exCreate.body.id;
  manifest.created.exercises.push(exerciseId);
  pass("POST exercise", exName);

  const exPatch = await req(`/api/exercises/${exerciseId}`, {
    method: "PATCH",
    json: { name: exRenamed },
  });
  if (exPatch.res.ok && exPatch.body?.name === exRenamed) {
    pass("PATCH exercise rename", exRenamed);
  } else {
    fail("PATCH exercise rename", `${exPatch.res.status}`);
  }

  await waitFor(async () => {
    const g = await req(bust(`/api/exercises/${exerciseId}`));
    return g.res.ok && g.body?.name === exRenamed;
  }, "Exercise rename survives GET");

  // --- Workout create, add, patch, remove exercise, rename ---
  const woName = `${MARKER} Workout ${RUN_ID}`;
  const woRenamed = `${MARKER} Workout Renamed ${RUN_ID}`;
  const woCreate = await req("/api/workouts", {
    method: "POST",
    json: { name: woName, description: `${MARKER} soak` },
  });
  if (!woCreate.res.ok || !woCreate.body?.id) {
    fail("POST workout", `${woCreate.res.status}`);
    writeReport(true);
    process.exit(1);
  }
  const workoutId = woCreate.body.id;
  manifest.created.workouts.push({ id: workoutId, name: woName });
  pass("POST workout", workoutId);

  const woDup = await req("/api/workouts", {
    method: "POST",
    json: { name: woName },
  });
  if (woDup.res.ok && woDup.body?.id === workoutId && woDup.body?.reused) {
    pass("POST duplicate workout reuses id", workoutId);
  } else if (woDup.res.ok && woDup.body?.id === workoutId) {
    pass("POST duplicate workout same id", workoutId);
  } else {
    fail("POST duplicate workout reuse", `got ${woDup.body?.id} reused=${woDup.body?.reused}`);
  }

  const addEx = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId,
      setScheme: "standard",
      reps: "10",
      sets: 3,
      weightTier: "medium",
      notes: `${MARKER} note`,
    },
  });
  if (!addEx.res.ok || !addEx.body?.id) {
    fail("POST workout exercise", `${addEx.res.status}`);
  } else {
    const itemId = addEx.body.id;
    pass("POST workout exercise", itemId);

    const patchItem = await req(`/api/workouts/${workoutId}/exercises`, {
      method: "PATCH",
      json: { itemId, notes: `${MARKER} patched` },
    });
    if (patchItem.res.ok && patchItem.body?.notes === `${MARKER} patched`) {
      pass("PATCH workout exercise", patchItem.body.notes);
    } else {
      fail("PATCH workout exercise", `${patchItem.res.status}`);
    }

    const delItem = await req(
      `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    if (delItem.res.status === 204) {
      pass("DELETE workout exercise", "204");
    } else {
      fail("DELETE workout exercise", `${delItem.res.status}`);
    }
  }

  const woRename = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: woRenamed },
  });
  if (woRename.res.ok && woRename.body?.name === woRenamed) {
    pass("PATCH workout rename", woRenamed);
    manifest.created.workouts[0].name = woRenamed;
  } else {
    fail("PATCH workout rename", `${woRename.res.status}`);
  }

  // --- Text upload: exercises (names must not fuzzy-match catalog) ---
  const exLines = [
    `${MARKER} Zq soak alpha ${RUN_ID}`,
    `${MARKER} Zq soak beta ${RUN_ID}`,
  ].join("\n");
  const exImport = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "exercises", rawText: exLines },
  });
  const exCreated = exImport.body?.created ?? 0;
  const exTotal = exImport.body?.total ?? 0;
  if (exImport.res.ok && exCreated >= 1) {
    pass("Text upload exercises", `created ${exCreated}/${exTotal}`);
    if (exImport.body.exerciseIds?.length) {
      manifest.created.exercises.push(...exImport.body.exerciseIds);
    }
  } else if (exImport.res.ok && exTotal >= 1 && exImport.body?.skipped >= exTotal) {
    fail(
      "Text upload exercises",
      `all ${exTotal} skipped as duplicates — ${JSON.stringify(exImport.body.skippedNames)}`,
    );
  } else {
    fail(
      "Text upload exercises",
      exImport.body?.error ||
        `status ${exImport.res.status} created=${exCreated} total=${exTotal}`,
    );
  }

  // --- Text upload: workout ---
  const textWoName = `${MARKER} Text Upload ${RUN_ID}`;
  const rawText = `Day ${CYCLE_DAY} ${textWoName}\n\n${MARKER} Warm-up\n5 min bike\n\nIncline dumbbell press\n10,10,10,10\n\nHIIT cool down 5 mins`;
  const textBuild = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText, workoutName: textWoName },
  });
  let textWorkoutId = textBuild.body?.workoutId;
  if (textBuild.res.ok && textWorkoutId) {
    pass("Text upload workout", `${textWorkoutId} (${textBuild.body.exerciseCount} blocks)`);
    manifest.created.workouts.push({ id: textWorkoutId, name: textBuild.body.workoutName });
  } else {
    fail("Text upload workout", textBuild.body?.error || textBuild.res.status);
    textWorkoutId = workoutId;
  }

  // --- Cycle assign (M2D28 gym) — mirrors Jeremy's flow ---
  const cycles = await req(bust("/api/workout-cycles?program=adult"));
  if (!cycles.res.ok || !Array.isArray(cycles.body)) {
    fail("GET workout cycles", `${cycles.res.status}`);
  } else {
    const m2 = cycles.body.find((c) => c.cycleMonth === 2);
    if (!m2?.id) {
      fail("Find Adult M2 cycle", "missing");
    } else {
      pass("Find Adult M2 cycle", m2.id);

      const freshLib = await req(bust("/api/workouts"));
      const assignId =
        freshLib.body?.find((w) => w.id === textWorkoutId)?.id ||
        freshLib.body?.find((w) => String(w.name).toLowerCase().includes(MARKER))?.id ||
        workoutId;

      const assign = await req(`/api/workout-cycles/${m2.id}/days/${CYCLE_DAY}`, {
        method: "PATCH",
        json: { trainingLocation: "gym", workoutId: assignId },
      });
      if (assign.res.ok) {
        pass(`Assign to M2D${CYCLE_DAY} gym`, assignId);
        manifest.created.cycleAssignments.push({
          cycleId: m2.id,
          day: CYCLE_DAY,
          location: "gym",
          workoutId: assignId,
        });

        const slot = assign.body?.days
          ?.find((d) => d.dayNumber === CYCLE_DAY)
          ?.slots?.find((s) => s.trainingLocation === "gym");
        if (slot?.workoutId === assignId) {
          pass("Cycle slot verified on response", assignId);
        } else {
          fail("Cycle slot verified on response", JSON.stringify(slot));
        }

        const remove = await req(`/api/workout-cycles/${m2.id}/days/${CYCLE_DAY}`, {
          method: "PATCH",
          json: { removeLocation: "gym", workoutId: assignId },
        });
        if (remove.res.ok) {
          const gone = !remove.body?.days
            ?.find((d) => d.dayNumber === CYCLE_DAY)
            ?.slots?.some((s) => s.trainingLocation === "gym");
          if (gone) pass("Remove from day (slot only)", `M2D${CYCLE_DAY} gym cleared`);
          else fail("Remove from day (slot only)", "slot still present");
        } else {
          fail("Remove from day", `${remove.res.status} ${JSON.stringify(remove.body)}`);
        }

        const stillThere = await req(bust(`/api/workouts/${assignId}`));
        if (stillThere.res.ok) {
          pass("Workout survives remove-from-day", stillThere.body?.name);
        } else {
          fail("Workout survives remove-from-day", `${stillThere.res.status}`);
        }
      } else {
        fail(`Assign to M2D${CYCLE_DAY} gym`, `${assign.res.status} ${JSON.stringify(assign.body)}`);
      }
    }
  }

  // --- Text upload with cycle slot ---
  if (textBuild.res.ok && cycles.body) {
    const m2 = cycles.body.find((c) => c.cycleMonth === 2);
    if (m2?.id && textWorkoutId) {
      const slotBuild = await req("/api/text-upload/build", {
        method: "POST",
        json: {
          mode: "workout",
          rawText: `Day ${CYCLE_DAY} ${MARKER} Slot Upload ${RUN_ID}\n\nPush-up\n3x15`,
          workoutName: `${MARKER} Slot Upload ${RUN_ID}`,
          cycleId: m2.id,
          cycleDay: CYCLE_DAY,
          trainingLocation: "home",
        },
      });
      if (slotBuild.res.ok && slotBuild.body?.cycleSlot) {
        pass("Text upload assigns cycle slot", JSON.stringify(slotBuild.body.cycleSlot));
        if (slotBuild.body.workoutId && slotBuild.body.workoutId !== textWorkoutId) {
          manifest.created.workouts.push({
            id: slotBuild.body.workoutId,
            name: slotBuild.body.workoutName,
          });
        }
        manifest.created.cycleAssignments.push({
          cycleId: m2.id,
          day: CYCLE_DAY,
          location: "home",
          workoutId: slotBuild.body.workoutId,
        });
      } else {
        fail("Text upload assigns cycle slot", slotBuild.body?.error || slotBuild.res.status);
      }
    }
  }

  writeReport(false);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\njerdog soak run: PASS\n");
}

function writeReport(failedEarly) {
  manifest.finishedAt = new Date().toISOString();
  manifest.results = results;
  manifest.passed = results.filter((r) => r.ok).length;
  manifest.failed = results.filter((r) => !r.ok).length;
  manifest.failedEarly = failedEarly;
  const path = new URL(`./.jerdog-manifest-${RUN_ID}.json`, import.meta.url).pathname;
  writeFileSync(path, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: scripts/.jerdog-manifest-${RUN_ID}.json`);
}

main().catch((err) => {
  console.error(err);
  results.push({ name: "fatal", ok: false, detail: err.message });
  writeReport(true);
  process.exit(1);
});