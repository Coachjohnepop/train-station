import "server-only";

import { prisma } from "@/lib/prisma";

export type TodaySessionRecord = {
  id: string;
  sessionDate: string;
  scheduledAt: string;
  title: string;
  rawSms: string;
  workoutId: string;
  programSlug: string;
  userIds: string[];
  replacesSchedule: boolean;
  createdAt: string;
  createdBy?: string;
};

export type TodaySessionStore = {
  sessions: Record<string, TodaySessionRecord>;
};

function rowToSession(row: {
  id: string;
  sessionDate: string;
  scheduledAt: Date;
  title: string;
  rawSms: string;
  workoutId: string;
  programSlug: string;
  userIds: string[];
  replacesSchedule: boolean;
  createdAt: Date;
  createdBy: string | null;
}): TodaySessionRecord {
  return {
    id: row.id,
    sessionDate: row.sessionDate,
    scheduledAt: row.scheduledAt.toISOString(),
    title: row.title,
    rawSms: row.rawSms,
    workoutId: row.workoutId,
    programSlug: row.programSlug,
    userIds: row.userIds,
    replacesSchedule: row.replacesSchedule,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? undefined,
  };
}

function sessionToRowData(session: TodaySessionRecord) {
  return {
    sessionDate: session.sessionDate,
    scheduledAt: new Date(session.scheduledAt),
    title: session.title,
    rawSms: session.rawSms,
    workoutId: session.workoutId,
    programSlug: session.programSlug,
    userIds: session.userIds,
    replacesSchedule: session.replacesSchedule,
    createdAt: new Date(session.createdAt),
    createdBy: session.createdBy ?? null,
  };
}

export async function loadSessionsFromDb(): Promise<TodaySessionStore> {
  const rows = await prisma.coachTodaySession.findMany({
    orderBy: { scheduledAt: "asc" },
  });
  const sessions: Record<string, TodaySessionRecord> = {};
  for (const row of rows) {
    sessions[row.id] = rowToSession(row);
  }
  return { sessions };
}

export async function upsertSessionDb(session: TodaySessionRecord): Promise<void> {
  const data = sessionToRowData(session);
  await prisma.coachTodaySession.upsert({
    where: { id: session.id },
    create: { id: session.id, ...data },
    update: data,
  });
}

export async function persistSessionsToDb(store: TodaySessionStore): Promise<void> {
  for (const session of Object.values(store.sessions)) {
    await upsertSessionDb(session);
  }
}

export async function deleteSessionFromDb(sessionId: string): Promise<boolean> {
  try {
    await prisma.coachTodaySession.delete({ where: { id: sessionId } });
    return true;
  } catch {
    return false;
  }
}

export async function deleteSessionsForUserOnDateDb(
  userId: string,
  sessionDate: string,
): Promise<boolean> {
  const rows = await prisma.coachTodaySession.findMany({
    where: { sessionDate, userIds: { has: userId } },
    select: { id: true },
  });
  if (rows.length === 0) return false;
  await prisma.coachTodaySession.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  return true;
}

export async function countSessionsDb(): Promise<number> {
  return prisma.coachTodaySession.count();
}