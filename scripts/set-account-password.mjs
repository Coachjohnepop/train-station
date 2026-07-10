#!/usr/bin/env node
/**
 * Set sign-in password for a registered account (Postgres + optional blob dual-write).
 *
 * Usage:
 *   node scripts/set-account-password.mjs <email> <password>
 *   npm run set-account-password -- jeremy@thetrainstation.co 'CoachTest123!'
 *
 * When DATABASE_URL / POSTGRES_PRISMA_URL is configured, updates User.passwordHash in Postgres.
 * When BLOB_MIGRATION_REGISTERED_ACCOUNTS_WRITE=dual (or blob), also updates the blob mirror.
 *
 * Deprecated: scripts/set-account-password-blob.mjs — use this script instead.
 */
import dotenv from "dotenv";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod", override: true });
dotenv.config({ path: ".env.vercel.production", override: true });

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

function isUsableDatabaseUrl(url) {
  if (!url) return false;
  if (url.includes("dummy")) return false;
  if (/user:pass@localhost/i.test(url)) return false;
  return true;
}

function resolveDatabaseUrl() {
  for (const url of [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ]) {
    if (url && isUsableDatabaseUrl(url)) return url;
  }
  return "";
}

async function setPasswordInPostgres(email, passwordHash) {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) return null;

  const { createPgPool } = await import("../src/lib/pg-connection.ts");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  try {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    const updated = await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    return {
      email: updated.email,
      userId: updated.id,
      role: updated.role,
      source: "postgres",
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function maybeSetPasswordInBlob(email, password) {
  const { writesToBlob } = await import("../src/lib/blob-migration-config.ts");
  const { isDatabaseConfigured } = await import("../src/lib/database-config.ts");
  const writeBlob =
    !isDatabaseConfigured() || writesToBlob("registered-accounts");
  if (!writeBlob) return null;

  const { setAccountPasswordBlob } = await import("./set-account-password-blob.mjs");
  const result = await setAccountPasswordBlob(email, password);
  return { ...result, source: "blob" };
}

export async function setAccountPassword(email, password) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password || password.length < 8) {
    throw new Error("Email and password (8+ chars) required.");
  }

  const passwordHash = hashPassword(password);
  const results = [];

  const dbResult = await setPasswordInPostgres(normalized, passwordHash);
  if (dbResult) {
    results.push(dbResult);
  }

  let blobResult = null;
  try {
    blobResult = await maybeSetPasswordInBlob(normalized, password);
    if (blobResult) results.push(blobResult);
  } catch (error) {
    if (!dbResult) throw error;
    console.warn(
      "⚠ Blob mirror update failed (Postgres updated):",
      error instanceof Error ? error.message : error,
    );
  }

  if (results.length === 0) {
    throw new Error(
      `No account found for ${normalized} in Postgres or blob. Import auth first or check email.`,
    );
  }

  const primary = dbResult ?? blobResult;
  if (dbResult) {
    const row = await (async () => {
      const connectionString = resolveDatabaseUrl();
      if (!connectionString) return null;
      const { createPgPool } = await import("../src/lib/pg-connection.ts");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { PrismaClient } = await import("../src/generated/prisma/client");
      const adapter = new PrismaPg(createPgPool(connectionString));
      const prisma = new PrismaClient({ adapter });
      try {
        return prisma.user.findUnique({ where: { email: normalized }, select: { passwordHash: true } });
      } finally {
        await prisma.$disconnect();
      }
    })();
    if (!row?.passwordHash || !verifyPassword(password, row.passwordHash)) {
      throw new Error("Postgres password verify failed after update.");
    }
  }

  return { ...primary, targets: results.map((r) => r.source) };
}

const isMain =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMain) {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: node scripts/set-account-password.mjs <email> <password>");
    process.exit(1);
  }
  setAccountPassword(email, password)
    .then((result) => {
      console.log(
        `✓ Password set for ${result.email} (${result.role}, ${result.userId}) → [${result.targets.join(", ")}]`,
      );
    })
    .catch((e) => {
      console.error("✗", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}