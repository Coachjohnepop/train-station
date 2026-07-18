#!/usr/bin/env node
/**
 * Prod soak: archive → restore → hard-delete (+ clone/paste).
 * Marker: MARSHMALLOW-BADGER
 *
 * Covers:
 *   - Exercises: create, hide from active list, GET by id still works, restore, 409 on hard-before-archive, forever delete
 *   - Templates: promote, archive shelf, restore, forever delete
 *   - Cycles: snapshot pack, archive, restore, forever delete
 *   - Clone independence (workout clone notes/sets)
 *   - Cleanup sweeps leftover MARK rows
 *
 *   BASE_URL=https://www.thetrainstation.co \
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *   node scripts/marshmallow-badger-soak.mjs
 */
import { createCoachClient } from "./lib/coach-auth.mjs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const MARK = "MARSHMALLOW-BADGER";
const RUN = Date.now().toString(36);
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const COACH_PASSWORD = process.env.COACH_PASSWORD || "LaserChickenSoak2026!";
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "2"));

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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runRound(req, round) {
  const tag = `${MARK} · r${round} · ${RUN}`;
  const created = {
    exercises: [],
    workouts: [],
    templates: [],
    cycles: [],
  };

  console.log(`\n── Round ${round}/${ROUNDS} · ${tag} ──\n`);

  // ── Exercises: create + archive lifecycle ──────────────────────────
  const exKeep = await req("/api/exercises", {
    method: "POST",
    json: {
      name: `${tag} · sticky marshmallow hold`,
      description: "kept on a workout while archived",
      tags: "marshmallow-badger,soak",
    },
  });
  assert(exKeep.res.status === 201, `r${round} create keep-ex`, String(exKeep.res.status));
  created.exercises.push(exKeep.body.id);

  const exGone = await req("/api/exercises", {
    method: "POST",
    json: {
      name: `${tag} · disposable fluff curl`,
      tags: "marshmallow-badger,soak",
    },
  });
  assert(exGone.res.status === 201, `r${round} create disposable-ex`);
  created.exercises.push(exGone.body.id);

  const w = await req("/api/workouts", {
    method: "POST",
    json: { name: `${tag} · source workout` },
  });
  assert(w.res.status === 201, `r${round} create source workout`);
  const sourceId = w.body.id;
  created.workouts.push(sourceId);

  for (const [id, notes, sets] of [
    [exKeep.body.id, "coach: toast gently", 3],
    [exGone.body.id, "coach: optional fluff", 2],
  ]) {
    const add = await req(`/api/workouts/${sourceId}/exercises`, {
      method: "POST",
      json: {
        exerciseId: id,
        setScheme: "standard",
        sets,
        reps: "10",
        weightTier: "medium",
        restSec: 45,
        notes,
      },
    });
    assert(add.res.status === 201, `r${round} add line`);
  }

  // Archive keep-ex → hidden from active, still on workout
  const archEx = await req(`/api/exercises/${exKeep.body.id}`, { method: "DELETE" });
  assert(
    archEx.res.ok && (archEx.body?.mode === "archived" || archEx.res.status === 200),
    `r${round} archive exercise`,
    `${archEx.res.status} ${JSON.stringify(archEx.body)?.slice(0, 80)}`,
  );

  const activeList = await req("/api/exercises?archive=active");
  assert(activeList.res.ok, `r${round} list active exercises`);
  assert(
    !(activeList.body || []).some((e) => e.id === exKeep.body.id),
    `r${round} archived ex hidden from active`,
  );

  const archList = await req("/api/exercises?archive=archived");
  assert(archList.res.ok, `r${round} list archived exercises`);
  assert(
    (archList.body || []).some((e) => e.id === exKeep.body.id),
    `r${round} archived ex on shelf`,
  );

  // GET by id still works (past workouts)
  const byId = await req(`/api/exercises/${exKeep.body.id}`);
  assert(byId.res.ok, `r${round} GET archived ex by id`);
  assert(byId.body?.archivedAt, `r${round} archivedAt set`);

  // Workout still has the exercise line
  let source = (await req(`/api/workouts/${sourceId}`)).body;
  assert(
    (source.exercises || []).some((line) => line.exerciseId === exKeep.body.id || line.exercise?.id === exKeep.body.id),
    `r${round} workout still refs archived ex`,
  );

  // Hard delete while not archived (disposable is still active) → 409
  const hardTooSoon = await req(`/api/exercises/${exGone.body.id}?hard=1`, {
    method: "DELETE",
  });
  assert(
    hardTooSoon.res.status === 409,
    `r${round} hard-delete active ex → 409`,
    String(hardTooSoon.res.status),
  );

  // Restore keep-ex
  const restEx = await req(`/api/exercises/${exKeep.body.id}`, {
    method: "PATCH",
    json: { action: "restore" },
  });
  assert(restEx.res.ok, `r${round} restore exercise`);
  assert(!restEx.body?.archivedAt, `r${round} restored archivedAt null`);

  const active2 = await req("/api/exercises?archive=active");
  assert(
    (active2.body || []).some((e) => e.id === exKeep.body.id),
    `r${round} restored ex back in active`,
  );

  // Re-archive + forever delete disposable (not on critical path after we remove it)
  await req(`/api/exercises/${exGone.body.id}`, { method: "DELETE" });
  const hardGone = await req(`/api/exercises/${exGone.body.id}?hard=1`, {
    method: "DELETE",
  });
  assert(hardGone.res.ok, `r${round} forever-delete exercise`, String(hardGone.res.status));
  created.exercises = created.exercises.filter((id) => id !== exGone.body.id);

  const goneCheck = await req(`/api/exercises/${exGone.body.id}`);
  assert(goneCheck.res.status === 404, `r${round} hard-deleted ex is 404`);

  // ── Clone independence ─────────────────────────────────────────────
  const cloneRes = await req(`/api/workouts/${sourceId}/clone`, {
    method: "POST",
    json: { name: `${tag} · clone` },
  });
  assert(cloneRes.res.status === 201, `r${round} clone workout`);
  const cloneId = cloneRes.body.id;
  created.workouts.push(cloneId);

  let clone = (await req(`/api/workouts/${cloneId}`)).body;
  assert((clone.exercises || []).length >= 1, `r${round} clone has lines`);

  if (clone.exercises?.[0]) {
    await req(`/api/workouts/${cloneId}/exercises`, {
      method: "PATCH",
      json: {
        itemId: clone.exercises[0].id,
        sets: 9,
        notes: "CLONE-ONLY-BADGER",
      },
    });
    source = (await req(`/api/workouts/${sourceId}`)).body;
    clone = (await req(`/api/workouts/${cloneId}`)).body;
    assert(
      !/CLONE-ONLY-BADGER/i.test(source.exercises?.[0]?.notes || ""),
      `r${round} source clean after clone edit`,
    );
    assert(
      /CLONE-ONLY-BADGER/i.test(clone.exercises?.[0]?.notes || ""),
      `r${round} clone notes updated`,
    );
    pass(`r${round} clone independence OK`);
  }

  // ── Template promote + archive shelf ───────────────────────────────
  const tmpl = await req("/api/workout-templates", {
    method: "POST",
    json: {
      sourceWorkoutId: sourceId,
      name: `${tag} · template`,
      category: "marshmallow-badger",
      versionLabel: "v_fluff",
    },
  });
  assert(tmpl.res.status === 201, `r${round} promote template`, tmpl.text?.slice(0, 100));
  created.templates.push(tmpl.body.id);
  if (tmpl.body.workoutId) created.workouts.push(tmpl.body.workoutId);

  const listActiveT = await req("/api/workout-templates?archive=active");
  assert(
    (listActiveT.body || []).some((t) => t.id === tmpl.body.id),
    `r${round} template in active library`,
  );

  const archT = await req(`/api/workout-templates/${tmpl.body.id}`, {
    method: "DELETE",
  });
  assert(archT.res.ok, `r${round} archive template`);
  assert(
    !(
      (await req("/api/workout-templates?archive=active")).body || []
    ).some((t) => t.id === tmpl.body.id),
    `r${round} template hidden when archived`,
  );
  assert(
    ((await req("/api/workout-templates?archive=archived")).body || []).some(
      (t) => t.id === tmpl.body.id,
    ),
    `r${round} template on archive shelf`,
  );

  // Archived template should not paste
  const summary = await req("/api/admin/programs-summary");
  assert(summary.res.ok, `r${round} programs-summary`);
  const adult = summary.body.programs.find((p) => p.slug === "adult");
  const week = adult.weeks.find((w) => w.weekNumber === 4) || adult.weeks.at(-1);
  const day = week.days.find((d) => d.dayNumber === 6) || week.days.at(-1);

  const pasteArchived = await req("/api/workout-templates/paste", {
    method: "POST",
    json: {
      templateId: tmpl.body.id,
      dayId: day.id,
      tracks: { gym: true, home: false },
      replace: true,
    },
  });
  assert(
    pasteArchived.res.status === 400 || pasteArchived.res.status === 409,
    `r${round} paste archived template blocked`,
    String(pasteArchived.res.status),
  );

  const restT = await req(`/api/workout-templates/${tmpl.body.id}`, {
    method: "PATCH",
    json: { action: "restore" },
  });
  assert(restT.res.ok, `r${round} restore template`);

  const paste = await req("/api/workout-templates/paste", {
    method: "POST",
    json: {
      templateId: tmpl.body.id,
      dayId: day.id,
      tracks: { gym: true, home: true },
      replace: true,
    },
  });
  assert(
    paste.res.status === 201,
    `r${round} paste gym+home after restore`,
    `${paste.res.status} ${paste.text?.slice(0, 120)}`,
  );
  if (paste.body?.gymWorkoutId) created.workouts.push(paste.body.gymWorkoutId);
  if (paste.body?.homeWorkoutId) created.workouts.push(paste.body.homeWorkoutId);

  // Re-archive + forever delete template
  await req(`/api/workout-templates/${tmpl.body.id}`, { method: "DELETE" });
  const hardT = await req(`/api/workout-templates/${tmpl.body.id}?hard=1`, {
    method: "DELETE",
  });
  assert(hardT.res.ok, `r${round} forever-delete template`);
  created.templates = created.templates.filter((id) => id !== tmpl.body.id);
  assert(
    !((await req("/api/workout-templates?archive=all")).body || []).some(
      (t) => t.id === tmpl.body.id,
    ),
    `r${round} template gone after hard delete`,
  );

  // ── 28-day pack archive lifecycle ──────────────────────────────────
  const snap = await req("/api/workout-cycles/snapshot", {
    method: "POST",
    json: {
      programSlug: "adult",
      cycleMonth: 1,
      name: `${tag} · pack`,
    },
  });
  assert(
    snap.res.status === 201 || snap.res.ok,
    `r${round} snapshot pack`,
    `${snap.res.status} ${snap.text?.slice(0, 120)}`,
  );
  const cycleId = snap.body?.id;
  if (cycleId) {
    created.cycles.push(cycleId);

    const activeC = await req("/api/workout-cycles?library=1&archive=active");
    assert(
      (activeC.body || []).some((c) => c.id === cycleId),
      `r${round} pack in active library`,
    );

    const archC = await req(`/api/workout-cycles/${cycleId}`, { method: "DELETE" });
    assert(archC.res.ok, `r${round} archive pack`);
    assert(
      !((await req("/api/workout-cycles?library=1&archive=active")).body || []).some(
        (c) => c.id === cycleId,
      ),
      `r${round} pack hidden when archived`,
    );
    assert(
      ((await req("/api/workout-cycles?library=1&archive=archived")).body || []).some(
        (c) => c.id === cycleId,
      ),
      `r${round} pack on archive shelf`,
    );

    const restC = await req(`/api/workout-cycles/${cycleId}`, {
      method: "PATCH",
      json: { action: "restore" },
    });
    assert(restC.res.ok, `r${round} restore pack`);

    await req(`/api/workout-cycles/${cycleId}`, { method: "DELETE" });
    const hardC = await req(`/api/workout-cycles/${cycleId}?hard=1`, {
      method: "DELETE",
    });
    assert(hardC.res.ok, `r${round} forever-delete pack`, String(hardC.res.status));
    created.cycles = created.cycles.filter((id) => id !== cycleId);
  }

  // ── Forever-delete the keep exercise (archive first) ───────────────
  await req(`/api/exercises/${exKeep.body.id}`, { method: "DELETE" });
  const hardKeep = await req(`/api/exercises/${exKeep.body.id}?hard=1`, {
    method: "DELETE",
  });
  assert(hardKeep.res.ok, `r${round} forever-delete keep-ex`);
  created.exercises = created.exercises.filter((id) => id !== exKeep.body.id);

  console.log(`\n── Cleanup round ${round} ──`);
  await cleanup(req, created);
  pass(`r${round} round complete`);
}

