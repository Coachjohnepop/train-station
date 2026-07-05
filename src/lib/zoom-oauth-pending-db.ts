import "server-only";

import { prisma } from "@/lib/prisma";
import type { ZoomOAuthPending } from "@/lib/zoom-oauth-pending";

const TTL_MS = 15 * 60 * 1000;

function cutoffDate(): Date {
  return new Date(Date.now() - TTL_MS);
}

export async function pruneExpiredPendingStatesDb(): Promise<void> {
  await prisma.zoomOAuthPendingState.deleteMany({
    where: { createdAt: { lt: cutoffDate() } },
  });
}

export async function loadPendingStatesFromDb(): Promise<Record<string, ZoomOAuthPending>> {
  await pruneExpiredPendingStatesDb();
  const rows = await prisma.zoomOAuthPendingState.findMany();
  const map: Record<string, ZoomOAuthPending> = {};
  for (const row of rows) {
    map[row.state] = {
      coachEmail: row.coachEmail,
      createdAt: row.createdAt.toISOString(),
    };
  }
  return map;
}

export async function deletePendingStatesForCoachDb(coachEmail: string): Promise<void> {
  await prisma.zoomOAuthPendingState.deleteMany({
    where: { coachEmail },
  });
}

export async function upsertPendingStateDb(
  state: string,
  pending: ZoomOAuthPending,
): Promise<void> {
  await prisma.zoomOAuthPendingState.upsert({
    where: { state },
    create: {
      state,
      coachEmail: pending.coachEmail,
      createdAt: new Date(pending.createdAt),
    },
    update: {
      coachEmail: pending.coachEmail,
      createdAt: new Date(pending.createdAt),
    },
  });
}

export async function deletePendingStateDb(state: string): Promise<void> {
  try {
    await prisma.zoomOAuthPendingState.delete({ where: { state } });
  } catch {
    // Already consumed or expired.
  }
}