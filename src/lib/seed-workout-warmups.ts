import "server-only";

import { getCoachSettings } from "@/lib/coach-settings-store";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import {
  hydrateDemoExercises,
  loadDemoExercises,
  createDemoExerciseId,
  saveDemoExercises,
} from "@/lib/demo-exercises";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { resolveDemoExercise } from "@/lib/demo-workout-items";
import { prisma } from "@/lib/prisma";
import {
  normalizePrescription,
  isValidSetCountForApproach,
  type SetApproachId,
} from "@/lib/workout-schemes";
import {
  DEFAULT_WARMUP_BLOCKS,
  isRestOrDayOffContent,
  isStandardWarmupLineName,
  isStandardWarmupWorkoutId,
  STANDARD_WARMUP_WORKOUT_ID,
  type WarmupBlockTemplate,
  workoutHasStandardWarmup,
} from "@/lib/warmup-template";
import { notesMarkWarmup } from "@/lib/warmup-group";

export { STANDARD_WARMUP_WORKOUT_ID, isStandardWarmupWorkoutId } from "@/lib/warmup-template";

export type SeedWarmupsResult = {
  added: number;
  missing: string[];
  skipped: boolean;
  seeded: string[];
  /** Human-readable status for coach UI. */
  message: string;
};



/** Alternate catalog names when default / settings IDs drift. */
const WARMUP_NAME_ALIASES: Record<string, string[]> = {
  "warm up well 5 min bike": [
    "Warm up well 5 min bike",
    "Low Intensity Cardio Warmup",
  ],
  "upper body warm up": [
    "Upper body warm up",
    "General Warm Up + Shoulder Mobility",
  ],
  "shoulder mobility warm": [
    "Shoulder mobility warm",
    "General Warm Up + Shoulder Mobility",
  ],
  "up with bands": [
    "Up with bands",
    "Band Rear Delt Extensions",
    "Band Rotator Cuff Extensions",
  ],
};

type CatalogEx = { id: string; name: string; archivedAt?: string | Date | null };

type ResolvedLine = {
  exerciseId: string;
  exerciseName: string;
  setScheme: SetApproachId;
  repPattern: string | null;
  reps: string | null;
  sets: number;
  weightTier: string;
  notes: string | null;
};

function normalizeSetScheme(raw: string | null | undefined): SetApproachId {
  const n = normalizePrescription({ setScheme: raw || "standard" });
  return n.approach;
}

function prescriptionForBlock(block: WarmupBlockTemplate): {
  setScheme: SetApproachId;
  repPattern: string | null;
  reps: string | null;
  sets: number;
  weightTier: string;
  notes: string | null;
} {
  const setScheme = normalizeSetScheme(block.setScheme);
  let sets = block.setCount > 0 ? block.setCount : 1;
  if (!isValidSetCountForApproach(sets, setScheme)) {
    sets = setScheme === "timed" ? 1 : Math.min(10, Math.max(1, sets));
    if (!isValidSetCountForApproach(sets, setScheme)) sets = 1;
  }
  let reps = block.reps;
  if (setScheme === "standard" && !reps) reps = "10";
  return {
    setScheme,
    repPattern: block.repPattern,
    reps,
    sets,
    weightTier: block.weightTier || "light",
    notes: [block.notes, notesMarkWarmup(block.notes || "") ? null : "Warm-up block"]
      .filter(Boolean)
      .join(" · ") || "Warm-up block",
  };
}

function aliasesFor(name: string): string[] {
  const key = name.trim().toLowerCase();
  return WARMUP_NAME_ALIASES[key] || [name];
}

function nameMatchesBlock(exName: string, block: WarmupBlockTemplate): boolean {
  const n = exName.toLowerCase();
  const candidates = [block.name, ...aliasesFor(block.name)].map((s) => s.toLowerCase());
  return candidates.includes(n);
}

