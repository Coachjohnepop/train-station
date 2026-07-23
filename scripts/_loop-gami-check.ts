/**
 * Loop-test gamification integrity (no server-only imports).
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "../src/lib/pg-connection";

const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
if (!url) {
  console.error("NO_DATABASE_URL");
  process.exit(1);
}

const pool = createPgPool(url);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function freePoolDayInCycle(enrollmentDayLinear: number, freePercent: number, cycleDays = 28) {
  const freeDays = Math.max(1, Math.ceil((cycleDays * Math.min(100, Math.max(0, freePercent))) / 100));
  const dayInCycle = ((Math.max(1, enrollmentDayLinear) - 1) % cycleDays) + 1;
  return { dayInCycle, freeDays, allowed: dayInCycle <= freeDays };
}

function computeDayStreakFromDates(isoDays: string[], todayIso: string): number {
  const set = new Set(isoDays.filter(Boolean));
  if (!set.size) return 0;
  let cursor = todayIso;
  if (!set.has(cursor)) {
    const d = new Date(`${todayIso}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

async function main() {
  const fail: string[] = [];
  const ok: string[] = [];

  const tables = (await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Gamification%' ORDER BY 1`,
  )) as { table_name: string }[];
  const names = tables.map((t) => t.table_name);
  for (const t of [
    "GamificationEvent",
    "GamificationSeasonScore",
    "GamificationPromo",
    "GamificationConfig",
    "GamificationAuditLog",
  ]) {
    if (names.includes(t)) ok.push(`table ${t}`);
    else fail.push(`MISSING table ${t}`);
  }

  const events = await prisma.gamificationEvent.count();
  const seasons = await prisma.gamificationSeasonScore.count();
  const promos = await prisma.gamificationPromo.count();
  const audits = await prisma.gamificationAuditLog.count();
  const cfg = await prisma.gamificationConfig.findUnique({ where: { id: "default" } });

  console.log(
    JSON.stringify({ events, seasons, promos, audits, hasConfig: !!cfg, tables: names }, null, 2),
  );

  if (events === 0) fail.push("ZERO events — board empty");
  else ok.push(`${events} events`);
  if (seasons === 0) fail.push("ZERO season scores");
  else ok.push(`${seasons} season scores`);

  const top = await prisma.gamificationSeasonScore.findMany({
    orderBy: { points: "desc" },
    take: 5,
  });
  console.log(
    "top",
    top.map((r) => ({
      u: r.userId.slice(0, 22),
      pts: r.points,
      div: r.division,
      days: r.activeDays,
      rank: r.rank,
    })),
  );

  const byType = await prisma.gamificationEvent.groupBy({
    by: ["type"],
    _count: true,
    _sum: { points: true },
  });
  console.log("byType", byType);

  if (Math.max(1, Math.ceil((28 * 10) / 100)) !== 3) fail.push("free days math");
  else ok.push("free 10% = 3 days");

  const d1 = freePoolDayInCycle(1, 10, 28);
  const d4 = freePoolDayInCycle(4, 10, 28);
  const d29 = freePoolDayInCycle(29, 10, 28);
  if (!d1.allowed) fail.push("day1 should free");
  else ok.push("day1 free");
  if (d4.allowed) fail.push("day4 should locked");
  else ok.push("day4 locked");
  if (!d29.allowed) fail.push("day29 should free");
  else ok.push("day29 free");

  const today = "2026-07-23";
  const s1 = computeDayStreakFromDates(["2026-07-23", "2026-07-22", "2026-07-21"], today);
  const s2 = computeDayStreakFromDates(["2026-07-20"], today);
  const s3 = computeDayStreakFromDates(["2026-07-23", "2026-07-21"], today);
  if (s1 !== 3) fail.push(`streak s1=${s1}`);
  else ok.push("streak 3 consecutive");
  if (s2 !== 0) fail.push(`streak s2=${s2}`);
  else ok.push("streak gap = 0");
  if (s3 !== 1) fail.push(`streak s3=${s3}`);
  else ok.push("streak only today = 1");

  // Award path smoke
  const smokeId = `loop-smoke:${Date.now()}`;
  const smokeUser = "loop-test-smoke-user";
  await prisma.gamificationEvent.create({
    data: {
      id: smokeId,
      userId: smokeUser,
      type: "workout_logged",
      points: 25,
      label: "Loop smoke",
      at: new Date(),
      seasonKey: "loop-smoke",
    },
  });
  let dedupeOk = false;
  try {
    await prisma.gamificationEvent.create({
      data: {
        id: smokeId,
        userId: smokeUser,
        type: "workout_logged",
        points: 25,
        label: "Loop smoke",
        at: new Date(),
        seasonKey: "loop-smoke",
      },
    });
  } catch {
    dedupeOk = true;
  }
  if (!dedupeOk) fail.push("dedupe failed");
  else ok.push("event id dedupe");

  const got = await prisma.gamificationEvent.findUnique({ where: { id: smokeId } });
  if (!got || got.points !== 25) fail.push("smoke event missing");
  else ok.push("award smoke write/read");

  await prisma.gamificationEvent.delete({ where: { id: smokeId } }).catch(() => {});

  // Division rank simulation with 1 eligible user
  const n = 1;
  const minDiv = 8;
  const topPct = 25;
  const cut =
    n <= 0
      ? 0
      : n >= minDiv
        ? Math.max(1, Math.ceil((topPct / 100) * n))
        : Math.max(1, Math.min(2, n));
  if (cut !== 1) fail.push(`small board cut=${cut}`);
  else ok.push("small board top cut = 1");

  console.log("\nPASS:");
  for (const x of ok) console.log("  OK", x);
  console.log("FAIL:");
  if (!fail.length) console.log("  (none)");
  for (const x of fail) console.log("  FAIL", x);

  process.exit(fail.length ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
