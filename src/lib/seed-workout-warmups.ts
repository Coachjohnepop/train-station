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
  type WarmupBlockTemplate,
} from "@/lib/warmup-template";

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
    notes: block.notes || (block.name.match(/warm|mobility|band/i) ? "Warm-up" : null),
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

function formatResult(r: Omit<SeedWarmupsResult, "message">): SeedWarmupsResult {
  if (r.skipped) {
    return {
      ...r,
      message: "Warm-ups not added — workout already has exercises.",
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

async function loadWarmupBlocks(
  blocks?: WarmupBlockTemplate[],
): Promise<WarmupBlockTemplate[]> {
  if (blocks?.length) return blocks;
  try {
    const settings = await getCoachSettings();
    if (settings.warmupBlocks?.length) return settings.warmupBlocks;
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b }));
}

/**
 * Prepend coach Settings warm-up blocks onto an empty workout.
 * No-op if the workout already has exercises (so deletes / clones stay intact).
 */
export async function seedWarmupsIntoWorkout(
  workoutId: string,
  blocks?: WarmupBlockTemplate[],
): Promise<SeedWarmupsResult> {
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

async function seedDb(
  workoutId: string,
  lines: ResolvedLine[],
  missing: string[],
): Promise<SeedWarmupsResult> {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true, _count: { select: { exercises: true } } },
  });
  if (!workout) {
    return formatResult({ added: 0, missing, skipped: false, seeded: [] });
  }
  if (workout._count.exercises > 0) {
    return formatResult({ added: 0, missing: [], skipped: true, seeded: [] });
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
    if (existing.length > 0) {
      skipped = true;
      return;
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
