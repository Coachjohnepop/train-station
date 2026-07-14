#!/usr/bin/env node
/**
 * Soak: multi-part (triple) program days.
 * Marker: TRIPLEDAYS
 *
 * Runs ROUNDS times (default 2). Creates 3-part day on Military (boot-camp)
 * with named workouts, verifies sessions + part options, cleans up.
 *
 *   BASE_URL=https://www.thetrainstation.co \
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *   ROUNDS=2 node scripts/tripledays-soak.mjs
 */
import { createCoachClient } from "./lib/coach-auth.mjs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MARK = "TRIPLEDAYS";
const RUN = Date.now().toString(36);
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "2"));
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD || "LaserChickenSoak2026!";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "boot-camp-preparation";

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else {
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
    results.push({ ok: false, name, detail });
    throw new Error(`${name}: ${detail}`);
  }
}

async function runRound(req, round) {
  const tag = `${MARK} · r${round} · ${RUN}`;
  console.log(`\n── Round ${round}/${ROUNDS} · ${tag} ──\n`);

  const created = { workouts: [], exercises: [] };

  // Pick a low-traffic day: last week, day 6
  const summary = await req("/api/admin/programs-summary");
  assert(summary.res.ok, `r${round} programs-summary`);
  const prog = (summary.body.programs || []).find((p) => p.slug === PROGRAM_SLUG);
  assert(prog, `r${round} program ${PROGRAM_SLUG}`);
  const week = prog.weeks[prog.weeks.length - 1] || prog.weeks[0];
  const dayMeta = week.days.find((d) => d.dayNumber === 6) || week.days.at(-1);
  assert(dayMeta?.id, `r${round} day id`);
  const dayId = dayMeta.id;
  pass(`r${round} target day`, `${PROGRAM_SLUG} W${week.weekNumber}D${dayMeta.dayNumber} ${dayId}`);

  // Create 3 exercises + 3 workouts with TRIPLEDAYS names
  const parts = [
    { partIndex: 1, label: "AM Session", kind: "strength", name: `${tag} · AM strength` },
    { partIndex: 2, label: "Midday Session", kind: "cardio", name: `${tag} · midday fasted cardio` },
    { partIndex: 3, label: "PM Session", kind: "strength", name: `${tag} · PM strength` },
  ];

  for (const part of parts) {
    const ex = await req("/api/exercises", {
      method: "POST",
      json: {
        name: `${tag} · part${part.partIndex} movement`,
        tags: "tripledays,soak",
        description: `Soak part ${part.partIndex}`,
      },
    });
    assert(ex.res.status === 201 || ex.res.ok, `r${round} create ex part${part.partIndex}`, String(ex.res.status));
    created.exercises.push(ex.body.id);

    const w = await req("/api/workouts", {
      method: "POST",
      json: { name: part.name },
    });
    assert(w.res.status === 201 || w.res.ok, `r${round} create workout part${part.partIndex}`);
    created.workouts.push(w.body.id);
    part.workoutId = w.body.id;

    const add = await req(`/api/workouts/${w.body.id}/exercises`, {
      method: "POST",
      json: {
        exerciseId: ex.body.id,
        setScheme: "standard",
        sets: part.partIndex === 2 ? 1 : 3,
        reps: part.partIndex === 2 ? "20 min" : "10",
        weightTier: "light",
        restSec: 45,
        notes: `${MARK} part ${part.partIndex}`,
      },
    });
    assert(add.res.status === 201 || add.res.ok, `r${round} add line part${part.partIndex}`);
  }

  // Set partCount = 3
  const pc = await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { partCount: 3 },
  });
  assert(pc.res.ok, `r${round} set partCount 3`, `${pc.res.status} ${pc.text?.slice(0, 120)}`);
  assert(Number(pc.body.partCount) === 3, `r${round} partCount is 3`, String(pc.body.partCount));
  assert(
    Array.isArray(pc.body.sessions) && pc.body.sessions.length >= 3,
    `r${round} three sessions returned`,
    String(pc.body.sessions?.length),
  );
  pass(`r${round} sessions shells`, pc.body.sessions.map((s) => `P${s.partIndex}:${s.label}`).join(", "));

  // Assign one Gym workout per part
  for (const part of parts) {
    const patch = await req(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      json: {
        options: [
          {
            workoutId: part.workoutId,
            label: "Gym",
            trainingLocation: "gym",
            partIndex: part.partIndex,
            notes: `${tag} · coach note part ${part.partIndex}`,
          },
        ],
      },
    });
    assert(
      patch.res.ok,
      `r${round} assign part ${part.partIndex}`,
      `${patch.res.status} ${patch.text?.slice(0, 150)}`,
    );
  }

  // Re-read day via partCount patch no-op to get full shape
  const verify = await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { partCount: 3 },
  });
  assert(verify.res.ok, `r${round} re-read day`);
  const sessions = verify.body.sessions || [];
  assert(sessions.length >= 3, `r${round} still 3+ sessions`, String(sessions.length));

  for (const part of parts) {
    const sess = sessions.find((s) => s.partIndex === part.partIndex);
    assert(sess, `r${round} session part ${part.partIndex} exists`);
    const opts = sess.options || [];
    const gym = opts.find((o) => /gym/i.test(o.label || "") && o.workoutId === part.workoutId);
    assert(
      Boolean(gym || opts.some((o) => o.workoutId === part.workoutId)),
      `r${round} part ${part.partIndex} has TRIPLEDAYS workout`,
      JSON.stringify(opts.map((o) => o.workoutId)).slice(0, 80),
    );
  }

  // Flat options should include all three workout ids
  const flat = verify.body.options || [];
  for (const part of parts) {
    assert(
      flat.some((o) => o.workoutId === part.workoutId),
      `r${round} flat options include part ${part.partIndex}`,
    );
  }
  pass(`r${round} triple-day structure OK`);

  // Reset day to 1 part (cleanup structure) — only if parts have no other real content we care about
  // Clear our options first then partCount 1
  for (const part of parts) {
    await req(`/api/programs/days/${dayId}`, {
      method: "PATCH",
      json: {
        options: [],
        partIndex: part.partIndex, // may be ignored; empty options clears all when rows empty
      },
    }).catch(() => {});
  }
  // Explicit clear all options + partCount 1
  const clear = await req(`/api/programs/days/${dayId}`, {
    method: "PATCH",
    json: { options: [], partCount: 1 },
  });
  assert(clear.res.ok, `r${round} reset day partCount 1`);
  pass(`r${round} day reset`);

  // Delete soak workouts (hard not needed - workout delete)
  for (const id of created.workouts) {
    await req(`/api/workouts/${id}`, { method: "DELETE" }).catch(() => {});
  }
  for (const id of created.exercises) {
    await req(`/api/exercises/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/exercises/${id}?hard=1&force=1`, { method: "DELETE" }).catch(() => {});
  }

  // Sweep leftover TRIPLEDAYS workouts/exercises
  for (const path of ["/api/workouts", "/api/exercises?archive=all"]) {
    const list = await req(path);
    if (!list.res.ok || !Array.isArray(list.body)) continue;
    for (const row of list.body) {
      if (!String(row.name || "").includes(MARK)) continue;
      if (path.startsWith("/api/workouts")) {
        await req(`/api/workouts/${row.id}`, { method: "DELETE" });
      } else {
        await req(`/api/exercises/${row.id}`, { method: "DELETE" });
        await req(`/api/exercises/${row.id}?hard=1&force=1`, { method: "DELETE" });
      }
      console.log("  swept", row.name);
    }
  }

  pass(`r${round} cleanup done`);
}

