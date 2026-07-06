#!/usr/bin/env node
/**
 * Run jerdog admin soak every hour for 4 hours, then cleanup and report.
 *
 * Usage:
 *   COACH_EMAIL=john@thetrainstation.co BASE_URL=https://www.thetrainstation.co \
 *     node scripts/jerdog-admin-soak-loop.mjs
 *
 * Env:
 *   ROUNDS=4 (default)
 *   INTERVAL_MS=3600000 (1 hour)
 *   SKIP_CLEANUP=1 — leave data for manual inspection
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "4"));
const INTERVAL_MS = Math.max(60_000, Number(process.env.INTERVAL_MS || String(60 * 60 * 1000)));
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "1";

const scriptDir = new URL(".", import.meta.url).pathname;
const runScript = `${scriptDir}/jerdog-admin-soak-run.mjs`;
const cleanupScript = `${scriptDir}/cleanup-jerdog.mjs`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runNode(script, extraEnv = {}) {
  const isCleanup = script.endsWith("cleanup-jerdog.mjs");
  const cmd = isCleanup ? "npx" : "node";
  const args = isCleanup ? ["tsx", script] : [script];
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, BASE_URL: BASE, ...extraEnv },
  });
  return res.status === 0;
}

function collectManifests() {
  const files = readdirSync(scriptDir).filter(
    (f) => f.startsWith(".jerdog-manifest-") && f.endsWith(".json"),
  );
  const rounds = [];
  for (const file of files.sort()) {
    try {
      rounds.push(JSON.parse(readFileSync(`${scriptDir}/${file}`, "utf8")));
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
    intervalMs: INTERVAL_MS,
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

  const outPath = `${scriptDir}/.jerdog-final-report.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n========================================");
  console.log("JERDOG SOAK FINAL REPORT");
  console.log("========================================");
  console.log(`Rounds: ${ROUNDS} · Interval: ${INTERVAL_MS / 60000} min`);
  console.log(`Checks: ${totalPass} passed, ${totalFail} failed`);
  for (const r of report.roundSummaries) {
    console.log(`  · ${r.runId}: ${r.passed} ok, ${r.failed} fail`);
  }
  if (allFailedTests.length) {
    console.log("\nFailures:");
    for (const f of allFailedTests) {
      console.log(`  · [${f.round}] ${f.name}: ${f.detail}`);
    }
  } else {
    console.log("\nAll rounds green — no failures.");
  }
  console.log(`\nFull report: scripts/.jerdog-final-report.json\n`);
}

async function main() {
  console.log(`\njerdog soak loop — ${ROUNDS} rounds, ${INTERVAL_MS / 60000} min apart\nBASE: ${BASE}\n`);

  console.log("Pre-clean any leftover jerdog rows…\n");
  runNode(cleanupScript);

  for (let round = 1; round <= ROUNDS; round++) {
    const runId = `r${round}-${Date.now()}`;
    console.log(`\n########## Round ${round}/${ROUNDS} (${runId}) ##########\n`);
    const ok = runNode(runScript, { JERDOG_RUN_ID: runId });
    if (!ok) {
      console.error(`\nRound ${round} FAILED — continuing loop to surface more issues.\n`);
    }
    if (round < ROUNDS) {
      console.log(`\nSleeping ${INTERVAL_MS / 60000} minutes until next round…\n`);
      await sleep(INTERVAL_MS);
    }
  }

  if (!SKIP_CLEANUP) {
    console.log("\nFinal jerdog cleanup…\n");
    runNode(cleanupScript);
  } else {
    console.log("\nSKIP_CLEANUP=1 — jerdog rows left in DB for inspection.\n");
  }

  const summaries = collectManifests();
  writeFinalReport(summaries);
  const anyFail = summaries.some((r) => r.failed > 0);
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});