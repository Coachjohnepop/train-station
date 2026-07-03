import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { catalogStorageLabel, isCoachCatalogDemo } from "@/lib/catalog-mode";
import { isDatabaseConfigured } from "@/lib/database-config";
import { getProgramBySlug } from "@/lib/program-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const demoMode = isCoachCatalogDemo();
  const storage = catalogStorageLabel();

  let counts = {
    exercises: 0,
    workouts: 0,
    programDays: 0,
    programDayOptions: 0,
  };

  if (demoMode) {
    const { hydrateDemoExercises, loadDemoExercises } = await import("@/lib/demo-exercises");
    const { getDemoSeed } = await import("@/lib/demo-seed-store");
    await hydrateDemoExercises({ preferFresh: true });
    const seed = await getDemoSeed({ preferFresh: true });
    counts = {
      exercises: loadDemoExercises().length,
      workouts: (seed.workouts as unknown[])?.length ?? 0,
      programDays: (seed.programDays as unknown[])?.length ?? 0,
      programDayOptions: (seed.programDayOptions as unknown[])?.length ?? 0,
    };
  } else {
    const { prisma } = await import("@/lib/prisma");
    const [exercises, workouts, programDays, programDayOptions] = await Promise.all([
      prisma.exercise.count(),
      prisma.workout.count(),
      prisma.programDay.count(),
      prisma.programDayOption.count(),
    ]);
    counts = { exercises, workouts, programDays, programDayOptions };
  }

  const adult = await getProgramBySlug("adult");
  const adultWeek1Days = adult?.weeks?.[0]?.days?.length ?? 0;

  return NextResponse.json({
    storage,
    demoMode,
    databaseConfigured: isDatabaseConfigured(),
    durable: !demoMode,
    counts,
    adultProgram: adult
      ? {
          slug: adult.slug,
          weekCount: adult.weeks?.length ?? 0,
          week1DayCount: adultWeek1Days,
        }
      : null,
    importHint: demoMode
      ? "Set real DATABASE_URL on Vercel, run db:migrate + db:import-catalog, then redeploy."
      : "POST /api/admin/catalog/import to refresh Postgres from live blob snapshot.",
  });
}