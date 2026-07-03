#!/usr/bin/env node
/**
 * Jeremy video — Test 1: Coach & content path (his #1 business blocker).
 * Persistence → program builder → catalog → bulk entry → Postgres catalog.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:jeremy-coach
 */

import { spawnSync } from "node:child_process";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const scripts = [
  "s1-exercise-persistence-test.mjs",
  "s1b-workout-persistence-test.mjs",
  "s2-program-builder-test.mjs",
  "s3-catalog-cleanup-test.mjs",
  "s4-bulk-entry-test.mjs",
  "s2e-catalog-db-test.mjs",
];

console.log(`\n══ Jeremy Video Test 1 — Coach & Content ══\nBASE: ${BASE}\n`);

let failed = 0;
for (const script of scripts) {
  const path = new URL(`./${script}`, import.meta.url).pathname;
  console.log(`\n── ${script} ──\n`);
  const res = spawnSync("node", [path], {
    stdio: "inherit",
    env: { ...process.env, BASE_URL: BASE },
  });
  if (res.status !== 0) failed += 1;
}

console.log(`\n══ Test 1 summary: ${scripts.length - failed}/${scripts.length} suites passed ══\n`);
process.exit(failed ? 1 : 0);