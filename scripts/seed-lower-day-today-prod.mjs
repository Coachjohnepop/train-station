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

leg press 
20 sec hold at bottom of lift 
Then burnout reps immediately 
4 sets 
Stay flexible

Barbell Hip thrust, back on bench hold at top of squeeze
30 sec then immediately burnout reps x 4 sets 

Seated calve raises machine or standing cave raises with weight single leg 
30 sec hold at top of squeeze
Then 15 reps immediately x 4 sets 

Dumbbell Bulgarians split squats 
Hold at bottom of lift 20 sec 
Then burn out reps immediately 
3 sets each leg 

HIIT jump squats to finish
8 rounds on 20sec

Stretch`;

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