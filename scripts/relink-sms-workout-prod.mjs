#!/usr/bin/env node
/**
 * Re-link SMS workout blocks to catalog exercises and restore YouTube videoUrl hints (prod blob).
 *
 *   npx tsx scripts/relink-sms-workout-prod.mjs [workoutId]
 *
 * Default workout: sms-w-efdc6c34 (Lower Day, 2026-06-30)
 */
import path from "path";
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

const { relinkSmsWorkoutExercises, hydrateSmsWorkouts } = await import(
  "../src/lib/sms-generated-workouts.ts"
);
const { hydrateDemoExercises, loadDemoExercises } = await import("../src/lib/demo-exercises.ts");
const { resolveExerciseVideoUrl } = await import("../src/lib/exercise-video-hints.ts");
const { readLocalJson } = await import("../src/lib/demo-json-blob.ts");

async function main() {
  const result = await relinkSmsWorkoutExercises(workoutId);
  console.log(`✓ Relinked workout ${result.workoutId}`);
  console.log(`  Blocks re-matched: ${result.relinked}`);
  console.log(`  Blocks with video: ${result.videos}`);

  await hydrateSmsWorkouts();
  await hydrateDemoExercises();
  const store = readLocalJson(path.join(process.cwd(), "prisma", "sms-workouts.dev.json"));
  const workout = store?.workouts?.find((w) => w.id === workoutId);
  const items = (store?.workoutExercises || [])
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const exById = Object.fromEntries(loadDemoExercises().map((e) => [e.id, e]));

  if (!workout) {
    console.warn("  Workout not found in store after relink");
    return;
  }
  console.log(`  "${workout.name}" — ${items.length} blocks`);
  for (const item of items) {
    const ex = exById[item.exerciseId] || { name: "Exercise" };
    const vid = resolveExerciseVideoUrl(ex) ? "▶ video" : "✗ no video";
    console.log(`    · ${ex.name} — ${vid}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});