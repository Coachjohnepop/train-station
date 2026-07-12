import "server-only";

import { canonicalExerciseName } from "@/lib/exercise-canonical";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import {
  createDemoExerciseId,
  hydrateDemoExercises,
  loadDemoExercises,
  saveDemoExercises,
} from "@/lib/demo-exercises";
import {
  matchExerciseInCatalog,
  sanitizeSmsExerciseName,
  type ExerciseCatalogEntry,
} from "@/lib/exercise-match";
import { hintVideoUrlForExerciseName } from "@/lib/exercise-video-hints";
import { prisma } from "@/lib/prisma";
import { NEWLY_ADDED_EXERCISE_TAG } from "@/lib/text-upload-exercises";

export type CatalogExercise = ExerciseCatalogEntry & {
  description?: string | null;
};

export async function loadExerciseCatalogForMatching(): Promise<CatalogExercise[]> {
  // Active only — archived exercises stay on past workouts (by id) but are not matched into new content.
  if (!isCoachCatalogDemo()) {
    return prisma.exercise.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, description: true, tags: true, videoUrl: true },
      orderBy: { name: "asc" },
    });
  }
  await hydrateDemoExercises({ preferFresh: true });
  return loadDemoExercises().filter((e: { archivedAt?: string | null }) => !e.archivedAt);
}

export async function loadExercisesByIds(
  ids: string[],
): Promise<Record<string, CatalogExercise>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  if (!isCoachCatalogDemo()) {
    const rows = await prisma.exercise.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, description: true, tags: true, videoUrl: true },
    });
    return Object.fromEntries(rows.map((row) => [row.id, row]));
  }

  await hydrateDemoExercises();
  const byId: Record<string, CatalogExercise> = {};
  for (const ex of loadDemoExercises()) {
    if (unique.includes(ex.id)) byId[ex.id] = ex;
  }
  return byId;
}

export async function resolveExerciseForWorkoutBlock(
  rawName: string,
  notes: string | undefined,
  catalog: CatalogExercise[],
): Promise<{ exercise: CatalogExercise; created: boolean; catalog: CatalogExercise[] }> {
  const displayName = sanitizeSmsExerciseName(rawName) || rawName.trim();
  const existing = matchExerciseInCatalog(displayName, catalog);
  if (existing) {
    return { exercise: existing, created: false, catalog };
  }

  const hintVideo = hintVideoUrlForExerciseName(displayName);
  const description =
    notes?.trim() || `Created from text upload (${new Date().toISOString().slice(0, 10)})`;

  if (!isCoachCatalogDemo()) {
    const created = await prisma.exercise.create({
      data: {
        name: canonicalExerciseName(displayName),
        description,
        tags: NEWLY_ADDED_EXERCISE_TAG,
        videoUrl: hintVideo,
      },
      select: { id: true, name: true, description: true, tags: true, videoUrl: true },
    });
    return { exercise: created, created: true, catalog: [...catalog, created] };
  }

  const created = {
    id: createDemoExerciseId(),
    name: displayName,
    description,
    tags: NEWLY_ADDED_EXERCISE_TAG,
    videoUrl: hintVideo,
  };
  const nextCatalog = [...catalog, created];
  await saveDemoExercises(nextCatalog);
  return { exercise: created, created: true, catalog: nextCatalog };
}