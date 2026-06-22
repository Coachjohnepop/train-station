import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

const BLOB_PATH = "demo/hidden-seed-user-ids.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "hidden-seed-user-ids.dev.json");

let memoryStore: string[] | null = null;

async function getStore(): Promise<Set<string>> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = Array.isArray(v) ? v : [];
    },
    fallback: () => [],
  });
  memoryStore = Array.isArray(hydrated) ? hydrated : [];
  return new Set(memoryStore);
}

async function persistStore(ids: Set<string>): Promise<void> {
  const list = [...ids];
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: list,
    setMemory: (v) => {
      memoryStore = Array.isArray(v) ? v : list;
    },
  });
}

export async function isDemoSeedUserHidden(id: string): Promise<boolean> {
  const store = await getStore();
  return store.has(id);
}

export async function hideDemoSeedUser(id: string): Promise<void> {
  const store = await getStore();
  store.add(id);
  await persistStore(store);
}

export async function unhideDemoSeedUser(id: string): Promise<boolean> {
  const store = await getStore();
  if (!store.has(id)) return false;
  store.delete(id);
  await persistStore(store);
  return true;
}