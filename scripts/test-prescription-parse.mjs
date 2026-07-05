#!/usr/bin/env node
/**
 * Regression: Lower Day text parse emits structured phases.
 *
 * Usage: node scripts/test-prescription-parse.mjs
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { parseSmsWorkout } = await import("../src/lib/sms-workout-parser");

const LOWER_DAY = `Lower Day 

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

const parsed = parseSmsWorkout(LOWER_DAY);
const checks = [
  {
    name: "Leg press",
    pattern: "hold_burnout",
    setCount: 4,
    rest: 90,
    phases: ["HOLD", "BURNOUT"],
  },
  {
    name: /hip thrust/i,
    pattern: "hold_burnout",
    setCount: 4,
    phases: ["HOLD", "BURNOUT"],
  },
  {
    name: /calve|calf/i,
    pattern: "hold_fixed_reps",
    setCount: 4,
    phases: ["HOLD", "REPS"],
    reps: 15,
  },
  {
    name: /bulgarian/i,
    pattern: "hold_burnout",
    setCount: 3,
  },
  {
    name: /hiit jump/i,
    pattern: "timed_rounds",
    setCount: 8,
    rest: 20,
  },
  {
    name: /bicep curl/i,
    pattern: "standard_reps",
    setCount: 1,
    reps: 20,
  },
];

let failed = false;

for (const check of checks) {
  const ex = parsed.exercises.find((e) =>
    typeof check.name === "string"
      ? e.name === check.name
      : check.name.test(e.name),
  );
  if (!ex) {
    console.error(`FAIL — missing block matching ${check.name}`);
    failed = true;
    continue;
  }
  if (ex.pattern !== check.pattern) {
    console.error(
      `FAIL — ${ex.name}: pattern ${ex.pattern} !== ${check.pattern}`,
    );
    failed = true;
  }
  if (check.setCount != null && ex.setCount !== check.setCount) {
    console.error(
      `FAIL — ${ex.name}: setCount ${ex.setCount} !== ${check.setCount}`,
    );
    failed = true;
  }
  if (check.rest != null && ex.restBetweenSetsSec !== check.rest) {
    console.error(
      `FAIL — ${ex.name}: rest ${ex.restBetweenSetsSec} !== ${check.rest}`,
    );
    failed = true;
  }
  if (check.phases) {
    const types = (ex.phases || []).map((p) => p.phaseType);
    if (types.join(",") !== check.phases.join(",")) {
      console.error(
        `FAIL — ${ex.name}: phases ${types.join(",")} !== ${check.phases.join(",")}`,
      );
      failed = true;
    }
  }
  if (check.reps != null) {
    const repPhase = (ex.phases || []).find((p) => p.phaseType === "REPS");
    if (repPhase?.reps !== check.reps) {
      console.error(
        `FAIL — ${ex.name}: rep phase ${repPhase?.reps} !== ${check.reps}`,
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);

console.log("OK — Lower Day parse emits structured phases");
for (const ex of parsed.exercises) {
  const phaseStr = (ex.phases || [])
    .map((p) => p.phaseType + (p.durationSec ? ` ${p.durationSec}s` : "") + (p.reps ? ` x${p.reps}` : ""))
    .join(" → ");
  console.log(
    `  ${ex.name} [${ex.pattern}] ${ex.setCount} sets, rest ${ex.restBetweenSetsSec ?? "—"}s${phaseStr ? `: ${phaseStr}` : ""}`,
  );
}