#!/usr/bin/env node
/**
 * Persistence soak — run S1 + S1b repeatedly to catch flaky blob/demo saves.
 *
 * Usage:
 *   npm run test:persistence-soak
 *   BASE_URL=https://preview.vercel.app ROUNDS=5 npm run test:persistence-soak
 */

import { spawnSync } from "node:child_process";

const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "3"));
const GAP_MS = Math.max(0, Number(process.env.SOAK_GAP_MS || "5000"));
const BASE = process.env.BASE_URL || "http://localhost:3000";

function runScript(scriptPath) {
  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    env: { ...process.env, BASE_URL: BASE },
  });
  return result.status === 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\nPersistence soak — ${ROUNDS} round(s)\nBASE: ${BASE}\nGap: ${GAP_MS}ms\n`);

  const scripts = [
    new URL("./s1-exercise-persistence-test.mjs", import.meta.url).pathname,
    new URL("./s1b-workout-persistence-test.mjs", import.meta.url).pathname,
  ];

  if (process.env.SOAK_DB === "1") {
    scripts.push(
      new URL("./s3a-enrollment-db-test.mjs", import.meta.url).pathname,
      new URL("./s3b-workout-logs-db-test.mjs", import.meta.url).pathname,
      new URL("./s3c-today-sessions-db-test.mjs", import.meta.url).pathname,
      new URL("./s7-landing-brand-test.mjs", import.meta.url).pathname,
    );
  }

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n=== Round ${round}/${ROUNDS} ===\n`);
    for (const script of scripts) {
      const name = script.split("/").pop();
      console.log(`--- ${name} ---\n`);
      const ok = runScript(script);
      if (!ok) {
        console.error(`\nSoak FAILED on round ${round} (${name})\n`);
        process.exit(1);
      }
    }
    if (round < ROUNDS && GAP_MS > 0) {
      console.log(`\nWaiting ${GAP_MS}ms before next round…\n`);
      await sleep(GAP_MS);
    }
  }

  const suite = process.env.SOAK_DB === "1"
    ? "S1 + S1b + S3a + S3b + S3c + S7"
    : "S1 + S1b";
  console.log(`\nSoak PASSED — ${ROUNDS} round(s), all ${suite} checks green.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});