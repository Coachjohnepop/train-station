import path from "path";
import { randomUUID } from "crypto";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { isAllowedCoachIntroVideoUrl } from "@/lib/site-video";

export type SiteVideoLibraryItem = {
  id: string;
  /** Coach-facing name, e.g. "Coach Class intro" */
  title: string;
  url: string;
  createdAt: string;
  /** Optional original filename */
  fileName?: string | null;
};

export type SiteVideoLibraryConfig = {
  items: SiteVideoLibraryItem[];
  updatedAt: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "site-video-library.dev.json");
const BLOB_PATH = "demo/site-video-library.json";

let memoryStore: SiteVideoLibraryConfig | null = null;

function emptyConfig(): SiteVideoLibraryConfig {
  return {
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeItem(raw: unknown): SiteVideoLibraryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SiteVideoLibraryItem>;
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url || !isAllowedCoachIntroVideoUrl(url)) return null;
  const id =
    typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : randomUUID();
  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : "Untitled video";
  return {
    id,
    title,
    url,
    createdAt:
      typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    fileName:
      typeof data.fileName === "string" && data.fileName.trim()
        ? data.fileName.trim()
        : null,
  };
}

function normalize(raw: unknown): SiteVideoLibraryConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const data = raw as Partial<SiteVideoLibraryConfig>;
  const items: SiteVideoLibraryItem[] = [];
  const seenUrls = new Set<string>();
  if (Array.isArray(data.items)) {
    for (const entry of data.items) {
      const item = normalizeItem(entry);
      if (!item) continue;
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      items.push(item);
    }
  }
  // Newest first
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return {
    items,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export async function getSiteVideoLibrary(): Promise<SiteVideoLibraryConfig> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
    fallback: emptyConfig,
  });
  const config = normalize(hydrated);
  memoryStore = config;
  return config;
}

export async function addSiteVideoLibraryItem(input: {
  url: string;
  title?: string | null;
  fileName?: string | null;
  id?: string | null;
}): Promise<SiteVideoLibraryItem> {
  const url = input.url?.trim();
  if (!url || !isAllowedCoachIntroVideoUrl(url)) {
    throw new Error("Video URL must be an uploaded site file or YouTube link.");
  }

  const current = await getSiteVideoLibrary();
  const existing = current.items.find((i) => i.url === url);
  if (existing) {
    // Already in library — optionally refresh title
    if (input.title?.trim() && input.title.trim() !== existing.title) {
      return updateSiteVideoLibraryItem(existing.id, { title: input.title.trim() });
    }
    return existing;
  }

  const item: SiteVideoLibraryItem = {
    id: input.id?.trim() || randomUUID(),
    title: input.title?.trim() || input.fileName?.trim() || "Untitled video",
    url,
    createdAt: new Date().toISOString(),
    fileName: input.fileName?.trim() || null,
  };

  const next: SiteVideoLibraryConfig = {
    items: [item, ...current.items],
    updatedAt: new Date().toISOString(),
  };

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return item;
}

export async function updateSiteVideoLibraryItem(
  id: string,
  patch: { title?: string },
): Promise<SiteVideoLibraryItem> {
  const current = await getSiteVideoLibrary();
  const idx = current.items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("Video not found in library.");

  const prev = current.items[idx];
  const nextItem: SiteVideoLibraryItem = {
    ...prev,
    title: patch.title !== undefined ? patch.title.trim() || "Untitled video" : prev.title,
  };

  const items = [...current.items];
  items[idx] = nextItem;
  const next: SiteVideoLibraryConfig = {
    items,
    updatedAt: new Date().toISOString(),
  };

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return nextItem;
}

export async function removeSiteVideoLibraryItem(id: string): Promise<void> {
  const current = await getSiteVideoLibrary();
  const next: SiteVideoLibraryConfig = {
    items: current.items.filter((i) => i.id !== id),
    updatedAt: new Date().toISOString(),
  };
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });
}

/**
 * Ensure currently assigned landing URLs appear in the library so the coach can reassign them.
 */
export async function ensureLibraryHasUrls(
  urls: Array<{ url: string | null | undefined; title?: string }>,
): Promise<SiteVideoLibraryConfig> {
  let library = await getSiteVideoLibrary();
  for (const entry of urls) {
    const url = entry.url?.trim();
    if (!url || !isAllowedCoachIntroVideoUrl(url)) continue;
    if (library.items.some((i) => i.url === url)) continue;
    await addSiteVideoLibraryItem({
      url,
      title: entry.title || "Assigned video",
    });
    library = await getSiteVideoLibrary();
  }
  return library;
}
