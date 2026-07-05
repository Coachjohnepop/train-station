import "server-only";

import { prisma } from "@/lib/prisma";
import type { ZoomOAuthRecord } from "@/lib/zoom-oauth-store";

export const ZOOM_OAUTH_RECORD_ID = "coach";

function rowToRecord(row: {
  zoomUserId: string;
  email: string;
  displayName: string;
  refreshToken: string;
  connectedAt: Date;
  connectedByEmail: string;
}): ZoomOAuthRecord {
  return {
    zoomUserId: row.zoomUserId,
    email: row.email,
    displayName: row.displayName,
    refreshToken: row.refreshToken,
    connectedAt: row.connectedAt.toISOString(),
    connectedByEmail: row.connectedByEmail,
  };
}

export async function loadZoomOAuthRecordFromDb(): Promise<ZoomOAuthRecord | null> {
  const row = await prisma.coachZoomOAuth.findUnique({
    where: { id: ZOOM_OAUTH_RECORD_ID },
  });
  if (!row?.refreshToken?.trim()) return null;
  return rowToRecord(row);
}

export async function saveZoomOAuthRecordToDb(
  record: ZoomOAuthRecord,
): Promise<{ saved: boolean }> {
  try {
    await prisma.coachZoomOAuth.upsert({
      where: { id: ZOOM_OAUTH_RECORD_ID },
      create: {
        id: ZOOM_OAUTH_RECORD_ID,
        zoomUserId: record.zoomUserId,
        email: record.email,
        displayName: record.displayName,
        refreshToken: record.refreshToken,
        connectedAt: new Date(record.connectedAt),
        connectedByEmail: record.connectedByEmail,
      },
      update: {
        zoomUserId: record.zoomUserId,
        email: record.email,
        displayName: record.displayName,
        refreshToken: record.refreshToken,
        connectedAt: new Date(record.connectedAt),
        connectedByEmail: record.connectedByEmail,
      },
    });
    return { saved: true };
  } catch (e) {
    console.error("Failed to save Zoom OAuth record to database:", e);
    return { saved: false };
  }
}

export async function clearZoomOAuthRecordFromDb(): Promise<{ saved: boolean }> {
  try {
    await prisma.coachZoomOAuth.deleteMany({
      where: { id: ZOOM_OAUTH_RECORD_ID },
    });
    return { saved: true };
  } catch (e) {
    console.error("Failed to clear Zoom OAuth record from database:", e);
    return { saved: false };
  }
}

export async function probeZoomOAuthDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.coachZoomOAuth.count();
    return { ok: true, message: null };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}