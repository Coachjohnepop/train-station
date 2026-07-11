import "server-only";

import fs from "fs";
import path from "path";
import { hydrateJsonStore, isBlobConfigured, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";

export type DemoWorkoutLogRow = {
  id: string;
  userId: string;
  workoutId: string;
  performedAt: string;
  completed: boolean;
  progress: number;
};

export type DemoExercisePerformanceRow = {
  id: string;
  userId: string;
  exerciseId: string;
  workoutExerciseId: string | null;
  setScheme: string;
  weightTier: string;
  startingWeightLbs: number | null;
  performedAt: string;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  repsCompleted?: number | null;
  setsCompleted?: number | null;
};

export type DemoLogsStore = {
  workoutLogs: DemoWorkoutLogRow[];
  performances: DemoExercisePerformanceRow[];
};

export type PerUserEnrollments = Record<
  string,
  {
    currentWeek: number;
    currentDay: number;
    currentPhase?: number;
    trainingLocation?: "gym" | "home";
    programStartDate?: string | null;
    blockEndsAt?: string | null;
  }
>;
export type DemoEnrollmentsStore = Record<string, PerUserEnrollments>;

const LOGS_BLOB = "demo/member-workout-logs.json";
const LOGS_DEV = path.join(process.cwd(), "prisma", "logs.dev.json");
const ENROLLMENTS_BLOB = "demo/member-enrollments.json";
const ENROLLMENTS_DEV = path.join(process.cwd(), "prisma", "enrollments.dev.json");

let logsMemory: DemoLogsStore | null = null;
let enrollmentsMemory: DemoEnrollmentsStore | null = null;

function emptyLogs(): DemoLogsStore {
  return { workoutLogs: [], performances: [] };
}

function readLocalJson<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    }
  } catch {
    // ignore
  }
  return null;
}

function normalizeEnrollmentsStore(raw: unknown): DemoEnrollmentsStore {
  if (!raw || typeof raw !== "object") return {};
  const parsed = raw as DemoEnrollmentsStore;
  if (
    !parsed["demo-user"] &&
    Object.keys(parsed).some(
      (k) => !k.startsWith("_") && typeof parsed[k] === "object" && "currentWeek" in (parsed[k] as object),
    )
  ) {
    return { "demo-user": parsed as unknown as PerUserEnrollments };
  }
  return parsed;
}

function defaultEnrollmentsStore(): DemoEnrollmentsStore {
  return {
    "demo-user-john-steph": {
      adult: { currentWeek: 2, currentDay: 5 },
    },
    "demo-user": {
      adult: { currentWeek: 2, currentDay: 5 },
      "john-steph": { currentWeek: 1, currentDay: 2 },
    },
  };
}

export async function hydrateDemoLogsStore(opts?: { preferFresh?: boolean }): Promise<DemoLogsStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: LOGS_BLOB,
    localPath: LOGS_DEV,
    memory: logsMemory,
    setMemory: (v) => {
      logsMemory = (v as DemoLogsStore) || emptyLogs();
    },
    fallback: emptyLogs,
    preferFresh: opts?.preferFresh ?? isBlobConfigured(),
  });
  logsMemory = {
    workoutLogs: Array.isArray(hydrated.workoutLogs) ? hydrated.workoutLogs : [],
    performances: Array.isArray(hydrated.performances) ? hydrated.performances : [],
  };
  return logsMemory;
}

export function getDemoLogsStoreSync(): DemoLogsStore {
  if (logsMemory) return logsMemory;
  const fromDisk = readLocalJson<DemoLogsStore>(LOGS_DEV);
  if (fromDisk) {
    logsMemory = {
      workoutLogs: Array.isArray(fromDisk.workoutLogs) ? fromDisk.workoutLogs : [],
      performances: Array.isArray(fromDisk.performances) ? fromDisk.performances : [],
    };
    return logsMemory;
  }
  logsMemory = emptyLogs();
  return logsMemory;
}

export async function persistDemoLogsStore(store: DemoLogsStore): Promise<void> {
  logsMemory = {
    workoutLogs: [...store.workoutLogs],
    performances: [...store.performances],
  };
  const { blobSaved } = await persistJsonStore({
    blobPath: LOGS_BLOB,
    localPath: LOGS_DEV,
    data: logsMemory,
    setMemory: (v) => {
      logsMemory = v as DemoLogsStore;
    },
  });
  requireBlobPersisted(blobSaved, "Workout logs");
}

export async function hydrateDemoEnrollmentsStore(opts?: { preferFresh?: boolean }): Promise<DemoEnrollmentsStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: ENROLLMENTS_BLOB,
    localPath: ENROLLMENTS_DEV,
    memory: enrollmentsMemory,
    setMemory: (v) => {
      enrollmentsMemory = normalizeEnrollmentsStore(v);
    },
    fallback: defaultEnrollmentsStore,
    preferFresh: opts?.preferFresh ?? isBlobConfigured(),
  });
  enrollmentsMemory = normalizeEnrollmentsStore(hydrated);
  return enrollmentsMemory;
}

export function getDemoEnrollmentsStoreSync(): DemoEnrollmentsStore {
  if (enrollmentsMemory) return enrollmentsMemory;
  const fromDisk = readLocalJson<unknown>(ENROLLMENTS_DEV);
  if (fromDisk) {
    enrollmentsMemory = normalizeEnrollmentsStore(fromDisk);
    return enrollmentsMemory;
  }
  enrollmentsMemory = defaultEnrollmentsStore();
  return enrollmentsMemory;
}

export async function persistDemoEnrollmentsStore(store: DemoEnrollmentsStore): Promise<void> {
  enrollmentsMemory = { ...store };
  const { blobSaved } = await persistJsonStore({
    blobPath: ENROLLMENTS_BLOB,
    localPath: ENROLLMENTS_DEV,
    data: enrollmentsMemory,
    setMemory: (v) => {
      enrollmentsMemory = normalizeEnrollmentsStore(v);
    },
  });
  requireBlobPersisted(blobSaved, "Enrollment progress");
}