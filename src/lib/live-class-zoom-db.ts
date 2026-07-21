import "server-only";

import type { LiveClassZoomRecord } from "@/lib/live-class-zoom";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

function parseRecord(raw: unknown): LiveClassZoomRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sessionDate !== "string" || typeof r.joinUrl !== "string") return null;
  return raw as LiveClassZoomRecord;
}

export async function getLiveClassZoomFromDb(
  sessionDate: string,
): Promise<LiveClassZoomRecord | null> {
  try {
    const row = await prisma.liveClassZoomDay.findUnique({
      where: { sessionDate },
    });
    if (!row) return null;
    return parseRecord(row.record);
  } catch {
    return null;
  }
}

export async function upsertLiveClassZoomToDb(
  sessionDate: string,
  record: LiveClassZoomRecord,
): Promise<void> {
  try {
    await prisma.liveClassZoomDay.upsert({
      where: { sessionDate },
      create: {
        sessionDate,
        record: record as unknown as Prisma.InputJsonValue,
      },
      update: {
        record: record as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.warn("live class zoom db upsert failed", err);
  }
}

export async function deleteLiveClassZoomFromDb(sessionDate: string): Promise<void> {
  try {
    await prisma.liveClassZoomDay.delete({ where: { sessionDate } }).catch(() => null);
  } catch {
    /* ignore */
  }
}