async function cleanup(req, created) {
  for (const id of created.templates || []) {
    await req(`/api/workout-templates/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/workout-templates/${id}?hard=1&force=1`, { method: "DELETE" }).catch(
      () => {},
    );
    console.log("  template", id);
  }
  for (const id of created.cycles || []) {
    await req(`/api/workout-cycles/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/workout-cycles/${id}?hard=1&force=1`, { method: "DELETE" }).catch(() => {});
    console.log("  cycle", id);
  }
  for (const id of [...new Set(created.workouts || [])].filter(Boolean)) {
    await req(`/api/workouts/${id}`, { method: "DELETE" }).catch(() => {});
    console.log("  workout", id);
  }
  for (const id of created.exercises || []) {
    await req(`/api/exercises/${id}`, { method: "DELETE" }).catch(() => {});
    await req(`/api/exercises/${id}?hard=1&force=1`, { method: "DELETE" }).catch(() => {});
    console.log("  exercise", id);
  }

  // Sweep MARK leftovers
  for (const path of [
    "/api/workout-templates?archive=all",
    "/api/workouts",
    "/api/exercises?archive=all",
    "/api/workout-cycles?library=1&archive=all",
  ]) {
    const list = await req(path);
    if (!list.res.ok || !Array.isArray(list.body)) continue;
    for (const row of list.body) {
      if (!String(row.name || "").includes(MARK)) continue;
      if (path.startsWith("/api/workout-templates")) {
        await req(`/api/workout-templates/${row.id}`, { method: "DELETE" });
        await req(`/api/workout-templates/${row.id}?hard=1&force=1`, {
          method: "DELETE",
        });
      } else if (path.startsWith("/api/workout-cycles")) {
        await req(`/api/workout-cycles/${row.id}`, { method: "DELETE" });
        await req(`/api/workout-cycles/${row.id}?hard=1&force=1`, {
          method: "DELETE",
        });
      } else if (path.startsWith("/api/workouts")) {
        await req(`/api/workouts/${row.id}`, { method: "DELETE" });
      } else {
        await req(`/api/exercises/${row.id}`, { method: "DELETE" });
        await req(`/api/exercises/${row.id}?hard=1&force=1`, { method: "DELETE" });
      }
      console.log("  swept", row.name);
    }
  }
}