async function main() {
  console.log(`\n🪖 ${MARK} SOAK`);
  console.log(`BASE: ${BASE}`);
  console.log(`PROGRAM: ${PROGRAM_SLUG}`);
  console.log(`ROUNDS: ${ROUNDS}\n`);

  const { req, loginCoach } = createCoachClient(BASE, {
    coachEmail: COACH_EMAIL,
    password: COACH_PASSWORD,
  });
  if (!(await loginCoach())) {
    console.error("Login failed");
    process.exit(1);
  }
  pass("Coach login", COACH_EMAIL);

  try {
    for (let r = 1; r <= ROUNDS; r++) {
      await runRound(req, r);
    }
    const failed = results.filter((x) => !x.ok);
    const report = {
      ok: failed.length === 0,
      mark: MARK,
      run: RUN,
      rounds: ROUNDS,
      program: PROGRAM_SLUG,
      pass: results.filter((x) => x.ok).length,
      fail: failed.length,
      results,
      at: new Date().toISOString(),
    };
    writeFileSync(
      new URL("./.tripledays-soak-latest.json", import.meta.url),
      JSON.stringify(report, null, 2),
    );
    console.log(
      failed.length
        ? `\n❌ ${MARK}: ${failed.length} failed\n`
        : `\n🎉 ${MARK} ALL PASSED (${results.filter((x) => x.ok).length} checks, ${ROUNDS} rounds)\n`,
    );
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error("\n💥", e.message);
    writeFileSync(
      new URL("./.tripledays-soak-latest.json", import.meta.url),
      JSON.stringify(
        { ok: false, mark: MARK, run: RUN, error: e.message, results, at: new Date().toISOString() },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

main();
