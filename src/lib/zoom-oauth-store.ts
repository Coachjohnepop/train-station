import "server-only";

import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { readLocalJson, writeLocalJson } from "@/lib/demo-json-blob";
import {
  clearZoomOAuthRecordFromDb,
  loadZoomOAuthRecordFromDb,
  normalizeCoachEmailKey,
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

export type ZoomOAuthStoreOpts = {
  coachEmail: string;
  preferFresh?: boolean;
};

/** Dev store: map coachEmail → record (legacy single object migrated on read). */
type DevStoreMap = Record<string, ZoomOAuthRecord>;

const DEV_FILE = path.join(process.cwd(), "prisma", "zoom-oauth.dev.json");

const memoryByCoach = new Map<string, ZoomOAuthRecord | null>();

function activeRecord(raw: ZoomOAuthRecord | null | undefined): ZoomOAuthRecord | null {
  if (!raw?.refreshToken?.trim()) return null;
  return raw;
}

function readDevMap(): DevStoreMap {
  const raw = readLocalJson<DevStoreMap | ZoomOAuthRecord | null>(DEV_FILE);
  if (!raw) return {};
  // Legacy single record
  if (typeof raw === "object" && "refreshToken" in raw && "zoomUserId" in raw) {
    const rec = raw as ZoomOAuthRecord;
    const key = normalizeCoachEmailKey(rec.connectedByEmail || rec.email || "coach");
    return key ? { [key]: rec } : {};
  }
  return raw as DevStoreMap;
}

function writeDevMap(map: DevStoreMap): void {
  writeLocalJson(DEV_FILE, map);
}

export async function getZoomOAuthRecord(
  opts: ZoomOAuthStoreOpts,
): Promise<ZoomOAuthRecord | null> {
  const key = normalizeCoachEmailKey(opts.coachEmail);
  if (!key) return null;

  if (!isDemoMode()) {
    const record = await loadZoomOAuthRecordFromDb(key);
    memoryByCoach.set(key, record);
    return record;
  }

  if (opts.preferFresh) {
    memoryByCoach.delete(key);
  }
  if (memoryByCoach.has(key)) {
    return activeRecord(memoryByCoach.get(key) ?? null);
  }
  const map = readDevMap();
  const record = activeRecord(map[key] ?? null);
  memoryByCoach.set(key, record);
  return record;
}

export async function saveZoomOAuthRecord(
  record: ZoomOAuthRecord,
): Promise<{ record: ZoomOAuthRecord; saved: boolean }> {
  const key = normalizeCoachEmailKey(record.connectedByEmail || record.email);
  const active = activeRecord(record);
  if (!key || !active) {
    return { record, saved: false };
  }

  memoryByCoach.set(key, active);

  if (!isDemoMode()) {
    const { saved } = await saveZoomOAuthRecordToDb(key, active);
    return { record: active, saved };
  }

  try {
    const map = readDevMap();
    map[key] = active;
    writeDevMap(map);
    return { record: active, saved: true };
  } catch (e) {
    console.error("Failed to save Zoom OAuth record to dev file:", e);
    return { record: active, saved: false };
  }
}

export async function clearZoomOAuthRecord(coachEmail: string): Promise<{ saved: boolean }> {
  const key = normalizeCoachEmailKey(coachEmail);
  if (!key) return { saved: false };

  memoryByCoach.set(key, null);

  if (!isDemoMode()) {
    return clearZoomOAuthRecordFromDb(key);
  }

  try {
    const map = readDevMap();
    delete map[key];
    writeDevMap(map);
    return { saved: true };
  } catch (e) {
    console.error("Failed to clear Zoom OAuth dev file:", e);
    return { saved: false };
  }
}

export async function isZoomCoachConnected(coachEmail: string): Promise<boolean> {
  const record = await getZoomOAuthRecord({ coachEmail });
  return Boolean(record?.refreshToken);
}

export { normalizeCoachEmailKey };
