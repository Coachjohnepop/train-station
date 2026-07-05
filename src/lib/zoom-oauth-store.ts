import "server-only";

import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { readLocalJson, writeLocalJson } from "@/lib/demo-json-blob";
import {
  clearZoomOAuthRecordFromDb,
  loadZoomOAuthRecordFromDb,
  saveZoomOAuthRecordToDb,
} from "@/lib/zoom-oauth-store-db";

export type ZoomOAuthRecord = {
  zoomUserId: string;
  email: string;
  displayName: string;
  refreshToken: string;
  connectedAt: string;
  connectedByEmail: string;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "zoom-oauth.dev.json");

let memoryStore: ZoomOAuthRecord | null = null;

function activeRecord(raw: ZoomOAuthRecord | null): ZoomOAuthRecord | null {
  if (!raw?.refreshToken?.trim()) return null;
  return raw;
}

async function loadRecordFromDevFile(): Promise<ZoomOAuthRecord | null> {
  if (memoryStore) return activeRecord(memoryStore);
  const fromDisk = readLocalJson<ZoomOAuthRecord | null>(DEV_FILE);
  memoryStore = activeRecord(fromDisk);
  return memoryStore;
}

async function loadRecord(opts?: { preferFresh?: boolean }): Promise<ZoomOAuthRecord | null> {
  if (!isDemoMode()) {
    const record = await loadZoomOAuthRecordFromDb();
    memoryStore = record;
    return record;
  }

  if (opts?.preferFresh) {
    memoryStore = null;
  }
  return loadRecordFromDevFile();
}

export async function getZoomOAuthRecord(opts?: { preferFresh?: boolean }): Promise<ZoomOAuthRecord | null> {
  return loadRecord(opts);
}

export async function saveZoomOAuthRecord(record: ZoomOAuthRecord): Promise<{
  record: ZoomOAuthRecord;
  saved: boolean;
}> {
  memoryStore = activeRecord(record);

  if (!isDemoMode()) {
    const { saved } = await saveZoomOAuthRecordToDb(record);
    return { record, saved };
  }

  try {
    writeLocalJson(DEV_FILE, record);
    return { record, saved: true };
  } catch (e) {
    console.error("Failed to save Zoom OAuth record to dev file:", e);
    return { record, saved: false };
  }
}

export async function clearZoomOAuthRecord(_clearedByEmail?: string): Promise<{ saved: boolean }> {
  memoryStore = null;

  if (!isDemoMode()) {
    return clearZoomOAuthRecordFromDb();
  }

  try {
    writeLocalJson(DEV_FILE, null);
    return { saved: true };
  } catch (e) {
    console.error("Failed to clear Zoom OAuth dev file:", e);
    return { saved: false };
  }
}

export async function isZoomCoachConnected(): Promise<boolean> {
  const record = await getZoomOAuthRecord();
  return Boolean(record?.refreshToken);
}