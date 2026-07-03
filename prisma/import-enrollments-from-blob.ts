import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

import { Role } from "../src/generated/prisma/client";
import { hydrateJsonStore } from "../src/lib/demo-json-blob";
import { DEMO_USER_DIRECTORY } from "../src/lib/demo-user-directory";
import { createPgPool } from "../src/lib/pg-connection";

type PerUserEnrollments = Record<string, { currentWeek: number; currentDay: number }>;
type DemoEnrollmentsStore = Record<string, PerUserEnrollments>;

const ENROLLMENTS_BLOB = "demo/member-enrollments.json";
const ENROLLMENTS_DEV = path.join(process.cwd(), "prisma", "enrollments.dev.json");

function normalizeEnrollmentsStore(raw: unknown): DemoEnrollmentsStore {
  if (!raw || typeof raw !== "object") return {};
  const parsed = raw as DemoEnrollmentsStore;
  if (
    !parsed["demo-user"] &&
    Object.keys(parsed).some(
      (k) =>
        !k.startsWith("_") &&
        typeof parsed[k] === "object" &&
        "currentWeek" in (parsed[k] as object),
    )
  ) {
    return { "demo-user": parsed as unknown as PerUserEnrollments };
  }
  return parsed;
}

function defaultEnrollmentsStore(): DemoEnrollmentsStore {
  return {
    "demo-user-john-steph": {
      adult: { currentWeek: 2, currentDay: 5 },
    },
    "demo-user": {
      adult: { currentWeek: 2, currentDay: 5 },
      "john-steph": { currentWeek: 1, currentDay: 2 },
    },
  };
}

async function loadEnrollmentSnapshot(): Promise<DemoEnrollmentsStore> {
  let memory: DemoEnrollmentsStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: ENROLLMENTS_BLOB,
    localPath: ENROLLMENTS_DEV,
    memory,
    setMemory: (v) => {
      memory = normalizeEnrollmentsStore(v);
    },
    fallback: defaultEnrollmentsStore,
    preferFresh: true,
  });
  const store = normalizeEnrollmentsStore(hydrated);
  const hasRows = Object.entries(store).some(
    ([key, perUser]) => !key.startsWith("_") && Object.keys(perUser || {}).length > 0,
  );
  return hasRows ? store : defaultEnrollmentsStore();
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
    console.error(
      "[import-enrollments] No Postgres URL — pull Vercel production env.",
    );
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");

  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  console.log("[import-enrollments] Loading blob enrollment snapshot…");
  const store = await loadEnrollmentSnapshot();

  const userIdByDemoKey = new Map<string, string>();
  let usersUpserted = 0;

  for (const entry of DEMO_USER_DIRECTORY) {
    const role = roleForDemoId(entry.id);
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        phone: entry.phone ?? undefined,
        role,
      },
      create: {
        email: entry.email,
        name: entry.name,
        phone: entry.phone ?? undefined,
        role,
      },
    });
    userIdByDemoKey.set(entry.id, user.id);
    usersUpserted += 1;
  }

  const programs = await prisma.program.findMany({
    select: { id: true, slug: true },
  });
  const programIdBySlug = new Map(programs.map((p) => [p.slug, p.id]));

  let enrollmentsUpserted = 0;
  let enrollmentsSkipped = 0;

  for (const [demoUserKey, perUser] of Object.entries(store as DemoEnrollmentsStore)) {
    if (demoUserKey.startsWith("_")) continue;
    const userId = userIdByDemoKey.get(demoUserKey);
    if (!userId) {
      console.warn(`[import-enrollments] Skip unknown demo user key: ${demoUserKey}`);
      continue;
    }

    for (const [slug, pos] of Object.entries(perUser || {})) {
      const programId = programIdBySlug.get(slug);
      if (!programId) {
        enrollmentsSkipped += 1;
        continue;
      }

      const existing = await prisma.programEnrollment.findFirst({
        where: { userId, programId },
      });
      if (existing) {
        await prisma.programEnrollment.update({
          where: { id: existing.id },
          data: {
            currentWeek: pos.currentWeek ?? 1,
            currentDay: pos.currentDay ?? 1,
          },
        });
      } else {
        await prisma.programEnrollment.create({
          data: {
            userId,
            programId,
            currentWeek: pos.currentWeek ?? 1,
            currentDay: pos.currentDay ?? 1,
          },
        });
      }
      enrollmentsUpserted += 1;
    }
  }

  console.log("[import-enrollments] Done:", {
    usersUpserted,
    enrollmentsUpserted,
    enrollmentsSkipped,
    source: "blob-or-local-seed",
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});