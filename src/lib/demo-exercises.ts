import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DEV_FILE = path.join(process.cwd(), "prisma", "exercises.dev.json");
const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

let cache: any[] | null = null;

function loadSeedExercises(): any[] {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  return (seed.exercises || []).map((e: any) => ({ ...e }));
}

export function isDemoMode(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export function loadDemoExercises(): any[] {
  if (cache) return [...cache];
  if (fs.existsSync(DEV_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    } catch {
      cache = loadSeedExercises();
    }
  } else {
    cache = loadSeedExercises();
    try {
      fs.writeFileSync(DEV_FILE, JSON.stringify(cache, null, 2));
    } catch {}
  }
  return [...(cache || [])];
}

function shouldSyncSeedSnapshot() {
  // On Vercel, rewriting the full seed-data.json during SMS builds can stall the
  // serverless function and leave coach "Build" stuck on Building...
  return isDemoMode() && !process.env.VERCEL;
}

export function saveDemoExercises(list: any[]) {
  cache = [...list];
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("Failed to persist demo exercises", e);
  }

  if (!shouldSyncSeedSnapshot()) return;

  // Sync the updated list into seed-data.json's top-level "exercises" array.
  // This is the key fix for the #1 customer issue:
  // - Name edits now appear in all workout exercise lists (because many loaders resolve names
  //   by looking up in seed.exercises at request time).
  // - Deletes remove the exercise from the canonical snapshot too.
  // - After local edits, the seed-data.json on disk reflects the coach's changes and can be
  //   committed (as required by CLAUDE.md / DEPLOY.md) so the next Vercel deploy has the new data.
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    seed.exercises = list.map((e: any) => ({ ...e }));
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  } catch (e) {
    console.error("Failed to sync updated exercises into seed-data.json", e);
  }
}

export function createDemoExerciseId(): string {
  return "ex_" + randomUUID().replace(/-/g, "");
}
