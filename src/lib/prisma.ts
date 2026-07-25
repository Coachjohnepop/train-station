import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-config";
import { createPgPool } from "@/lib/pg-connection";

/** Bump when prisma/schema.prisma changes so dev hot-reload gets a fresh client. */
const PRISMA_SCHEMA_VERSION = 10;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

function createPrisma(): PrismaClient {
  const connectionString = resolveDatabaseUrl() || "postgresql://user:pass@localhost:5432/db";

  if (!connectionString || connectionString.includes("dummy") || connectionString.includes("user:pass") || connectionString.includes("localhost")) {
    // Demo mode or no real DB / placeholder: return a proxy that throws if accidentally used.
    // Prevents adapter/client creation errors with placeholder, dummy, or local URLs in preview envs.
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error(
          "Prisma client accessed in demo mode (DATABASE_URL contains 'dummy', is unset, or is a placeholder/local URL). " +
          "Use isDemoMode() checks before any DB access. For previews, set DATABASE_URL=dummy in Vercel env."
        );
      },
    });
  }

  const adapter = new PrismaPg(createPgPool(connectionString));

  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  const stale =
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION;

  if (stale || !globalForPrisma.prisma) {
    void globalForPrisma.prisma?.$disconnect();
    globalForPrisma.prisma = createPrisma();
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrisma();