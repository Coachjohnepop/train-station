import { applyOverrideToDay, hydrateScheduleOverrides } from "@/lib/demo-schedule-overrides";
import { getDemoSeed } from "@/lib/demo-seed-store";
import { applyCatalogMetadata, normalizeProgramSlug } from "@/lib/programs";

function freshSeedOpts() {
  return { preferFresh: true as const };
}

export async function listPrograms() {
  await hydrateScheduleOverrides();
  const data = await getDemoSeed(freshSeedOpts());
  const programDayOptionsByDayId = (data.programDayOptions || []).reduce((acc: any, o: any) => {
    if (!acc[o.dayId]) acc[o.dayId] = [];
    acc[o.dayId].push({ workoutId: o.workoutId, label: o.label });
    return acc;
  }, {});
  const progs = (data.programs || []).map((p: any) => {
    const weeks = (data.programWeeks || [])
      .filter((w: any) => w.programId === p.id)
      .sort((a: any, b: any) => a.weekNumber - b.weekNumber)
      .map((w: any) => ({
        id: w.id,
        weekNumber: w.weekNumber,
        days: (data.programDays || [])
          .filter((d: any) => d.weekId === w.id)
          .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
          .map((d: any) => ({
          workoutId: d.workoutId,
          options: programDayOptionsByDayId[d.id] || (d.workoutId ? [{ workoutId: d.workoutId, label: "Standard" }] : []),
        })),
      }));
    return applyCatalogMetadata({
      ...p,
      _count: { weeks: weeks.length, enrollments: 1 },
      weeks,
    });
  });
  return progs.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function getProgramBySlug(slug: string) {
  await hydrateScheduleOverrides();
  const data = await getDemoSeed(freshSeedOpts());
  const target = normalizeProgramSlug(slug);
  const p = (data.programs || []).find(
    (pr: any) => pr.slug === slug || normalizeProgramSlug(pr.slug) === target,
  );
  if (!p) return null;
  const workoutsById: Record<string, any> = Object.fromEntries(
    (data.workouts || []).map((w: any) => [w.id, w])
  );
  const programDayOptionsByDayId = (data.programDayOptions || []).reduce((acc: any, o: any) => {
    if (!acc[o.dayId]) acc[o.dayId] = [];
    acc[o.dayId].push({ workoutId: o.workoutId, label: o.label });
    return acc;
  }, {});
  const weeks = (data.programWeeks || [])
    .filter((w: any) => w.programId === p.id)
    .sort((a: any, b: any) => a.weekNumber - b.weekNumber)
    .map((w: any) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      days: (data.programDays || [])
        .filter((d: any) => d.weekId === w.id)
        .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
        .map((d: any) =>
          applyOverrideToDay({
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
            workout: workoutsById[d.workoutId] || null,
            options: (programDayOptionsByDayId[d.id] || (d.workoutId ? [{ workoutId: d.workoutId, label: "Standard" }] : [])).map((opt: any) => ({
              ...opt,
              workout: workoutsById[opt.workoutId] || null,
            })),
          }),
        ),
    }));
  return applyCatalogMetadata({
    ...(p as any),
    startDate: (p as any).startDate ?? null,
    weeks,
    _count: { enrollments: 1 },
  });
}