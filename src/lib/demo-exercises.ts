import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  hydrateJsonStore,
  persistJsonStore,
  readLocalJson,
} from "@/lib/demo-json-blob";
import { mutateDemoSeed, readDemoSeedSync } from "@/lib/demo-seed-store";

const DEV_FILE = path.join(process.cwd(), "prisma", "exercises.dev.json");
const BLOB_PATH = "demo/exercises.json";

let cache: any[] | null = null;

function loadSeedExercises(): any[] {
  const seed = readDemoSeedSync();
  return (seed.exercises || []).map((e: any) => ({ ...e }));
}

function setMemory(list: any[]) {
  cache = list;
}

export function isDemoMode(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

export async function hydrateDemoExercises(): Promise<any[]> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: cache,
    setMemory,
    fallback: loadSeedExercises,
  });
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
  }
  return [...(cache || [])];
}

async function syncExercisesIntoSeed(list: any[]) {
  await mutateDemoSeed((seed) => {
    seed.exercises = list.map((e: any) => ({ ...e }));
    const byId = Object.fromEntries(list.map((e: any) => [e.id, e]));
    for (const we of seed.workoutExercises || []) {
      const ex = byId[(we as any).exerciseId];
      if (ex && (we as any).exercise) {
        (we as any).exercise = { ...ex };
      }
    }
  });
}

export async function saveDemoExercises(list: any[]): Promise<void> {
  cache = [...list];
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: cache,
    setMemory,
  });
  await syncExercisesIntoSeed(list);
}

export function createDemoExerciseId(): string {
  return "ex_" + randomUUID().replace(/-/g, "");
}