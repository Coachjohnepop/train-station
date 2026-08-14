import path from "path";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { isDatabaseConfigured } from "@/lib/database-config";

export type ScheduleDayOverride = {
  dayId: string;
  programSlug?: string;
  weekNumber?: number;
  dayNumber?: number;
  smsWorkoutText: string;
  active: boolean;
  replacesLiveSession: boolean;
  label?: string;
  updatedAt: string;
};

type OverrideStore = {
  overrides: Record<string, ScheduleDayOverride>;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "schedule-overrides.dev.json");
const BLOB_PATH = "demo/schedule-overrides.json";

let memoryStore: OverrideStore | null = null;

function emptyStore(): OverrideStore {
  return { overrides: {} };
}

function setMemory(store: OverrideStore) {
  memoryStore = store;
}

export async function hydrateScheduleOverrides(): Promise<OverrideStore> {
  if (isDatabaseConfigured()) {
    const empty = emptyStore();
    setMemory(empty);
    return empty;
  }
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
  });
}

function readStore(): OverrideStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<OverrideStore>(DEV_FILE) || emptyStore();
  return memoryStore;
}

async function writeStore(store: OverrideStore) {
  if (isDatabaseConfigured()) {
    setMemory(emptyStore());
    return;
  }
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

export async function getAllScheduleOverrides(): Promise<ScheduleDayOverride[]> {
  await hydrateScheduleOverrides();
  const store = readStore();
  return Object.values(store.overrides).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getScheduleOverride(dayId: string): ScheduleDayOverride | null {
  const store = readStore();
  return store.overrides[dayId] ?? null;
}

export function getActiveScheduleOverride(dayId: string): ScheduleDayOverride | null {
  const o = getScheduleOverride(dayId);
  if (!o?.active || !o.smsWorkoutText.trim()) return null;
  return o;
}

export async function saveScheduleOverride(
  input: Omit<ScheduleDayOverride, "updatedAt"> & { updatedAt?: string },
) {
  await hydrateScheduleOverrides();
  const store = readStore();
  const entry: ScheduleDayOverride = {
    ...input,
    smsWorkoutText: input.smsWorkoutText.trim(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  store.overrides[input.dayId] = entry;
  await writeStore(store);
  return entry;
}

export async function clearScheduleOverride(dayId: string) {
  await hydrateScheduleOverrides();
  const store = readStore();
  if (!store.overrides[dayId]) return false;
  delete store.overrides[dayId];
  await writeStore(store);
  return true;
}

export function applyOverrideToDay<T extends { id: string }>(day: T): T & {
  smsWorkoutText?: string | null;
  smsOverrideActive?: boolean;
  replacesLiveSession?: boolean;
  smsOverrideLabel?: string | null;
} {
  const override = getActiveScheduleOverride(day.id);
  if (!override) {
    return {
      ...day,
      smsWorkoutText: null,
      smsOverrideActive: false,
      replacesLiveSession: false,
      smsOverrideLabel: null,
    };
  }
  return {
    ...day,
    smsWorkoutText: override.smsWorkoutText,
    smsOverrideActive: true,
    replacesLiveSession: override.replacesLiveSession,
    smsOverrideLabel: override.label ?? "Coach SMS workout",
  };
}