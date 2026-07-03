import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

import { Role } from "../src/generated/prisma/client";
import { hydrateJsonStore } from "../src/lib/demo-json-blob";
import type {
  DemoExercisePerformanceRow,
  DemoWorkoutLogRow,
} from "../src/lib/demo-member-progress-store";
import { DEMO_USER_DIRECTORY } from "../src/lib/demo-user-directory";
import { createPgPool } from "../src/lib/pg-connection";

type DemoLogsStore = {
  workoutLogs: DemoWorkoutLogRow[];
  performances: DemoExercisePerformanceRow[];
};

const LOGS_BLOB = "demo/member-workout-logs.json";
const LOGS_DEV = path.join(process.cwd(), "prisma", "logs.dev.json");
const LOGS_DEV_BAK = path.join(process.cwd(), "prisma", "logs.dev.json.bak");

function emptyLogs(): DemoLogsStore {
  return { workoutLogs: [], performances: [] };
}

async function loadLogsSnapshot(): Promise<DemoLogsStore> {
  let memory: DemoLogsStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: LOGS_BLOB,
    localPath: LOGS_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as DemoLogsStore) || emptyLogs();
    },
    fallback: emptyLogs,
    preferFresh: true,
  });
  const store: DemoLogsStore = {
    workoutLogs: Array.isArray(hydrated.workoutLogs) ? hydrated.workoutLogs : [],
    performances: Array.isArray(hydrated.performances) ? hydrated.performances : [],
  };
  if (store.workoutLogs.length === 0 && store.performances.length === 0) {
    try {
      const fs = await import("node:fs");
      if (fs.existsSync(LOGS_DEV_BAK)) {
        const bak = JSON.parse(fs.readFileSync(LOGS_DEV_BAK, "utf8")) as DemoLogsStore;
        return {
          workoutLogs: Array.isArray(bak.workoutLogs) ? bak.workoutLogs : [],
          performances: Array.isArray(bak.performances) ? bak.performances : [],
        };
      }
    } catch {
      // ignore
    }
  }
  return store;
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

function roleForDemoId(demoId: string): Role {
  if (demoId.includes("coach")) {
    return demoId.includes("john") && !demoId.includes("jeremy")
      ? Role.ADMIN
      : Role.INSTRUCTOR;
  }
  if (demoId === "demo-user-3") return Role.PROSPECTIVE_INSTRUCTOR;
  return Role.MEMBER;
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error("[import-logs] No Postgres URL — pull Vercel production env.");
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");

  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  console.log("[import-logs] Loading blob workout-log snapshot…");
  const store = await loadLogsSnapshot();

  const userIdByDemoKey = new Map<string, string>();
  for (const entry of DEMO_USER_DIRECTORY) {
    const role = roleForDemoId(entry.id);
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: { name: entry.name, phone: entry.phone ?? undefined, role },
      create: {
        email: entry.email,
        name: entry.name,
        phone: entry.phone ?? undefined,
        role,
      },
    });
    userIdByDemoKey.set(entry.id, user.id);
  }

  const workoutIds = new Set(
    (await prisma.workout.findMany({ select: { id: true } })).map((w) => w.id),
  );
  const exerciseIds = new Set(
    (await prisma.exercise.findMany({ select: { id: true } })).map((e) => e.id),
  );

  let logsImported = 0;
  let logsSkipped = 0;
  let perfsImported = 0;
  let perfsSkipped = 0;

  for (const log of store.workoutLogs) {
    const userId = userIdByDemoKey.get(log.userId);
    if (!userId || !workoutIds.has(log.workoutId)) {
      logsSkipped += 1;
      continue;
    }

    const performedAt = new Date(log.performedAt);
    const existing = await prisma.workoutLog.findFirst({
      where: { userId, workoutId: log.workoutId, performedAt },
    });
    if (existing) {
      await prisma.workoutLog.update({
        where: { id: existing.id },
        data: {
          completed: log.completed ?? true,
          progress: log.progress ?? 100,
        },
      });
    } else {
      await prisma.workoutLog.create({
        data: {
          userId,
          workoutId: log.workoutId,
          performedAt,
          completed: log.completed ?? true,
          progress: log.progress ?? 100,
        },
      });
    }
    logsImported += 1;
  }

  for (const perf of store.performances) {
    const userId = userIdByDemoKey.get(perf.userId);
    if (!userId || !exerciseIds.has(perf.exerciseId)) {
      perfsSkipped += 1;
      continue;
    }

    const performedAt = new Date(perf.performedAt);
    const existing = await prisma.exercisePerformance.findFirst({
      where: {
        userId,
        exerciseId: perf.exerciseId,
        performedAt,
        setScheme: perf.setScheme,
      },
    });
    if (existing) {
      await prisma.exercisePerformance.update({
        where: { id: existing.id },
        data: {
          workoutExerciseId: perf.workoutExerciseId ?? null,
          weightTier: perf.weightTier,
          startingWeightLbs: perf.startingWeightLbs ?? null,
          repsCompleted: perf.repsCompleted ?? null,
          setsCompleted: perf.setsCompleted ?? null,
        },
      });
    } else {
      await prisma.exercisePerformance.create({
        data: {
          userId,
          exerciseId: perf.exerciseId,
          workoutExerciseId: perf.workoutExerciseId ?? null,
          setScheme: perf.setScheme,
          weightTier: perf.weightTier,
          startingWeightLbs: perf.startingWeightLbs ?? null,
          repsCompleted: perf.repsCompleted ?? null,
          setsCompleted: perf.setsCompleted ?? null,
          performedAt,
        },
      });
    }
    perfsImported += 1;
  }

  console.log("[import-logs] Done:", {
    logsImported,
    logsSkipped,
    perfsImported,
    perfsSkipped,
    sourceRows: {
      workoutLogs: store.workoutLogs.length,
      performances: store.performances.length,
    },
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});