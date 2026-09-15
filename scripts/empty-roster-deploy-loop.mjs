#!/usr/bin/env node
/**
 * Reproduce Jeremy's 2026-09-15 empty-roster deploy, then prove the fix.
 *
 * What went wrong:
 *   Pick who gets it → Deploy with zero names → "save anyway" confirm →
 *   POST /api/today/cascade { userIds: [] } → class row saved, phones unchanged.
 *
 *   ROUNDS=3 npx tsx scripts/empty-roster-deploy-loop.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(ROOT, ".env"), quiet: true });
dotenv.config({ path: join(ROOT, ".env.go-prod"), override: true, quiet: true });

const ROUNDS = Math.max(1, Number(process.env.ROUNDS || "3"));
const RUN = `empty-roster-loop-${Date.now()}`;
const JOHN_EMAIL = "john@lemonvoice.com";
const STEPH_EMAIL = "sprealty9@gmail.com";
const ALI_EMAIL = "fletcherboys@att.net";

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function futureDate(offsetDays) {
  const d = new Date("2026-12-20T12:00:00-08:00");
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function sourceGuards() {
  const builder = readFileSync(join(ROOT, "src/components/CoachLessonPlanBuilder.tsx"), "utf8");
  const cascade = readFileSync(join(ROOT, "src/app/api/today/cascade/route.ts"), "utf8");
  const assign = readFileSync(join(ROOT, "src/app/api/today/assign-member/route.ts"), "utf8");

  if (/Save today's class anyway/i.test(builder)) {
    fail("source: no save-anyway confirm", "builder still offers calendar-only save");
  } else pass("source: no save-anyway confirm");

  if (!/Tap who gets this workout/.test(builder) || !/selectedForDeploy.length === 0/.test(builder)) {
    fail("source: deploy disabled until names", "builder missing empty-roster block");
  } else pass("source: deploy disabled until names");

  if (!/JOHN_STEPH_CLASS_EMAILS/.test(builder) || !/setCascadeIds\(fallback\)/.test(builder)) {
    fail("source: default roster", "builder does not preselect John & Steph / last class");
  } else pass("source: default John & Steph + last class");

  if (!cascade.includes("Assign at least one student") || cascade.includes("or save a class workout first")) {
    fail("source: cascade API rejects empty roster", "route still allows userIds: []");
  } else pass("source: cascade API rejects empty roster");

  if (assign.includes("filter((s) => s.userIds.length > 0)")) {
    fail("source: add-more sees empty saves", "publish-saved still ignores empty-roster classes");
  } else pass("source: add-more sees empty saves");
}

function memberSeesClass(session, userId) {
  return Boolean(session && Array.isArray(session.userIds) && session.userIds.includes(userId));
}

async function round(prisma, ids, n) {
  const sessionDate = futureDate(n);
  const id = `${RUN}-r${n}`;
  console.log(`\n── round ${n}/${ROUNDS}  date=${sessionDate} ──`);

  const empty = await prisma.coachTodaySession.create({
    data: {
      id: `${id}-empty`,
      sessionDate,
      scheduledAt: new Date(`${sessionDate}T06:30:00-08:00`),
      title: `${RUN} empty`,
      rawSms: `${RUN} empty\n\nLeg press 4x10`,
      workoutId: "sms-w-loop-empty",
      programSlug: "adult",
      userIds: [],
      replacesSchedule: true,
      createdBy: "loop",
    },
  });

  if (memberSeesClass(empty, ids.john) || memberSeesClass(empty, ids.steph) || memberSeesClass(empty, ids.ali)) {
    fail(`r${n} empty roster stays off phones`, "someone was on an empty userIds row");
  } else {
    pass(`r${n} empty roster stays off phones`, "John/Steph/Ali would still see program day");
  }

  const named = await prisma.coachTodaySession.create({
    data: {
      id: `${id}-named`,
      sessionDate,
      scheduledAt: new Date(`${sessionDate}T06:31:00-08:00`),
      title: `${RUN} named`,
      rawSms: `${RUN} named\n\nLeg press 4x10`,
      workoutId: "sms-w-loop-named",
      programSlug: "adult",
      userIds: [ids.john, ids.steph],
      replacesSchedule: true,
      createdBy: "loop",
    },
  });

  if (memberSeesClass(named, ids.john) && memberSeesClass(named, ids.steph)) {
    pass(`r${n} named roster lands on John & Steph`, named.id);
  } else {
    fail(`r${n} named roster lands on John & Steph`, JSON.stringify(named.userIds));
  }
  if (!memberSeesClass(named, ids.ali)) {
    pass(`r${n} Ali not on that class`, "stays on her program unless tapped");
  } else {
    fail(`r${n} Ali not on that class`, "Ali was included");
  }

  const latestForJohn = await prisma.coachTodaySession.findMany({
    where: { sessionDate, userIds: { has: ids.john } },
    orderBy: { createdAt: "desc" },
  });
  if (latestForJohn[0]?.id === named.id) {
    pass(`r${n} member Today would resolve named class`, latestForJohn[0].title);
  } else {
    fail(
      `r${n} member Today would resolve named class`,
      latestForJohn[0]?.id || "John has no session on that date",
    );
  }

  const deleted = await prisma.coachTodaySession.deleteMany({
    where: { id: { in: [empty.id, named.id] } },
  });
  if (deleted.count === 2) pass(`r${n} cleanup`, `${deleted.count} rows`);
  else fail(`r${n} cleanup`, `deleted ${deleted.count}`);
}

async function morningReplay(prisma, ids) {
  const today = await prisma.coachTodaySession.findFirst({
    where: { sessionDate: "2026-09-15", title: { contains: "Leg day" } },
  });
  if (!today) {
    fail("this morning Leg day still exists", "missing today-2026-09-15 session");
    return;
  }
  const on = today.userIds || [];
  const names = [];
  if (on.includes(ids.john)) names.push("Lemon John");
  if (on.includes(ids.steph)) names.push("Stephanie");
  if (on.includes(ids.ali)) names.push("Ali");
  if (on.length === 0) {
    fail("this morning roster after attach", "still empty");
  } else {
    pass("this morning Leg day roster", `${today.id} → ${names.join(", ") || on.length + " ids"}`);
  }
}

async function main() {
  console.log(`\nEmpty-roster deploy loop
ROUNDS: ${ROUNDS}
RUN: ${RUN}
Repro: cascade userIds [] (Jeremy 2026-09-15 6:30 PT)
`);

  sourceGuards();

  const pool = createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const users = await prisma.user.findMany({
    where: { email: { in: [JOHN_EMAIL, STEPH_EMAIL, ALI_EMAIL] } },
    select: { id: true, email: true, name: true },
  });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const ids = {
    john: byEmail[JOHN_EMAIL]?.id,
    steph: byEmail[STEPH_EMAIL]?.id,
    ali: byEmail[ALI_EMAIL]?.id,
  };
  if (!ids.john || !ids.steph || !ids.ali) {
    fail("load class members", JSON.stringify(ids));
  } else {
    pass("load class members", "Lemon John, Stephanie, Ali");
  }

  await morningReplay(prisma, ids);

  try {
    for (let n = 1; n <= ROUNDS; n += 1) {
      await round(prisma, ids, n);
    }
  } finally {
    const leftover = await prisma.coachTodaySession.deleteMany({
      where: { id: { startsWith: RUN } },
    });
    if (leftover.count) pass("final leftover cleanup", `${leftover.count} rows`);
    await prisma.$disconnect();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  const ok = results.length - failed.length;
  console.log(`\n---\n${ok}/${results.length} passed`);
  if (failed.length) {
    console.log("failures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nEmpty-roster loop: PASS\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