function findInCatalog(list: CatalogEx[], block: WarmupBlockTemplate): CatalogEx | null {
  // Prefer exact name / alias match so stale coach-settings IDs (e.g. bike → upper body) don't win.
  const candidates = [block.name, ...aliasesFor(block.name)];
  for (const name of candidates) {
    const hit = list.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  if (block.exerciseId) {
    const byId = list.find((e) => e.id === block.exerciseId);
    if (byId && nameMatchesBlock(byId.name, block)) return byId;
    // ID exists but name drifted — still use it only if no name match (already failed above).
    if (byId) return byId;
  }
  return null;
}

function formatResult(
  r: Omit<SeedWarmupsResult, "message"> & { message?: string },
): SeedWarmupsResult {
  if (r.skipped) {
    return {
      ...r,
      message: r.message || "Warm-ups not added — already present or rest / day off.",
    };
  }
  if (r.added === 0) {
    return {
      ...r,
      message:
        r.missing.length > 0
          ? `Could not add warm-ups (missing library: ${r.missing.join(", ")}).`
          : "No warm-up blocks configured.",
    };
  }
  if (r.missing.length > 0) {
    return {
      ...r,
      message: `Added ${r.added} warm-up${r.added === 1 ? "" : "s"}; missing: ${r.missing.join(", ")}.`,
    };
  }
  return {
    ...r,
    message: `Added ${r.added} warm-up exercise${r.added === 1 ? "" : "s"}.`,
  };
}

async function resolveBlocks(
  blocks: WarmupBlockTemplate[],
): Promise<{ lines: ResolvedLine[]; missing: string[] }> {
  const missing: string[] = [];
  const lines: ResolvedLine[] = [];

  if (isCoachCatalogDemo()) {
    await hydrateDemoExercises({ preferFresh: true });
    const catalog = loadDemoExercises() as CatalogEx[];
    let catalogDirty = false;

    for (const block of blocks) {
      let ex = findInCatalog(catalog, block);
      if (!ex && block.name.trim()) {
        const now = new Date().toISOString();
        const row = {
          id: createDemoExerciseId(),
          name: block.name.trim(),
          description: block.notes,
          videoUrl: null,
          tags: "warmup-auto",
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        catalog.push(row);
        catalogDirty = true;
        ex = row;
      }
      if (!ex) {
        missing.push(block.name);
        continue;
      }
      const rx = prescriptionForBlock(block);
      lines.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        ...rx,
      });
    }

    if (catalogDirty) {
      await saveDemoExercises(catalog);
    }
    return { lines, missing };
  }

  const catalog = (await prisma.exercise.findMany({
    select: { id: true, name: true, archivedAt: true },
  })) as CatalogEx[];

  for (const block of blocks) {
    let ex = findInCatalog(catalog, block);
    if (!ex && block.name.trim()) {
      const created = await prisma.exercise.create({
        data: {
          name: block.name.trim(),
          description: block.notes,
          tags: "warmup-auto",
        },
        select: { id: true, name: true, archivedAt: true },
      });
      catalog.push(created);
      ex = created;
    }
    if (!ex) {
      missing.push(block.name);
      continue;
    }
    const rx = prescriptionForBlock(block);
    lines.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      ...rx,
    });
  }

  return { lines, missing };
}

function workoutRowsToBlocks(
  rows: Array<{
    id: string;
    exerciseId: string;
    setScheme?: string | null;
    repPattern?: string | null;
    reps?: string | null;
    sets?: number | null;
    setCount?: number | null;
    weightTier?: string | null;
    notes?: string | null;
    exercise?: { name?: string | null } | null;
    blockName?: string | null;
  }>,
): WarmupBlockTemplate[] {
  return rows.map((row, i) => ({
    id: row.id || `wu-${i}`,
    name: row.exercise?.name || row.blockName || "Warm-up",
    exerciseId: row.exerciseId,
    setCount: (row.setCount ?? row.sets ?? 1) || 1,
    setScheme: row.setScheme || "standard",
    repPattern: row.repPattern ?? null,
    reps: row.reps ?? null,
    weightTier: row.weightTier || "light",
    notes: row.notes || "Warm-up block",
  }));
}

