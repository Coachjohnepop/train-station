import type { Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";
import { linearEnrollmentDay } from "@/lib/member-enrollment-day";
import { getUserGamification } from "@/lib/member-gamification-store";

const PAYING_STATUSES = new Set(["active", "trialing"]);

export type MartRollupResult = {
  metricDate: string;
  dailyMetrics: {
    activeMembers: number;
    payingMembers: number;
    mrrCents: number;
    newSignups: number;
    workoutCompletions: number;
    pageViews: number;
    pageClicks: number;
    uniqueVisitors: number;
    liveSessionsJoined: number;
    churnedSubscriptions: number;
  };
  memberSnapshots: number;
  skipped?: boolean;
  reason?: string;
};

export function parseMetricDate(input?: string | null): Date {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday;
}

export function metricDateBounds(date: Date): { start: Date; end: Date; dateOnly: Date } {
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start = dateOnly;
  const end = new Date(dateOnly);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, dateOnly };
}

function formatMetricDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function runMartRollup(opts?: {
  metricDate?: string | null;
  dryRun?: boolean;
}): Promise<MartRollupResult> {
  if (!isDatabaseConfigured() || isDemoMode()) {
    const date = parseMetricDate(opts?.metricDate);
    return {
      metricDate: formatMetricDate(date),
      dailyMetrics: {
        activeMembers: 0,
        payingMembers: 0,
        mrrCents: 0,
        newSignups: 0,
        workoutCompletions: 0,
        pageViews: 0,
        pageClicks: 0,
        uniqueVisitors: 0,
        liveSessionsJoined: 0,
        churnedSubscriptions: 0,
      },
      memberSnapshots: 0,
      skipped: true,
      reason: "Postgres not active or demo mode — mart rollup requires database",
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const { start, end, dateOnly } = metricDateBounds(parseMetricDate(opts?.metricDate));
  const metricDate = formatMetricDate(dateOnly);

  const [
    activeMembers,
    subscriptions,
    newSignups,
    workoutCompletions,
    pageViews,
    pageClicks,
    uniqueVisitors,
    liveSessionsJoined,
    users,
    workoutLogsByUser,
    performancesByUser,
    lastWorkoutByUser,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: "MEMBER", status: "active", hidden: false },
    }),
    prisma.subscription.findMany({
      where: { status: { in: [...PAYING_STATUSES] } },
      include: { tier: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: start, lt: end } },
    }),
    prisma.workoutLog.count({
      where: { completed: true, performedAt: { gte: start, lt: end } },
    }),
    prisma.analyticsEvent.count({
      where: { eventType: "page_view", occurredAt: { gte: start, lt: end } },
    }),
    prisma.analyticsEvent.count({
      where: { eventType: "page_click", occurredAt: { gte: start, lt: end } },
    }),
    prisma.analyticsSession.count({
      where: { lastActivityAt: { gte: start, lt: end } },
    }),
    prisma.analyticsEvent.count({
      where: { eventType: "live_session_joined", occurredAt: { gte: start, lt: end } },
    }),
    prisma.user.findMany({
      where: { hidden: false },
      select: {
        id: true,
        role: true,
        city: true,
        state: true,
        subscriptions: {
          where: { status: { in: [...PAYING_STATUSES] } },
          include: { tier: true },
          take: 1,
        },
        enrollments: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: { program: { select: { slug: true } } },
        },
      },
    }),
    prisma.workoutLog.groupBy({
      by: ["userId"],
      where: { completed: true, performedAt: { gte: start, lt: end } },
      _count: true,
    }),
    prisma.exercisePerformance.groupBy({
      by: ["userId"],
      where: { performedAt: { gte: start, lt: end } },
      _count: true,
    }),
    prisma.workoutLog.groupBy({
      by: ["userId"],
      where: { completed: true, performedAt: { lt: end } },
      _max: { performedAt: true },
    }),
  ]);

  const payingSubs = subscriptions.filter((s) => (s.tier.monthlyCents ?? 0) > 0);
  const payingMemberIds = new Set(payingSubs.map((s) => s.userId));
  const mrrCents = payingSubs.reduce((sum, s) => sum + (s.tier.monthlyCents ?? 0), 0);

  const workoutCountMap = new Map(workoutLogsByUser.map((r) => [r.userId, r._count]));
  const performanceCountMap = new Map(performancesByUser.map((r) => [r.userId, r._count]));
  const lastWorkoutMap = new Map(
    lastWorkoutByUser.map((r) => [r.userId, r._max.performedAt ?? null]),
  );

  const snapshotRows: Prisma.MartMemberDailySnapshotCreateManyInput[] = [];

  for (const user of users) {
    const sub = user.subscriptions[0];
    const tierSlug = sub?.tier.slug ?? null;
    const isPaying = Boolean(sub && (sub.tier.monthlyCents ?? 0) > 0);
    const enrollment = user.enrollments[0];
    const programSlug = enrollment?.program.slug ?? null;
    const enrollmentDay = enrollment
      ? linearEnrollmentDay(enrollment.currentWeek, enrollment.currentDay)
      : null;

    const lastWorkout = lastWorkoutMap.get(user.id);
    const daysSinceLastWorkout =
      lastWorkout && lastWorkout < end
        ? daysBetween(lastWorkout, end)
        : lastWorkout
          ? 0
          : null;

    let gamificationPoints = 0;
    try {
      const gamification = await getUserGamification(user.id);
      gamificationPoints = gamification.totalPoints;
    } catch {
      gamificationPoints = 0;
    }

    snapshotRows.push({
      userId: user.id,
      snapshotDate: dateOnly,
      tierSlug,
      role: user.role,
      isPaying,
      workoutsCompleted: workoutCountMap.get(user.id) ?? 0,
      exercisesLogged: performanceCountMap.get(user.id) ?? 0,
      gamificationPoints,
      programSlug,
      enrollmentDay,
      daysSinceLastWorkout,
      city: user.city,
      state: user.state,
    });
  }

  const dailyMetrics = {
    activeMembers,
    payingMembers: payingMemberIds.size,
    mrrCents,
    newSignups,
    workoutCompletions,
    pageViews,
    pageClicks,
    uniqueVisitors,
    liveSessionsJoined,
    churnedSubscriptions: 0,
  };

  if (!opts?.dryRun) {
    await prisma.$transaction([
      prisma.martDailyMetrics.upsert({
        where: { metricDate: dateOnly },
        create: { metricDate: dateOnly, ...dailyMetrics },
        update: { ...dailyMetrics, computedAt: new Date() },
      }),
      prisma.martMemberDailySnapshot.deleteMany({
        where: { snapshotDate: dateOnly },
      }),
      ...(snapshotRows.length > 0
        ? [
            prisma.martMemberDailySnapshot.createMany({
              data: snapshotRows,
            }),
          ]
        : []),
    ]);
  }

  return {
    metricDate,
    dailyMetrics,
    memberSnapshots: snapshotRows.length,
    skipped: false,
  };
}