import fs from "fs";
import path from "path";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");
const BLOB_PATH = "demo/seed-data.json";

export type DemoSeedData = {
  exercises?: Array<Record<string, unknown>>;
  workouts?: Array<Record<string, unknown>>;
  workoutExercises?: Array<Record<string, unknown>>;
  programs?: Array<Record<string, unknown>>;
  programWeeks?: Array<Record<string, unknown>>;
  programDays?: Array<Record<string, unknown>>;
  programDayOptions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

let memorySeed: DemoSeedData | null = null;

function loadBundledSeed(): DemoSeedData {
  try {
    return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as DemoSeedData;
  } catch {
    return {
      exercises: [],
      workouts: [],
      workoutExercises: [],
      programs: [],
      programWeeks: [],
      programDays: [],
      programDayOptions: [],
    };
  }
}

function setMemory(data: DemoSeedData) {
  memorySeed = data;
}

export async function hydrateDemoSeed(): Promise<DemoSeedData> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: SEED_FILE,
    memory: memorySeed,
    setMemory,
    fallback: loadBundledSeed,
  });
}

/** Sync read — call hydrateDemoSeed() first in serverless so Blob state is loaded. */
export function readDemoSeedSync(): DemoSeedData {
  if (memorySeed) return memorySeed;
  return readLocalJson<DemoSeedData>(SEED_FILE) || loadBundledSeed();
}

export async function getDemoSeed(): Promise<DemoSeedData> {
  return hydrateDemoSeed();
}

export async function persistDemoSeed(data: DemoSeedData): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: SEED_FILE,
    data,
    setMemory,
  });
}

export async function mutateDemoSeed(
  mutator: (data: DemoSeedData) => void,
): Promise<DemoSeedData> {
  const data = structuredClone(await hydrateDemoSeed()) as DemoSeedData;
  mutator(data);
  await persistDemoSeed(data);
  return data;
}