async function main() {
  console.log(`\n🧸 ${MARK} SOAK`);
  console.log(`BASE: ${BASE}`);
  console.log(`ROUNDS: ${ROUNDS}`);
  console.log(`Naming: "${MARK} · rN · <runId> · …"\n`);

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
      if (r < ROUNDS) await sleep(1500);
    }

    // Final sweep
    await cleanup(req, { exercises: [], workouts: [], templates: [], cycles: [] });

    const failed = results.filter((x) => !x.ok);
    const report = {
      ok: failed.length === 0,
      mark: MARK,
      run: RUN,
      rounds: ROUNDS,
      base: BASE,
      pass: results.filter((x) => x.ok).length,
      fail: failed.length,
      results,
      at: new Date().toISOString(),
    };
    writeFileSync(
      new URL("./.marshmallow-badger-soak-latest.json", import.meta.url),
      JSON.stringify(report, null, 2),
    );
    console.log(
      failed.length
        ? `\n❌ ${MARK}: ${failed.length} failed / ${results.length} checks\n`
        : `\n🎉 ${MARK} ALL PASSED (${results.filter((x) => x.ok).length} checks, ${ROUNDS} rounds)\n`,
    );
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error("\n💥", e.message);
    try {
      await cleanup(req, { exercises: [], workouts: [], templates: [], cycles: [] });
    } catch (ce) {
      console.error("cleanup", ce.message);
    }
    writeFileSync(
      new URL("./.marshmallow-badger-soak-latest.json", import.meta.url),
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
