#!/usr/bin/env node
/**
 * Wake on member friction: error-boundary clicks, member_error events.
 *
 *   MINUTES=600 INTERVAL_SEC=30 npx tsx scripts/watch-member-friction.mjs
 *
 * stdout is only ACTION_REQUIRED / DONE / FAILED for the monitor tool.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const TOTAL_MS = Math.max(5, Number(process.env.MINUTES || "600")) * 60 * 1000;
const INTERVAL_MS = Math.max(30, Number(process.env.INTERVAL_SEC || "30")) * 1000;
const LOG =
  process.env.WATCH_LOG ||
  `${process.env.HOME}/.grok/long-running-background-tasks/watch-member-friction.log`;

function dbg(line) {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* ignore */
  }
}

function fmt(d) {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isFriction(e) {
  if (e.eventType === "member_error") return true;
  const t = `${e.elementText || ""} ${e.clickAction || ""}`;
  return /try again|open today|couldn.?t open/i.test(t);
}

async function main() {
  const pool = createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let since = new Date(Date.now() - 2 * 60 * 1000);
  const started = Date.now();
  dbg(`WATCH_START every=${INTERVAL_MS / 1000}s for=${TOTAL_MS / 60000}m`);

  while (Date.now() - started < TOTAL_MS) {
    try {
      const events = await prisma.analyticsEvent.findMany({
        where: { occurredAt: { gt: since } },
        orderBy: { occurredAt: "asc" },
        select: {
          occurredAt: true,
          eventType: true,
          pagePath: true,
          elementText: true,
          clickAction: true,
          userId: true,
          deviceType: true,
        },
        take: 200,
      });
      const hits = events.filter(isFriction);
      if (hits.length) {
        const ids = [...new Set(hits.map((e) => e.userId).filter(Boolean))];
        const users = ids.length
          ? await prisma.user.findMany({
              where: { id: { in: ids } },
              select: { id: true, email: true, name: true },
            })
          : [];
        const who = Object.fromEntries(
          users.map((u) => [u.id, `${u.name || "?"} <${u.email}>`]),
        );
        for (const e of hits) {
          const label = String(e.elementText || e.clickAction || "")
            .replace(/\s+/g, " ")
            .slice(0, 120);
          const line = `FRICTION ${fmt(e.occurredAt)} PT | ${who[e.userId] || e.userId || "anon"} | ${e.deviceType || "-"} | ${e.eventType} | ${e.pagePath || ""} | ${label}`;
          dbg(line);
          console.log(`ACTION_REQUIRED: ${line}`);
        }
        since = hits[hits.length - 1].occurredAt;
      } else if (events.length) {
        since = events[events.length - 1].occurredAt;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dbg(`WATCH_ERR ${msg}`);
      console.log(`ACTION_REQUIRED: WATCH_ERR ${msg}`);
    }
    await sleep(INTERVAL_MS);
  }

  dbg("WATCH_DONE");
  console.log("DONE");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.log(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
