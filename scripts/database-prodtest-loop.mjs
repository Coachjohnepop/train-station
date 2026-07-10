#!/usr/bin/env node
/**
 * Full Postgres migration prodtest loop — runs API + DB smoke suites for every
 * blob→Postgres store and core catalog tables.
 *
 * All write tests use MARKER "prodtest" (see cleanup-database-prodtest.mjs).
 *
 * Usage:
 *   BASE_URL=https://www.thetrainstation.co npm run test:database-prodtest-loop
 *   SKIP_WRITE=1 npm run test:database-prodtest-loop   # read-only suites only
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");
const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
const RUN_ID = Date.now();
const MARKER = process.env.TEST_MARKER || "prodtest";
const SKIP_WRITE = process.env.SKIP_WRITE === "1" || process.env.SKIP_WRITE === "true";

const STORE_LABELS = [
  "registered-accounts",
  "member-profiles",
  "sms-workouts",
  "oauth-identities",
  "password-reset-tokens",
  "coach-chat",
  "live-workout-sessions",
  "coach-settings",
  "member-coach-prefs",
  "commission-ledger",
  "commission-partners",
  "referral-codes",
  "stripe-webhook-events",
  "waitlist",
  "custom-training-offers",
];

const SUITES = [
  {
    name: "blob-migration-loop",
    stores: STORE_LABELS,
    cmd: "npm",
    args: ["run", "test:blob-migration-loop"],
    needsDb: true,
  },
  {
    name: "jeremy-migration",
    stores: [
      "registered-accounts",
      "member-profiles",
      "coach-chat",
      "sms-workouts",
      "live-workout-sessions",
      "coach-settings",
      "member-coach-prefs",
      "commission-ledger",
      "commission-partners",
      "referral-codes",
      "waitlist",
      "custom-training-offers",
    ],
    cmd: "npm",
    args: ["run", "test:jeremy-migration"],
    skipWhenReadOnly: false,
  },
  {
    name: "lesson-plan-prod",
    stores: ["sms-workouts"],
    cmd: "npm",
    args: ["run", "test:lesson-plan-prod"],
    env: { TEST_MARKER: `${MARKER}-lesson-${RUN_ID}` },
    skipWhenReadOnly: true,
  },
  {
    name: "program-order",
    stores: ["sms-workouts"],
    cmd: "npm",
    args: ["run", "test:program-order"],
    skipWhenReadOnly: true,
  },
  {
    name: "s3a-enrollment",
    stores: ["registered-accounts", "member-profiles"],
    cmd: "npm",
    args: ["run", "test:s3a"],
  },
  {
    name: "s3b-workout-logs",
    stores: ["sms-workouts"],
    cmd: "npm",
    args: ["run", "test:s3b"],
    skipWhenReadOnly: true,
  },
  {
    name: "s3c-today-sessions",
    stores: ["live-workout-sessions"],
    cmd: "npm",
    args: ["run", "test:s3c"],
    skipWhenReadOnly: true,
  },
  {
    name: "s2e-catalog-db",
    stores: ["sms-workouts"],
    cmd: "npm",
    args: ["run", "test:s2e"],
    skipWhenReadOnly: true,
  },
  {
    name: "catalog-smoke",
    stores: ["sms-workouts"],
    cmd: "npm",
    args: ["run", "test:catalog-smoke"],
  },
];

function runSuite(suite) {
  if (SKIP_WRITE && suite.skipWhenReadOnly) {
    return { suite: suite.name, ok: true, skipped: true, detail: "SKIP_WRITE=1" };
  }

  const env = {
    ...process.env,
    BASE_URL: BASE,
    TEST_MARKER: MARKER,
    COACH_EMAIL: process.env.COACH_EMAIL || "jeremy@thetrainstation.co",
    ...suite.env,
  };

  const started = Date.now();
  const result = spawnSync(suite.cmd, suite.args, {
    cwd: projectRoot,
    env,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const exitCode = result.status ?? 1;
  const passed = stdout.match(/✅/g)?.length ?? 0;
  const failed = stdout.match(/❌/g)?.length ?? 0;

  return {
    suite: suite.name,
    stores: suite.stores,
    ok: exitCode === 0,
    exitCode,
    passed,
    failed,
    durationMs: Date.now() - started,
    stdoutTail: stdout.slice(-2500),
    stderrTail: stderr.slice(-800),
  };
}

async function main() {
  console.log(`\n══ Database prodtest loop ══`);
  console.log(`BASE: ${BASE}`);
  console.log(`MARKER: ${MARKER}`);
  console.log(`RUN_ID: ${RUN_ID}`);
  console.log(`SKIP_WRITE: ${SKIP_WRITE}`);
  console.log(`Stores: ${STORE_LABELS.length} blob-migration + catalog\n`);

  const results = [];
  for (const suite of SUITES) {
    process.stdout.write(`▶ ${suite.name} … `);
    const r = runSuite(suite);
    results.push(r);
    if (r.skipped) {
      console.log(`○ skipped (${r.detail})`);
    } else if (r.ok) {
      console.log(`✅ ${r.passed} checks (${r.durationMs}ms)`);
    } else {
      console.log(`❌ exit ${r.exitCode} — ${r.failed} failures (${r.durationMs}ms)`);
    }
  }

  const report = {
    marker: MARKER,
    runId: RUN_ID,
    base: BASE,
    skipWrite: SKIP_WRITE,
    stores: STORE_LABELS,
    finishedAt: new Date().toISOString(),
    suites: results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.ok && !r.skipped).length,
      failed: results.filter((r) => !r.ok && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
    },
  };

  const reportPath = join(scriptDir, `.database-prodtest-results-${RUN_ID}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n══ Summary ══`);
  console.log(`Suites: ${report.summary.passed}/${report.summary.total - report.summary.skipped} passed`);
  if (report.summary.skipped) console.log(`Skipped: ${report.summary.skipped}`);
  if (report.summary.failed) {
    console.log(`Failed: ${report.summary.failed}`);
    for (const r of results.filter((x) => !x.ok && !x.skipped)) {
      console.log(`  ❌ ${r.suite} (exit ${r.exitCode})`);
      if (r.stdoutTail) {
        const lines = r.stdoutTail.split("\n").filter((l) => l.includes("❌"));
        for (const line of lines.slice(-5)) console.log(`     ${line.trim()}`);
      }
    }
  }
  console.log(`\nReport: ${reportPath}\n`);

  if (report.summary.failed > 0) process.exit(1);
  console.log("✅ database-prodtest-loop passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});