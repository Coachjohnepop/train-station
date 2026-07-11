#!/usr/bin/env node
/**
 * Slice 1d — program builder day navigation math + copy-week (API level).
 *
 * Usage:
 *   node scripts/s1d-program-builder-test.mjs
 *   BASE_URL=http://localhost:3000 npm run test:s1d
 *   BASE_URL=https://www.thetrainstation.co npm run test:s1d
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const FROM_WEEK = Number(process.env.FROM_WEEK || "1");
const TO_WEEK = Number(process.env.TO_WEEK || "2");
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const COACH_PASSWORD_ENV =
  process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null;
const MARKER = `S1D-${Date.now()}`;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_PER_WEEK = 7;

const results = [];
let cookies = "";

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

/** Mirrors src/lib/program-calendar.ts adjacentProgramDay */
function adjacentProgramDay(weekNumber, dayNumber, delta, durationWeeks) {
  if (durationWeeks < 1) return null;
  let w = weekNumber;
  let d = dayNumber + delta;
  if (d < 1) {
    w -= 1;
    d = DAYS_PER_WEEK;
  } else if (d > DAYS_PER_WEEK) {
    w += 1;
    d = 1;
  }
  if (w < 1 || w > durationWeeks) return null;
  return { weekNumber: w, dayNumber: d };
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function tryLogin(password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: COACH_EMAIL,
      password,
      redirect: `/admin/programs/${PROGRAM_SLUG}`,
    }),
    redirect: "manual",
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const setCookie = parseSetCookie(loginRes.headers);
  if (loginRes.ok && setCookie.includes("ts_session")) {
    cookies = setCookie;
    return { ok: true, detail: password ? "password" : "no password" };
  }
  return { ok: false, detail: loginBody.error || `status ${loginRes.status}` };
}

async function loginCoach() {
  const attempts =
    COACH_PASSWORD_ENV !== null ? [COACH_PASSWORD_ENV] : ["CoachTest123!", ""];
  for (const password of attempts) {
    const result = await tryLogin(password);
    if (result.ok) {
      pass("Coach login", `${COACH_EMAIL} (${result.detail})`);
      return true;
    }
  }
  fail("Coach login", "set COACH_PASSWORD for prod accounts with a password");
  return false;
}

