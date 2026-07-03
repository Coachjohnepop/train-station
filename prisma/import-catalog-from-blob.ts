import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  importCatalogSnapshot,
  loadCatalogSnapshotFromDemoSources,
} from "../src/lib/import-catalog-snapshot";
import { isCoachCatalogDemo } from "../src/lib/catalog-mode";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";

async function main() {
  if (isCoachCatalogDemo()) {
    console.error(
      "[import-catalog] DATABASE_URL is unset or dummy — set a real Postgres URL first.",
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("[import-catalog] Loading live blob / local seed snapshot…");
  const { snapshot, source } = await loadCatalogSnapshotFromDemoSources();
  console.log(
    `[import-catalog] Source: ${source} — ${snapshot.exercises?.length ?? 0} exercises, ${snapshot.workouts?.length ?? 0} workouts, ${snapshot.programDays?.length ?? 0} program days`,
  );

  const result = await importCatalogSnapshot(prisma, snapshot, source);
  console.log("[import-catalog] Done:", result);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});