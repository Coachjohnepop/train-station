import { getMemberAccess, type MemberAccess } from "@/lib/access";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { prisma } from "@/lib/prisma";

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getCurrentStreak(userId: string): Promise<number> {
  const logs = await prisma.workoutLog.findMany({
    where: { userId },
    select: { performedAt: true },
    orderBy: { performedAt: "desc" },
    take: 90,
  });
  if (logs.length === 0) return 0;

  const daySet = new Set(logs.map((l) => toDateKey(new Date(l.performedAt))));

  let streak = 0;
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // allow streak to start from today or yesterday (common in fitness apps)
  for (let i = 0; i < 2; i++) {
    const key = toDateKey(cursor);
    if (daySet.has(key)) {
      streak = 1;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
      break;
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  if (streak === 0) return 0;

  // continue backward
  while (true) {
    const key = toDateKey(cursor);
    if (daySet.has(key)) {
      streak += 1;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export type MemberDashboardData = {
  user: { id: string; name: string; email: string };
  access: MemberAccess;
  enrollments: {
    id: string;
    program: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      tierSlug: string;
      durationWeeks: number;
    };
    currentWeek: number;
    currentDay: number;
  }[];
  programs: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tierSlug: string;
    sortOrder: number;
    workoutCount: number;
  }[];
  stats: {
    dayStreak: number;
    totalWorkouts: number;
    scheduledThisWeek: number;
  };
  continueUrl: string | null;
  continueLabel: string | null;
};

export async function getMemberDashboard(): Promise<MemberDashboardData | null> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_MEMBER_EMAIL },
    include: {
      subscriptions: {
        where: { status: "active" },
        include: { tier: true },
        take: 1,
      },
      enrollments: {
        include: {
          program: true,
        },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const tierSlug = user.subscriptions[0]?.tier.slug as
    | "starter"
    | "first_class"
    | undefined;
  const access = getMemberAccess(tierSlug ?? "first_class");

  const programs = await prisma.program.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
    include: {
      weeks: {
        include: {
          days: { where: { workoutId: { not: null } } },
        },
      },
    },
  });

  let scheduledThisWeek = 0;
  for (const p of programs) {
    for (const w of p.weeks) {
      scheduledThisWeek += w.days.length;
    }
  }

  const [totalWorkouts, dayStreak] = await Promise.all([
    prisma.workoutLog.count({ where: { userId: user.id } }),
    getCurrentStreak(user.id),
  ]);

  const activeEnrollment = user.enrollments[0];
  let continueUrl: string | null = "/member/workout";
  let continueLabel: string | null = "Continue sample workout";

  if (activeEnrollment) {
    continueUrl = `/member/programs/${activeEnrollment.program.slug}`;
    continueLabel = `Continue ${activeEnrollment.program.name}`;
  }

  return {
    user: {
      id: user.id,
      name: user.name ?? "Member",
      email: user.email,
    },
    access,
    enrollments: user.enrollments.map((e) => ({
      id: e.id,
      program: {
        id: e.program.id,
        slug: e.program.slug,
        name: e.program.name,
        description: e.program.description,
        tierSlug: e.program.tierSlug,
        durationWeeks: e.program.durationWeeks,
      },
      currentWeek: e.currentWeek,
      currentDay: e.currentDay,
    })),
    programs: programs.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      tierSlug: p.tierSlug,
      sortOrder: p.sortOrder,
      workoutCount: p.weeks.reduce((n, w) => n + w.days.length, 0),
    })),
    stats: {
      dayStreak,
      totalWorkouts,
      scheduledThisWeek,
    },
    continueUrl,
    continueLabel,
  };
}