async function req(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(opts.headers || {}),
  };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function dayOptions(day) {
  if (day.options?.length) return day.options;
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

function gymWorkoutId(day) {
  const opts = dayOptions(day);
  const gym = opts.find((o) => /^gym$/i.test(o.label) && o.workoutId);
  return gym?.workoutId || day.workoutId || null;
}

async function waitForExercises(workoutId, min = 1) {
  for (let i = 0; i < 12; i++) {
    const g = await req(bust(`/api/workouts/${workoutId}`));
    const count = g.body?.exercises?.length || 0;
    if (g.res.ok && count >= min) return g.body;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return null;
}

function testAdjacentProgramDay() {
  const cases = [
    { w: 1, d: 1, delta: -1, dur: 4, expect: null },
    { w: 1, d: 2, delta: -1, dur: 4, expect: { weekNumber: 1, dayNumber: 1 } },
    { w: 1, d: 1, delta: 1, dur: 4, expect: { weekNumber: 1, dayNumber: 2 } },
    { w: 1, d: 7, delta: 1, dur: 4, expect: { weekNumber: 2, dayNumber: 1 } },
    { w: 2, d: 1, delta: -1, dur: 4, expect: { weekNumber: 1, dayNumber: 7 } },
    { w: 4, d: 7, delta: 1, dur: 4, expect: null },
    { w: 2, d: 4, delta: 1, dur: 4, expect: { weekNumber: 2, dayNumber: 5 } },
  ];

  let ok = true;
  for (const c of cases) {
    const got = adjacentProgramDay(c.w, c.d, c.delta, c.dur);
    const expectStr = c.expect ? `W${c.expect.weekNumber}D${c.expect.dayNumber}` : "null";
    const gotStr = got ? `W${got.weekNumber}D${got.dayNumber}` : "null";
    if (gotStr !== expectStr) {
      fail(
        `adjacentProgramDay W${c.w}D${c.d} ${c.delta > 0 ? "+" : "-"}1`,
        `expected ${expectStr}, got ${gotStr}`,
      );
      ok = false;
    }
  }
  if (ok) pass("adjacentProgramDay math", `${cases.length} cases`);
  return ok;
}

/** Same clone loop as ProgramCalendarBuilder.copyWeek */
async function copyWeekLikeUi(program, fromWeekNumber, toWeekNumber) {
  const fromWeek = program.weeks.find((w) => w.weekNumber === fromWeekNumber);
  const toWeek = program.weeks.find((w) => w.weekNumber === toWeekNumber);
  if (!fromWeek || !toWeek) return { ok: false, detail: "week missing" };

  const clonedByDay = new Map();

  for (const toDay of [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    const fromDay = fromWeek.days.find((d) => d.dayNumber === toDay.dayNumber);
    if (!fromDay) continue;

    const fromOpts = dayOptions(fromDay).filter((o) => o.workoutId);
    if (fromOpts.length === 0) {
      await req(`/api/programs/days/${toDay.id}`, {
        method: "PATCH",
        json: { options: [] },
      });
      continue;
    }

    const clonedOpts = [];
    for (const opt of fromOpts) {
      const dayLabel = DAY_NAMES[toDay.dayNumber - 1] ?? `Day${toDay.dayNumber}`;
      const cloneRes = await req(`/api/workouts/${opt.workoutId}/clone`, {
        method: "POST",
        json: { name: `${MARKER} W${toWeekNumber} ${dayLabel} ${opt.label}` },
      });
      if (!cloneRes.res.ok) {
        return { ok: false, detail: `clone failed day ${toDay.dayNumber}` };
      }
      clonedOpts.push({ workoutId: cloneRes.body.id, label: opt.label });
      clonedByDay.set(toDay.dayNumber, cloneRes.body.id);
    }

    const dayPatch = { options: clonedOpts };
    if (fromDay.defaultSets != null) dayPatch.defaultSets = fromDay.defaultSets;
    if (fromDay.defaultReps != null) dayPatch.defaultReps = fromDay.defaultReps;
    if (fromDay.defaultRestSec != null) dayPatch.defaultRestSec = fromDay.defaultRestSec;
    if (fromDay.publishedAt != null) dayPatch.publishedAt = fromDay.publishedAt;

    const patch = await req(`/api/programs/days/${toDay.id}`, {
      method: "PATCH",
      json: dayPatch,
    });
    if (!patch.res.ok) {
      return { ok: false, detail: `patch day ${toDay.dayNumber}: ${patch.res.status} ${patch.text}` };
    }
  }

  return { ok: true, clonedByDay };
}

async function main() {
  console.log(`\nS1d program builder test\nBASE: ${BASE}\nPROGRAM: ${PROGRAM_SLUG}\n`);

  if (!testAdjacentProgramDay()) {
    process.exit(1);
  }

  if (!(await loginCoach())) {
    process.exit(1);
  }

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    fail("Load program schedule", `${sync.res.status}`);
    process.exit(1);
  }
  const program = sync.body;
  pass("Load program schedule", program.name || PROGRAM_SLUG);

  const fromWeek = program.weeks?.find((w) => w.weekNumber === FROM_WEEK);
  const toWeek = program.weeks?.find((w) => w.weekNumber === TO_WEEK);
  if (!fromWeek || !toWeek) {
    fail(`Weeks ${FROM_WEEK} and ${TO_WEEK} exist`);
    process.exit(1);
  }
  pass(`Weeks ${FROM_WEEK} and ${TO_WEEK} exist`);

  const w1Mon = fromWeek.days.find((d) => d.dayNumber === 1);
  if (!w1Mon?.id) {
    fail("Source week Monday exists");
    process.exit(1);
  }

  let sourceWorkoutId = gymWorkoutId(w1Mon);
  if (!sourceWorkoutId) {
    const workouts = await req(bust("/api/workouts"));
    const candidate = workouts.body?.find((w) => w.name && !/^qa/i.test(w.name));
    if (!candidate?.id) {
      fail("Find seed workout for week copy");
      process.exit(1);
    }
    sourceWorkoutId = candidate.id;
    const assign = await req(`/api/programs/days/${w1Mon.id}`, {
      method: "PATCH",
      json: { options: [{ workoutId: sourceWorkoutId, label: "Gym" }] },
    });
    if (!assign.res.ok) {
      fail("Assign seed workout to source Monday", `${assign.res.status}`);
      process.exit(1);
    }
    pass("Seeded source Monday", sourceWorkoutId);
  } else {
    pass("Source Monday has gym workout", sourceWorkoutId);
  }

  const sourceWorkout = await waitForExercises(sourceWorkoutId, 1);
  if (!sourceWorkout?.exercises?.length) {
    fail("Source workout has exercises");
    process.exit(1);
  }
  pass("Source workout ready", `${sourceWorkout.exercises.length} exercise(s)`);

  const copy = await copyWeekLikeUi(program, FROM_WEEK, TO_WEEK);
  if (!copy.ok) {
    fail("Copy week (UI-equivalent)", copy.detail);
    process.exit(1);
  }
  pass(`Copy week ${FROM_WEEK} → ${TO_WEEK}`, `${copy.clonedByDay.size} day clone(s)`);

  const resync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  const toWeekFresh = (resync.body?.weeks || []).find((w) => w.weekNumber === TO_WEEK);
  const toMon = toWeekFresh?.days?.find((d) => d.dayNumber === 1);
  const toMonWorkoutId = gymWorkoutId(toMon);
  if (!toMonWorkoutId) {
    fail("Target Monday has gym workout after copy");
    process.exit(1);
  }
  if (toMonWorkoutId === sourceWorkoutId) {
    fail("Copy week produced independent Monday workout");
    process.exit(1);
  }
  pass("Target Monday is independent clone", toMonWorkoutId);

  const toMonWorkout = await waitForExercises(toMonWorkoutId, 1);
  if (!toMonWorkout?.exercises?.length) {
    fail("Target Monday workout exercises visible");
    process.exit(1);
  }
  pass(
    "Target Monday workout exercises visible",
    `${toMonWorkout.exercises.length} exercise(s)`,
  );

  const targetItem = toMonWorkout.exercises[0];
  const sourceSetsBefore = sourceWorkout.exercises[0]?.sets ?? 3;
  const newSets = (targetItem?.sets ?? 3) === 5 ? 4 : 5;

  const patch = await req(`/api/workouts/${toMonWorkoutId}/exercises`, {
    method: "PATCH",
    json: { itemId: targetItem.id, sets: newSets, reps: targetItem.reps || "8-10" },
  });
  if (!patch.res.ok) {
    fail("Patch target week sets/reps", `${patch.res.status}`);
    process.exit(1);
  }
  pass("Patch target week Monday sets", `→ ${newSets}`);

  const sourceAfter = await waitForExercises(sourceWorkoutId, 1);
  const toAfter = await waitForExercises(toMonWorkoutId, 1);
  if (toAfter?.exercises?.[0]?.sets !== newSets) {
    fail("Target week Monday updated");
  } else {
    pass("Target week Monday updated");
  }

  if (sourceAfter?.exercises?.[0]?.sets === sourceSetsBefore) {
    pass("Source week Monday unchanged", `sets still ${sourceSetsBefore}`);
  } else {
    fail(
      "Source week Monday unchanged",
      `${sourceSetsBefore} → ${sourceAfter?.exercises?.[0]?.sets}`,
    );
  }

  const gymDays = (toWeekFresh?.days || []).filter((d) => gymWorkoutId(d)).length;
  if (gymDays < 1) {
    fail("Target week has populated days after copy");
  } else {
    pass("Target week populated", `${gymDays} day(s) with gym`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nS1d acceptance: PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});