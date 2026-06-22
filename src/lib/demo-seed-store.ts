import fs from "fs";
import path from "path";
import { BLOB_TOKEN, hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

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

export async function hydrateDemoSeed(opts?: { preferFresh?: boolean }): Promise<DemoSeedData> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: SEED_FILE,
    memory: memorySeed,
    setMemory,
    fallback: loadBundledSeed,
    preferFresh: opts?.preferFresh,
  });
}

/** Sync read — call hydrateDemoSeed() first in serverless so Blob state is loaded. */
export function readDemoSeedSync(): DemoSeedData {
  if (memorySeed) return memorySeed;
  return readLocalJson<DemoSeedData>(SEED_FILE) || loadBundledSeed();
}

export async function getDemoSeed(opts?: { preferFresh?: boolean }): Promise<DemoSeedData> {
  return hydrateDemoSeed(opts);
}

export async function persistDemoSeed(data: DemoSeedData): Promise<{ blobSaved: boolean }> {
  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: SEED_FILE,
    data,
    setMemory,
  });
}

function mergeSeedArray<T extends { id?: string }>(base: T[], overlay: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of base) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of overlay) {
    if (row?.id) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function mergeDemoSeed(base: DemoSeedData, overlay: DemoSeedData): DemoSeedData {
  return {
    ...base,
    workouts: mergeSeedArray(
      (base.workouts as Array<{ id?: string }>) || [],
      (overlay.workouts as Array<{ id?: string }>) || [],
    ),
    workoutExercises: mergeSeedArray(
      (base.workoutExercises as Array<{ id?: string }>) || [],
      (overlay.workoutExercises as Array<{ id?: string }>) || [],
    ),
    programDays: mergeSeedArray(
      (base.programDays as Array<{ id?: string }>) || [],
      (overlay.programDays as Array<{ id?: string }>) || [],
    ),
    programDayOptions: mergeSeedArray(
      (base.programDayOptions as Array<{ id?: string }>) || [],
      (overlay.programDayOptions as Array<{ id?: string }>) || [],
    ),
  };
}

export async function mutateDemoSeed(
  mutator: (data: DemoSeedData) => void,
  opts?: { preferFresh?: boolean },
): Promise<{ data: DemoSeedData; blobSaved: boolean }> {
  const preferFresh = opts?.preferFresh ?? Boolean(BLOB_TOKEN);
  const local = memorySeed;
  const fresh = structuredClone(await hydrateDemoSeed({ preferFresh })) as DemoSeedData;
  const data =
    local && BLOB_TOKEN ? mergeDemoSeed(fresh, structuredClone(local) as DemoSeedData) : fresh;
  mutator(data);
  const { blobSaved } = await persistDemoSeed(data);
  return { data, blobSaved };
}