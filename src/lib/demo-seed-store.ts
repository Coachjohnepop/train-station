import fs from "fs";
import path from "path";
import {
  hydrateJsonStore,
  isBlobConfigured,
  persistJsonStore,
  readBlobJson,
  readLocalJson,
  writeBlobJson,
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

function seedProgramSnapshot(seed: DemoSeedData): string {
  const days = ((seed.programDays as Array<{ id?: string; workoutId?: string | null }>) || [])
    .map((d) => `${d.id}:${d.workoutId ?? ""}`)
    .sort()
    .join("|");
  const opts = ((seed.programDayOptions as Array<{ dayId?: string; workoutId?: string }>) || [])
    .map((o) => `${o.dayId}:${o.workoutId}`)
    .sort()
    .join("|");
  return `${days}#${opts}`;
}

export async function persistDemoSeed(data: DemoSeedData): Promise<{ blobSaved: boolean }> {
  const expected = seedProgramSnapshot(data);
  let { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: SEED_FILE,
    data,
    setMemory,
  });

  if (isBlobConfigured() && blobSaved && expected) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const readback = await readBlobJson<DemoSeedData>(BLOB_PATH);
      if (readback && seedProgramSnapshot(readback) === expected) break;
      await writeBlobJson(BLOB_PATH, data);
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }

  return { blobSaved };
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
  // but keep program-day mutations from this request intact. Read blob directly — do not
  // re-hydrate into memory (that was masking fresh program-day writes on Vercel).
  let toPersist = data;
  if (isBlobConfigured()) {
    const latest = ((await readBlobJson<DemoSeedData>(BLOB_PATH)) || data) as DemoSeedData;
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