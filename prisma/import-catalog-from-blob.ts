import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

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
      "[import-catalog] No Postgres URL — pull Vercel production env (POSTGRES_PRISMA_URL).",
    );
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { createPgPool } = await import("../src/lib/pg-connection");
  const { importCatalogSnapshot, loadCatalogSnapshotFromDemoSources } = await import(
    "../src/lib/import-catalog-snapshot",
  );

  const adapter = new PrismaPg(createPgPool(connectionString));
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