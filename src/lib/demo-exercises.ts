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

export async function hydrateDemoExercises(opts?: { preferFresh?: boolean }): Promise<any[]> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: cache,
    setMemory,
    fallback: loadSeedExercises,
    preferFresh: opts?.preferFresh,
  });
}

export function loadDemoExercises(): any[] {
  if (cache) return [...cache];
  if (fs.existsSync(DEV_FILE)) {
    try {
      return [...JSON.parse(fs.readFileSync(DEV_FILE, "utf8"))];
    } catch {
      return [...loadSeedExercises()];
    }
  }
  return [...loadSeedExercises()];
}

function applyExerciseListToSeed(seed: Record<string, any>, list: any[]) {
  const exerciseIds = new Set(list.map((e: any) => e.id));
  const byId = Object.fromEntries(list.map((e: any) => [e.id, e]));

  seed.exercises = list.map((e: any) => ({ ...e }));

  if (!seed.workoutExercises) return;

  seed.workoutExercises = seed.workoutExercises.filter((we: any) =>
    exerciseIds.has(we.exerciseId),
  );

  for (const we of seed.workoutExercises) {
    const ex = byId[we.exerciseId];
    if (ex) {
      we.exercise = { ...ex };
    }
  }
}

async function syncExercisesIntoSeed(list: any[]): Promise<boolean> {
  const { blobSaved } = await mutateDemoSeed((seed) => {
    applyExerciseListToSeed(seed, list);
  });
  return blobSaved;
}

export async function saveDemoExercises(list: any[]): Promise<{
  exercisesBlobSaved: boolean;
  seedBlobSaved: boolean;
}> {
  cache = [...list];
  const { blobSaved: exercisesBlobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: cache,
    setMemory,
  });
  const seedBlobSaved = await syncExercisesIntoSeed(list);
  return { exercisesBlobSaved, seedBlobSaved };
}

export function createDemoExerciseId(): string {
  return "ex_" + randomUUID().replace(/-/g, "");
}