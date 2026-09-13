import "server-only";

import { prisma } from "@/lib/prisma";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { canonicalExerciseName } from "@/lib/exercise-canonical";

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseByowNotes(rawText: string) {
  return parseSmsWorkout(rawText);
}

async function ensureByowExercise(ownerUserId: string, rawName: string, notes?: string) {
  const name = canonicalExerciseName(rawName) || rawName.trim();
  const target = normalizeName(name);
  const existing = await prisma.byowExercise.findMany({
    where: { ownerUserId },
    select: { id: true, name: true },
  });
  const hit = existing.find((e) => normalizeName(e.name) === target);
  if (hit) return hit.id;

  const created = await prisma.byowExercise.create({
    data: {
      ownerUserId,
      name,
      description: notes?.trim() || null,
      tags: "byow",
    },
    select: { id: true, name: true },
  });
  return created.id;
}

export async function buildByowWorkoutFromNotes(input: {
  ownerUserId: string;
  rawText: string;
  filename?: string | null;
}) {
  const parsed = parseSmsWorkout(input.rawText);
  if (parsed.exercises.length === 0) {
    throw new Error("No exercises found in that note. Put one move per line, then sets/reps under it.");
  }

  const workout = await prisma.byowWorkout.create({
    data: {
      ownerUserId: input.ownerUserId,
      name: parsed.title || "My workout",
      exportText: parsed.rawText,
      source: "notes",
    },
  });

  let sortOrder = 0;
  for (const line of parsed.exercises) {
    const exerciseId = await ensureByowExercise(
      input.ownerUserId,
      line.name,
      line.notes,
    );
    await prisma.byowWorkoutExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId,
        sortOrder,
        setScheme: line.setScheme || "standard",
        sets: line.sets || 3,
        reps: line.reps || "10",
        notes: line.notes || null,
      },
    });
    sortOrder += 1;
  }

  await prisma.byowSourceNote.create({
    data: {
      ownerUserId: input.ownerUserId,
      workoutId: workout.id,
      filename: input.filename?.trim() || null,
      rawText: parsed.rawText,
    },
  });

  return {
    workoutId: workout.id,
    name: workout.name,
    exerciseCount: parsed.exercises.length,
  };
}

export async function listByowWorkoutsForOwner(ownerUserId: string) {
  return prisma.byowWorkout.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { exercises: true } },
    },
  });
}

export async function listAllByowWorkouts() {
  return prisma.byowWorkout.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      ownerUserId: true,
      owner: { select: { name: true, email: true } },
      _count: { select: { exercises: true } },
    },
  });
}
