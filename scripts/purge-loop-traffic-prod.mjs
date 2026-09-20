#!/usr/bin/env node
/**
 * Strip Playwright / landing-loop noise from prod analytics + fake members
 * so Station pulse counts real traffic.
 *
 *   DRY_RUN=1 npx tsx scripts/purge-loop-traffic-prod.mjs
 *   npx tsx scripts/purge-loop-traffic-prod.mjs
 */
import { createRequire } from "module";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.vercel.production", override: true });
dotenv.config({ path: ".env.vercel.prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const LEGACY_IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const KEEP_EMAILS = new Set([
  "jeremy@thetrainstation.co",
  "john@thetrainstation.co",
  "demo@thetrainstation.co",
  "john@lemonvoice.com",
  "sprealty9@gmail.com",
  "johnsteph@thetrainstation.co",
  "coachjohnepop@yahoo.com",
]);

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("Need real Postgres URL (.env.vercel.prod / .env.vercel.production)");
  }
  return url;
}

function isLoopMember(user) {
  const email = (user.email || "").toLowerCase();
  const name = user.name || "";
  if (KEEP_EMAILS.has(email)) return false;
  if (user.role && user.role !== "MEMBER") return false;
  if (email.endsWith("@example.com") || email.endsWith("@mailinator.com")) return true;
  if (/^loop/i.test(name) || name.startsWith("Loop ")) return true;
  if (/^loop(own|jer)/i.test(name)) return true;
  if (email.startsWith("loop") && email.endsWith("@example.com")) return true;
  return false;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  console.log(`\n══ Purge loop traffic${DRY_RUN ? " (DRY RUN)" : ""} ══\n`);

  const loopSessions = await prisma.$queryRaw`
    SELECT id, "sessionKey", "userAgent", "landingPath", "startedAt"
    FROM "AnalyticsSession"
    WHERE COALESCE("userAgent", '') ~* 'TrainStationLoop|HeadlessChrome|Playwright'
       OR COALESCE("userAgent", '') = ${LEGACY_IPHONE_UA}
  `;
  const keys = [...new Set(loopSessions.map((s) => s.sessionKey).filter(Boolean))];
  console.log(`Loop analytics sessions: ${loopSessions.length} (keys=${keys.length})`);
  const uaCounts = new Map();
  for (const s of loopSessions) {
    const ua = (s.userAgent || "(none)").slice(0, 80);
    uaCounts.set(ua, (uaCounts.get(ua) || 0) + 1);
  }
  for (const [ua, n] of [...uaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${n}  ${ua}`);
  }

  if (!DRY_RUN && keys.length) {
    const ev = await prisma.analyticsEvent.deleteMany({
      where: { sessionKey: { in: keys } },
    });
    const sess = await prisma.analyticsSession.deleteMany({
      where: { sessionKey: { in: keys } },
    });
    console.log(`  deleted events=${ev.count} sessions=${sess.count}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  const purgeUsers = users.filter(isLoopMember);
  console.log(`\nLoop / example members: ${purgeUsers.length}`);
  for (const u of purgeUsers) {
    console.log(`  ${u.email}  name=${u.name || "—"}  ${u.id}`);
  }

  if (!DRY_RUN && purgeUsers.length) {
    const ids = purgeUsers.map((u) => u.id);
    const emails = purgeUsers.map((u) => u.email);
    await prisma.byowWorkoutExercise.deleteMany({
      where: { workout: { ownerUserId: { in: ids } } },
    });
    await prisma.byowWorkoutLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.byowSourceNote.deleteMany({ where: { ownerUserId: { in: ids } } });
    await prisma.byowWorkout.deleteMany({ where: { ownerUserId: { in: ids } } });
    await prisma.byowExercise.deleteMany({ where: { ownerUserId: { in: ids } } });
    await prisma.factSubscriptionPayment.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.analyticsEvent.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.analyticsSession.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.outboundNotification.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    const threads = await prisma.coachChatThread.findMany({
      where: { memberId: { in: ids } },
      select: { id: true },
    });
    if (threads.length) {
      const tids = threads.map((t) => t.id);
      await prisma.coachChatMessage.deleteMany({ where: { threadId: { in: tids } } });
      await prisma.coachChatThread.deleteMany({ where: { id: { in: tids } } });
    }
    await prisma.customTrainingOffer.deleteMany({
      where: { OR: [{ memberUserId: { in: ids } }, { memberEmail: { in: emails } }] },
    });
    const classes = await prisma.coachTodaySession.findMany();
    for (const row of classes) {
      if (!row.userIds.some((id) => ids.includes(id))) continue;
      await prisma.coachTodaySession.update({
        where: { id: row.id },
        data: { userIds: row.userIds.filter((id) => !ids.includes(id)) },
      });
    }
    const del = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`  deleted users=${del.count}`);
  }

  const waitlist = await prisma.waitlistEntry.findMany();
  const purgeWait = waitlist.filter((e) => {
    const email = (e.email || "").toLowerCase();
    if (KEEP_EMAILS.has(email)) return false;
    if (email.endsWith("@example.com") || email.endsWith("@mailinator.com")) return true;
    if ((e.source || "").startsWith("byow-") && /loop|playwright|test/i.test(email + (e.name || ""))) {
      return true;
    }
    return false;
  });
  console.log(`\nLoop waitlist rows: ${purgeWait.length}`);
  for (const e of purgeWait) console.log(`  ${e.email}  source=${e.source || "—"}`);
  if (!DRY_RUN && purgeWait.length) {
    const del = await prisma.waitlistEntry.deleteMany({
      where: { id: { in: purgeWait.map((e) => e.id) } },
    });
    console.log(`  deleted waitlist=${del.count}`);
  }

  if (!DRY_RUN) {
    console.log("\nRebuilding last-complete-week weekday snapshot…");
    const { snapshotLastCompleteWeek } = await import("../src/lib/analytics-weekday-snapshot.ts");
    const snap = await snapshotLastCompleteWeek();
    console.log(`  ${snap.label}`);
    for (const row of snap.rows) {
      console.log(`    ${row.label}  sessions=${row.sessions}  events=${row.events}`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
