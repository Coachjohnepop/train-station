import "server-only";

import { prisma } from "@/lib/prisma";
import { DAYS_PER_WEEK } from "@/lib/program-constants";
import { isGymLabel, isHomeLabel, normalizeDayOptions } from "@/lib/program-calendar";

export type TrainingLocation = "gym" | "home";

export type MacroPhaseDef = {
  phaseIndex: number;
  slug: string;
  name: string;
  minWeeks: number;
  maxWeeks: number;
};

/** Jeremy's Adult macro cycle — monthly Zoom eval advances phase. */
export const ADULT_MACRO_PHASES: MacroPhaseDef[] = [
  { phaseIndex: 1, slug: "conditioning", name: "Conditioning", minWeeks: 2, maxWeeks: 2 },
  { phaseIndex: 2, slug: "hypertrophy", name: "Hypertrophy / Oxidation", minWeeks: 4, maxWeeks: 6 },
  { phaseIndex: 3, slug: "strength", name: "Strength", minWeeks: 4, maxWeeks: 8 },
  { phaseIndex: 4, slug: "power", name: "Power", minWeeks: 4, maxWeeks: 6 },
];

const MACRO_BY_PROGRAM_SLUG: Record<string, MacroPhaseDef[]> = {
  adult: ADULT_MACRO_PHASES,
};

export function macroPhasesForProgramSlug(slug: string): MacroPhaseDef[] {
  return MACRO_BY_PROGRAM_SLUG[slug] ?? [];
}

export function totalMacroWeeks(phases: MacroPhaseDef[]): number {
  return phases.reduce((sum, p) => sum + p.maxWeeks, 0);
}

export function normalizeTrainingLocation(value: string | null | undefined): TrainingLocation {
  return value === "home" ? "home" : "gym";
}

export function clampPhaseWeek(
  phaseIndex: number,
  weekInPhase: number,
  phases: MacroPhaseDef[],
): { phaseIndex: number; weekInPhase: number } {
  if (!phases.length) {
    return {
      phaseIndex: Math.max(1, Math.floor(phaseIndex)),
      weekInPhase: Math.max(1, Math.floor(weekInPhase)),
    };
  }
  const idx = Math.min(Math.max(1, Math.floor(phaseIndex)), phases.length);
  const phase = phases[idx - 1];
  const maxWeek = Math.max(1, phase.maxWeeks);
  return {
    phaseIndex: idx,
    weekInPhase: Math.min(Math.max(1, Math.floor(weekInPhase)), maxWeek),
  };
}

export type ProgramWeekLike = {
  id?: string;
  weekNumber: number;
  macroPhaseIndex?: number | null;
  phaseWeekNumber?: number | null;
  days?: Array<{
    dayNumber: number;
    workoutId?: string | null;
    workout?: { id: string; name?: string } | null;
    options?: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>;
  }>;
};

export type EnrollmentPositionLike = {
  currentPhase?: number;
  currentWeek: number;
  currentDay: number;
  trainingLocation?: string | null;
};

/** Find scheduled week row for enrollment phase + week-in-phase. */
export function findEnrollmentWeek<T extends ProgramWeekLike>(
  weeks: T[],
  enrollment: EnrollmentPositionLike,
  phases: MacroPhaseDef[] = [],
): T | undefined {
  const phase = enrollment.currentPhase ?? 1;
  const weekInPhase = enrollment.currentWeek ?? 1;

  const tagged = weeks.find(
    (w) =>
      (w.macroPhaseIndex ?? 1) === phase &&
      (w.phaseWeekNumber ?? w.weekNumber) === weekInPhase,
  );
  if (tagged) return tagged;

  if (phases.length === 0 && phase === 1) {
    return weeks.find((w) => w.weekNumber === weekInPhase);
  }

  return weeks.find((w) => (w.macroPhaseIndex ?? 1) === phase && w.phaseWeekNumber === weekInPhase);
}

