import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-enrollments";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";

const TZ = "America/Los_Angeles";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PLANS: Array<{
  planKey: number;
  slug: SignupPlan;
  family: string;
  billing: string;
  priceCents: number;
}> = [
  { planKey: 1, slug: "explorer", family: "explorer", billing: "none", priceCents: 0 },
  { planKey: 2, slug: "member", family: "paid", billing: "monthly", priceCents: 2500 },
  { planKey: 3, slug: "business", family: "paid", billing: "monthly", priceCents: 5000 },
  { planKey: 4, slug: "pro", family: "paid", billing: "one_time", priceCents: 85000 },
];

const LANDINGS = [
  { landingKey: 1, letter: "A", variant: "tour", path: "/a", name: "Tour · tickets first" },
  { landingKey: 2, letter: "B", variant: "jeremy", path: "/b", name: "First Day Free · console" },
  { landingKey: 3, letter: "C", variant: "floor", path: "/l/floor", name: "Floor preview" },
  { landingKey: 4, letter: "D", variant: "class", path: "/l/class", name: "6:30am class door" },
  { landingKey: 0, letter: "?", variant: "other", path: "(other)", name: "Other public path" },
] as const;

export type WarehouseLoadResult = {
  dates: number;
  members: number;
  landingSessions: number;
  signups: number;
  payments: number;
  upgradeRequests: number;
  skipped?: boolean;
  reason?: string;
};

