#!/usr/bin/env node
/**
 * Assign today's Lower Day workout to John + Stephanie (prod blob).
 *
 *   node scripts/seed-lower-day-today-prod.mjs
 */
import { createRequire } from "module";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { blobOptions } from "./remove-member-email.mjs";

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

const { parseSmsWorkout } = await import("../src/lib/sms-workout-parser.ts");
const { createTodaySessionFromSms } = await import("../src/lib/today-sessions.ts");

const LOWER_DAY_SMS = `Lower Day

Warm up bicycle or walk at 3.3 on treadmill at 7.0 incline
5 mins

Rest periods are 1:30 min

Upper body warm up
Band exercises
Dumbbell bicep curls 20
Dumbbell shoulder press 20

25 air squats

Leg press
4 sets
20 sec hold at bottom of lift
Then burnout reps immediately
Stay flexible

Barbell hip thrust raise
4 sets
30 sec hold at top of squeeze
Then burnout reps immediately

Seated calf raises
4 sets
30 sec hold at top of squeeze
Then 15 reps immediately

Dumbbell Bulgarian split squats
3 sets each leg
Hold at bottom 20 sec
Then burnout reps immediately

HIIT jump squats to finish
8 rounds 20 sec on 20 sec off

Stretch well`;

const USER_IDS = ["member-e820ae6e-62c", "member-ab2cb068-b46"];

async function main() {
  const sessionDate = new Date().toISOString().slice(0, 10);
  const scheduled = new Date();
  scheduled.setHours(6, 30, 0, 0);

  const result = await createTodaySessionFromSms({
    sessionDate,
    scheduledAt: scheduled.toISOString(),
    rawSms: LOWER_DAY_SMS,
    programSlug: "adult",
    userIds: USER_IDS,
    replacesSchedule: true,
    createdBy: "seed-lower-day-today-prod",
    title: "Lower Day",
  });

  console.log(`✓ Lower Day assigned for ${sessionDate}`);
  console.log(`  Session: ${result.session.id}`);
  console.log(`  Workout: ${result.workoutId}`);
  console.log(`  Members: john@bcxvoice.com, sprealty9@gmail.com`);
  console.log(`  Blocks: ${result.parsed.exercises.length}`);
  for (const ex of result.parsed.exercises) {
    console.log(`    · ${ex.name} (${ex.sets}× ${ex.reps})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});