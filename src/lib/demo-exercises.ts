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

export function saveDemoExercises(list: any[]) {
  cache = [...list];
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("Failed to persist demo exercises", e);
  }
}

export function createDemoExerciseId(): string {
  return "ex_" + randomUUID().replace(/-/g, "");
}
