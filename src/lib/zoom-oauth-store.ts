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
      memoryStore = activeRecord(v);
    },
    fallback: () => null,
    preferFresh: opts?.preferFresh ?? true,
  });
  return activeRecord(hydrated);
}

function activeRecord(raw: ZoomOAuthRecord | null): ZoomOAuthRecord | null {
  if (!raw?.refreshToken?.trim()) return null;
  return raw;
}

export async function getZoomOAuthRecord(opts?: { preferFresh?: boolean }): Promise<ZoomOAuthRecord | null> {
  const raw = await loadRecord(opts);
  return activeRecord(raw);
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

/** Tombstone written to blob — avoids null JSON + CDN stale reads showing old tokens. */
export type ZoomOAuthCleared = {
  clearedAt: string;
  clearedByEmail?: string;
};

export async function clearZoomOAuthRecord(clearedByEmail?: string): Promise<{ blobSaved: boolean }> {
  memoryStore = null;
  const tombstone: ZoomOAuthCleared = {
    clearedAt: new Date().toISOString(),
    ...(clearedByEmail ? { clearedByEmail } : {}),
  };
  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: tombstone as unknown as ZoomOAuthRecord,
    setMemory: (v) => {
      memoryStore = activeRecord(v as ZoomOAuthRecord | null);
    },
  });
}

export async function isZoomCoachConnected(): Promise<boolean> {
  const record = await getZoomOAuthRecord();
  return Boolean(record?.refreshToken);
}