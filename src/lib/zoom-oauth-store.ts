import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type ZoomOAuthRecord = {
  zoomUserId: string;
  email: string;
  displayName: string;
  refreshToken: string;
  connectedAt: string;
  connectedByEmail: string;
};

const BLOB_PATH = "coach/zoom-oauth.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "zoom-oauth.dev.json");

let memoryStore: ZoomOAuthRecord | null = null;

async function loadRecord(opts?: { preferFresh?: boolean }): Promise<ZoomOAuthRecord | null> {
  const hydrated = await hydrateJsonStore<ZoomOAuthRecord | null>({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v;
    },
    fallback: () => null,
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated;
  return hydrated;
}

export async function getZoomOAuthRecord(opts?: { preferFresh?: boolean }): Promise<ZoomOAuthRecord | null> {
  return loadRecord(opts);
}

export async function saveZoomOAuthRecord(record: ZoomOAuthRecord): Promise<ZoomOAuthRecord> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: record,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
  return record;
}

export async function clearZoomOAuthRecord(): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: null,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

export async function isZoomCoachConnected(): Promise<boolean> {
  const record = await getZoomOAuthRecord();
  return Boolean(record?.refreshToken);
}