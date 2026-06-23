import fs from "fs";
import path from "path";
import {
  hydrateJsonStore,
  isBlobConfigured,
  persistJsonStore,
  readLocalJson,
} from "@/lib/demo-json-blob";

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
  // preferFresh must return blob/disk as-is — never overlay stale instance memory
  // (on Vercel, warm lambdas kept old programDayOptions and masked coach edits).
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

function mergeProgramDayOptions(
  base: Array<{ id?: string; dayId?: string }>,
  overlay: Array<{ id?: string; dayId?: string }>,
): Array<{ id?: string; dayId?: string }> {
  const overlayDayIds = new Set(overlay.map((o) => o.dayId).filter(Boolean));
  if (overlayDayIds.size === 0) return base;
  const keptBase = base.filter((o) => !o.dayId || !overlayDayIds.has(o.dayId));
  return mergeSeedArray(keptBase, overlay);
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
    programDayOptions: mergeProgramDayOptions(
      (base.programDayOptions as Array<{ id?: string; dayId?: string }>) || [],
      (overlay.programDayOptions as Array<{ id?: string; dayId?: string }>) || [],
    ),
  };
}

export async function mutateDemoSeed(
  mutator: (data: DemoSeedData) => void,
  opts?: { preferFresh?: boolean },
): Promise<{ data: DemoSeedData; blobSaved: boolean }> {
  const preferFresh = opts?.preferFresh ?? isBlobConfigured();
  // Always mutate from latest blob/disk — not stale lambda memory overlay.
  const data = structuredClone(
    await hydrateDemoSeed({ preferFresh: preferFresh || isBlobConfigured() }),
  ) as DemoSeedData;
  mutator(data);

  // Re-merge latest workouts/exercises before write so concurrent clone/create writes survive,
  // but keep program-day mutations from this request intact.
  let toPersist = data;
  if (isBlobConfigured()) {
    const latest = structuredClone(await hydrateDemoSeed({ preferFresh: true })) as DemoSeedData;
    toPersist = {
      ...data,
      workouts: mergeSeedArray(
        (latest.workouts as Array<{ id?: string }>) || [],
        (data.workouts as Array<{ id?: string }>) || [],
      ),
      workoutExercises: mergeSeedArray(
        (latest.workoutExercises as Array<{ id?: string }>) || [],
        (data.workoutExercises as Array<{ id?: string }>) || [],
      ),
    };
  }

  const { blobSaved } = await persistDemoSeed(toPersist);
  return { data: toPersist, blobSaved };
}