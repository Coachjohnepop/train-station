#!/usr/bin/env node
/**
 * Program calendar — create one Gym workout and duplicate across Week 1.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/program-week-duplicate-test.mjs
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const WEEK_NUMBER = Number(process.env.WEEK_NUMBER || "2");
const MARKER = `QA-WEEK-${Date.now()}`;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function pass(msg, detail = "") {
  console.log(`✅ ${msg}${detail ? ` — ${detail}` : ""}`);
}
function fail(msg, detail = "") {
  console.error(`❌ ${msg}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
}

function gymOption(day) {
  const opts = day.options || [];
  return opts.find((o) => /^gym$/i.test(o.label) && o.workoutId);
}

async function main() {
  console.log(`Program week duplicate test → ${BASE}`);
  console.log(`Program: ${PROGRAM_SLUG} · Week ${WEEK_NUMBER} · marker: ${MARKER}`);

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) fail("Program sync", `${sync.res.status} ${sync.text}`);

  const program = sync.body;
  const week = (program.weeks || []).find((w) => w.weekNumber === WEEK_NUMBER);
  if (!week) fail("Week not found", String(WEEK_NUMBER));

  const days = [...week.days].sort((a, b) => a.dayNumber - b.dayNumber);
  if (days.length < 7) fail("Expected 7 days", String(days.length));

  const monday = days[0];
  pass("Loaded week", `${days.length} days, Monday id=${monday.id}`);

  const createWorkout = await req("/api/workouts", {
    method: "POST",
    json: { name: `${MARKER} Template Gym` },
  });
  if (!createWorkout.res.ok || !createWorkout.body?.id) {
    fail("Create template workout", createWorkout.text);
  }
  const sourceWorkoutId = createWorkout.body.id;
  pass("Created template workout", sourceWorkoutId);

  for (let i = 0; i < 5; i++) {
    const check = await req(`/api/workouts/${sourceWorkoutId}`);
    if (check.res.ok && check.body?.id) break;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    if (i === 4) fail("Template workout not visible after create", sourceWorkoutId);
  }

  const exercises = await req("/api/exercises");
  if (!exercises.res.ok || !Array.isArray(exercises.body)) fail("Load exercise library");
  const bench =
    exercises.body.find((e) => /bench press/i.test(e.name)) ||
    exercises.body.find((e) => /squat/i.test(e.name)) ||
    exercises.body[0];
  if (!bench) fail("No exercises in library");

  const addEx = await req(`/api/workouts/${sourceWorkoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: bench.id,
      setScheme: "standard",
      reps: "10",
      sets: 3,
      weightTier: "medium",
      restSec: 60,
      notes: MARKER,
    },
  });
  if (!addEx.res.ok) fail("Add marker exercise", addEx.text);
  pass("Added marker exercise", bench.name);

  for (let i = 0; i < 5; i++) {
    const check = await req(`/api/workouts/${sourceWorkoutId}`);
    const count = (check.body?.exercises || []).length;
    if (count > 0) break;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    if (i === 4) fail("Marker exercise not on template workout after add");
  }

  const patchMon = await req(`/api/programs/days/${monday.id}`, {
    method: "PATCH",
    json: {
      options: [
        { workoutId: sourceWorkoutId, label: "Gym" },
        ...(days[0].options || [])
          .filter((o) => /^home$/i.test(o.label) && o.workoutId)
          .slice(0, 1),
      ],
      defaultSets: 3,
      defaultReps: "10",
      defaultRestSec: 60,
      publishedAt: new Date().toISOString(),
    },
  });
  if (!patchMon.res.ok) fail("Assign Monday Gym", patchMon.text);
  pass("Monday Gym assigned + published");

  let copied = 0;
  for (const day of days.slice(1)) {
    const clone = await req(`/api/workouts/${sourceWorkoutId}/clone`, {
      method: "POST",
      json: {
        name: `${MARKER} ${DAY_NAMES[day.dayNumber - 1]} Gym`,
      },
    });
    if (!clone.res.ok || !clone.body?.id) {
      fail(`Clone for day ${day.dayNumber}`, clone.text);
    }

    const home = (day.options || []).find((o) => /^home$/i.test(o.label) && o.workoutId);
    const options = [{ workoutId: clone.body.id, label: "Gym" }];
    if (home) options.push({ workoutId: home.workoutId, label: "Home" });

    const patch = await req(`/api/programs/days/${day.id}`, {
      method: "PATCH",
      json: {
        options,
        defaultSets: 3,
        defaultReps: "10",
        defaultRestSec: 60,
        publishedAt: new Date().toISOString(),
      },
    });
    if (!patch.res.ok) fail(`Assign day ${day.dayNumber}`, patch.text);

    const verify = await req(`/api/workouts/${clone.body.id}`);
    const markerHit = (verify.body?.exercises || []).some(
      (e) => e.notes === MARKER || e.exercise?.name === bench.name,
    );
    if (!markerHit) fail(`Day ${day.dayNumber} missing marker exercise`);
    copied++;
    pass(`Day ${DAY_NAMES[day.dayNumber - 1]} duplicated`, clone.body.id);
  }

  const resync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  const weekAfter = (resync.body?.weeks || []).find((w) => w.weekNumber === WEEK_NUMBER);
  const gymDays = weekAfter.days.filter((d) => gymOption(d)?.workoutId).length;
  if (gymDays < 7) fail("All 7 days should have Gym workout", `got ${gymDays}`);

  pass("Week complete", `${copied} days copied from Monday template`);
  console.log(`\nAll checks passed. Search admin program builder for "${MARKER}" to review or clean up.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});