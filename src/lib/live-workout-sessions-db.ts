import "server-only";

import type { LiveRestActive, LiveWorkoutSession } from "@/lib/live-workout-session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

function toIso(value: Date): string {
  return value.toISOString();
}

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function parseCompletedSets(raw: unknown): Record<string, number[]> {
  const obj = parseJsonRecord(raw);
  const out: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!Array.isArray(value)) continue;
    const nums = value.filter((v): v is number => typeof v === "number");
    if (nums.length > 0) out[key] = nums;
  }
  return out;
}

function parseWeights(raw: unknown): Record<string, string> {
  const obj = parseJsonRecord(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parseRestActive(raw: unknown): LiveRestActive | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.blockId !== "string") return undefined;
  if (typeof o.completedSetNum !== "number") return undefined;
  if (typeof o.endsAt !== "number") return undefined;
  if (typeof o.totalSeconds !== "number") return undefined;
  const startedBy = o.startedBy === "member" ? "member" : "coach";
  const phase = o.phase === "exercise" || o.phase === "rest" ? o.phase : undefined;
  return {
    blockId: o.blockId,
    completedSetNum: o.completedSetNum,
    endsAt: o.endsAt,
    totalSeconds: o.totalSeconds,
    startedBy,
    phase,
  };
}

function rowToSession(row: {
  userId: string;
  workoutId: string;
  sessionDate: string;
  completedSets: unknown;
  finishedExercises: string[];
  weights: unknown;
  activeId: string | null;
  restTimerEnabled?: boolean | null;
  restTimerSeconds?: number | null;
  restTimerSound?: string | null;
  restActive?: unknown;
  updatedBy: string;
  revision: number;
  updatedAt: Date;
}): LiveWorkoutSession {
  const restActive = parseRestActive(row.restActive);
  return {
    userId: row.userId,
    workoutId: row.workoutId,
    sessionDate: row.sessionDate,
    completedSets: parseCompletedSets(row.completedSets),
    finishedExercises: row.finishedExercises,
    weights: parseWeights(row.weights),
    activeId: row.activeId ?? undefined,
    restTimerEnabled:
      typeof row.restTimerEnabled === "boolean" ? row.restTimerEnabled : undefined,
    restTimerSeconds:
      typeof row.restTimerSeconds === "number" ? row.restTimerSeconds : undefined,
    restTimerSound: row.restTimerSound ?? undefined,
    restActive: restActive === undefined ? undefined : restActive,
    updatedAt: toIso(row.updatedAt),
    updatedBy: row.updatedBy === "member" ? "member" : "coach",
    revision: row.revision,
  };
}

function sessionToRow(session: LiveWorkoutSession) {
  return {
    userId: session.userId,
    workoutId: session.workoutId,
    sessionDate: session.sessionDate,
    completedSets: session.completedSets as Prisma.InputJsonValue,
    finishedExercises: session.finishedExercises,
    weights: session.weights as Prisma.InputJsonValue,
    activeId: session.activeId ?? null,
    restTimerEnabled: session.restTimerEnabled ?? null,
    restTimerSeconds: session.restTimerSeconds ?? null,
    restTimerSound: session.restTimerSound ?? null,
    restActive: (session.restActive ?? null) as Prisma.InputJsonValue,
    updatedBy: session.updatedBy,
    revision: session.revision,
    updatedAt: new Date(session.updatedAt),
  };
}

export async function getLiveWorkoutSessionFromDb(input: {
  userId: string;
  workoutId: string;
  sessionDate: string;
}): Promise<LiveWorkoutSession | null> {
  const row = await prisma.liveWorkoutSession.findUnique({
    where: {
      userId_workoutId_sessionDate: {
        userId: input.userId,
        workoutId: input.workoutId,
        sessionDate: input.sessionDate,
      },
    },
  });
  return row ? rowToSession(row) : null;
}

export async function upsertLiveWorkoutSessionToDb(session: LiveWorkoutSession): Promise<void> {
  const data = sessionToRow(session);
  await prisma.liveWorkoutSession.upsert({
    where: {
      userId_workoutId_sessionDate: {
        userId: session.userId,
        workoutId: session.workoutId,
        sessionDate: session.sessionDate,
      },
    },
    create: data,
    update: {
      completedSets: data.completedSets,
      finishedExercises: data.finishedExercises,
      weights: data.weights,
      activeId: data.activeId,
      restTimerEnabled: data.restTimerEnabled,
      restTimerSeconds: data.restTimerSeconds,
      restTimerSound: data.restTimerSound,
      restActive: data.restActive,
      updatedBy: data.updatedBy,
      revision: data.revision,
      updatedAt: data.updatedAt,
    },
  });
}

export async function deleteLiveWorkoutSessionFromDb(input: {
  userId: string;
  workoutId: string;
  sessionDate: string;
}): Promise<boolean> {
  const result = await prisma.liveWorkoutSession.deleteMany({
    where: {
      userId: input.userId,
      workoutId: input.workoutId,
      sessionDate: input.sessionDate,
    },
  });
  return result.count > 0;
}

export async function probeLiveWorkoutSessionsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.liveWorkoutSession.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Live workout sessions DB probe failed";
    return { ok: false, message };
  }
}