function pacificIso(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function dateKeyFromIso(iso: string): number {
  return Number(iso.replaceAll("-", ""));
}

function isoWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function dimDateRow(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay();
  return {
    dateKey: dateKeyFromIso(iso),
    isoDate: date,
    year,
    quarter: Math.ceil(month / 3),
    month,
    monthName: MONTH_NAMES[month - 1] || String(month),
    day,
    dow,
    dowName: DOW_NAMES[dow] || String(dow),
    isoWeek: isoWeek(iso),
    isFirstOfMonth: day === 1,
    isWeekend: dow === 0 || dow === 6,
  };
}

function eachIsoDay(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const [y, m, d] = fromIso.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(`${toIso}T00:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function landingKeyFromPath(path: string | null | undefined): number {
  const p = (path || "/").split("?")[0] || "/";
  if (p === "/a" || p === "/" || p === "/l/tour") return 1;
  if (p === "/b" || p.startsWith("/l/jeremy")) return 2;
  if (p.startsWith("/l/floor")) return 3;
  if (p.startsWith("/l/class")) return 4;
  return 0;
}

function planKeyFromSlug(slug: string | null | undefined): number {
  const s = (slug || "explorer").toLowerCase();
  if (s === "member") return 2;
  if (s === "business") return 3;
  if (s === "pro") return 4;
  return 1;
}

function paymentMethod(raw: string | null | undefined, reason: string | null | undefined): string {
  const m = (raw || "").toLowerCase();
  if (m === "stripe") return "stripe";
  if (m === "manual") return "manual";
  if ((reason || "").includes("venmo")) return "manual";
  return "other";
}

export async function loadWarehouse(opts?: { fromIso?: string; toIso?: string }): Promise<WarehouseLoadResult> {
  if (!isDatabaseConfigured() || isDemoMode()) {
    return {
      dates: 0,
      members: 0,
      landingSessions: 0,
      signups: 0,
      payments: 0,
      upgradeRequests: 0,
      skipped: true,
      reason: "Postgres not active or demo mode",
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const today = pacificIso(new Date());
  const fromIso = opts?.fromIso || "2026-01-01";
  const toIso = opts?.toIso || today;

  await prisma.whDimPlan.createMany({
    data: PLANS.map((p) => ({
      planKey: p.planKey,
      slug: p.slug,
      label: signupPlanLabel(p.slug),
      family: p.family,
      billing: p.billing,
      priceCents: p.priceCents,
    })),
    skipDuplicates: true,
  });
  await prisma.whDimLanding.createMany({
    data: [...LANDINGS],
    skipDuplicates: true,
  });

  const days = eachIsoDay(fromIso, toIso);
  const dateChunks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 120) dateChunks.push(days.slice(i, i + 120));
  for (const chunk of dateChunks) {
    await prisma.whDimDate.createMany({
      data: chunk.map(dimDateRow),
      skipDuplicates: true,
    });
  }

  const users = await prisma.user.findMany({
    where: { hidden: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      city: true,
      state: true,
      createdAt: true,
      memberProfile: { select: { plan: true, paymentMethod: true } },
    },
  });

  for (const user of users) {
    await prisma.whDimMember.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        email: user.email,
        name: user.name || user.email.split("@")[0],
        role: user.role,
        planKey: planKeyFromSlug(user.memberProfile?.plan),
        city: user.city,
        state: user.state,
      },
      update: {
        email: user.email,
        name: user.name || user.email.split("@")[0],
        role: user.role,
        planKey: planKeyFromSlug(user.memberProfile?.plan),
        city: user.city,
        state: user.state,
      },
    });
  }

  const members = await prisma.whDimMember.findMany({ select: { memberKey: true, userId: true } });
  const memberByUser = new Map(members.map((m) => [m.userId, m.memberKey]));

  const channelCache = new Map<string, number>();
  async function channelKey(source?: string | null, medium?: string | null, campaign?: string | null) {
    const sourceN = source?.trim() || "(none)";
    const mediumN = medium?.trim() || "(none)";
    const campaignN = campaign?.trim() || "(none)";
    const cacheKey = `${sourceN}|${mediumN}|${campaignN}`;
    const hit = channelCache.get(cacheKey);
    if (hit) return hit;
    const row = await prisma.whDimChannel.upsert({
      where: {
        source_medium_campaign: { source: sourceN, medium: mediumN, campaign: campaignN },
      },
      create: { source: sourceN, medium: mediumN, campaign: campaignN },
      update: {},
    });
    channelCache.set(cacheKey, row.channelKey);
    return row.channelKey;
  }

  const sessions = await prisma.analyticsSession.findMany({
    where: { startedAt: { gte: new Date(`${fromIso}T00:00:00.000Z`) } },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      landingPath: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      deviceType: true,
      convertedSignup: true,
      convertedPaid: true,
      _count: { select: { events: true } },
    },
  });

  let landingSessions = 0;
  for (const session of sessions) {
    const iso = pacificIso(session.startedAt);
    const dateKey = dateKeyFromIso(iso);
    await prisma.whDimDate.upsert({
      where: { dateKey },
      create: dimDateRow(iso),
      update: {},
    });
    const ch = await channelKey(session.utmSource, session.utmMedium, session.utmCampaign);
    await prisma.whFactLandingSession.upsert({
      where: { sourceSessionId: session.id },
      create: {
        dateKey,
        landingKey: landingKeyFromPath(session.landingPath),
        channelKey: ch,
        memberKey: session.userId ? memberByUser.get(session.userId) ?? null : null,
        deviceType: session.deviceType,
        eventCount: session._count.events,
        convertedSignup: session.convertedSignup,
        convertedPaid: session.convertedPaid,
        sourceSessionId: session.id,
        startedAt: session.startedAt,
      },
      update: {
        eventCount: session._count.events,
        convertedSignup: session.convertedSignup,
        convertedPaid: session.convertedPaid,
        landingKey: landingKeyFromPath(session.landingPath),
      },
    });
    landingSessions += 1;
  }

  let signups = 0;
  for (const user of users) {
    const memberKey = memberByUser.get(user.id);
    if (!memberKey) continue;
    const iso = pacificIso(user.createdAt);
    const dateKey = dateKeyFromIso(iso);
    await prisma.whDimDate.upsert({
      where: { dateKey },
      create: dimDateRow(iso),
      update: {},
    });
    await prisma.whFactSignup.upsert({
      where: { memberKey },
      create: {
        dateKey,
        planKey: planKeyFromSlug(user.memberProfile?.plan),
        memberKey,
      },
      update: { planKey: planKeyFromSlug(user.memberProfile?.plan) },
    });
    signups += 1;
  }

  const payments = await prisma.factSubscriptionPayment.findMany({
    select: {
      id: true,
      userId: true,
      amountCents: true,
      status: true,
      planId: true,
      billingReason: true,
      paidAt: true,
    },
  });
  let paymentFacts = 0;
  for (const pay of payments) {
    const iso = pacificIso(pay.paidAt);
    const dateKey = dateKeyFromIso(iso);
    await prisma.whDimDate.upsert({
      where: { dateKey },
      create: dimDateRow(iso),
      update: {},
    });
    await prisma.whFactPayment.upsert({
      where: { sourcePaymentId: pay.id },
      create: {
        dateKey,
        planKey: planKeyFromSlug(pay.planId),
        memberKey: pay.userId ? memberByUser.get(pay.userId) ?? null : null,
        amountCents: pay.amountCents,
        status: pay.status,
        method: paymentMethod(null, pay.billingReason),
        sourcePaymentId: pay.id,
      },
      update: {
        amountCents: pay.amountCents,
        status: pay.status,
      },
    });
    paymentFacts += 1;
  }

  const upgrades = await prisma.memberProfile.findMany({
    where: { businessUpgradeRequestedAt: { not: null } },
    select: {
      userId: true,
      businessUpgradeStatus: true,
      businessUpgradeRequestedAt: true,
    },
  });
  let upgradeFacts = 0;
  for (const row of upgrades) {
    if (!row.businessUpgradeRequestedAt) continue;
    const memberKey = memberByUser.get(row.userId);
    if (!memberKey) continue;
    const iso = pacificIso(row.businessUpgradeRequestedAt);
    const dateKey = dateKeyFromIso(iso);
    await prisma.whDimDate.upsert({
      where: { dateKey },
      create: dimDateRow(iso),
      update: {},
    });
    await prisma.whFactUpgradeRequest.upsert({
      where: { sourceUserId: row.userId },
      create: {
        dateKey,
        memberKey,
        status: row.businessUpgradeStatus || "pending",
        requestedAt: row.businessUpgradeRequestedAt,
        sourceUserId: row.userId,
      },
      update: { status: row.businessUpgradeStatus || "pending" },
    });
    upgradeFacts += 1;
  }

  return {
    dates: days.length,
    members: users.length,
    landingSessions,
    signups,
    payments: paymentFacts,
    upgradeRequests: upgradeFacts,
  };
}
