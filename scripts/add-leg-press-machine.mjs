#!/usr/bin/env node
/**
 * Add Leg Press Machine to exercise catalog and remap Lower Day leg press row.
 *
 * Usage:
 *   node scripts/add-leg-press-machine.mjs
 *   WORKOUT_ID=cmr6okj25000004jlh7a4bdlu node scripts/add-leg-press-machine.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const WORKOUT_ID = process.env.WORKOUT_ID || "cmr6okj25000004jlh7a4bdlu";
const LEG_PRESS_NAME = "Leg Press Machine";
const HACK_SQUAT_NAME = "Dumbbell Hack Squat";

const { req, loginCoach } = createCoachClient(BASE);

function pass(msg, detail = "") {
  console.log(`✅ ${msg}${detail ? ` — ${detail}` : ""}`);
}

function fail(msg, detail = "") {
  console.log(`❌ ${msg}${detail ? ` — ${detail}` : ""}`);
}

async function ensureLegPressExercise() {
  const list = await req("/api/exercises");
  if (!list.res.ok) {
    fail("Load exercises", list.res.status);
    return null;
  }

  const existing = (list.body || []).find(
    (row) => row.name?.toLowerCase() === LEG_PRESS_NAME.toLowerCase(),
  );
  if (existing) {
    pass("Leg Press Machine exercise", existing.id);
    return existing.id;
  }

  const created = await req("/api/exercises", {
    method: "POST",
    json: {
      name: LEG_PRESS_NAME,
      description:
        "Leg press on a sled or seated machine. Hold at the bottom or top of the range, then burnout reps as prescribed.",
    },
  });
  if (!created.res.ok || !created.body?.id) {
    fail("Create Leg Press Machine", created.body?.detail || created.res.status);
    return null;
  }

  pass("Created Leg Press Machine exercise", created.body.id);
  return created.body.id;
}

async function ensureLegPressEquipment() {
  const list = await req("/api/admin/equipment");
  if (!list.res.ok) {
    fail("Load equipment catalog", list.res.status);
    return;
  }

  const existing = (list.body?.equipment || []).find((row) =>
    /leg press/i.test(row.name || ""),
  );
  if (existing) {
    pass("Leg press equipment", existing.id);
    return;
  }

  const created = await req("/api/admin/equipment", {
    method: "POST",
    json: {
      name: "Leg press machine",
      category: "machine",
      description: "Home or gym leg press sled",
    },
  });
  if (!created.res.ok) {
    fail("Create leg press equipment", created.body?.error || created.res.status);
    return;
  }
  pass("Created leg press equipment", created.body.id);
}

async function remapLowerDay(legPressExerciseId) {
  const workout = await req(`/api/workouts/${WORKOUT_ID}`);
  if (!workout.res.ok) {
    fail("Load Lower Day workout", workout.res.status);
    return;
  }

  const exercises = workout.body?.exercises || [];
  const legPressRow =
    exercises.find((row) => /leg press/i.test(row.exercise?.name || "")) ||
    exercises.find((row) => row.exercise?.name === HACK_SQUAT_NAME);

  if (!legPressRow) {
    fail("Find leg press row in workout");
    return;
  }

  if (legPressRow.exercise?.name === LEG_PRESS_NAME) {
    pass("Lower Day already uses Leg Press Machine");
    return;
  }

  const patch = await req(`/api/workouts/${WORKOUT_ID}/exercises`, {
    method: "PATCH",
    json: {
      itemId: legPressRow.id,
      exerciseId: legPressExerciseId,
    },
  });
  if (!patch.res.ok) {
    fail("Remap Lower Day leg press", patch.body?.detail || patch.res.status);
    return;
  }

  pass(
    "Remapped Lower Day",
    `${legPressRow.exercise?.name} → ${LEG_PRESS_NAME}`,
  );
}

async function main() {
  console.log(`\nLeg Press Machine catalog fix\nBASE: ${BASE}\nWORKOUT: ${WORKOUT_ID}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) process.exit(1);

  const legPressExerciseId = await ensureLegPressExercise();
  if (!legPressExerciseId) process.exit(1);

  await ensureLegPressEquipment();
  await remapLowerDay(legPressExerciseId);

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});