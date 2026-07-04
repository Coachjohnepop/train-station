import "server-only";

import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { matchExerciseInCatalog, sanitizeSmsExerciseName } from "@/lib/exercise-match";
import { hintVideoUrlForExerciseName } from "@/lib/exercise-video-hints";
import { prisma } from "@/lib/prisma";
import { normalizeProgramSlug } from "@/lib/programs";
import { syncProgramSchedule } from "@/lib/program-schedule";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";
import { parseProgramWeekText, type ParsedWeekDaySlot } from "@/lib/program-week-parser";
import { NEWLY_ADDED_EXERCISE_TAG } from "@/lib/text-upload-exercises";

type ExerciseRow = {
  id: string;
  name: string;
  description: string | null;
  tags: string | null;
  videoUrl: string | null;
};

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchWorkoutByName(name: string, workouts: Array<{ id: string; name: string }>) {
  const target = normalizeName(name);
  const exact = workouts.find((w) => normalizeName(w.name) === target);
  if (exact) return exact;

  let best: (typeof workouts)[number] | null = null;
  let bestScore = 0;
  for (const w of workouts) {
    const wn = normalizeName(w.name);
    if (wn.includes(target) || target.includes(wn)) {
      const score = Math.min(wn.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }
  }
  return best;
}

async function loadExerciseCatalog(): Promise<ExerciseRow[]> {
  return prisma.exercise.findMany({
    select: { id: true, name: true, description: true, tags: true, videoUrl: true },
    orderBy: { name: "asc" },
  });
}

async function ensureExerciseDb(
  rawName: string,
  notes: string | undefined,
  catalog: ExerciseRow[],
  extraTags?: string,
): Promise<{ exercise: ExerciseRow; created: boolean }> {
  const displayName = sanitizeSmsExerciseName(rawName) || rawName.trim();
  const existing = matchExerciseInCatalog(displayName, catalog);
  if (existing) {
    return {
      exercise: {
        id: existing.id,
        name: existing.name,
        description: existing.description ?? null,
        tags: (existing.tags as string | null) ?? null,
        videoUrl: existing.videoUrl ?? null,
      },
      created: false,
    };
  }

  const hintVideo = hintVideoUrlForExerciseName(displayName);
  const created = await prisma.exercise.create({
    data: {
      name: displayName,
      description:
        notes?.trim() ||
        `Created from text upload (${new Date().toISOString().slice(0, 10)})`,
      tags: [extraTags, NEWLY_ADDED_EXERCISE_TAG].filter(Boolean).join(", ") || NEWLY_ADDED_EXERCISE_TAG,
      videoUrl: hintVideo,
    },
    select: { id: true, name: true, description: true, tags: true, videoUrl: true },
  });
  catalog.push(created);
  return { exercise: created, created: true };
}

export async function buildExercisesFromTextDb(rawText: string) {
  const { parseExerciseList } = await import("@/lib/exercise-list-parser");
  const { exercises: lines } = parseExerciseList(rawText);
  if (lines.length === 0) {
    throw new Error("No exercises found — add one name per line.");
  }

  const catalog = await loadExerciseCatalog();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const line of lines) {
    const match = matchExerciseInCatalog(line.name, catalog);
    if (match) {
      skipped.push(line.name);
      continue;
    }
    const { exercise } = await ensureExerciseDb(
      line.name,
      line.description,
      catalog,
      line.tags?.trim(),
    );
    created.push(exercise.id);
  }

  return {
    created: created.length,
    skipped: skipped.length,
    skippedNames: skipped,
    exerciseIds: created,
    total: lines.length,
  };
}

