#!/usr/bin/env node
/**
 * Jeremy program-builder flow — mirrors prod UI actions on Gym/Home day editor.
 * Non-destructive: adds a temp exercise, removes it, reorders, renames title suffix.
 *
 * Usage:
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *     BASE_URL=https://www.thetrainstation.co node scripts/jeremy-program-builder-prodtest.mjs
 */

import { createCoachClient } from "./lib/coach-auth.mjs";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const PROGRAM = process.env.PROGRAM_SLUG || "adult";
const WEEK = Number(process.env.BUILDER_WEEK || "1");
const DAY = Number(process.env.BUILDER_DAY || "1");
const LOCATION = process.env.BUILDER_LOCATION || "Home";
const RUN_ID = process.env.TEST_MARKER || `jeremy-builder-${Date.now()}`;
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";

const { req, loginCoach } = createCoachClient(BASE, {
  coachEmail: COACH_EMAIL,
  password: process.env.COACH_PASSWORD ?? process.env.COACH_TEST_PASSWORD ?? null,
});

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

async function waitFor(fn, label, maxMs = 20_000) {
  const start = Date.now();
  let n = 0;
  while (Date.now() - start < maxMs) {
    n += 1;
    if (await fn()) {
      pass(label, `check ${n}, ${Date.now() - start}ms`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  fail(label, `timeout ${maxMs}ms`);
  return false;
}

function dayOptions(day) {
  if (day.options?.length) return day.options;
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

function optionForLocation(day, label) {
  const opts = dayOptions(day);
  return opts.find((o) => o.label?.toLowerCase() === label.toLowerCase() && o.workoutId);
}

async function fetchWorkout(id) {
  const g = await req(bust(`/api/workouts/${id}`));
  return g.res.ok ? g.body : null;
}

async function main() {
  console.log(`\nJeremy program-builder prod test`);
  console.log(`BASE: ${BASE}`);
  console.log(`Program: ${PROGRAM} W${WEEK}D${DAY} ${LOCATION}`);
  console.log(`RUN: ${RUN_ID}\n`);

  if (!(await loginCoach({ onPass: pass, onFail: fail }))) {
    process.exit(1);
  }

  const status = await req(bust("/api/admin/catalog/status"));
  if (status.res.ok && status.body?.storage === "database" && status.body?.durable) {
    pass("Catalog on Postgres", `${status.body.counts?.workouts ?? "?"} workouts`);
  } else {
    fail("Catalog on Postgres", JSON.stringify(status.body));
  }

  const sync = await req(`/api/programs/${PROGRAM}/sync`, { method: "POST" });
  if (!sync.res.ok) {
    fail("Program sync", `${sync.res.status}`);
    process.exit(1);
  }
  pass("Program sync", sync.body?.name || PROGRAM);

  const week = sync.body.weeks?.find((w) => w.weekNumber === WEEK);
  const day = week?.days?.find((d) => d.dayNumber === DAY);
  if (!day?.id) {
    fail("Resolve program day", `W${WEEK}D${DAY}`);
    process.exit(1);
  }
  pass("Resolve program day", day.id);

  let opt = optionForLocation(day, LOCATION);
  if (!opt?.workoutId) {
    const gym = optionForLocation(day, "Gym");
    if (!gym?.workoutId) {
      fail(`${LOCATION} workout on day`, "missing — assign Gym/Home first");
      process.exit(1);
    }
    const clone = await req(`/api/workouts/${gym.workoutId}/clone`, {
      method: "POST",
      json: { name: `${RUN_ID} ${LOCATION} clone` },
    });
    if (!clone.res.ok || !clone.body?.id) {
      fail("Clone gym → home", `${clone.res.status}`);
      process.exit(1);
    }
    const patchDay = await req(`/api/programs/days/${day.id}`, {
      method: "PATCH",
      json: {
        options: [
          { workoutId: gym.workoutId, label: "Gym" },
          { workoutId: clone.body.id, label: "Home" },
        ],
      },
    });
    if (!patchDay.res.ok) {
      fail("Attach home option", `${patchDay.res.status}`);
      process.exit(1);
    }
    opt = { workoutId: clone.body.id, label: "Home" };
    pass("Seeded home workout", opt.workoutId);
  } else {
    pass(`${LOCATION} workout loaded`, opt.workoutId);
  }

  const workoutId = opt.workoutId;
  let workout = await fetchWorkout(workoutId);
  if (!workout?.exercises?.length) {
    fail("Workout has exercises", "0 blocks");
    process.exit(1);
  }
  pass("Workout exercises loaded", `${workout.exercises.length} block(s)`);

  const library = await req(bust("/api/exercises"));
  const libEx =
    library.body?.find((e) => /cool down|stretch/i.test(e.name)) ||
    library.body?.find((e) => /bicycle/i.test(e.name)) ||
    library.body?.[0];
  if (!libEx?.id) {
    fail("Pick library exercise");
    process.exit(1);
  }

  const add = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: libEx.id,
      setScheme: "standard",
      reps: "10",
      sets: 2,
      weightTier: "light",
      notes: `${RUN_ID} temp block`,
    },
  });
  if (!add.res.ok || !add.body?.id) {
    fail("Add exercise (like +ex)", `${add.res.status}`);
    process.exit(1);
  }
  const tempItemId = add.body.id;
  pass("Add exercise", `${libEx.name}`);

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return w?.exercises?.some((e) => e.id === tempItemId);
  }, "Add survives refresh");

  const del = await req(
    `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(tempItemId)}`,
    { method: "DELETE" },
  );
  if (del.res.status !== 204) {
    fail("Remove exercise (like Jeremy Remove)", `${del.res.status}`);
  } else {
    pass("Remove exercise", "204");
  }

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return !w?.exercises?.some((e) => e.id === tempItemId);
  }, "Remove survives refresh");

  const add2 = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    json: {
      exerciseId: libEx.id,
      setScheme: "standard",
      reps: "12",
      sets: 2,
      weightTier: "light",
      notes: `${RUN_ID} reorder`,
    },
  });
  if (!add2.res.ok || !add2.body?.id) {
    fail("Re-add for reorder test", `${add2.res.status}`);
    process.exit(1);
  }
  const reorderId = add2.body.id;
  pass("Re-add exercise for reorder", reorderId);

  const reorder = await req(`/api/workouts/${workoutId}/exercises`, {
    method: "PATCH",
    json: { itemId: reorderId, sortOrder: 0 },
  });
  if (!reorder.res.ok) {
    fail("Move exercise (sortOrder)", `${reorder.res.status}`);
  } else {
    pass("Move exercise to top", "sortOrder 0");
  }

  workout = await fetchWorkout(workoutId);
  const firstId = workout?.exercises?.[0]?.id;
  if (firstId === reorderId) {
    pass("Reorder persisted", "temp block is first");
  } else {
    fail("Reorder persisted", `first=${firstId}, expected=${reorderId}`);
  }

  const originalName = workout?.name || "Workout";
  const taggedName = originalName.includes(RUN_ID)
    ? originalName
    : `${originalName} · ${RUN_ID}`;
  const rename = await req(`/api/workouts/${workoutId}`, {
    method: "PATCH",
    json: { name: taggedName },
  });
  if (!rename.res.ok) {
    fail("Save workout title", `${rename.res.status}`);
  } else {
    pass("Save workout title", taggedName.slice(0, 48));
  }

  await waitFor(async () => {
    const w = await fetchWorkout(workoutId);
    return w?.name === taggedName;
  }, "Title survives refresh");

  const resync = await req(`/api/programs/${PROGRAM}/sync`, { method: "POST" });
  const dayFresh = resync.body?.weeks
    ?.find((w) => w.weekNumber === WEEK)
    ?.days?.find((d) => d.dayNumber === DAY);
  const stillLinked = optionForLocation(dayFresh, LOCATION)?.workoutId === workoutId;
  if (stillLinked) {
    pass("Program day still links workout", workoutId);
  } else {
    fail("Program day still links workout", "option changed after edit");
  }

  if (reorderId) {
    await req(
      `/api/workouts/${workoutId}/exercises?itemId=${encodeURIComponent(reorderId)}`,
      { method: "DELETE" },
    );
  }
  if (!originalName.includes(RUN_ID)) {
    await req(`/api/workouts/${workoutId}`, {
      method: "PATCH",
      json: { name: originalName },
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n---\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nJeremy program-builder: PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});