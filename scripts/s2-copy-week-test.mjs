#!/usr/bin/env node
/**
 * Sprint 2 — copy full week with independent workout clones (API level).
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:copy-week
 */

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const FROM_WEEK = Number(process.env.FROM_WEEK || "3");
const TO_WEEK = Number(process.env.TO_WEEK || "4");
const MARKER = `COPY-WEEK-${Date.now()}`;
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

function gymWorkoutId(day) {
  const opts = day.options || [];
  const gym = opts.find((o) => /^gym$/i.test(o.label) && o.workoutId);
  return gym?.workoutId || day.workoutId || null;
}

async function waitForExercises(workoutId, min = 1) {
  for (let i = 0; i < 12; i++) {
    const g = await req(`/api/workouts/${workoutId}`);
    if (g.res.ok && (g.body?.exercises?.length || 0) >= min) return g.body;
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}

async function main() {
  console.log(`Copy-week test → ${BASE}`);
  console.log(`Program: ${PROGRAM_SLUG} · W${FROM_WEEK} → W${TO_WEEK} · ${MARKER}`);

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) fail("Program sync", sync.text);

  const fromWeek = (sync.body.weeks || []).find((w) => w.weekNumber === FROM_WEEK);
  const toWeek = (sync.body.weeks || []).find((w) => w.weekNumber === TO_WEEK);
  if (!fromWeek || !toWeek) fail("Weeks exist", `${FROM_WEEK}/${TO_WEEK}`);

  const fromDays = [...fromWeek.days].sort((a, b) => a.dayNumber - b.dayNumber);
  const toDays = [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber);
  pass("Loaded weeks", `${fromDays.length} days each`);

  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: `${MARKER} Template Gym` },
  });
  if (!create.res.ok || !create.body?.id) fail("Create template", create.text);
  const templateId = create.body.id;

  const exercises = await req("/api/exercises");
  const bench =
    exercises.body?.find((e) => /bench press/i.test(e.name)) ||
    exercises.body?.find((e) => /squat/i.test(e.name)) ||
    exercises.body?.[0];
  if (!bench) fail("Exercise library");

  const add = await req(`/api/workouts/${templateId}/exercises`, {
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
  if (!add.res.ok) fail("Add marker exercise", add.text);

  const template = await waitForExercises(templateId, 1);
  if (!template) fail("Template exercises visible");

  const monday = fromDays[0];
  const patchMon = await req(`/api/programs/days/${monday.id}`, {
    method: "PATCH",
    json: {
      options: [{ workoutId: templateId, label: "Gym" }],
      defaultSets: 3,
      defaultReps: "10",
      defaultRestSec: 60,
      publishedAt: new Date().toISOString(),
    },
  });
  if (!patchMon.res.ok) fail("Seed source Monday", patchMon.text);
  pass("Source week Monday set", templateId);

  let sourceIds = new Set([templateId]);
  for (const day of fromDays.slice(1)) {
    let clone = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      clone = await req(`/api/workouts/${templateId}/clone`, {
        method: "POST",
        json: { name: `${MARKER} W${FROM_WEEK} ${DAY_NAMES[day.dayNumber - 1]} Gym` },
      });
      if (clone.res.ok && clone.body?.id) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!clone?.res.ok || !clone?.body?.id) fail(`Clone source day ${day.dayNumber}`, clone?.text);

    const patch = await req(`/api/programs/days/${day.id}`, {
      method: "PATCH",
      json: {
        options: [{ workoutId: clone.body.id, label: "Gym" }],
        defaultSets: 3,
        defaultReps: "10",
        defaultRestSec: 60,
        publishedAt: new Date().toISOString(),
      },
    });
    if (!patch.res.ok) fail(`Assign source day ${day.dayNumber}`, patch.text);
    sourceIds.add(clone.body.id);
    pass(`Source ${DAY_NAMES[day.dayNumber - 1]}`, clone.body.id);
  }

  const clonedToIds = new Map();
  for (const toDay of toDays) {
    const fromDay = fromDays.find((d) => d.dayNumber === toDay.dayNumber);
    const sourceWorkoutId = gymWorkoutId(fromDay);
    if (!sourceWorkoutId) fail(`Source day ${toDay.dayNumber} missing gym`);

    let clone = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      clone = await req(`/api/workouts/${sourceWorkoutId}/clone`, {
        method: "POST",
        json: {
          name: `${MARKER} W${TO_WEEK} ${DAY_NAMES[toDay.dayNumber - 1]} Gym`,
        },
      });
      if (clone.res.ok && clone.body?.id) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!clone?.res.ok || !clone?.body?.id) fail(`Clone to day ${toDay.dayNumber}`, clone?.text);

    const body = await waitForExercises(clone.body.id, 1);
    if (!body?.exercises?.some((e) => e.notes === MARKER || e.exercise?.name === bench.name)) {
      fail(`Clone day ${toDay.dayNumber} missing marker`);
    }

    const patch = await req(`/api/programs/days/${toDay.id}`, {
      method: "PATCH",
      json: {
        options: [{ workoutId: clone.body.id, label: "Gym" }],
        defaultSets: fromDay.defaultSets ?? 3,
        defaultReps: fromDay.defaultReps ?? "10",
        defaultRestSec: fromDay.defaultRestSec ?? 60,
        publishedAt: fromDay.publishedAt ?? new Date().toISOString(),
      },
    });
    if (!patch.res.ok) fail(`Assign target day ${toDay.dayNumber}`, patch.text);

    clonedToIds.set(toDay.dayNumber, clone.body.id);
    pass(`Target ${DAY_NAMES[toDay.dayNumber - 1]}`, clone.body.id);
  }

  for (const id of clonedToIds.values()) {
    if (sourceIds.has(id)) fail("Clone reused source workout id", id);
  }
  pass("All target workouts are independent copies");

  const toMonId = clonedToIds.get(1);
  const fromMonId = gymWorkoutId(fromDays[0]);
  const toMon = await waitForExercises(toMonId, 1);
  const item = toMon?.exercises?.[0];
  if (!item?.id) fail("Patch target Monday sets");

  const newSets = (item.sets ?? 3) === 5 ? 4 : 5;
  const patchEx = await req(`/api/workouts/${toMonId}/exercises`, {
    method: "PATCH",
    json: { itemId: item.id, sets: newSets },
  });
  if (!patchEx.res.ok) fail("Patch target week sets", patchEx.text);

  const fromAfter = await waitForExercises(fromMonId, 1);
  const toAfter = await waitForExercises(toMonId, 1);
  if (toAfter?.exercises?.[0]?.sets !== newSets) fail("Target week updated");
  pass("Target week Monday sets updated", String(newSets));

  if (fromAfter?.exercises?.[0]?.sets === newSets) {
    fail("Source week unchanged", `source also has sets ${newSets}`);
  }
  pass("Source week Monday unchanged", `still ${fromAfter?.exercises?.[0]?.sets ?? "?"}`);

  const resync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  const weekAfter = (resync.body?.weeks || []).find((w) => w.weekNumber === TO_WEEK);
  const gymDays = weekAfter.days.filter((d) => gymWorkoutId(d)).length;
  if (gymDays < 7) fail("Target week has 7 gym days", String(gymDays));

  pass("Copy week complete", `W${FROM_WEEK} → W${TO_WEEK}, marker ${MARKER}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});