import { randomUUID } from "crypto";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import {
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
  createDemoExerciseId,
} from "@/lib/demo-exercises";
import {
  buildExercisesFromTextDb,
  buildProgramWeekFromTextDb,
  buildWorkoutFromParsedDb,
} from "@/lib/text-upload-build-db";
import { mutateDemoSeed, getDemoSeed } from "@/lib/demo-seed-store";
import { parseExerciseList, type ParsedExerciseLine } from "@/lib/exercise-list-parser";
import { parseProgramWeekText, type ParsedWeekDaySlot } from "@/lib/program-week-parser";
import { parseSmsWorkout, type ParsedSmsWorkout } from "@/lib/sms-workout-parser";
import { expandParsedWarmupExercises } from "@/lib/warmup-group";
import { NEWLY_ADDED_EXERCISE_TAG } from "@/lib/text-upload-exercises";
import { normalizeProgramSlug } from "@/lib/programs";
import { workoutContentTitle } from "@/lib/workout-content-name";

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchExercise(name: string, exercises: any[]): any | null {
  const target = normalizeName(name);
  const exact = exercises.find((e) => normalizeName(e.name) === target);
  if (exact) return exact;

  const keywords = target.split(" ").filter((w) => w.length > 3);
  let best: any = null;
  let bestScore = 0;
  for (const ex of exercises) {
    const en = normalizeName(ex.name);
    let score = 0;
    for (const kw of keywords) {
      if (en.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return bestScore >= Math.min(3, keywords.length) ? best : null;
}

function matchWorkoutByName(name: string, workouts: any[]): any | null {
  const target = normalizeName(name);
  const exact = workouts.find((w) => normalizeName(w.name) === target);
  if (exact) return exact;

  let best: any = null;
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

async function ensureExercise(name: string, notes?: string, tags?: string) {
  await hydrateDemoExercises();
  const exercises = loadDemoExercises();
  const existing = matchExercise(name, exercises);
  if (existing) return { exercise: existing, created: false };

  const created = {
    id: createDemoExerciseId(),
    name,
    description: notes || `Created from text upload (${new Date().toISOString().slice(0, 10)})`,
    tags: [tags, NEWLY_ADDED_EXERCISE_TAG].filter(Boolean).join(", ") || NEWLY_ADDED_EXERCISE_TAG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveDemoExercises([...exercises, created]);
  return { exercise: created, created: true };
}

export async function buildExercisesFromText(rawText: string) {
  if (!isCoachCatalogDemo()) {
    return buildExercisesFromTextDb(rawText);
  }

  const { exercises: lines } = parseExerciseList(rawText);
  if (lines.length === 0) {
    throw new Error("No exercises found — add one name per line.");
  }

  await hydrateDemoExercises();
  const existing = loadDemoExercises();
  const created: string[] = [];
  const skipped: string[] = [];
  const list = [...existing];

  for (const line of lines) {
    const match = matchExercise(line.name, list);
    if (match) {
      skipped.push(line.name);
      continue;
    }
    const ex = {
      id: createDemoExerciseId(),
      name: line.name.trim(),
      description: line.description?.trim() || `Created from text upload (${new Date().toISOString().slice(0, 10)})`,
      tags: line.tags?.trim() || NEWLY_ADDED_EXERCISE_TAG,
      videoUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.push(ex);
    created.push(ex.id);
  }

  if (created.length > 0) {
    await saveDemoExercises(list);
  }

  return {
    created: created.length,
    skipped: skipped.length,
    skippedNames: skipped,
    exerciseIds: created,
    total: lines.length,
  };
}

export async function buildSeedWorkoutFromParsed(
  parsed: ParsedSmsWorkout,
  workoutName?: string,
) {
  const name = workoutContentTitle(
    (workoutName || parsed.title || "Text upload workout").trim(),
  );
  const newExerciseIds: string[] = [];
  const workoutExercises: any[] = [];
  const workoutId = `w-upload-${Date.now()}`;

  for (const [idx, ex] of expandParsedWarmupExercises(parsed.exercises).entries()) {
    const { exercise, created } = await ensureExercise(ex.name, ex.notes);
    if (created) newExerciseIds.push(exercise.id);
    workoutExercises.push({
      id: `we-upload-${randomUUID().slice(0, 8)}`,
      workoutId,
      exerciseId: exercise.id,
      sortOrder: idx,
      setScheme: ex.setScheme || "standard",
      repPattern: null,
      reps: ex.reps,
      sets: ex.sets,
      weightTier: "medium",
      restSec: null,
      notes: [ex.notes, ex.section === "warmup" ? "Warm-up block" : null].filter(Boolean).join(" · ") || null,
      exercise,
    });
  }

  const now = new Date().toISOString();
  let reused = false;
  let resolvedId = workoutId;

  await mutateDemoSeed((seed) => {
    if (!seed.workouts) seed.workouts = [];
    if (!seed.workoutExercises) seed.workoutExercises = [];

    const existing = (seed.workouts as any[]).find(
      (w) => workoutContentTitle(w.name) === name,
    );
    if (existing) {
      reused = true;
      resolvedId = existing.id;
      existing.name = name;
      existing.description = "Updated from text upload";
      existing.updatedAt = now;
      seed.workoutExercises = (seed.workoutExercises as any[]).filter(
        (we) => we.workoutId !== existing.id,
      );
    } else {
      (seed.workouts as any[]).push({
        id: workoutId,
        name,
        description: "Created from text upload",
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const we of workoutExercises) {
      we.workoutId = resolvedId;
    }
    (seed.workoutExercises as any[]).push(...workoutExercises);
  });

  return {
    workoutId: resolvedId,
    workoutName: name,
    exerciseCount: parsed.exercises.length,
    newExerciseIds,
    reused,
  };
}

export async function buildWorkoutFromText(rawText: string, workoutName?: string) {
  const parsed = parseSmsWorkout(rawText);
  if (!isCoachCatalogDemo()) {
    return buildWorkoutFromParsedDb(parsed, workoutName);
  }
  return buildSeedWorkoutFromParsed(parsed, workoutName);
}

export async function buildProgramWeekFromText(
  rawText: string,
  programSlug: string,
  weekNumber: number,
) {
  if (!isCoachCatalogDemo()) {
    return buildProgramWeekFromTextDb(rawText, programSlug, weekNumber);
  }

  const { slots, warnings } = parseProgramWeekText(rawText);
  if (slots.length === 0) {
    throw new Error("No schedule lines parsed — use format like: M1D1 Gym: Upper body");
  }

  const seed = await getDemoSeed();
  const targetSlug = normalizeProgramSlug(programSlug);
  const program = (seed.programs as any[])?.find(
    (p) => p.slug === programSlug || normalizeProgramSlug(p.slug) === targetSlug,
  );
  if (!program) throw new Error(`Program "${programSlug}" not found`);

  const week = (seed.programWeeks as any[])?.find(
    (w) => w.programId === program.id && w.weekNumber === weekNumber,
  );
  if (!week) throw new Error(`Week ${weekNumber} not found in ${program.name}`);

  const days = ((seed.programDays as any[]) || [])
    .filter((d) => d.weekId === week.id)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const workouts = (seed.workouts as any[]) || [];
  const applied: Array<{ day: number; label: string; workoutName: string; workoutId: string }> = [];
  const unresolved: string[] = [];

  await mutateDemoSeed((data) => {
    if (!data.programDayOptions) data.programDayOptions = [];

    const byDay = new Map<number, ParsedWeekDaySlot[]>();
    for (const slot of slots) {
      if (!byDay.has(slot.dayNumber)) byDay.set(slot.dayNumber, []);
      byDay.get(slot.dayNumber)!.push(slot);
    }

    for (const [dayNumber, daySlots] of byDay) {
      const day = days.find((d) => d.dayNumber === dayNumber);
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

      data.programDayOptions = (data.programDayOptions as any[]).filter(
        (o) => o.dayId !== day.id,
      );

      options.forEach((opt, idx) => {
        (data.programDayOptions as any[]).push({
          id: `pdo-upload-${day.id}-${idx}-${Date.now()}`,
          dayId: day.id,
          workoutId: opt.workoutId,
          label: opt.label,
          sortOrder: idx,
        });
      });

      const dayIdx = (data.programDays as any[]).findIndex((d) => d.id === day.id);
      if (dayIdx >= 0) {
        const updated = { ...(data.programDays as any[])[dayIdx] };
        updated.workoutId = options[0].workoutId;
        (data.programDays as any[])[dayIdx] = updated;
      }
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
    programSlug,
    weekNumber,
    appliedCount: applied.length,
    applied,
    unresolved,
    warnings,
  };
}

export type TextUploadParseResult =
  | { mode: "exercises"; exercises: ParsedExerciseLine[] }
  | { mode: "workout"; workout: ParsedSmsWorkout }
  | {
      mode: "program-week";
      slots: ReturnType<typeof parseProgramWeekText>["slots"];
      warnings: string[];
    };

export function parseTextUpload(
  mode: "exercises" | "workout" | "program-week",
  rawText: string,
): TextUploadParseResult {
  if (mode === "exercises") {
    return { mode, ...parseExerciseList(rawText) };
  }
  if (mode === "workout") {
    return { mode, workout: parseSmsWorkout(rawText) };
  }
  const { slots, warnings } = parseProgramWeekText(rawText);
  return { mode, slots, warnings };
}