import { NextResponse } from "next/server";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { getDemoSeed } from "@/lib/demo-seed-store";
import { getSyncedProgramFromDb } from "@/lib/program-catalog-db";
import { requireCoachStaff } from "@/lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  if (isCoachCatalogDemo()) {
    const data = await getDemoSeed({ preferFresh: true });
    const prog = (data.programs || []).find((p: any) => p.slug === slug);
    if (!prog) {
      return NextResponse.json({ detail: "Program not found" }, { status: 404 });
    }
    const workoutsById: Record<string, any> = Object.fromEntries(
      (data.workouts || []).map((w: any) => [w.id, w]),
    );
    const weeks = (data.programWeeks || [])
      .filter((w: any) => w.programId === prog.id)
      .sort((a: any, b: any) => a.weekNumber - b.weekNumber)
      .map((w: any) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        days: (data.programDays || [])
          .filter((d: any) => d.weekId === w.id)
          .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
          .map((d: any) => {
            const dayOpts = (data.programDayOptions || [])
              .filter((o: any) => o.dayId === d.id)
              .map((o: any) => ({
                workoutId: o.workoutId,
                label: o.label,
                notes: o.notes ?? null,
                workout: workoutsById[o.workoutId] || null,
              }));
            return {
              id: d.id,
              dayNumber: d.dayNumber,
              workoutId: d.workoutId,
              notes: d.notes,
              videoUrl: d.videoUrl || null,
              calendarDate: d.calendarDate ?? null,
              defaultSets: d.defaultSets ?? null,
              defaultReps: d.defaultReps ?? null,
              defaultRestSec: d.defaultRestSec ?? null,
              publishedAt: d.publishedAt ?? null,
              workout: d.workoutId ? workoutsById[d.workoutId] || null : null,
              options:
                dayOpts.length > 0
                  ? dayOpts
                  : d.workoutId
                    ? [{ workoutId: d.workoutId, label: "Standard", workout: workoutsById[d.workoutId] || null }]
                    : [],
            };
          }),
      }));
    return NextResponse.json({
      ...prog,
      startDate: prog.startDate ?? null,
      weeks,
    });
  }

  const synced = await getSyncedProgramFromDb(slug);
  if (!synced) {
    return NextResponse.json({ detail: "Program not found" }, { status: 404 });
  }
  return NextResponse.json(synced);
}