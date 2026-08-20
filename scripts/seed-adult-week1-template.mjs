#!/usr/bin/env node
/**
 * Fill empty Adult program Week 1 days from a starter template, then copy → Week 2.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co node scripts/seed-adult-week1-template.mjs
 *   DRY_RUN=1 node scripts/seed-adult-week1-template.mjs
 */
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const COACH_EMAIL = process.env.COACH_EMAIL || "jeremy@thetrainstation.co";
const DRY_RUN = process.env.DRY_RUN === "1";
const COPY_WEEK2 = process.env.COPY_WEEK2 !== "0";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** dayNumber → how to fill when empty */
const WEEK1_TEMPLATE = {
  2: {
    kind: "workout",
    label: "Gym",
    title: "Adult W1 Tue Mobility + Core",
    text: `W1 Tue Mobility + Core

Band pull-apart
10,10,10

Plank
30,30,30 sec

Dead bug
10,10,10 each side`,
  },
  4: { kind: "clone", label: "Gym", fromDay: 1 },
  5: { kind: "clone", label: "Gym", fromDay: 3 },
  6: { kind: "active-recovery" },
  7: { kind: "meal-prep" },
};

let cookies = "";

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function login() {
  for (const password of ["", "CoachTest123!"]) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: COACH_EMAIL, password, redirect: "/admin" }),
      redirect: "manual",
    });
    const setCookie = parseSetCookie(res.headers);
    if (res.ok && setCookie.includes("ts_session")) {
      cookies = setCookie;
      console.log(`✅ Logged in as ${COACH_EMAIL}`);
      return true;
    }
  }
  console.error("❌ Login failed");
  return false;
}

async function req(path, opts = {}) {
  const headers = { "Cache-Control": "no-cache", ...(opts.headers || {}) };
  if (cookies) headers.Cookie = cookies;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, cache: "no-store" });
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

function hasWorkoutContent(day) {
  const opts = dayOptions(day);
  return opts.some((o) => o.workoutId && !/^day off$/i.test(o.label) && !/^fasted/i.test(o.label));
}

function isDayOff(day) {
  return dayOptions(day).some((o) => /^day off$/i.test(o.label));
}

function isFastedCardio(day) {
  return dayOptions(day).some((o) => /^fasted/i.test(o.label));
}

async function buildWorkoutFromText(title, text) {
  const build = await req("/api/text-upload/build", {
    method: "POST",
    json: { mode: "workout", rawText: text, workoutName: title },
  });
  if (!build.res.ok) {
    throw new Error(`text-upload build failed: ${build.text}`);
  }
  return build.body.workoutId;
}

async function cloneWorkout(sourceId, name) {
  const clone = await req(`/api/workouts/${sourceId}/clone`, {
    method: "POST",
    json: { name },
  });
  if (!clone.res.ok) {
    throw new Error(`clone failed: ${clone.text}`);
  }
  return clone.body.id;
}

async function findFastedCardioExercise() {
  const ex = await req("/api/exercises");
  if (!ex.res.ok) return null;
  const list = Array.isArray(ex.body) ? ex.body : [];
  return list.find((e) => /^fasted cardio$/i.test(e.name)) || null;
}

async function setupFastedCardioDay(day, programName, minutes) {
  const cal = day.calendarDate;
  const dayLabel = DAY_NAMES[day.dayNumber - 1] ?? `Day${day.dayNumber}`;
  const workoutName = `${programName} · ${dayLabel} Fasted cardio`;

  if (DRY_RUN) {
    console.log(`  [dry] fasted cardio ${minutes}m on ${dayLabel}`);
    return;
  }

  const cardioEx = await findFastedCardioExercise();
  if (!cardioEx) {
    throw new Error('Add "Fasted Cardio" to the exercise library first.');
  }

  const create = await req("/api/workouts", {
    method: "POST",
    json: { name: workoutName },
  });
  if (!create.res.ok) throw new Error(`workout create: ${create.text}`);
  const workoutId = create.body.id;

  await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: cardioEx.id,
      setScheme: "standard",
      repPattern: null,
      reps: `${minutes} min`,
      sets: 1,
      weightTier: "light",
      restSec: 0,
      notes: `${minutes} min fasted cardio`,
    },
  });

  const patch = await req(`/api/programs/days/${day.id}`, {
    method: "PATCH",
    json: {
      options: [{ workoutId, label: "Fasted cardio" }],
      notes: `${minutes} minutes fasted cardio`,
      calendarDate: cal ?? undefined,
    },
  });
  if (!patch.res.ok) throw new Error(`patch fasted day: ${patch.text}`);
}

async function setDayOff(day) {
  if (DRY_RUN) {
    console.log(`  [dry] day off ${DAY_NAMES[day.dayNumber - 1]}`);
    return;
  }
  const patch = await req(`/api/programs/days/${day.id}`, {
    method: "PATCH",
    json: { options: [{ workoutId: "", label: "Day Off" }] },
  });
  if (!patch.res.ok) throw new Error(`patch day off: ${patch.text}`);
}

async function assignGymWorkout(day, workoutId, label = "Gym") {
  if (DRY_RUN) {
    console.log(`  [dry] assign ${workoutId} → ${DAY_NAMES[day.dayNumber - 1]}`);
    return;
  }
  const patch = await req(`/api/programs/days/${day.id}`, {
    method: "PATCH",
    json: { options: [{ workoutId, label }] },
  });
  if (!patch.res.ok) throw new Error(`patch gym day: ${patch.text}`);
}

