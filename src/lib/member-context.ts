import 'server-only';

import { getMemberAccess, type MemberAccess } from "@/lib/access";
import { DEMO_MEMBER_EMAIL } from "@/lib/demo-workout";
import { listPrograms } from "@/lib/program-data";
import { isDemoMode, getDemoEnrollments } from "@/lib/demo-enrollments";
import { getDemoWorkoutLogCount, getDemoStrengthScore, computeStrengthScoreFromPerfs } from "@/lib/demo-logs";
import { getDemoUserSettings } from "@/lib/demo-reminders";
import { getCurrentUser, resolveUserId, getCurrentUserName } from "@/lib/current-user";

export async function getMemberDashboard() {
  const programs = await listPrograms();
  const adult = programs.find((p: any) => p.slug === "adult") || programs.find((p: any) => (p.category || "workout") === "workout") || programs[0];

  const current = await getCurrentUser();
  const uid = await resolveUserId("demo-user");
  const displayName = current?.name || (await getCurrentUserName()) || "Member";

  // User identity for the shell + dashboard (real when cookie + DB, synthetic or demo otherwise)
  const effectiveUser = current || {
    id: uid,
    name: displayName,
    email: DEMO_MEMBER_EMAIL,
  };

  let mockEnrollments: any[] = [];
  const demoEnrolls = getDemoEnrollments(uid); // now supports per-uid in demo
  if (Object.keys(demoEnrolls).length > 0) {
    mockEnrollments = Object.entries(demoEnrolls).map(([slug, prog]: any) => {
      const p = programs.find((pp: any) => pp.slug === slug) || adult;
      return {
        id: `enroll-${uid}-${slug}`,
        program: {
          id: p?.id || slug,
          slug: p?.slug || slug,
          name: p?.name || slug,
          description: p?.description || null,
          tierSlug: p?.tierSlug || "coach",
          durationWeeks: p?.durationWeeks || 4,
          category: p?.category || "workout",
        },
        currentWeek: prog.currentWeek || 1,
        currentDay: prog.currentDay || 1,
      };
    });
  } else if (!isDemoMode() && adult) {
    // Real DB: try to load the joined user's actual enrollments
    try {
      const prismaModule = await import("@/lib/prisma");
      const pr = prismaModule.prisma;
      const realEnrolls = await pr.programEnrollment.findMany({
        where: { userId: uid },
        include: { program: true },
      });
      mockEnrollments = realEnrolls.map((e: any) => ({
        id: e.id,
        program: {
          id: e.program.id,
          slug: e.program.slug,
          name: e.program.name,
          description: e.program.description,
          tierSlug: e.program.tierSlug || "coach",
          category: e.program.category || "workout",
          durationWeeks: e.program.durationWeeks || 4,
        },
        currentWeek: e.currentWeek || 1,
        currentDay: e.currentDay || 1,
      }));
    } catch {
      // fall back to empty or demo adult preview
      if (adult) {
        mockEnrollments = [{
          id: "preview-adult",
          program: { id: adult.id, slug: adult.slug, name: adult.name, description: adult.description, tierSlug: adult.tierSlug || "coach", category: adult.category || "workout", durationWeeks: adult.durationWeeks || 4 },
          currentWeek: 1,
          currentDay: 1,
        }];
      }
    }
  }

  const totalWorkouts = isDemoMode() ? getDemoWorkoutLogCount(uid) : 12;

  let strengthScore = 0;
  if (isDemoMode()) {
    strengthScore = getDemoStrengthScore(uid);
  } else {
    try {
      const prismaModule = await import("@/lib/prisma");
      const pr = prismaModule.prisma;
      const perfs = await pr.exercisePerformance.findMany({
        where: { userId: uid },
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
    const demoSettings = getDemoUserSettings(uid);
    reminderSettings = {
      phone: demoSettings.phone || "(555) 987-6543",
      dailyReminderTime: demoSettings.dailyReminderTime || "07:30",
    };
  } else {
    try {
      const prismaModule = await import("@/lib/prisma");
      const pr = prismaModule.prisma;
      const u = await pr.user.findUnique({ where: { id: uid }, select: { phone: true, dailyReminderTime: true } });
      if (u) {
        reminderSettings = {
          phone: u.phone || reminderSettings.phone,
          dailyReminderTime: u.dailyReminderTime || reminderSettings.dailyReminderTime,
        };
      }
    } catch {}
  }

  return {
    user: { id: effectiveUser.id, name: displayName, email: effectiveUser.email || DEMO_MEMBER_EMAIL, dailyReminderTime: reminderSettings.dailyReminderTime as string | null, phone: reminderSettings.phone as string | null },
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
      dayStreak: totalWorkouts > 0 ? Math.min(5, Math.max(1, totalWorkouts)) : 0,
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

