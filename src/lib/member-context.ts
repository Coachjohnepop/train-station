import 'server-only';

import { getMemberAccess, type MemberAccess } from "@/lib/access";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { listPrograms } from "@/lib/program-data";
import { isDemoMode, getDemoEnrollments } from "@/lib/demo-enrollments";
import { getDemoWorkoutLogCount, getDemoStrengthScore, computeStrengthScoreFromPerfs } from "@/lib/demo-logs";
import { getDemoUserSettings } from "@/lib/demo-reminders";

export async function getMemberDashboard() {
  // Mock for quick demo (no DB). Uses real program data from seed export.
  const programs = await listPrograms();

  const adult = programs.find((p: any) => p.slug === "adult") || programs.find((p: any) => (p.category || "workout") === "workout") || programs[0];

  // Fake demo member enrolled in Adult with some progress
  const demoUser = {
    id: "demo-user",
    name: "Demo Member",
    email: DEMO_MEMBER_EMAIL,
  };

  let mockEnrollments: any[] = [];
  if (isDemoMode()) {
    const demoEnrolls = getDemoEnrollments();
    mockEnrollments = Object.entries(demoEnrolls).map(([slug, prog]) => {
      const p = programs.find((pp: any) => pp.slug === slug) || adult;
      return {
        id: `demo-enroll-${slug}`,
        program: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          tierSlug: p.tierSlug || "coach",
          durationWeeks: p.durationWeeks || 4,
        },
        currentWeek: prog.currentWeek,
        currentDay: prog.currentDay,
      };
    });
  } else if (adult) {
    mockEnrollments = [
      {
        id: "demo-enroll-adult",
        program: {
          id: adult.id,
          slug: adult.slug,
          name: adult.name,
          description: adult.description,
          tierSlug: adult.tierSlug || "coach",
          category: adult.category || "workout",
          durationWeeks: adult.durationWeeks || 4,
        },
        currentWeek: 2,
        currentDay: 5,
      },
    ];
  }

  const totalWorkouts = isDemoMode() ? getDemoWorkoutLogCount() : 12;

  let strengthScore = 0;
  if (isDemoMode()) {
    strengthScore = getDemoStrengthScore();
  } else {
    try {
      const prismaModule = await import("@/lib/prisma");
      const prisma = prismaModule.prisma;
      const demoUser = await prisma.user.findUnique({ where: { email: DEMO_MEMBER_EMAIL } });
      if (demoUser) {
        const perfs = await prisma.exercisePerformance.findMany({
          where: { userId: demoUser.id },
          include: { exercise: { select: { name: true } } },
        });
        strengthScore = computeStrengthScoreFromPerfs(
          perfs.map((p: any) => ({
            exercise: { name: p.exercise?.name },
            startingWeightLbs: p.startingWeightLbs,
            repsCompleted: p.repsCompleted,
            setsCompleted: p.setsCompleted,
          }))
        );
      }
    } catch (e) {
      // ignore, fall to 0
    }
  }

  // Support doing workouts + yoga + journeys in parallel: provide per-program continues
  // Eating temporarily disabled (coming soon)
  const activeContinues = mockEnrollments.length > 0
    ? mockEnrollments
        .filter((enr: any) => (enr.program.category || "workout") !== "eating")
        .map((enr: any) => {
          const prog = programs.find((pp: any) => pp.slug === enr.program.slug) || enr.program;
          const cat = prog.category || "workout";
          const labelBase = cat === "yoga" ? "Yoga" : cat === "journey" ? "Journey" : "Workouts";
          const contUrl = cat === "journey" 
            ? `/member/journey?program=${enr.program.slug}` 
            : `/member/programs/${enr.program.slug}`;
          return {
            url: contUrl,
            label: `${labelBase}: ${prog.name} (W${enr.currentWeek}D${enr.currentDay})`,
            category: cat,
            currentWeek: enr.currentWeek,
            currentDay: enr.currentDay,
          };
        })
    : (adult ? [{
        url: `/member/programs/${adult.slug}`,
        label: `Continue ${adult.name}`,
        category: adult.category || "workout",
        currentWeek: 2,
        currentDay: 5,
      }] : []);

  const primaryContinue = activeContinues[0] || null;

  let reminderSettings = { phone: "(555) 987-6543", dailyReminderTime: "07:30" };
  if (isDemoMode()) {
    const demoSettings = getDemoUserSettings("demo-user");
    reminderSettings = {
      phone: demoSettings.phone || "(555) 987-6543",
      dailyReminderTime: demoSettings.dailyReminderTime || "07:30",
    };
  }

  return {
    user: { ...demoUser, dailyReminderTime: reminderSettings.dailyReminderTime as string | null, phone: reminderSettings.phone as string | null },
    access: getMemberAccess("first_class"),
    enrollments: mockEnrollments,
    programs: programs.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      tierSlug: p.tierSlug || "coach",
      category: p.category || "workout",
      sortOrder: p.sortOrder || 0,
      workoutCount: p.weeks?.reduce((n: number, w: any) => n + (w.days?.length || 0), 0) || 0,
    })),
    stats: {
      dayStreak: 5,
      totalWorkouts,
      strengthScore,
    },
    continueUrl: primaryContinue?.url || null,
    continueLabel: primaryContinue?.label || null,
    activeContinues,
    dailyReminderTime: reminderSettings.dailyReminderTime,
  };
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
      category?: string;
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
    category?: string;
    sortOrder: number;
    workoutCount: number;
  }[];
  stats: {
    dayStreak: number;
    totalWorkouts: number;
    strengthScore: number;
  };
  continueUrl: string | null;
  continueLabel: string | null;
  activeContinues?: Array<{
    url: string;
    label: string;
    category: string;
    currentWeek: number;
    currentDay: number;
  }>;
  dailyReminderTime?: string | null;
};

