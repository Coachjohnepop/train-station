import "server-only";

import { prisma } from "@/lib/prisma";
import type { ZoomOAuthRecord } from "@/lib/zoom-oauth-store";

/** Normalize Train Station coach login used as CoachZoomOAuth.id */
export function normalizeCoachEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Legacy singleton row before multi-coach migration. */
export const ZOOM_OAUTH_LEGACY_ID = "coach";

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

export async function loadZoomOAuthRecordFromDb(
  coachEmail: string,
): Promise<ZoomOAuthRecord | null> {
  const key = normalizeCoachEmailKey(coachEmail);
  if (!key) return null;

  let row = await prisma.coachZoomOAuth.findUnique({ where: { id: key } });

  // One-release dual-read: pre-migration singleton
  if (!row?.refreshToken?.trim() && key) {
    const legacy = await prisma.coachZoomOAuth.findUnique({
      where: { id: ZOOM_OAUTH_LEGACY_ID },
    });
    if (
      legacy?.refreshToken?.trim() &&
      (!legacy.connectedByEmail ||
        normalizeCoachEmailKey(legacy.connectedByEmail) === key ||
        normalizeCoachEmailKey(legacy.email) === key)
    ) {
      row = legacy;
    }
  }

  if (!row?.refreshToken?.trim()) return null;
  return rowToRecord(row);
}

export async function saveZoomOAuthRecordToDb(
  coachEmail: string,
  record: ZoomOAuthRecord,
): Promise<{ saved: boolean }> {
  const key = normalizeCoachEmailKey(coachEmail || record.connectedByEmail);
  if (!key) {
    console.error("saveZoomOAuthRecordToDb: missing coach email");
    return { saved: false };
  }

  try {
    // Drop legacy singleton when this coach re-saves
    if (key !== ZOOM_OAUTH_LEGACY_ID) {
      await prisma.coachZoomOAuth
        .deleteMany({ where: { id: ZOOM_OAUTH_LEGACY_ID } })
        .catch(() => {});
    }

    await prisma.coachZoomOAuth.upsert({
      where: { id: key },
      create: {
        id: key,
        zoomUserId: record.zoomUserId,
        email: record.email,
        displayName: record.displayName,
        refreshToken: record.refreshToken,
        connectedAt: new Date(record.connectedAt),
        connectedByEmail: normalizeCoachEmailKey(record.connectedByEmail || key),
      },
      update: {
        zoomUserId: record.zoomUserId,
        email: record.email,
        displayName: record.displayName,
        refreshToken: record.refreshToken,
        connectedAt: new Date(record.connectedAt),
        connectedByEmail: normalizeCoachEmailKey(record.connectedByEmail || key),
      },
    });
    return { saved: true };
  } catch (e) {
    console.error("Failed to save Zoom OAuth record to database:", e);
    return { saved: false };
  }
}

export async function clearZoomOAuthRecordFromDb(
  coachEmail: string,
): Promise<{ saved: boolean }> {
  const key = normalizeCoachEmailKey(coachEmail);
  if (!key) return { saved: false };

  try {
    await prisma.coachZoomOAuth.deleteMany({
      where: {
        OR: [
          { id: key },
          { connectedByEmail: key },
          // Only clear legacy singleton if it belongs to this coach
          ...(key
            ? [{ id: ZOOM_OAUTH_LEGACY_ID, connectedByEmail: key }]
            : []),
        ],
      },
    });
    // If legacy row has empty connectedByEmail but zoom email matches coach
    await prisma.coachZoomOAuth
      .deleteMany({
        where: {
          id: ZOOM_OAUTH_LEGACY_ID,
          email: { equals: key, mode: "insensitive" },
        },
      })
      .catch(() => {});
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
