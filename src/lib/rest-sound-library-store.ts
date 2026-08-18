import path from "path";
import { randomUUID } from "crypto";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type RestSoundLibraryItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  fileName?: string | null;
};

export type RestSoundLibraryConfig = {
  items: RestSoundLibraryItem[];
  /** Built-in id or custom URL / custom:id for new workouts / live defaults */
  defaultSoundKey?: string | null;
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "rest-sound-library.dev.json");
const BLOB_PATH = "demo/rest-sound-library.json";

let memoryStore: RestSoundLibraryConfig | null = null;

function emptyConfig(): RestSoundLibraryConfig {
  return {
    items: [],
    defaultSoundKey: "cybertruck",
    updatedAt: new Date().toISOString(),
  };
}

function isHttpOrPathUrl(url: string): boolean {
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("/")
  );
}

function normalizeItem(raw: unknown): RestSoundLibraryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<RestSoundLibraryItem>;
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url || !isHttpOrPathUrl(url)) return null;
  return {
    id:
      typeof data.id === "string" && data.id.trim()
        ? data.id.trim()
        : randomUUID(),
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : "Custom rest sound",
    url,
    createdAt:
      typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    fileName:
      typeof data.fileName === "string" && data.fileName.trim()
        ? data.fileName.trim()
        : null,
  };
}

function normalize(raw: unknown): RestSoundLibraryConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<RestSoundLibraryConfig>;
  const items: RestSoundLibraryItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(data.items)) {
    for (const entry of data.items) {
      const item = normalizeItem(entry);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return {
    items,
    defaultSoundKey:
      typeof data.defaultSoundKey === "string" && data.defaultSoundKey.trim()
        ? data.defaultSoundKey.trim()
        : "cybertruck",
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

async function loadStore(preferFresh = false): Promise<RestSoundLibraryConfig> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (s) => {
      memoryStore = s;
    },
    fallback: emptyConfig,
    preferFresh,
  }).then(normalize);
}

async function saveStore(config: RestSoundLibraryConfig): Promise<RestSoundLibraryConfig> {
  const next = {
    ...normalize(config),
    updatedAt: new Date().toISOString(),
  };
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (s) => {
      memoryStore = s as RestSoundLibraryConfig;
    },
  });
  return next;
}

export async function getRestSoundLibrary(): Promise<RestSoundLibraryConfig> {
  return loadStore(true);
}

export async function addRestSoundLibraryItem(input: {
  title: string;
  url: string;
  fileName?: string | null;
}): Promise<RestSoundLibraryConfig> {
  const store = await loadStore(true);
  const item = normalizeItem({
    id: randomUUID(),
    title: input.title,
    url: input.url,
    fileName: input.fileName,
    createdAt: new Date().toISOString(),
  });
  if (!item) throw new Error("Invalid sound URL.");
  // Newest first; de-dupe by URL
  const items = [item, ...store.items.filter((i) => i.url !== item.url)];
  return saveStore({ ...store, items });
}

export async function renameRestSoundLibraryItem(
  id: string,
  title: string,
): Promise<RestSoundLibraryConfig> {
  const store = await loadStore(true);
  const nextTitle = title.trim();
  if (!nextTitle) throw new Error("Title is required.");
  const items = store.items.map((i) =>
    i.id === id ? { ...i, title: nextTitle } : i,
  );
  return saveStore({ ...store, items });
}

export async function removeRestSoundLibraryItem(id: string): Promise<RestSoundLibraryConfig> {
  const store = await loadStore(true);
  return saveStore({
    ...store,
    items: store.items.filter((i) => i.id !== id),
  });
}

export async function setRestSoundLibraryDefault(
  defaultSoundKey: string | null,
): Promise<RestSoundLibraryConfig> {
  const store = await loadStore(true);
  return saveStore({
    ...store,
    defaultSoundKey: defaultSoundKey?.trim() || null,
  });
}
