#!/usr/bin/env node
/** Local demo: John (couple), Chad, Katie — Saturday fun day */
import { createRequire } from "module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

dotenv.config({ path: ".env" });

const SESSION_DATE = "2026-07-04";
const USER_IDS = ["demo-user-john-steph", "demo-user-john", "demo-user-stephanie"];

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

Sexy boob lifts 10,10,10

Slap that ass hardening 12,12,12,12

Let's keep our intestines functioning 15,15,15`;

const { createTodaySessionFromSms } = await import("../src/lib/today-sessions.ts");

const scheduled = new Date(`${SESSION_DATE}T09:00:00`);
const result = await createTodaySessionFromSms({
  sessionDate: SESSION_DATE,
  scheduledAt: scheduled.toISOString(),
  rawSms: FUN_DAY_SMS,
  programSlug: "adult",
  userIds: USER_IDS,
  replacesSchedule: true,
  createdBy: "seed-saturday-fun-local",
  title: "Saturday Fun Day",
});

console.log("Local seed OK", result.session.id, result.parsed.exercises.map((e) => e.name).join(", "));