async function fillWeek1(program) {
  const week1 = program.weeks?.find((w) => w.weekNumber === 1);
  if (!week1) throw new Error("Week 1 not found");

  let filled = 0;
  for (const day of [...week1.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    const spec = WEEK1_TEMPLATE[day.dayNumber];
    if (!spec) continue;

    const dayLabel = DAY_NAMES[day.dayNumber - 1] ?? `Day${day.dayNumber}`;

    if (spec.kind === "day-off") {
      if (isDayOff(day)) {
        console.log(`⏭  ${dayLabel} — already day off`);
        continue;
      }
      await setDayOff(day);
      console.log(`✅ ${dayLabel} — Day Off`);
      filled++;
      continue;
    }

    if (spec.kind === "fasted-cardio") {
      if (isFastedCardio(day)) {
        console.log(`⏭  ${dayLabel} — already fasted cardio`);
        continue;
      }
      await setupFastedCardioDay(day, program.name || "Adult", spec.minutes);
      console.log(`✅ ${dayLabel} — Fasted cardio (${spec.minutes} min)`);
      filled++;
      continue;
    }

    if (hasWorkoutContent(day)) {
      console.log(`⏭  ${dayLabel} — already has workout`);
      continue;
    }

    if (spec.kind === "workout") {
      let workoutId;
      if (DRY_RUN) {
        console.log(`  [dry] build workout ${spec.title}`);
        workoutId = "dry-workout-id";
      } else {
        workoutId = await buildWorkoutFromText(spec.title, spec.text);
      }
      await assignGymWorkout(day, workoutId, spec.label);
      console.log(`✅ ${dayLabel} — built "${spec.title}"`);
      filled++;
      continue;
    }

    if (spec.kind === "clone") {
      const sourceDay = week1.days.find((d) => d.dayNumber === spec.fromDay);
      const sourceOpt = dayOptions(sourceDay).find((o) => o.workoutId);
      if (!sourceOpt?.workoutId) {
        console.warn(`⚠️  ${dayLabel} — cannot clone (W1 ${DAY_NAMES[spec.fromDay - 1]} empty)`);
        continue;
      }
      const cloneName = `Adult W1 ${dayLabel} ${spec.label} (from ${DAY_NAMES[spec.fromDay - 1]})`;
      let workoutId;
      if (DRY_RUN) {
        console.log(`  [dry] clone ${sourceOpt.workoutId} → ${cloneName}`);
        workoutId = "dry-clone-id";
      } else {
        workoutId = await cloneWorkout(sourceOpt.workoutId, cloneName);
      }
      await assignGymWorkout(day, workoutId, spec.label);
      console.log(`✅ ${dayLabel} — cloned from ${DAY_NAMES[spec.fromDay - 1]}`);
      filled++;
    }
  }

  return filled;
}

async function copyWeek1ToWeek2(program) {
  const fromWeek = program.weeks?.find((w) => w.weekNumber === 1);
  const toWeek = program.weeks?.find((w) => w.weekNumber === 2);
  if (!fromWeek || !toWeek) return 0;

  let copied = 0;
  for (const toDay of [...toWeek.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    const fromDay = fromWeek.days.find((d) => d.dayNumber === toDay.dayNumber);
    if (!fromDay) continue;

    const fromOpts = dayOptions(fromDay);
    if (fromOpts.length === 0) {
      if (!DRY_RUN) {
        await req(`/api/programs/days/${toDay.id}`, { method: "PATCH", json: { options: [] } });
      }
      continue;
    }

    const clonedOpts = [];
    for (const opt of fromOpts) {
      if (!opt.workoutId) {
        clonedOpts.push({ workoutId: "", label: opt.label });
        continue;
      }
      const dayLabel = DAY_NAMES[toDay.dayNumber - 1] ?? `Day${toDay.dayNumber}`;
      const cloneName = `Adult W2 ${dayLabel} ${opt.label}`;
      if (DRY_RUN) {
        clonedOpts.push({ workoutId: "dry", label: opt.label });
      } else {
        const cloneRes = await req(`/api/workouts/${opt.workoutId}/clone`, {
          method: "POST",
          json: { name: cloneName },
        });
        if (!cloneRes.res.ok) throw new Error(`week2 clone: ${cloneRes.text}`);
        clonedOpts.push({ workoutId: cloneRes.body.id, label: opt.label });
      }
    }

    if (!DRY_RUN) {
      const patch = await req(`/api/programs/days/${toDay.id}`, {
        method: "PATCH",
        json: {
          options: clonedOpts,
          defaultSets: fromDay.defaultSets ?? undefined,
          defaultReps: fromDay.defaultReps ?? undefined,
          defaultRestSec: fromDay.defaultRestSec ?? undefined,
        },
      });
      if (!patch.res.ok) throw new Error(`week2 patch: ${patch.text}`);
    }
    copied++;
    console.log(`✅ Week 2 ${DAY_NAMES[toDay.dayNumber - 1]} (${clonedOpts.length} option(s))`);
  }
  return copied;
}

async function main() {
  if (!(await login())) process.exit(1);

  const sync = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    console.error("❌ sync failed", sync.res.status);
    process.exit(1);
  }
  const program = sync.body;

  console.log(`\n📋 Filling ${PROGRAM_SLUG} Week 1 template${DRY_RUN ? " (DRY RUN)" : ""}…\n`);
  const filled = await fillWeek1(program);

  let copied = 0;
  if (COPY_WEEK2) {
    console.log(`\n📋 Copying Week 1 → Week 2…\n`);
    const refreshed = await req(`/api/programs/${PROGRAM_SLUG}/sync`, { method: "POST" });
    copied = await copyWeek1ToWeek2(refreshed.body || program);
  }

  console.log(`\nDone — filled ${filled} day(s)${COPY_WEEK2 ? `, copied ${copied} day(s) to Week 2` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});