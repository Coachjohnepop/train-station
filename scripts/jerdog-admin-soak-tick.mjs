#!/usr/bin/env node
/**
 * Run one jerdog soak round. Use with `at` for durable hourly scheduling.
 *
 * Usage:
 *   JERDOG_ROUND=2 node scripts/jerdog-admin-soak-tick.mjs
 *   node scripts/jerdog-admin-soak-tick.mjs --schedule  # queue rounds 1..N via at
 *   node scripts/jerdog-admin-soak-tick.mjs --schedule-remaining  # queue 2..N (round 1 done)
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const runScript = join(scriptDir, "jerdog-admin-soak-run.mjs");
const cleanupScript = join(scriptDir, "cleanup-jerdog.mjs");
const statePath = join(scriptDir, ".jerdog-loop-state.json");
const logPath = join(scriptDir, ".jerdog-loop.log");

const ROUNDS = Math.max(1, Number(process.env.JERDOG_ROUNDS || process.env.ROUNDS || "4"));
const INTERVAL_MIN = Math.max(
  1,
  Math.round(
    Number(process.env.INTERVAL_MS || String(60 * 60 * 1000)) / 60_000,
  ),
);
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const COACH_EMAIL = process.env.COACH_EMAIL || "john@thetrainstation.co";
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "1";
const ROUND = Number(process.env.JERDOG_ROUND || "0");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(logPath, `${line}\n`);
}

function runNode(script, extraEnv = {}) {
  const isCleanup = script.endsWith("cleanup-jerdog.mjs");
  const cmd = isCleanup ? "npx" : "node";
  const args = isCleanup ? ["tsx", script] : [script];
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: projectRoot,
    env: {
      ...process.env,
      BASE_URL: BASE,
      COACH_EMAIL,
      ...extraEnv,
    },
  });
  return res.status === 0;
}

function loadState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function collectManifests() {
  const files = readdirSync(scriptDir).filter(
    (f) => f.startsWith(".jerdog-manifest-") && f.endsWith(".json"),
  );
  const rounds = [];
  for (const file of files.sort()) {
    try {
      rounds.push(JSON.parse(readFileSync(join(scriptDir, file), "utf8")));
    } catch {
      // skip
    }
  }
  return rounds;
}

function writeFinalReport(roundSummaries) {
  const totalPass = roundSummaries.reduce((n, r) => n + r.passed, 0);
  const totalFail = roundSummaries.reduce((n, r) => n + r.failed, 0);
  const allFailedTests = roundSummaries.flatMap((r) =>
    (r.results || []).filter((t) => !t.ok).map((t) => ({ round: r.runId, ...t })),
  );

  const report = {
    marker: "jerdog",
    base: BASE,
    rounds: ROUNDS,
    intervalMin: INTERVAL_MIN,
    completedAt: new Date().toISOString(),
    totalChecksPassed: totalPass,
    totalChecksFailed: totalFail,
    roundSummaries: roundSummaries.map((r) => ({
      runId: r.runId,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      passed: r.passed,
      failed: r.failed,
    })),
    failures: allFailedTests,
  };

  const outPath = join(scriptDir, ".jerdog-final-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  log(`Final report: scripts/.jerdog-final-report.json (${totalPass} ok, ${totalFail} fail)`);
  return report;
}

function tickCommand(round) {
  const env = [
    `BASE_URL=${BASE}`,
    `COACH_EMAIL=${COACH_EMAIL}`,
    `JERDOG_ROUND=${round}`,
    `JERDOG_ROUNDS=${ROUNDS}`,
    `INTERVAL_MS=${INTERVAL_MIN * 60_000}`,
  ];
  if (SKIP_CLEANUP) env.push("SKIP_CLEANUP=1");
  return `cd ${projectRoot} && ${env.join(" ")} node scripts/jerdog-admin-soak-tick.mjs >> scripts/.jerdog-loop.log 2>&1`;
}

function scheduleRound(round, delayMin) {
  const cmd = tickCommand(round);
  const res = spawnSync("bash", ["-c", `echo ${JSON.stringify(cmd)} | at now + ${delayMin} minutes`], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    log(`FAILED to schedule round ${round}: ${res.stderr || res.stdout}`);
    return false;
  }
  const job = (res.stdout || res.stderr || "").trim();
  log(`Scheduled round ${round} in ${delayMin} min — ${job}`);
  return true;
}

function scheduleAll(startRound = 1) {
  log(`Scheduling rounds ${startRound}..${ROUNDS} via at (${INTERVAL_MIN} min apart)`);
  const jobs = [];
  for (let round = startRound; round <= ROUNDS; round++) {
    const delayMin = Math.max(1, (round - 1) * INTERVAL_MIN);
    if (!scheduleRound(round, delayMin)) return false;
    jobs.push({ round, delayMin });
  }
  saveState({
    base: BASE,
    coachEmail: COACH_EMAIL,
    rounds: ROUNDS,
    intervalMin: INTERVAL_MIN,
    scheduledAt: new Date().toISOString(),
    startRound,
    jobs,
  });
  return true;
}

async function runRound(round) {
  log(`\n########## Round ${round}/${ROUNDS} ##########`);
  if (round === 1) {
    log("Pre-clean leftover jerdog rows…");
    runNode(cleanupScript);
  }

  const runId = `r${round}-${Date.now()}`;
  const ok = runNode(runScript, { JERDOG_RUN_ID: runId });
  if (!ok) log(`Round ${round} FAILED — see manifest`);

  const state = loadState() || {};
  state.lastCompletedRound = round;
  state.lastRunId = runId;
  state.lastFinishedAt = new Date().toISOString();
  saveState(state);

  if (round >= ROUNDS) {
    if (!SKIP_CLEANUP) {
      log("Final jerdog cleanup…");
      runNode(cleanupScript);
    }
    writeFinalReport(collectManifests());
  }
}

const arg = process.argv[2];

if (arg === "--schedule") {
  if (!scheduleAll(1)) process.exit(1);
  log("All rounds queued. Check: atq");
  process.exit(0);
}

if (arg === "--schedule-remaining") {
  const start = Number(process.env.JERDOG_START_ROUND || "2");
  if (!scheduleAll(start)) process.exit(1);
  log(`Rounds ${start}..${ROUNDS} queued. Check: atq`);
  process.exit(0);
}

if (!ROUND || ROUND < 1) {
  console.error("Set JERDOG_ROUND=1..N or use --schedule / --schedule-remaining");
  process.exit(1);
}

runRound(ROUND).catch((e) => {
  log(`fatal: ${e.message}`);
  process.exit(1);
});