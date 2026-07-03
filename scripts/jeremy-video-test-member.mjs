#!/usr/bin/env node
/**
 * Jeremy video — Test 2: Member, money & trust path.
 * Payments → catalog/preview/booking → landing brand → member progress on Postgres.
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:jeremy-member
 */

import { spawnSync } from "node:child_process";

const BASE = process.env.BASE_URL || "https://www.thetrainstation.co";
const scripts = [
  "s5-payments-test.mjs",
  "test-s3-s6.mjs",
  "s7-landing-brand-test.mjs",
  "s3b-workout-logs-db-test.mjs",
  "s3c-today-sessions-db-test.mjs",
];

console.log(`\n══ Jeremy Video Test 2 — Member, Money & Trust ══\nBASE: ${BASE}\n`);

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

console.log(`\n══ Test 2 summary: ${scripts.length - failed}/${scripts.length} suites passed ══\n`);
process.exit(failed ? 1 : 0);