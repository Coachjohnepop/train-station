#!/usr/bin/env node
/**
 * Saturday fun workout for John + Stephanie + Katie (prod blob).
 *
 *   node scripts/seed-saturday-fun-workout-prod.mjs
 *   node scripts/seed-saturday-fun-workout-prod.mjs 2026-07-04
 */
import { createRequire } from "module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const SESSION_DATE = process.argv[2] || "2026-07-04";

const FUN_DAY_SMS = `Saturday Fun Day

Warm-up (bonus points if done before coach arrives)
5 min bike, row, or brisk walk
Wall taps 20
Band pull-aparts 15
Lightweight bicep curls 15
Light shoulder press 15
Shrugs 15
Bosu ball squats 10
Jump squats 10

Sexy boob lifts
10,10,10

Slap that ass hardening
12,12,12,12

Let's keep our intestines functioning
15,15,15`;

/** Prod member emails → resolved at runtime from registered-accounts blob */
const TARGET_EMAILS = [
  "john@bcxvoice.com",
  "sprealty9@gmail.com",
  "kaite@thetrainstation.co",
];

async function resolveUserIds() {
  const { listSelfRegisteredAccounts } = await import("../src/lib/member-accounts-store.ts");
  const accounts = await listSelfRegisteredAccounts();
  const ids = [];
  const found = [];
  for (const email of TARGET_EMAILS) {
    const row = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (row?.account?.userId) {
      ids.push(row.account.userId);
      found.push(`${row.account.name || email} (${row.account.userId})`);
    } else {
      console.warn(`⚠ Member not found: ${email}`);
    }
  }
  if (ids.length === 0) {
    throw new Error("No target members found in registered-accounts blob.");
  }
  return { ids, found };
}

async function main() {
  const { createTodaySessionFromSms } = await import("../src/lib/today-sessions.ts");
  const { parseSmsWorkout } = await import("../src/lib/sms-workout-parser.ts");

  const { ids, found } = await resolveUserIds();
  const scheduled = new Date(`${SESSION_DATE}T09:00:00`);

  const parsed = parseSmsWorkout(FUN_DAY_SMS);
  const result = await createTodaySessionFromSms({
    sessionDate: SESSION_DATE,
    scheduledAt: scheduled.toISOString(),
    rawSms: FUN_DAY_SMS,
    programSlug: "adult",
    userIds: ids,
    replacesSchedule: true,
    createdBy: "seed-saturday-fun",
    title: "Saturday Fun Day",
  });

  const base = "https://www.thetrainstation.co";
  console.log(`\n✓ Saturday Fun Day assigned for ${SESSION_DATE}`);
  console.log(`  Members: ${found.join(", ")}`);
  console.log(`  Session: ${result.session.id}`);
  console.log(`  Workout: ${result.workoutId}`);
  console.log(`  Blocks: ${result.parsed.exercises.length}`);
  for (const ex of result.parsed.exercises) {
    console.log(`    · ${ex.name} (${ex.sets}× ${ex.reps})`);
  }
  console.log(`\n── Links (forward to students) ──`);
  console.log(`Coach class:  ${base}/admin/day?date=${SESSION_DATE}`);
  console.log(`Coach plan:   ${base}/admin/day?plan=1`);
  for (const line of found) {
    const id = line.match(/\((member-[^)]+)\)/)?.[1];
    if (id) {
      console.log(`Member:       ${base}/member/today?date=${SESSION_DATE}`);
      break;
    }
  }
  console.log(`Member today: ${base}/member/today?date=${SESSION_DATE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});