export function pickWorkoutOptionByLocation(
  options: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>,
  location: TrainingLocation,
) {
  const opts = normalizeDayOptions(
    options.map((o) => ({ workoutId: o.workoutId, label: o.label || "" })),
  );
  if (!opts.length) return null;

  const locationOf = (o: { label: string; trainingLocation?: string | null }) =>
    o.trainingLocation || (isHomeLabel(o.label) ? "home" : isGymLabel(o.label) ? "gym" : null);

  if (location === "home") {
    const homeIdx = options.findIndex(
      (o) => locationOf({ label: o.label || "", trainingLocation: (o as { trainingLocation?: string }).trainingLocation }) === "home",
    );
    const homeOpt = homeIdx >= 0 ? options[homeIdx] : options.find((o) => isHomeLabel(o.label || ""));
    if (homeOpt?.workoutId) {
      return {
        workoutId: homeOpt.workoutId,
        label: homeOpt.label,
        workout: homeOpt.workout,
      };
    }
  }

  const gym =
    options.find(
      (o) => locationOf({ label: o.label || "", trainingLocation: (o as { trainingLocation?: string }).trainingLocation }) === "gym",
    ) || opts.find((o) => isGymLabel(o.label));
  const pick = gym || opts.find((o) => o.workoutId) || opts[0];
  if (!pick?.workoutId) return null;
  return {
    ...pick,
    workout: options.find((o) => o.workoutId === pick.workoutId)?.workout,
  };
}

export function macroPhaseLabel(phases: MacroPhaseDef[], phaseIndex: number): string {
  const phase = phases.find((p) => p.phaseIndex === phaseIndex);
  return phase?.name ?? `Phase ${phaseIndex}`;
}

export function linearMacroEnrollmentDay(
  phases: MacroPhaseDef[],
  phaseIndex: number,
  weekInPhase: number,
  dayNumber: number,
): number {
  let offset = 0;
  for (const p of phases) {
    if (p.phaseIndex < phaseIndex) offset += p.maxWeeks * DAYS_PER_WEEK;
  }
  return offset + (weekInPhase - 1) * DAYS_PER_WEEK + dayNumber;
}

export async function ensureProgramMacroPhases(programId: string, slug: string) {
  const defs = macroPhasesForProgramSlug(slug);
  if (!defs.length) return [];

  for (const def of defs) {
    await prisma.programMacroPhase.upsert({
      where: {
        programId_phaseIndex: { programId, phaseIndex: def.phaseIndex },
      },
      update: {
        slug: def.slug,
        name: def.name,
        minWeeks: def.minWeeks,
        maxWeeks: def.maxWeeks,
        sortOrder: def.phaseIndex,
      },
      create: {
        programId,
        phaseIndex: def.phaseIndex,
        slug: def.slug,
        name: def.name,
        minWeeks: def.minWeeks,
        maxWeeks: def.maxWeeks,
        sortOrder: def.phaseIndex,
      },
    });
  }

  const totalWeeks = totalMacroWeeks(defs);
  await prisma.program.update({
    where: { id: programId },
    data: {
      totalPhases: defs.length,
      durationWeeks: totalWeeks,
    },
  });

  return prisma.programMacroPhase.findMany({
    where: { programId },
    orderBy: { phaseIndex: "asc" },
  });
}

/** Tag each global weekNumber with macro phase + week-within-phase; create scaffold weeks. */
export async function syncMacroWeekTags(programId: string, slug: string) {
  const phases = macroPhasesForProgramSlug(slug);
  if (!phases.length) return;

  await ensureProgramMacroPhases(programId, slug);

  let globalWeek = 0;
  for (const phase of phases) {
    for (let pw = 1; pw <= phase.maxWeeks; pw++) {
      globalWeek += 1;
      await prisma.programWeek.upsert({
        where: {
          programId_weekNumber: { programId, weekNumber: globalWeek },
        },
        update: {
          macroPhaseIndex: phase.phaseIndex,
          phaseWeekNumber: pw,
        },
        create: {
          programId,
          weekNumber: globalWeek,
          macroPhaseIndex: phase.phaseIndex,
          phaseWeekNumber: pw,
        },
      });
    }
  }
}

export async function getProgramMacroPhasesFromDb(programId: string) {
  return prisma.programMacroPhase.findMany({
    where: { programId },
    orderBy: { phaseIndex: "asc" },
  });
}

export function macroPhasesFromDbRows(
  rows: Array<{ phaseIndex: number; slug: string; name: string; minWeeks: number; maxWeeks: number }>,
): MacroPhaseDef[] {
  return rows.map((r) => ({
    phaseIndex: r.phaseIndex,
    slug: r.slug,
    name: r.name,
    minWeeks: r.minWeeks,
    maxWeeks: r.maxWeeks,
  }));
}