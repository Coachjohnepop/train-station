/**
 * Prod recompute + free-week offers (no server-only).
 * Requires DATABASE_URL in env.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "../src/lib/pg-connection";

const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
const pool = createPgPool(url);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function seasonKey(seasonDays = 28): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const epoch = Date.UTC(2026, 0, 1);
  const dayIndex = Math.floor((start.getTime() - epoch) / 86_400_000);
  const bucket = Math.floor(dayIndex / seasonDays) * seasonDays;
  const bucketStart = new Date(epoch + bucket * 86_400_000);
  return `roll-${bucketStart.toISOString().slice(0, 10)}-d${seasonDays}`;
}

const DEFAULTS = {
  topPercentile: 25,
  freeWeekDays: 7,
  claimWindowHours: 72,
  seasonDays: 28,
  minActiveDaysForPercentile: 4,
  minSeasonPointsForPercentile: 100,
  minDivisionSizeForTopCut: 8,
  cooldownDaysPerEdge: 90,
};

async function recomputeDivision(division: string, L: typeof DEFAULTS, sk: string) {
  const rows = await prisma.gamificationSeasonScore.findMany({
    where: { seasonKey: sk, division },
    orderBy: [{ points: "desc" }, { lastEventAt: "desc" }, { userId: "asc" }],
  });
  const eligible = rows.filter(
    (r) =>
      r.activeDays >= L.minActiveDaysForPercentile &&
      r.points >= L.minSeasonPointsForPercentile,
  );
  const n = eligible.length;
  const cut =
    n <= 0
      ? 0
      : n >= L.minDivisionSizeForTopCut
        ? Math.max(1, Math.ceil((L.topPercentile / 100) * n))
        : Math.max(1, Math.min(2, n));

  let offered = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const eligIdx = eligible.findIndex((e) => e.userId === r.userId);
    const eligibleRank = eligIdx >= 0 ? eligIdx + 1 : 0;
    const topPercent = eligibleRank > 0 && eligibleRank <= cut;
    const percentile =
      n > 0 && eligibleRank > 0 ? Math.round((100 * (n - eligibleRank + 1)) / n) : 0;
    await prisma.gamificationSeasonScore.update({
      where: { userId_seasonKey: { userId: r.userId, seasonKey: sk } },
      data: { rank: eligibleRank || i + 1, percentile },
    });

    if (!topPercent || division === "pro") continue;
    const toPlan =
      division === "explorer" ? "member" : division === "member" ? "business" : "pro";
    const now = new Date();
    const open = await prisma.gamificationPromo.findFirst({
      where: {
        userId: r.userId,
        fromPlan: division,
        toPlan,
        status: { in: ["offered", "claimed"] },
      },
    });
    if (open) continue;
    const cooldownMs = L.cooldownDaysPerEdge * 86_400_000;
    const recent = await prisma.gamificationPromo.findFirst({
      where: {
        userId: r.userId,
        fromPlan: division,
        toPlan,
        offeredAt: { gte: new Date(now.getTime() - cooldownMs) },
      },
    });
    if (recent) continue;

    await prisma.gamificationPromo.create({
      data: {
        userId: r.userId,
        kind: "free_week_upgrade",
        fromPlan: division,
        toPlan,
        status: "offered",
        offeredAt: now,
        claimBy: new Date(now.getTime() + L.claimWindowHours * 3600_000),
        notes: `Loop recompute top band ${division} → ${toPlan}`,
      },
    });
    offered += 1;
    console.log("OFFER", r.userId.slice(0, 24), division, "→", toPlan, "pts", r.points);
  }
  return { division, rows: rows.length, eligible: n, cut, offered };
}

async function main() {
  // Ensure config
  let cfg = await prisma.gamificationConfig.findUnique({ where: { id: "default" } });
  if (!cfg) {
    cfg = await prisma.gamificationConfig.create({
      data: {
        id: "default",
        levers: {
          freeContentPercent: 10,
          coachContentPercent: 90,
          ...DEFAULTS,
          crossDivisionPeek: true,
          prizeBandEnabled: true,
          dailyPointCap: 150,
          anonymizeRivals: false,
          featureEnabled: true,
        },
      },
    });
    console.log("created default config");
  }
  const levers = { ...DEFAULTS, ...(cfg.levers as object) } as typeof DEFAULTS;
  const sk = seasonKey(levers.seasonDays);
  console.log("seasonKey", sk, "levers", levers);

  // Align seasonKey on scores if needed
  const scores = await prisma.gamificationSeasonScore.findMany();
  for (const s of scores) {
    if (s.seasonKey !== sk) {
      // re-key: delete old, upsert new
      await prisma.gamificationSeasonScore.delete({
        where: { userId_seasonKey: { userId: s.userId, seasonKey: s.seasonKey } },
      });
      await prisma.gamificationSeasonScore.create({
        data: {
          userId: s.userId,
          seasonKey: sk,
          division: s.division,
          points: s.points,
          activeDays: s.activeDays,
          lastEventAt: s.lastEventAt,
        },
      });
      console.log("rekeyed", s.userId.slice(0, 18), s.seasonKey, "→", sk);
    }
  }

  const results = [];
  for (const d of ["explorer", "member", "business", "pro"]) {
    results.push(await recomputeDivision(d, levers, sk));
  }
  console.log("results", results);

  const promos = await prisma.gamificationPromo.findMany({
    where: { status: "offered" },
  });
  console.log(
    "open promos",
    promos.map((p) => ({
      u: p.userId.slice(0, 20),
      edge: `${p.fromPlan}→${p.toPlan}`,
      claimBy: p.claimBy,
    })),
  );

  await prisma.gamificationAuditLog.create({
    data: {
      actorId: "script:loop-recompute",
      actorRole: "SYSTEM",
      action: "season.recompute",
      detail: { results, openPromos: promos.length },
    },
  });
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
