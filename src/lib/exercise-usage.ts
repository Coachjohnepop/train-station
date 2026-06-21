import { getDemoSeed } from "@/lib/demo-seed-store";

export type ExerciseProgramUsage = {
  id: string;
  name: string;
  slug: string;
  workoutCount: number;
  references: Array<{
    workoutId: string;
    workoutName: string;
    label: string; // e.g. "Gym" or "Home"
    week: number;
    day: number;
  }>;
};

export type ExerciseUsage = {
  exerciseId: string;
  programCount: number;
  workoutCount: number;
  programs: ExerciseProgramUsage[];
};

/**
 * Returns detailed usage for a single exercise.
 * Shows exactly which programs, workouts, and specific day slots (with Gym/Home labels) use it.
 */
export async function getExerciseUsage(exerciseId: string): Promise<ExerciseUsage> {
  const data = (await getDemoSeed({ preferFresh: true })) as any;

  const wes = (data.workoutExercises || []).filter(
    (we: any) => we.exerciseId === exerciseId
  );
  const workoutIds = new Set(wes.map((we: any) => we.workoutId));

  const workoutsById: Record<string, any> = Object.fromEntries(
    (data.workouts || []).map((w: any) => [w.id, w])
  );

  const dayOptions = (data.programDayOptions || []).filter((o: any) =>
    workoutIds.has(o.workoutId)
  );

  const programMap = new Map<string, ExerciseProgramUsage>();

  for (const opt of dayOptions) {
    const day = (data.programDays || []).find((d: any) => d.id === opt.dayId);
    if (!day) continue;
    const week = (data.programWeeks || []).find((w: any) => w.id === day.weekId);
    if (!week) continue;
    const prog = (data.programs || []).find((p: any) => p.id === week.programId);
    if (!prog) continue;

    if (!programMap.has(prog.id)) {
      programMap.set(prog.id, {
        id: prog.id,
        name: prog.name,
        slug: prog.slug,
        workoutCount: 0,
        references: [],
      });
    }

    const pUsage = programMap.get(prog.id)!;
    const workoutName = workoutsById[opt.workoutId]?.name || "Unknown workout";

    pUsage.references.push({
      workoutId: opt.workoutId,
      workoutName,
      label: opt.label || "Standard",
      week: week.weekNumber,
      day: day.dayNumber,
    });
  }

  // Dedup references per program and compute counts
  const programs: ExerciseProgramUsage[] = Array.from(programMap.values()).map((p) => {
    // Deduplicate by workout + label + day for cleanliness
    const uniqueRefs = p.references.reduce((acc: any[], ref: any) => {
      const key = `${ref.workoutId}-${ref.label}-${ref.week}-${ref.day}`;
      if (!acc.some((r) => `${r.workoutId}-${r.label}-${r.week}-${r.day}` === key)) {
        acc.push(ref);
      }
      return acc;
    }, []);

    return {
      ...p,
      workoutCount: new Set(uniqueRefs.map((r) => r.workoutId)).size,
      references: uniqueRefs.sort((a, b) => a.week - b.week || a.day - b.day),
    };
  });

  return {
    exerciseId,
    programCount: programs.length,
    workoutCount: workoutIds.size,
    programs: programs.sort((a, b) => b.workoutCount - a.workoutCount),
  };
}

/**
 * Returns a lightweight summary map for every exercise (great for the library table).
 */
export async function getAllExerciseUsages(): Promise<Record<string, { programCount: number; workoutCount: number; programs: Array<{ name: string; slug: string }> }>> {
  const data = (await getDemoSeed({ preferFresh: true })) as any;
  const result: Record<string, any> = {};

  const allWes = data.workoutExercises || [];
  const dayOptions = data.programDayOptions || [];
  const programDays = data.programDays || [];
  const programWeeks = data.programWeeks || [];
  const programs = data.programs || [];
  const workoutsById: Record<string, any> = Object.fromEntries(
    (data.workouts || []).map((w: any) => [w.id, w])
  );

  // Precompute workout -> programs map for speed (name + slug for linking)
  const workoutToPrograms: Record<string, Array<{name: string; slug: string}>> = {};
  for (const opt of dayOptions) {
    const day = programDays.find((d: any) => d.id === opt.dayId);
    if (!day) continue;
    const week = programWeeks.find((w: any) => w.id === day.weekId);
    if (!week) continue;
    const prog = programs.find((p: any) => p.id === week.programId);
    if (!prog) continue;

    if (!workoutToPrograms[opt.workoutId]) workoutToPrograms[opt.workoutId] = [];
    const exists = workoutToPrograms[opt.workoutId].some((p) => p.name === prog.name);
    if (!exists) {
      workoutToPrograms[opt.workoutId].push({ name: prog.name, slug: prog.slug });
    }
  }

  for (const ex of data.exercises || []) {
    const wesForEx = allWes.filter((we: any) => we.exerciseId === ex.id);
    const wids = new Set<string>(wesForEx.map((we: any) => we.workoutId));

    const programSet = new Map<string, {name: string; slug: string}>();
    for (const wid of wids) {
      const progsForW = workoutToPrograms[wid] || [];
      progsForW.forEach((p) => {
        if (!programSet.has(p.name)) programSet.set(p.name, p);
      });
    }

    const allPrograms = Array.from(programSet.values());

    result[ex.id] = {
      programCount: allPrograms.length,
      workoutCount: wids.size,
      programs: allPrograms,
    };
  }

  return result;
}