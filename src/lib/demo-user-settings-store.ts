import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

export type DemoUserSettings = {
  phone: string | null;
  dailyReminderTime: string | null;
};

type SettingsStore = Record<string, DemoUserSettings>;

const BLOB_PATH = "demo/user-settings.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "user-settings.dev.json");

let memoryStore: SettingsStore | null = null;

function defaultSettings(): DemoUserSettings {
  return { phone: null, dailyReminderTime: null };
}

function loadBundledDefaults(): SettingsStore {
  const local = readLocalJson<SettingsStore>(DEV_FILE);
  if (local && Object.keys(local).length > 0) return local;
  return {
    "demo-user": {
      phone: "(555) 987-6543",
      dailyReminderTime: "07:30",
    },
  };
}

async function getStore(): Promise<SettingsStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as SettingsStore) || {};
    },
    fallback: loadBundledDefaults,
  });
  memoryStore = hydrated as SettingsStore;
  return memoryStore;
}

export async function hydrateDemoUserSettings(): Promise<SettingsStore> {
  return getStore();
}

/** Sync read — call hydrateDemoUserSettings() first in serverless so Blob state is loaded. */
export function readDemoUserSettingsSync(userId: string): DemoUserSettings {
  const all = memoryStore || readLocalJson<SettingsStore>(DEV_FILE) || loadBundledDefaults();
  return all[userId] || defaultSettings();
}

export async function getDemoUserSettings(userId: string): Promise<DemoUserSettings> {
  const store = await getStore();
  return store[userId] || defaultSettings();
}

export async function updateDemoUserSettings(
  userId: string,
  updates: Partial<DemoUserSettings>,
): Promise<{ settings: DemoUserSettings; blobSaved: boolean }> {
  const store = await getStore();
  const current = store[userId] || defaultSettings();
  const updated = { ...current, ...updates };
  store[userId] = updated;

  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as SettingsStore;
    },
  });

  return { settings: updated, blobSaved };
}