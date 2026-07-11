#!/usr/bin/env node
/**
 * Builder hardening loop — exercises, workouts, program builder, copy-week.
 *
 * Usage:
 *   COACH_EMAIL=john@thetrainstation.co COACH_PASSWORD='…' \
 *     BASE_URL=https://www.thetrainstation.co node scripts/builder-soak-loop.mjs
 *
 * Env:
 *   ROUNDS=3 (default)
 *   INTERVAL_MS=3000 gap between rounds
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "3"));
const INTERVAL_MS = Math.max(0, Number(process.env.INTERVAL_MS || "3000"));
const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const scriptDir = new URL(".", import.meta.url).pathname;

const SCRIPTS = [
  "s1-exercise-persistence-test.mjs",
  "s1b-workout-persistence-test.mjs",
  "jeremy-program-builder-prodtest.mjs",
  "s1d-program-builder-test.mjs",
  "s2-program-builder-test.mjs",
  "jerdog-admin-soak-run.mjs",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runScript(name, round) {
  const path = `${scriptDir}/${name}`;
  const res = spawnSync("node", [path], {
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: BASE,
      TEST_MARKER: `builder-soak-r${round}-${Date.now()}`,
      JERDOG_RUN_ID: `builder-soak-r${round}-${Date.now()}`,
    },
  });
  return res.status === 0;
}

async function main() {
  console.log(`\nBuilder soak loop — ${ROUNDS} round(s)`);
  console.log(`BASE: ${BASE}`);
  console.log(`Scripts: ${SCRIPTS.join(", ")}\n`);

  const summary = [];

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n========== Round ${round}/${ROUNDS} ==========\n`);
    const roundResult = { round, scripts: [], ok: true };

    for (const script of SCRIPTS) {
      console.log(`\n--- ${script} ---\n`);
      const ok = runScript(script, round);
      roundResult.scripts.push({ script, ok });
      if (!ok) {
        roundResult.ok = false;
        console.error(`\nBuilder soak FAILED: round ${round}, ${script}\n`);
        writeFileSync(
          `${scriptDir}/.builder-soak-latest.json`,
          JSON.stringify({ summary, failed: roundResult }, null, 2),
        );
        process.exit(1);
      }
    }

    summary.push(roundResult);
    if (round < ROUNDS && INTERVAL_MS > 0) {
      console.log(`\nWaiting ${INTERVAL_MS}ms…\n`);
      await sleep(INTERVAL_MS);
    }
  }

  writeFileSync(
    `${scriptDir}/.builder-soak-latest.json`,
    JSON.stringify({ base: BASE, rounds: ROUNDS, summary, completedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`\nBuilder soak: ${ROUNDS}/${ROUNDS} rounds PASS`);
  console.log(`Report: scripts/.builder-soak-latest.json\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});