/**
 * One-shot: Blob/JSON gamification ledger → Postgres (no server-only deps).
 *
 *   vercel env pull .env.prod --environment production --yes
 *   set -a && source .env.prod && set +a
 *   npx tsx scripts/import-gamification-blob-prod.ts
 */
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "../src/lib/pg-connection";
import { head, list } from "@vercel/blob";

const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const pool = createPgPool(url);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BLOB_PATH = "demo/member-gamification.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-gamification.dev.json");

async function loadStore(): Promise<Record<string, any>> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    try {
      // Prefer direct blob URL if listed
      const listed = await list({ prefix: BLOB_PATH, token, limit: 5 });
      const hit = listed.blobs.find((b) => b.pathname === BLOB_PATH || b.pathname.endsWith(BLOB_PATH));
      if (hit?.url) {
        const res = await fetch(hit.url);
        if (res.ok) return (await res.json()) as Record<string, any>;
      }
      // Fallback: construct via head
      const meta = await head(BLOB_PATH, { token }).catch(() => null);
      if (meta?.url) {
        const res = await fetch(meta.url);
        if (res.ok) return (await res.json()) as Record<string, any>;
      }
    } catch (e) {
      console.warn("blob load failed, trying local file", e);
    }
  }
  try {
    const fs = await import("fs");
    if (fs.existsSync(DEV_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
    }
  } catch {
    /* empty */
  }
  return {};
}

function seasonKey(): string {
  const days = 28;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const epoch = Date.UTC(2026, 0, 1);
  const dayIndex = Math.floor((start.getTime() - epoch) / 86_400_000);
  const bucket = Math.floor(dayIndex / days) * days;
  const bucketStart = new Date(epoch + bucket * 86_400_000);
  return `roll-${bucketStart.toISOString().slice(0, 10)}-d${days}`;
}

async function main() {
  const store = await loadStore();
  const keys = Object.keys(store).filter((k) => k && !k.startsWith("_"));
  console.log("blob users", keys.length);
  const sk = seasonKey();
  let imported = 0;
  let skipped = 0;
  for (const userId of keys) {
    const raw = store[userId];
    const events = Array.isArray(raw?.events) ? raw.events : [];
    for (const ev of events) {
      if (!ev?.id || typeof ev.points !== "number") {
        skipped += 1;
        continue;
      }
      try {
        await prisma.gamificationEvent.create({
          data: {
            id: String(ev.id),
            userId,
            type: String(ev.type || "workout_logged"),
            points: Math.max(0, Math.round(ev.points)),
            label: String(ev.label || ev.type || "event"),
            at: new Date(ev.at || Date.now()),
            programSlug: ev.programSlug ?? null,
            seasonKey: sk,
          },
        });
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  console.log({ imported, skipped });

  // Season scores
  const users = await prisma.gamificationEvent.groupBy({
    by: ["userId"],
    _sum: { points: true },
    _count: true,
  });
  const windowStart = new Date(Date.now() - 28 * 86_400_000);
  for (const u of users) {
    const evs = await prisma.gamificationEvent.findMany({
      where: { userId: u.userId, at: { gte: windowStart } },
      select: { points: true, at: true },
    });
    const points = evs.reduce((s, e) => s + e.points, 0);
    const days = new Set(evs.map((e) => e.at.toISOString().slice(0, 10)));
    const last = evs.length ? evs[evs.length - 1].at : null;
    await prisma.gamificationSeasonScore.upsert({
      where: { userId_seasonKey: { userId: u.userId, seasonKey: sk } },
      create: {
        userId: u.userId,
        seasonKey: sk,
        division: "explorer",
        points,
        activeDays: days.size,
        lastEventAt: last,
      },
      update: {
        points,
        activeDays: days.size,
        lastEventAt: last,
      },
    });
  }
  console.log("season scores", users.length);

  try {
    await prisma.gamificationAuditLog.create({
      data: {
        actorId: "script:import-blob",
        actorRole: "SYSTEM",
        action: "points.import_blob",
        detail: { imported, skipped, users: keys.length },
      },
    });
  } catch (e) {
    console.warn("audit write", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end?.();
  });