export async function buildWorkoutFromParsedDb(
  parsed: ParsedSmsWorkout,
  workoutName?: string,
) {
  const name = (workoutName || parsed.title || "Text upload workout").trim();
  const catalog = await loadExerciseCatalog();
  const newExerciseIds: string[] = [];
  const items: Array<{
    exerciseId: string;
    sortOrder: number;
    setScheme: string;
    reps: string | null;
    sets: number | null;
    weightTier: string;
    notes: string | null;
  }> = [];

  for (const [idx, ex] of parsed.exercises.entries()) {
    const { exercise, created } = await ensureExerciseDb(ex.name, ex.notes, catalog);
    if (created) newExerciseIds.push(exercise.id);
    items.push({
      exerciseId: exercise.id,
      sortOrder: idx,
      setScheme: ex.setScheme || "standard",
      reps: ex.reps ?? null,
      sets: ex.sets ?? null,
      weightTier: "medium",
      notes:
        [ex.notes, ex.section === "warmup" ? "Warm-up block" : null]
          .filter(Boolean)
          .join(" · ") || null,
    });
  }

  const workout = await prisma.workout.create({
    data: {
      name,
      description: "Created from text upload",
      exercises: { create: items },
    },
    select: { id: true, name: true },
  });

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    exerciseCount: parsed.exercises.length,
    newExerciseIds,
  };
}

export async function buildProgramWeekFromTextDb(
  rawText: string,
  programSlug: string,
  weekNumber: number,
) {
  const { slots, warnings } = parseProgramWeekText(rawText);
  if (slots.length === 0) {
    throw new Error("No schedule lines parsed — use format like: Day 1 Gym: Upper Body Workout");
  }

  const targetSlug = normalizeProgramSlug(programSlug);
  let program = await prisma.program.findFirst({
    where: {
      OR: [{ slug: programSlug }, { slug: targetSlug }],
    },
    select: { id: true, name: true, durationWeeks: true, slug: true },
  });
  if (!program) throw new Error(`Program "${programSlug}" not found`);

  await syncProgramSchedule(program.id);

  const week = await prisma.programWeek.findUnique({
    where: {
      programId_weekNumber: { programId: program.id, weekNumber },
    },
    include: {
      days: { orderBy: { dayNumber: "asc" } },
    },
  });
  if (!week) throw new Error(`Week ${weekNumber} not found in ${program.name}`);

  const workouts = await prisma.workout.findMany({
    select: { id: true, name: true },
  });

  const applied: Array<{ day: number; label: string; workoutName: string; workoutId: string }> =
    [];
  const unresolved: string[] = [];

  const byDay = new Map<number, ParsedWeekDaySlot[]>();
  for (const slot of slots) {
    if (!byDay.has(slot.dayNumber)) byDay.set(slot.dayNumber, []);
    byDay.get(slot.dayNumber)!.push(slot);
  }

  await prisma.$transaction(async (tx) => {
    for (const [dayNumber, daySlots] of byDay) {
      const day = week.days.find((d) => d.dayNumber === dayNumber);
      if (!day) continue;

      const options: Array<{ workoutId: string; label: string }> = [];
      for (const slot of daySlots) {
        const workout = matchWorkoutByName(slot.workoutName, workouts);
        if (!workout) {
          unresolved.push(`${dayNumber} ${slot.label}: ${slot.workoutName}`);
          continue;
        }
        options.push({ workoutId: workout.id, label: slot.label });
        applied.push({
          day: dayNumber,
          label: slot.label,
          workoutName: workout.name,
          workoutId: workout.id,
        });
      }

      if (options.length === 0) continue;

      await tx.programDayOption.deleteMany({ where: { dayId: day.id } });
      await tx.programDayOption.createMany({
        data: options.map((opt, idx) => ({
          dayId: day.id,
          workoutId: opt.workoutId,
          label: opt.label,
          sortOrder: idx,
        })),
      });
      await tx.programDay.update({
        where: { id: day.id },
        data: { workoutId: options[0].workoutId },
      });
    }
  });

  if (applied.length === 0) {
    throw new Error(
      unresolved.length > 0
        ? `No workouts matched. Unresolved: ${unresolved.slice(0, 3).join("; ")}`
        : "Nothing was applied — check day numbers and workout names.",
    );
  }

  return {
    programSlug: program.slug,
    weekNumber,
    appliedCount: applied.length,
    applied,
    unresolved,
    warnings,
  };
}

/** Guard — callers should branch on isCoachCatalogDemo() before invoking DB helpers. */
export function assertDatabaseTextUpload() {
  if (isCoachCatalogDemo()) {
    throw new Error("Database text upload helpers require Postgres catalog mode.");
  }
}