#!/usr/bin/env node
/**
 * Task 9 — smoke tests after catalog cleanup (Tasks 6–7).
 *
 * Local: Lower Day SMS parse + prescription phases.
 * Prod:  exercise/workout counts, junk hidden, Lower Day + Leg Press, program catalog.
 *
 * Usage:
 *   node scripts/catalog-post-cleanup-smoke.mjs
 *   BASE_URL=https://www.thetrainstation.co npm run test:catalog-smoke
 *   npm run test:catalog-smoke -- --full   # also run test:s3 + test:s2e
 */

import { spawnSync } from "node:child_process";
import { createCoachClient } from "./lib/coach-auth.mjs";

/** Mirror src/lib/programs.ts — junk workouts must not appear in admin list. */
function isJunkWorkoutName(name) {
  const n = String(name || "").trim();
  const lower = n.toLowerCase();
  if (/\bqa\b/.test(lower) || /\bqa[-_]/.test(lower) || /\bsmoke\b/.test(lower)) return true;
  if (/^s1b-workout/i.test(n)) return true;
  if (/^s2-\d+/i.test(n)) return true;
  if (/^s1c-/i.test(n)) return true;
  if (/^s34-/i.test(n)) return true;
  if (/copy-week/i.test(n)) return true;
  if (/^gym$/i.test(n)) return true;
  if (/day test showing/i.test(n)) return true;
  if (/^adult strength conditioning ·/i.test(n)) return true;
  if (/^totally fake/i.test(n)) return true;
  if (/^qa workout/i.test(n)) return true;
  return false;
}

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const LOWER_DAY_ID = process.env.LOWER_DAY_ID || "cmr6okj25000004jlh7a4bdlu";
const LEG_PRESS_ID = process.env.LEG_PRESS_ID || "cmr7wjntw000004jsp1eqtz32";

const EXPECT = {
  exercisesMin: Number(process.env.EXPECT_EXERCISES_MIN || 50),
  workoutsVisibleMin: Number(process.env.EXPECT_WORKOUTS_MIN || 40),
  lowerDayBlocksMin: Number(process.env.EXPECT_LOWER_DAY_BLOCKS_MIN || 8),
  programsMin: Number(process.env.EXPECT_PROGRAMS_MIN || 1),
};

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail, level: "required" });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail, level: "required" });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  results.push({ name, ok: false, detail, level: "warn" });
  console.log(`⚠️ ${name}${detail ? ` — ${detail}` : ""}`);
}