async function readStandardWarmupBlocks(): Promise<WarmupBlockTemplate[]> {
  if (isCoachCatalogDemo()) {
    const { getDemoSeed } = await import("@/lib/demo-seed-store");
    const data = await getDemoSeed({ preferFresh: true });
    const items = ((data.workoutExercises as any[]) || [])
      .filter((we) => we.workoutId === STANDARD_WARMUP_WORKOUT_ID)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return workoutRowsToBlocks(items);
  }
  const workout = await prisma.workout.findUnique({
    where: { id: STANDARD_WARMUP_WORKOUT_ID },
    select: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  if (!workout) return [];
  return workoutRowsToBlocks(workout.exercises);
}

/** Create the standard warm-up workout once; later edits live in WorkoutBuilder. */
export async function ensureStandardWarmupWorkout(): Promise<{
  workoutId: string;
  created: boolean;
  exerciseCount: number;
}> {
  const existing = await readStandardWarmupBlocks();
  if (existing.length > 0) {
    return {
      workoutId: STANDARD_WARMUP_WORKOUT_ID,
      created: false,
      exerciseCount: existing.length,
    };
  }

  let initial = DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b }));
  try {
    const settings = await getCoachSettings();
    if (settings.warmupBlocks?.length) initial = settings.warmupBlocks;
  } catch {
    /* defaults */
  }

  const { lines } = await resolveBlocks(initial);

  if (isCoachCatalogDemo()) {
    const { mutateDemoSeed } = await import("@/lib/demo-seed-store");
    const { resolveDemoExercise } = await import("@/lib/demo-workout-items");
    const { loadDemoExercises } = await import("@/lib/demo-exercises");
    await mutateDemoSeed((data) => {
      if (!data.workouts) data.workouts = [];
      if (!data.workoutExercises) data.workoutExercises = [];
      const workouts = data.workouts as any[];
      if (!workouts.some((w) => w.id === STANDARD_WARMUP_WORKOUT_ID)) {
        const now = new Date().toISOString();
        workouts.push({
          id: STANDARD_WARMUP_WORKOUT_ID,
          name: "Standard warm-up",
          description:
            "Jeremy's default warm-up. Seeded onto new workouts. Members see these as one card.",
          source: "warmup",
          createdAt: now,
          updatedAt: now,
        });
      }
      const already = (data.workoutExercises as any[]).some(
        (we) => we.workoutId === STANDARD_WARMUP_WORKOUT_ID,
      );
      if (already) return;
      const exList = loadDemoExercises();
      let sortOrder = 0;
      for (const line of lines) {
        (data.workoutExercises as any[]).push({
          id: `demo-we-wu-std-${sortOrder}`,
          workoutId: STANDARD_WARMUP_WORKOUT_ID,
          exerciseId: line.exerciseId,
          sortOrder: sortOrder++,
          setScheme: line.setScheme,
          repPattern: line.repPattern,
          reps: line.reps,
          sets: line.sets,
          weightTier: line.weightTier,
          restSec: null,
          notes: line.notes,
          exercise: resolveDemoExercise(line.exerciseId, exList),
        });
      }
    });
    const after = await readStandardWarmupBlocks();
    return {
      workoutId: STANDARD_WARMUP_WORKOUT_ID,
      created: true,
      exerciseCount: after.length,
    };
  }

  await prisma.workout.upsert({
    where: { id: STANDARD_WARMUP_WORKOUT_ID },
    create: {
      id: STANDARD_WARMUP_WORKOUT_ID,
      name: "Standard warm-up",
      description:
        "Jeremy's default warm-up. Seeded onto new workouts. Members see these as one card.",
      source: "warmup",
    },
    update: {},
  });

  const current = await prisma.workoutExercise.count({
    where: { workoutId: STANDARD_WARMUP_WORKOUT_ID },
  });
  if (current === 0) {
    let sortOrder = 0;
    for (const line of lines) {
      await prisma.workoutExercise.create({
        data: {
          workoutId: STANDARD_WARMUP_WORKOUT_ID,
          exerciseId: line.exerciseId,
          sortOrder: sortOrder++,
          setScheme: line.setScheme,
          repPattern: line.repPattern,
          reps: line.reps,
          sets: line.sets,
          weightTier: line.weightTier,
          restSec: null,
          notes: line.notes,
        },
      });
    }
  }

  const after = await readStandardWarmupBlocks();
  return {
    workoutId: STANDARD_WARMUP_WORKOUT_ID,
    created: current === 0,
    exerciseCount: after.length,
  };
}

async function loadWarmupBlocks(
  blocks?: WarmupBlockTemplate[],
): Promise<WarmupBlockTemplate[]> {
  if (blocks?.length) return blocks;
  await ensureStandardWarmupWorkout();
  const fromWorkout = await readStandardWarmupBlocks();
  if (fromWorkout.length) return fromWorkout;
  try {
    const settings = await getCoachSettings();
    if (settings.warmupBlocks?.length) return settings.warmupBlocks;
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b }));
}

/**
 * Prepend coach Settings warm-up blocks when the workout has no standard warm-up.
 * Skips rest / day-off content. Existing main lifts stay; they are shifted down.
 */
export async function seedWarmupsIntoWorkout(
  workoutId: string,
  blocks?: WarmupBlockTemplate[],
): Promise<SeedWarmupsResult> {
  if (isStandardWarmupWorkoutId(workoutId)) {
    return formatResult({
      added: 0,
      missing: [],
      skipped: true,
      seeded: [],
      message: "This is the standard warm-up workout — edit its lines directly.",
    });
  }
  const resolvedBlocks = await loadWarmupBlocks(blocks);
  if (!resolvedBlocks.length) {
    return formatResult({ added: 0, missing: [], skipped: false, seeded: [] });
  }

  const { lines, missing } = await resolveBlocks(resolvedBlocks);
  if (!lines.length) {
    return formatResult({ added: 0, missing, skipped: false, seeded: [] });
  }

  if (isCoachCatalogDemo()) {
    return seedDemo(workoutId, lines, missing);
  }
  return seedDb(workoutId, lines, missing);
}

