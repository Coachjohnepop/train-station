#!/usr/bin/env node
/** Quick regression: Lower Day SMS parses into 10 named blocks (no generic "Exercise"). */
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
const names = parsed.exercises.map((e) => e.name);

const expected = [
  "Bicycle or walk at 3.3 on treadmill at 7.0 incline",
  "Upper body warm up",
  "Band exercises",
  "Dumbbell bicep curls",
  "Dumbbell shoulder press",
  "Air squats",
  "Leg press",
  "Barbell Hip thrust, back on bench hold at top of squeeze",
  "Seated calve raises machine or standing cave raises with weight single leg",
  "Dumbbell Bulgarians split squats",
  "HIIT jump squats to finish",
  "Stretch / Cool-down",
];

let failed = false;
if (names.length !== expected.length) {
  console.error(`Expected ${expected.length} blocks, got ${names.length}`);
  failed = true;
}
for (let i = 0; i < expected.length; i++) {
  if (names[i] !== expected[i]) {
    console.error(`Block ${i + 1}: expected "${expected[i]}", got "${names[i] || "(missing)"}"`);
    failed = true;
  }
}
if (names.some((n) => /^exercise$/i.test(n))) {
  console.error("Found generic Exercise block name");
  failed = true;
}

if (failed) {
  console.error("FAIL — Lower Day SMS parse regression");
  process.exit(1);
}
console.log(`OK — Lower Day SMS → ${names.length} blocks with correct names`);