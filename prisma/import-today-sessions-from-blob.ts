import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

import { hydrateJsonStore } from "../src/lib/demo-json-blob";
import { createPgPool } from "../src/lib/pg-connection";

type TodaySession = {
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

type TodaySessionStore = {
  sessions: Record<string, TodaySession>;
};

const SESSIONS_BLOB = "demo/today-sessions.json";
const SESSIONS_DEV = path.join(process.cwd(), "prisma", "today-sessions.dev.json");

function emptyStore(): TodaySessionStore {
  return { sessions: {} };
}

async function loadSessionsSnapshot(): Promise<TodaySessionStore> {
  let memory: TodaySessionStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: SESSIONS_BLOB,
    localPath: SESSIONS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as TodaySessionStore) || emptyStore();
    },
    fallback: emptyStore,
    preferFresh: true,
  });
  const sessions = (hydrated as TodaySessionStore)?.sessions ?? {};
  return { sessions: typeof sessions === "object" ? sessions : {} };
}

function resolveConnectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? "";
  const pooled =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  return (
    direct ||
    (database && !database.includes("dummy") ? database : "") ||
    pooled
  );
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error(
      "[import-today-sessions] No Postgres URL — pull Vercel production env.",
    );
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");

  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  console.log("[import-today-sessions] Loading blob session snapshot…");
  const store = await loadSessionsSnapshot();
  const rows = Object.values(store.sessions);

  let imported = 0;
  let skipped = 0;

  for (const session of rows) {
    if (!session?.id || !session.sessionDate || !session.workoutId) {
      skipped += 1;
      continue;
    }

    await prisma.coachTodaySession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        sessionDate: session.sessionDate,
        scheduledAt: new Date(session.scheduledAt),
        title: session.title || "Workout",
        rawSms: session.rawSms || "",
        workoutId: session.workoutId,
        programSlug: session.programSlug || "adult",
        userIds: Array.isArray(session.userIds) ? session.userIds : [],
        replacesSchedule: session.replacesSchedule ?? true,
        createdAt: new Date(session.createdAt || Date.now()),
        createdBy: session.createdBy ?? null,
      },
      update: {
        sessionDate: session.sessionDate,
        scheduledAt: new Date(session.scheduledAt),
        title: session.title || "Workout",
        rawSms: session.rawSms || "",
        workoutId: session.workoutId,
        programSlug: session.programSlug || "adult",
        userIds: Array.isArray(session.userIds) ? session.userIds : [],
        replacesSchedule: session.replacesSchedule ?? true,
        createdBy: session.createdBy ?? null,
      },
    });
    imported += 1;
  }

  console.log("[import-today-sessions] Done:", {
    imported,
    skipped,
    sourceRows: rows.length,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});