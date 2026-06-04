import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when prisma/schema.prisma changes so dev hot-reload gets a fresh client. */
const PRISMA_SCHEMA_VERSION = 3;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

function createPrisma(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";

  const adapter = new PrismaPg({ connectionString });

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