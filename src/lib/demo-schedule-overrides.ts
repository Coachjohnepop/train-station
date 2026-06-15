import fs from "fs";
import path from "path";

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

function emptyStore(): OverrideStore {
  return { overrides: {} };
}

function readStore(): OverrideStore {
  try {
    if (fs.existsSync(DEV_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8")) as OverrideStore;
    }
  } catch {
    /* fall through */
  }
  return emptyStore();
}

function writeStore(store: OverrideStore) {
  fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
}

export function getAllScheduleOverrides(): ScheduleDayOverride[] {
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

export function saveScheduleOverride(input: Omit<ScheduleDayOverride, "updatedAt"> & { updatedAt?: string }) {
  const store = readStore();
  const entry: ScheduleDayOverride = {
    ...input,
    smsWorkoutText: input.smsWorkoutText.trim(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  store.overrides[input.dayId] = entry;
  writeStore(store);
  return entry;
}

export function clearScheduleOverride(dayId: string) {
  const store = readStore();
  if (!store.overrides[dayId]) return false;
  delete store.overrides[dayId];
  writeStore(store);
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