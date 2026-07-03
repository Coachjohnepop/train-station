#!/usr/bin/env node
/**
 * Sprint 2 — program builder / copy-week smoke test (API level).
 *
 * Usage:
 *   node scripts/s2-program-builder-test.mjs
 *   BASE_URL=https://www.thetrainstation.co npm run test:s2
 *   PROGRAM_SLUG=adult node scripts/s2-program-builder-test.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const MARKER = `S2-${Date.now()}`;

const { req, loginCoach } = createCoachClient(BASE);
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

async function waitForWorkoutItemCount(workoutId, expectedMin, label, maxMs = 35_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const { res, body } = await req(bust(`/api/workouts/${workoutId}`));
    if (res.ok && (body.exercises?.length ?? 0) >= expectedMin) {
      pass(label, `${body.exercises.length} exercise(s) in ~${Date.now() - started}ms`);
      return body;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(label, `expected >=${expectedMin} exercises after ${maxMs}ms`);
  return null;
}

function dayOptions(day) {
  if (day.options?.length) return day.options;
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

function monday(week) {
  return week?.days?.find((d) => d.dayNumber === 1);
}

async function main() {
  console.log(`\nS2 program builder test\nBASE: ${BASE}\nPROGRAM: ${PROGRAM_SLUG}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    fail("Load program schedule", `${sync.res.status}`);
    process.exit(1);
  }
  const program = sync.body;
  pass("Load program schedule", program.name || PROGRAM_SLUG);

  const week1 = program.weeks?.find((w) => w.weekNumber === 1);
  const week2 = program.weeks?.find((w) => w.weekNumber === 2);
  if (!week1 || !week2) {
    fail("Week 1 and Week 2 exist");
    process.exit(1);
  }
  pass("Program has week 1 and week 2");

  const w1Mon = monday(week1);
  const w2Mon = monday(week2);
  if (!w1Mon?.id || !w2Mon?.id) {
    fail("Monday day ids on weeks 1 and 2");
    process.exit(1);
  }
  pass("Monday slots resolved", `W1 ${w1Mon.id.slice(0, 8)}… / W2 ${w2Mon.id.slice(0, 8)}…`);

  let sourceWorkoutId = dayOptions(w1Mon)[0]?.workoutId;
  if (!sourceWorkoutId) {
    const workouts = await req(bust("/api/workouts"));
    if (!workouts.res.ok || !workouts.body?.length) {
      fail("Find source workout with exercises");
      process.exit(1);
    }
    for (const candidate of workouts.body) {
      const detail = await req(bust(`/api/workouts/${candidate.id}`));
      if (detail.res.ok && detail.body.exercises?.length > 0) {
        sourceWorkoutId = candidate.id;
        break;
      }
    }
    if (!sourceWorkoutId) {
      fail("Find workout with at least one exercise");
      process.exit(1);
    }
    const assign = await req(`/api/programs/days/${w1Mon.id}`, {
      method: "PATCH",
      json: { options: [{ workoutId: sourceWorkoutId, label: "Gym" }] },
    });
    if (!assign.res.ok) {
      fail("Assign source workout to week 1 Monday", `${assign.res.status}`);
      process.exit(1);
    }
    pass("Assigned source workout to week 1 Monday", sourceWorkoutId);
  } else {
    pass("Week 1 Monday has workout", sourceWorkoutId);
  }

  const sourceWorkout = await waitForWorkoutItemCount(
    sourceWorkoutId,
    1,
    "Source workout has exercises",
  );
  if (!sourceWorkout) process.exit(1);

  const cloneRes = await req(`/api/workouts/${sourceWorkoutId}/clone`, {
    method: "POST",
    json: { name: `${MARKER} W2 Mon Gym` },
  });
  if (!cloneRes.res.ok) {
    fail("Clone workout API", `${cloneRes.res.status} ${cloneRes.text}`);
    process.exit(1);
  }
  const clonedId = cloneRes.body.id;
  pass("Clone workout API", clonedId);

  const clonedWorkout = await waitForWorkoutItemCount(
    clonedId,
    sourceWorkout.exercises.length,
    "Cloned workout has same exercise count",
  );
  if (!clonedWorkout) process.exit(1);

  if (clonedId === sourceWorkoutId) {
    fail("Clone produced new workout id");
  } else {
    pass("Clone produced independent workout id");
  }

  const sourceNames = sourceWorkout.exercises.map((e) => e.exercise?.name).join("|");
  const clonedNames = clonedWorkout.exercises.map((e) => e.exercise?.name).join("|");
  if (sourceNames === clonedNames) {
    pass("Cloned exercises match source", `${sourceWorkout.exercises.length} items`);
  } else {
    fail("Cloned exercises match source", "name mismatch");
  }

  const copyDay = await req(`/api/programs/days/${w2Mon.id}`, {
    method: "PATCH",
    json: { options: [{ workoutId: clonedId, label: "Gym" }] },
  });
  if (!copyDay.res.ok) {
    fail("Assign cloned workout to week 2 Monday", `${copyDay.res.status}`);
    process.exit(1);
  }
  pass("Week 2 Monday linked to cloned workout");

  const targetItem = clonedWorkout.exercises[0];
  if (!targetItem?.id) {
    fail("Patch week 2 sets/reps", "no exercise item");
    process.exit(1);
  }

  const sourceSetsBefore = sourceWorkout.exercises[0]?.sets ?? 3;
  const clonedSetsBefore = targetItem.sets ?? 3;
  const newSets = clonedSetsBefore === 4 ? 3 : 4;

  const patch = await req(`/api/workouts/${clonedId}/exercises`, {
    method: "PATCH",
    json: { itemId: targetItem.id, sets: newSets, reps: targetItem.reps || "8-10" },
  });
  if (!patch.res.ok) {
    fail("Patch week 2 sets/reps", `${patch.res.status}`);
    process.exit(1);
  }
  pass("Patch week 2 sets/reps only", `sets → ${newSets}`);

  let clonedItem = null;
  const patchDeadline = Date.now() + 35_000;
  while (Date.now() < patchDeadline) {
    const clonedAfter = await req(bust(`/api/workouts/${clonedId}`));
    if (clonedAfter.res.ok) {
      clonedItem = clonedAfter.body.exercises?.[0];
      if (clonedItem?.sets === newSets) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const sourceAfter = await req(bust(`/api/workouts/${sourceWorkoutId}`));
  if (!sourceAfter.res.ok) {
    fail("Reload week 1 workout after patch");
    process.exit(1);
  }

  const sourceItem = sourceAfter.body.exercises?.[0];
  if (clonedItem?.sets === newSets) {
    pass("Week 2 workout updated");
  } else {
    fail("Week 2 workout updated", `got sets ${clonedItem?.sets}`);
  }

  if (sourceItem?.sets === sourceSetsBefore) {
    pass("Week 1 workout unchanged after week 2 edit", `W1 sets still ${sourceItem?.sets ?? "?"}`);
  } else {
    fail("Week 1 workout unchanged after week 2 edit", `W1 sets changed ${sourceSetsBefore} → ${sourceItem?.sets}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nS2 acceptance: PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});