function bust(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_t=${Date.now()}`;
}

function runLocal(script, label) {
  const scriptPath = new URL(`./${script}`, import.meta.url).pathname;
  const res = spawnSync("npx", ["tsx", scriptPath], { stdio: "pipe", encoding: "utf8" });
  if (res.status === 0) {
    pass(label, script);
    return true;
  }
  fail(label, res.stderr?.trim() || res.stdout?.trim() || `exit ${res.status}`);
  return false;
}

function runNpmScript(script, label) {
  const res = spawnSync("npm", ["run", script], {
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, BASE_URL: BASE, SKIP_CATALOG_IMPORT: "1" },
  });
  if (res.status === 0) {
    pass(label, script);
    return true;
  }
  fail(label, res.stderr?.split("\n").slice(-3).join(" ").trim() || `exit ${res.status}`);
  return false;
}

async function verifyProd() {
  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach({ onPass: pass, onFail: fail }))) return false;

  const statusRes = await req(bust("/api/admin/catalog/status"));
  if (!statusRes.res.ok || !statusRes.body?.counts) {
    fail("Catalog status API", `${statusRes.res.status}`);
    return false;
  }
  const { exercises, workouts } = statusRes.body.counts;
  if (statusRes.body.storage === "database") pass("Catalog storage", "Postgres");
  else fail("Catalog storage", statusRes.body.storage || "unknown");

  if (exercises >= EXPECT.exercisesMin) {
    pass("Exercise count (DB)", `${exercises} (min ${EXPECT.exercisesMin})`);
  } else {
    fail("Exercise count (DB)", `${exercises} (expected ≥ ${EXPECT.exercisesMin})`);
  }

  const exRes = await req(bust("/api/exercises"));
  if (!exRes.res.ok || !Array.isArray(exRes.body)) {
    fail("GET /api/exercises", `${exRes.res.status}`);
  } else {
    pass("GET /api/exercises", `${exRes.body.length} listed`);
    if (exRes.body.length !== exercises) {
      warn("Exercise list vs DB count", `api=${exRes.body.length} db=${exercises}`);
    }

    const legPress = exRes.body.find((e) => e.id === LEG_PRESS_ID || e.name === "Leg Press Machine");
    if (legPress?.name === "Leg Press Machine") pass("Leg Press Machine in catalog", legPress.id);
    else fail("Leg Press Machine in catalog", legPress?.name || "missing");

    const repsInName = exRes.body.filter((e) => /\d+\s*(reps?|sets?)\b/i.test(e.name) || /\bx\d+\b/i.test(e.name));
    if (repsInName.length === 0) pass("Exercise names clean (no reps/sets in title)");
    else fail("Exercise names clean", repsInName.map((e) => e.name).join(", "));

    const byLower = new Map();
    for (const e of exRes.body) {
      const k = e.name.toLowerCase();
      if (!byLower.has(k)) byLower.set(k, []);
      byLower.get(k).push(e);
    }
    const dupeGroups = [...byLower.values()].filter((g) => g.length > 1);
    if (dupeGroups.length === 0) pass("No duplicate exercise names");
    else warn("Duplicate exercise names (case-insensitive)", `${dupeGroups.length} group(s)`);
  }

  const wRes = await req(bust("/api/workouts"));
  if (!wRes.res.ok || !Array.isArray(wRes.body)) {
    fail("GET /api/workouts", `${wRes.res.status}`);
  } else {
    const visible = wRes.body.length;
    if (visible >= EXPECT.workoutsVisibleMin) {
      pass("Visible workout count", `${visible} (min ${EXPECT.workoutsVisibleMin})`);
    } else {
      fail("Visible workout count", `${visible} (expected ≥ ${EXPECT.workoutsVisibleMin})`);
    }

    const junkVisible = wRes.body.filter((w) => isJunkWorkoutName(w.name));
    if (junkVisible.length === 0) pass("Junk workouts hidden from API");
    else fail("Junk workouts hidden", junkVisible.map((w) => w.name).join(", "));

    const lowerListed = wRes.body.find((w) => w.id === LOWER_DAY_ID);
    if (lowerListed?.name === "Lower Day") pass("Lower Day in workout list");
    else fail("Lower Day in workout list", lowerListed?.name || "missing");
  }

  const lowerRes = await req(bust(`/api/workouts/${LOWER_DAY_ID}`));
  if (!lowerRes.res.ok) {
    fail("GET Lower Day workout", `${lowerRes.res.status}`);
  } else {
    const blocks = lowerRes.body?.exercises?.length ?? 0;
    if (blocks >= EXPECT.lowerDayBlocksMin) {
      pass("Lower Day block count", `${blocks} (min ${EXPECT.lowerDayBlocksMin})`);
    } else {
      fail("Lower Day block count", `expected ≥ ${EXPECT.lowerDayBlocksMin}, got ${blocks}`);
    }

    const legInWorkout = (lowerRes.body?.exercises || []).some(
      (row) => row.exerciseId === LEG_PRESS_ID,
    );
    if (legInWorkout) pass("Lower Day uses Leg Press Machine");
    else fail("Lower Day uses Leg Press Machine", "exercise row not found");
  }

  const programsRes = await req(bust("/api/programs"));
  if (!programsRes.res.ok || !Array.isArray(programsRes.body)) {
    fail("GET /api/programs", `${programsRes.res.status}`);
  } else if (programsRes.body.length >= EXPECT.programsMin) {
    const adult = programsRes.body.find((p) => p.slug === "adult");
    if (adult) pass("Program catalog", `${programsRes.body.length} programs (adult present)`);
    else fail("Program catalog", `${programsRes.body.length} programs but adult missing`);
  } else {
    fail("Program catalog count", `${programsRes.body.length} (expected ≥ ${EXPECT.programsMin})`);
  }

  return true;
}

async function main() {
  console.log(`\nCatalog post-cleanup smoke → ${BASE}${FULL ? " (full)" : ""}\n`);

  console.log("── Local parse regressions ──\n");
  runLocal("sms-lower-day-parse-test.mjs", "Lower Day SMS blocks");
  runLocal("test-prescription-parse.mjs", "Lower Day prescription phases");

  console.log("\n── Prod catalog invariants ──\n");
  await verifyProd();

  if (FULL) {
    console.log("\n── Extended catalog suites ──\n");
    runNpmScript("test:s3", "S3 program visibility");
    runNpmScript("test:s2e", "S2e Postgres catalog");
  }

  const required = results.filter((r) => r.level === "required");
  const warnings = results.filter((r) => r.level === "warn" && !r.ok);
  const failed = required.filter((r) => !r.ok);

  console.log(`\n${required.length - failed.length}/${required.length} required passed`);
  if (warnings.length) {
    console.log(`${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w.name}: ${w.detail}`);
  }
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});