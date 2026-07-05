#!/usr/bin/env node
/**
 * Full coach workflow loop — exercises, workouts, text import, scratch build,
 * certify/export/re-ingest, and 2-week Adult schedule (Gym + Home per day).
 *
 * All created rows are prefixed with MARKER for later cleanup.
 *
 * Usage:
 *   COACH_EMAIL=john@thetrainstation.co BASE_URL=https://www.thetrainstation.co \
 *     node scripts/coach-workflow-loop-testingsilly.mjs
 */

import { writeFileSync } from "node:fs";
import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const MARKER = process.env.TEST_MARKER || "testingsilly";
const RUN_ID = Date.now();

const WARMUP = `Warm-up (bonus points if done before coach arrives)
5 min bike, row, or brisk walk
Wall taps 20
Band pull-aparts 15
Lightweight bicep curls 15
Light shoulder press 15
Shrugs 15
Bosu ball squats 10
Jump squats 10`;

const { req, loginCoach } = createCoachClient(BASE, { coachEmail: COACH_EMAIL });
const results = [];
const manifest = {
  marker: MARKER,
  runId: RUN_ID,
  base: BASE,
  coachEmail: COACH_EMAIL,
  created: { exercises: [], workouts: [], programDays: [] },
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

function workoutText(theme, mainBlock, location = "gym") {
  const locNote =
    location === "home"
      ? "\n\n(Home — bands / dumbbells / bodyweight only)"
      : "\n\n(Gym — full equipment)";
  return `${WARMUP}\n\n${mainBlock}${locNote}`;
}

/** Coach 2-week conditioning block — body-area themes every training day. */
const SCHEDULE = [
  // Week 1
  { week: 1, day: 1, theme: "Leg day", gym: "Back Squat\n4x8\n\nRomanian Deadlift\n3x10", home: "Goblet squat\n3x15\n\nSingle-leg RDL\n3x10 each leg" },
  { week: 1, day: 2, theme: "Shoulder day", gym: "Overhead Press\n4x8\n\nLateral Raise\n3x12", home: "Pike push-up\n3x10\n\nBand lateral raise\n3x15" },
  { week: 1, day: 3, theme: "Day Off", off: true },
  { week: 1, day: 4, theme: "Chest day", gym: "Bench Press\n4x8\n\nIncline Dumbbell Press\n3x10", home: "Push-up\n4x12\n\nFloor press\n3x12" },
  { week: 1, day: 5, theme: "Back & biceps", gym: "Pull-Up\n4x6\n\nBarbell Row\n3x10", home: "Inverted row\n3x12\n\nBand curl\n3x15" },
  { week: 1, day: 6, theme: "Full body", gym: "Back Squat\n3x8\n\nBench Press\n3x8\n\nBarbell Row\n3x10", home: "Air squat\n3x15\n\nPush-up\n3x12\n\nBand row\n3x15" },
  { week: 1, day: 7, theme: "Day Off", off: true },
  // Week 2
  { week: 2, day: 1, theme: "Lower body", gym: "Leg Press\n4x12\n\nWalking Lunge\n3x10 each leg", home: "Step-up\n3x12 each leg\n\nGlute bridge\n3x15" },
  { week: 2, day: 2, theme: "Upper body", gym: "Bench Press\n4x8\n\nPull-Up\n3x8", home: "Push-up\n4x10\n\nBand pull-apart row\n3x15" },
  { week: 2, day: 3, theme: "Cardio", gym: "30 min steady bike\n\nCore plank\n3x45 sec", home: "30 min brisk walk\n\nDead bug\n3x10 each side" },
  { week: 2, day: 4, theme: "Shoulder day", gym: "Arnold Press\n3x10\n\nFace Pull\n3x15", home: "Band overhead press\n3x12\n\nBand face pull\n3x15" },
  { week: 2, day: 5, theme: "Leg day", gym: "Romanian Deadlift\n4x8\n\nLeg Curl\n3x12", home: "Single-leg RDL\n3x10 each leg\n\nNordic curl negative\n3x5" },
  { week: 2, day: 6, theme: "Arm day", gym: "Barbell Curl\n3x12\n\nTricep Pushdown\n3x12", home: "Band curl\n3x15\n\nChair dip\n3x12" },
  { week: 2, day: 7, theme: "Day Off", off: true },
];

async function waitForExercises(workoutId, min = 2, maxMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const g = await req(bust(`/api/workouts/${workoutId}`));
    if (g.res.ok && (g.body?.exercises?.length ?? 0) >= min) return g.body;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function buildWorkoutFromText(name, rawText) {
  const build = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText, workoutName: name },
  });
  if (!build.res.ok || !build.body?.workoutId) {
    throw new Error(build.body?.error || `build failed ${build.res.status}`);
  }
  manifest.created.workouts.push({ id: build.body.workoutId, name });
  return build.body.workoutId;
}