/** Load name + lines, skip rest/off, otherwise seed. */
export async function ensureWarmupsOnWorkout(
  workoutId: string,
  opts?: { optionLabel?: string | null },
): Promise<SeedWarmupsResult> {
  if (isCoachCatalogDemo()) {
    return seedWarmupsIntoWorkout(workoutId);
  }
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: {
      id: true,
      name: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  if (!workout) {
    return formatResult({ added: 0, missing: [], skipped: false, seeded: [] });
  }
  const exerciseNames = workout.exercises.map((we) => we.exercise?.name || "");
  if (
    isRestOrDayOffContent({
      workoutName: workout.name,
      optionLabel: opts?.optionLabel,
      exerciseNames,
    })
  ) {
    return formatResult({
      added: 0,
      missing: [],
      skipped: true,
      seeded: [],
      message: "Rest / day off — no warm-up.",
    });
  }
  return seedWarmupsIntoWorkout(workoutId);
}

async function seedDb(
  workoutId: string,
  lines: ResolvedLine[],
  missing: string[],
): Promise<SeedWarmupsResult> {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: {
      id: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  if (!workout) {
    return formatResult({ added: 0, missing, skipped: false, seeded: [] });
  }
  const existingNames = workout.exercises.map((we) => we.exercise?.name || "");
  const existingHasWarmup =
    workoutHasStandardWarmup(existingNames) ||
    workout.exercises.some(
      (we) =>
        notesMarkWarmup(we.notes || "") ||
        isStandardWarmupLineName(we.exercise?.name || ""),
    );
  if (existingHasWarmup) {
    return formatResult({
      added: 0,
      missing: [],
      skipped: true,
      seeded: [],
      message: "Warm-ups not added — workout already has a warm-up.",
    });
  }

  const shift = lines.length;
  if (workout.exercises.length > 0) {
    await prisma.$transaction(
      [...workout.exercises].reverse().map((we) =>
        prisma.workoutExercise.update({
          where: { id: we.id },
          data: { sortOrder: we.sortOrder + shift },
        }),
      ),
    );
  }

  const seeded: string[] = [];
  let sortOrder = 0;
  for (const line of lines) {
    await prisma.workoutExercise.create({
      data: {
        workoutId,
        exerciseId: line.exerciseId,
        sortOrder: sortOrder++,
        setScheme: line.setScheme,
        repPattern: line.repPattern,
        reps: line.reps,
        sets: line.sets,
        weightTier: line.weightTier,
        restSec: null,
        notes: line.notes,
      },
    });
    seeded.push(line.exerciseName);
  }

  return formatResult({
    added: seeded.length,
    missing,
    skipped: false,
    seeded,
  });
}

async function seedDemo(
  workoutId: string,
  lines: ResolvedLine[],
  missing: string[],
): Promise<SeedWarmupsResult> {
  await hydrateDemoExercises({ preferFresh: true });
  const exList = loadDemoExercises();
  let skipped = false;
  const seeded: string[] = [];

  await mutateDemoSeed((data) => {
    const workouts = (data.workouts as any[]) || [];
    if (!workouts.some((w) => w.id === workoutId)) return;
    if (!data.workoutExercises) data.workoutExercises = [];
    const existing = (data.workoutExercises as any[]).filter(
      (we) => we.workoutId === workoutId,
    );
    const existingNames = existing.map((we) => we.exercise?.name || we.blockName || "");
    const existingHasWarmup =
      workoutHasStandardWarmup(existingNames) ||
      existing.some(
        (we) =>
          notesMarkWarmup(String(we.notes || "")) ||
          isStandardWarmupLineName(String(we.exercise?.name || we.blockName || "")),
      );
    if (existingHasWarmup) {
      skipped = true;
      return;
    }

    const shift = lines.length;
    for (const we of existing) {
      we.sortOrder = (we.sortOrder ?? 0) + shift;
    }

    let sortOrder = 0;
    for (const line of lines) {
      (data.workoutExercises as any[]).push({
        id: `demo-we-wu-${Date.now()}-${sortOrder}`,
        workoutId,
        exerciseId: line.exerciseId,
        sortOrder: sortOrder++,
        setScheme: line.setScheme,
        repPattern: line.repPattern,
        reps: line.reps,
        sets: line.sets,
        weightTier: line.weightTier,
        restSec: null,
        notes: line.notes,
        exercise: resolveDemoExercise(line.exerciseId, exList),
      });
      seeded.push(line.exerciseName);
    }
  });

  return formatResult({
    added: skipped ? 0 : seeded.length,
    missing: skipped ? [] : missing,
    skipped,
    seeded: skipped ? [] : seeded,
  });
}
