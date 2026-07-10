import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });

import { hydrateJsonStore } from "../src/lib/demo-json-blob";
import { createPgPool } from "../src/lib/pg-connection";
import { normalizeAccountEmail } from "../src/lib/account-email";
import type { Role } from "../src/generated/prisma/client";

type StoredMemberAccount = {
  userId: string;
  role: string;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  hidden?: boolean;
  createdAt: string;
};

type RegisteredAccountsStore = Record<string, StoredMemberAccount>;

const AUTH_BLOB = "demo/registered-accounts.json";
const AUTH_DEV = path.join(process.cwd(), "prisma", "registered-accounts.dev.json");

const STORE_ALIASES: Record<string, string> = {
  auth: "auth",
  "registered-accounts": "auth",
};

function parseArgs(argv: string[]) {
  const storesArg = argv.find((a) => a.startsWith("--stores="))?.split("=")[1] ?? "auth";
  return {
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose"),
    stores: storesArg
      .split(",")
      .map((s) => STORE_ALIASES[s.trim()] ?? s.trim())
      .filter(Boolean),
  };
}

function resolveConnectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DIRECT_URL ?? "";
  const pooled =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  return (
    direct ||
    (pooled && !pooled.includes("dummy") ? pooled : "")
  );
}

async function loadAuthSnapshot(): Promise<RegisteredAccountsStore> {
  let memory: RegisteredAccountsStore | null = null;
  const hydrated = await hydrateJsonStore({
    blobPath: AUTH_BLOB,
    localPath: AUTH_DEV,
    memory,
    setMemory: (v) => {
      memory = (v as RegisteredAccountsStore) || {};
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  return (hydrated as RegisteredAccountsStore) || {};
}

async function importAuth(
  prisma: import("../src/generated/prisma/client").PrismaClient,
  opts: { dryRun: boolean; verbose: boolean },
) {
  const store = await loadAuthSnapshot();
  const entries = Object.entries(store);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [rawEmail, account] of entries) {
    const email = normalizeAccountEmail(rawEmail);
    if (!email) {
      skipped += 1;
      continue;
    }
    if (account.hidden) {
      skipped += 1;
      if (opts.verbose) console.log(`[auth] skip hidden ${email}`);
      continue;
    }

    const data = {
      id: account.userId,
      email,
      name: account.name || "Member",
      phone: account.phone ?? null,
      role: account.role as Role,
      passwordHash: account.passwordHash ?? null,
      hidden: Boolean(account.hidden),
      hiddenAt: account.hidden ? new Date(account.createdAt) : null,
      registeredAt: new Date(account.createdAt),
    };

    if (opts.dryRun) {
      if (opts.verbose) console.log(`[auth] dry-run upsert ${email} → ${data.id}`);
      imported += 1;
      continue;
    }

    try {
      await prisma.user.upsert({
        where: { email },
        create: data,
        update: {
          name: data.name,
          phone: data.phone,
          role: data.role,
          passwordHash: data.passwordHash,
          hidden: data.hidden,
          hiddenAt: data.hiddenAt,
          registeredAt: data.registeredAt,
        },
      });
      imported += 1;
      if (opts.verbose) console.log(`[auth] upserted ${email}`);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${email}: ${message}`);
      console.error(`[auth] failed ${email}:`, message);
    }
  }

  const summary = {
    store: "auth",
    blobCount: entries.length,
    imported,
    skipped,
    orphanUserIds: [] as string[],
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error("[import-blob-stores] No Postgres URL — pull Vercel production env.");
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  try {
    for (const store of args.stores) {
      if (store === "auth") {
        await importAuth(prisma, { dryRun: args.dryRun, verbose: args.verbose });
      } else {
        console.warn(`[import-blob-stores] Store not implemented yet: ${store}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[import-blob-stores] fatal:", error);
  process.exit(1);
});