async function main() {
  console.log(`\nCoach workflow loop [${MARKER}]\nBASE: ${BASE}\nCOACH: ${COACH_EMAIL}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  // --- 1. Text import exercises ---
  const exerciseLines = [
    `${MARKER} Tempo Split Squat, testingsilly, leg`,
    `${MARKER} Band Face Pull, testingsilly, shoulder`,
    `${MARKER} Floor Press, testingsilly, chest`,
  ].join("\n");

  const exImport = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "exercises", rawText: exerciseLines },
  });
  if (!exImport.res.ok) {
    fail("1. Text import exercises", exImport.body?.error || exImport.res.status);
    process.exit(1);
  }
  pass(
    "1. Text import exercises",
    `created ${exImport.body.created}, skipped ${exImport.body.skipped}`,
  );
  if (exImport.body.exerciseIds?.length) {
    manifest.created.exercises.push(...exImport.body.exerciseIds);
  }

  // --- 2. Scratch-build workout from library ---
  const scratchName = `${MARKER} Scratch Build — Shoulder day`;
  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: scratchName, description: `${MARKER} built from scratch via API` },
  });
  if (!create.res.ok) {
    fail("2a. Create empty workout", create.res.status);
    process.exit(1);
  }
  const scratchId = create.body.id;
  manifest.created.workouts.push({ id: scratchId, name: scratchName });
  pass("2a. Create empty workout", scratchId);

  const lib = await req(bust("/api/exercises"));
  const libEx =
    lib.body?.find((e) => /overhead press/i.test(e.name)) ||
    lib.body?.find((e) => e.name && !e.name.includes(MARKER));
  if (!libEx) {
    fail("2b. Pick library exercise");
    process.exit(1);
  }

  const addEx = await req(`/api/workouts/${scratchId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: libEx.id,
      setScheme: "standard",
      sets: 3,
      reps: "10",
      weightTier: "medium",
      notes: `${MARKER} scratch prescription`,
    },
  });
  if (!addEx.res.ok) {
    fail("2b. Add exercise to scratch workout", addEx.res.status);
    process.exit(1);
  }
  pass("2b. Add exercise to scratch workout", libEx.name);

  const scratchDetail = await waitForExercises(scratchId, 1);
  if (!scratchDetail?.exercises?.length) {
    fail("2c. Scratch workout persisted");
    process.exit(1);
  }
  pass("2c. Scratch workout persisted", `${scratchDetail.exercises.length} item(s)`);

  // --- 3. Text-import workout + certify + re-ingest round-trip ---
  const importName = `${MARKER} Import — Chest day (Gym)`;
  const importText = workoutText(
    "Chest day",
    "Bench Press\n4x8\n\nIncline Dumbbell Press\n3x10",
    "gym",
  );
  let importId;
  try {
    importId = await buildWorkoutFromText(importName, importText);
  } catch (e) {
    fail("3a. Text-import themed workout", e.message);
    process.exit(1);
  }
  pass("3a. Text-import themed workout", importId);

  const importDetail = await waitForExercises(importId, 3);
  const hasWarmup = importDetail?.exercises?.some((e) =>
    /warm|bike|band pull|wall tap|bonus/i.test(
      `${e.exercise?.name || ""} ${e.notes || ""}`,
    ),
  );
  if (!hasWarmup) {
    fail("3b. Warmup auto-filled in import", "no warmup block detected");
  } else {
    pass("3b. Warmup auto-filled in import");
  }

  const certify = await req(`/api/workouts/${importId}`, {
    method: "PATCH",
    json: { exportText: importText.trim(), certifiedAt: new Date().toISOString() },
  });
  if (!certify.res.ok || !certify.body?.exportText) {
    fail("3c. Certify export text", certify.res.status);
    process.exit(1);
  }
  pass("3c. Certify export text", `${certify.body.exportText.length} chars`);

  const reingestName = `${MARKER} Re-ingest — Chest day`;
  let reingestId;
  try {
    reingestId = await buildWorkoutFromText(reingestName, certify.body.exportText);
  } catch (e) {
    fail("3d. Re-ingest certified export", e.message);
    process.exit(1);
  }
  pass("3d. Re-ingest certified export", reingestId);

  const reDetail = await waitForExercises(reingestId, 2);
  if (!reDetail?.exercises?.length) {
    fail("3e. Re-ingested workout has exercises");
  } else {
    pass("3e. Re-ingested workout has exercises", `${reDetail.exercises.length} items`);
  }

  // --- 4. Load program + assign 2-week schedule ---
  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    fail("4a. Sync Adult program", sync.res.status);
    process.exit(1);
  }
  const program = sync.body;
  pass("4a. Sync Adult program", `${program.weeks?.length ?? 0} weeks scaffolded`);

  const weekMap = new Map((program.weeks || []).map((w) => [w.weekNumber, w]));
  let assigned = 0;
  let offDays = 0;

  for (const slot of SCHEDULE) {
    const week = weekMap.get(slot.week);
    const day = week?.days?.find((d) => d.dayNumber === slot.day);
    if (!day?.id) {
      fail(`4b. Day W${slot.week}D${slot.day}`, "day id missing");
      continue;
    }

    if (slot.off) {
      let patch = await req(`/api/programs/days/${day.id}`, {
        method: "PATCH",
        json: { options: [{ workoutId: "", label: "Day Off" }] },
      });
      if (!patch.res.ok) {
        patch = await req(`/api/programs/days/${day.id}`, {
          method: "PATCH",
          json: { options: [], notes: `${MARKER} Day Off` },
        });
      }
      if (patch.res.ok) {
        offDays += 1;
        manifest.created.programDays.push({ dayId: day.id, theme: slot.theme, off: true });
        pass(`4b. Day Off W${slot.week}D${slot.day}`);
      } else {
        fail(`4b. Day Off W${slot.week}D${slot.day}`, patch.res.status);
      }
      continue;
    }

    const gymName = `${MARKER} ${slot.theme} W${slot.week}D${slot.day} Gym`;
    const homeName = `${MARKER} ${slot.theme} W${slot.week}D${slot.day} Home`;

    let gymId;
    let homeId;
    try {
      gymId = await buildWorkoutFromText(gymName, workoutText(slot.theme, slot.gym, "gym"));
      homeId = await buildWorkoutFromText(homeName, workoutText(slot.theme, slot.home, "home"));
    } catch (e) {
      fail(`4b. Build W${slot.week}D${slot.day} ${slot.theme}`, e.message);
      continue;
    }

    const patch = await req(`/api/programs/days/${day.id}`, {
      method: "PATCH",
      json: {
        options: [
          { workoutId: gymId, label: "Gym" },
          { workoutId: homeId, label: "Home" },
        ],
        notes: `${MARKER} ${slot.theme}`,
      },
    });
    if (!patch.res.ok) {
      fail(`4c. Assign W${slot.week}D${slot.day} ${slot.theme}`, patch.res.status);
      continue;
    }

    const opts = patch.body?.options || [];
    const hasGym = opts.some((o) => /^gym$/i.test(o.label) && o.workoutId === gymId);
    const hasHome = opts.some((o) => /^home$/i.test(o.label) && o.workoutId === homeId);
    if (hasGym && hasHome) {
      assigned += 1;
      manifest.created.programDays.push({
        dayId: day.id,
        week: slot.week,
        day: slot.day,
        theme: slot.theme,
        gymId,
        homeId,
      });
      pass(`4c. W${slot.week}D${slot.day} ${slot.theme}`, `Gym + Home`);
    } else {
      fail(`4c. W${slot.week}D${slot.day} ${slot.theme}`, "options mismatch");
    }
  }

  if (assigned >= 10) {
    pass("4d. Two-week schedule assigned", `${assigned} training days, ${offDays} rest days`);
  } else {
    fail("4d. Two-week schedule assigned", `only ${assigned} training days`);
  }

  // --- 5. Verify schedule reload ---
  const resync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  const w1d1 = resync.body?.weeks
    ?.find((w) => w.weekNumber === 1)
    ?.days?.find((d) => d.dayNumber === 1);
  const w1d1Opts = w1d1?.options || [];
  const w1d1Gym = w1d1Opts.find((o) => /^gym$/i.test(o.label));
  if (w1d1Gym?.workout?.name?.includes(MARKER) && /leg/i.test(w1d1Gym.workout.name)) {
    pass("5. Schedule survives reload", w1d1Gym.workout.name);
  } else {
    fail("5. Schedule survives reload", w1d1Gym?.workout?.name || "missing");
  }

  // --- 6. Member start-workout resolves Gym track ---
  const start = await req(`/api/programs/${PROGRAM_SLUG}/start-workout`);
  if (start.res.ok && start.body?.workoutId) {
    pass("6. Member start-workout resolves", start.body.workoutId);
  } else {
    fail("6. Member start-workout resolves", start.body?.detail || start.res.status);
  }

  const manifestPath = `scripts/.testingsilly-manifest-${RUN_ID}.json`;
  writeFileSync(new URL(`../${manifestPath}`, import.meta.url), JSON.stringify(manifest, null, 2));
  pass("Manifest written", manifestPath);

  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n---\n${ok}/${total} steps passed`);
  console.log(`Marker: ${MARKER} — delete later via manifest ${manifestPath}\n`);
  process.exit(ok === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});