#!/usr/bin/env node
/**
 * Re-link SMS workout blocks to catalog exercises and restore YouTube videoUrl hints (prod blob).
 *
 *   node scripts/relink-sms-workout-prod.mjs [workoutId]
 *
 * Default workout: sms-w-efdc6c34 (Lower Day, 2026-06-30)
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

const workoutId = process.argv[2] || "sms-w-efdc6c34";

const { relinkSmsWorkoutExercises } = await import("../src/lib/sms-generated-workouts.ts");
const { getSmsGeneratedWorkout } = await import("../src/lib/sms-generated-workouts.ts");

async function main() {
  const result = await relinkSmsWorkoutExercises(workoutId);
  console.log(`✓ Relinked workout ${result.workoutId}`);
  console.log(`  Blocks re-matched: ${result.relinked}`);
  console.log(`  Blocks with video: ${result.videos}`);

  const view = await getSmsGeneratedWorkout(workoutId);
  if (!view) {
    console.warn("  Workout not found after relink");
    return;
  }
  console.log(`  "${view.workoutName}" — ${view.exercises.length} blocks`);
  for (const ex of view.exercises) {
    const vid = ex.videoUrl ? "▶ video" : "✗ no video";
    console.log(`    · ${ex.name} — ${vid}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});