import { NextResponse } from "next/server";
import { listPrograms, getProgramBySlug } from "@/lib/program-data";
import { filterAdminCatalogPrograms } from "@/lib/programs";
import { requireCoachStaff } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const programs = filterAdminCatalogPrograms(await listPrograms());
  const workoutPrograms = await Promise.all(
    programs
      .filter((p: any) => (p.category || "workout") === "workout")
      .map(async (p: any) => {
        const full = await getProgramBySlug(p.slug);
        if (!full) return null;
        return {
          slug: full.slug,
          name: full.name,
          weeks: full.weeks.map((w: any) => ({
            weekNumber: w.weekNumber,
            days: w.days.map((d: any) => ({
              id: d.id,
              dayNumber: d.dayNumber,
              smsWorkoutText: d.smsWorkoutText,
              smsOverrideActive: d.smsOverrideActive,
              replacesLiveSession: d.replacesLiveSession,
              smsOverrideLabel: d.smsOverrideLabel,
            })),
          })),
        };
      }),
  );

  return NextResponse.json({
    programs: workoutPrograms.filter(Boolean),
  });
}